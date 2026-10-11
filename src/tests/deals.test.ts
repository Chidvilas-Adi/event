import { describe, it, expect, beforeAll } from 'vitest';
import { runSeed } from '../../scripts/seed';
import { pool } from '../lib/db';
import { DealService } from '../lib/deals/service';
import { AuctionService } from '../lib/auctions/service';
import { LedgerService } from '../lib/ledger/service';

describe('Phase 2: Economy and Deals Engine', () => {
  beforeAll(async () => {
    await runSeed();
  });

  describe('Deal Templates and Versioned Lineage', () => {
    it('creates and counters a bilateral sale proposal with version incrementing (v1 -> v2)', async () => {
      // comp_swiftcart proposes to comp_ledgerly
      const createRes = await DealService.createDeal({
        templateType: 'sale',
        senderType: 'company',
        senderId: 'comp_swiftcart',
        recipientType: 'company',
        recipientId: 'comp_ledgerly',
        terms: { price: 3000, deliverable: 'Autonomous Flight Sensor Kit' },
        authoriser: 'vc_p_001',
      });

      expect(createRes.dealId).toBeDefined();

      const dealV1 = await DealService.getDeal(createRes.dealId);
      expect(dealV1).toBeDefined();
      expect(dealV1.version).toBe(1);
      expect(dealV1.status).toBe('proposed');

      // comp_ledgerly submits counter-offer (v2)
      const counterRes = await DealService.counterDeal({
        parentDealId: createRes.dealId,
        authoriserId: 'vc_p_010',
        updatedTerms: { price: 2500, deliverable: 'Autonomous Flight Sensor Kit + 10 Batteries' },
        reason: 'Price adjustment counter-offer',
      });

      expect(counterRes.version).toBe(2);

      // Verify parent deal status is now 'countered'
      const oldDeal = await DealService.getDeal(createRes.dealId);
      expect(oldDeal.status).toBe('countered');

      // Verify new child deal has v2 and is 'proposed'
      const childDeal = await DealService.getDeal(counterRes.dealId);
      expect(childDeal.version).toBe(2);
      expect(childDeal.parent_deal_id).toBe(createRes.dealId);
      expect(childDeal.status).toBe('proposed');
      expect(childDeal.terms.price).toBe(2500);
    });

    it('atomically accepts a counter-offer, transfers funds via ledger, and creates active contract', async () => {
      // Find the v2 deal from above
      const dealsRes = await pool.query<{ id: string; terms: any }>(
        "SELECT id, terms FROM deals WHERE LOWER(template_type) = 'sale' AND version = 2 AND status = 'proposed' LIMIT 1"
      );
      const v2Deal = dealsRes.rows[0];
      expect(v2Deal).toBeDefined();

      // Check balances before
      // In this deal: comp_swiftcart is seller (+2500), comp_ledgerly is buyer (-2500)
      const aetherBalBefore = await LedgerService.getBalance('company', 'comp_swiftcart');
      const kavachBalBefore = await LedgerService.getBalance('company', 'comp_ledgerly');

      // Accept deal
      const acceptRes = await DealService.acceptDeal(v2Deal.id, 'vc_p_001', false);
      expect(acceptRes.success).toBe(true);
      expect(acceptRes.contractId).toBeDefined();

      // Check balances after
      const aetherBalAfter = await LedgerService.getBalance('company', 'comp_swiftcart');
      const kavachBalAfter = await LedgerService.getBalance('company', 'comp_ledgerly');

      expect(aetherBalAfter).toBe(aetherBalBefore + 2500);
      expect(kavachBalAfter).toBe(kavachBalBefore - 2500);

      // Verify contract row created in db
      const contractRes = await pool.query('SELECT * FROM contracts WHERE id = $1', [acceptRes.contractId]);
      expect(contractRes.rows.length).toBe(1);
      expect(contractRes.rows[0].status).toBe('active');
    });
  });

  describe('Apex Reserve Bank Lending Pool and 1-Loan Constraint', () => {
    it('approves a bank loan within 80,000 VB pool and enforces max 1 open loan per company', async () => {
      // 1. Check initial Bank lending pool config
      const instRes = await pool.query<{ config: any }>("SELECT config FROM institutions WHERE id = 'bank'");
      const initialPool = instRes.rows[0].config.lending_pool_remaining;
      expect(initialPool).toBe(80000);

      // 2. comp_prana requests 15,000 VB loan from bank
      const loanDealRes = await DealService.createDeal({
        templateType: 'loan',
        senderType: 'company',
        senderId: 'comp_prana',
        recipientType: 'institution',
        recipientId: 'bank',
        terms: {
          principal: 15000,
          interest_rate_percent: 10,
          duration_ticks: 8,
          collateral: 'Biotech IP Portfolio',
        },
        authoriser: 'vc_p_019',
      });

      const pranaBalBefore = await LedgerService.getBalance('company', 'comp_prana');

      // 3. Bank accepts loan
      const acceptRes = await DealService.acceptDeal(loanDealRes.dealId, 'op_bank', false);
      expect(acceptRes.success).toBe(true);

      // Verify prana received 15,000 VB in ledger
      const pranaBalAfter = await LedgerService.getBalance('company', 'comp_prana');
      expect(pranaBalAfter).toBe(pranaBalBefore + 15000);

      // Verify Bank lending pool remaining decreased from 80k to 65k
      const instAfter = await pool.query<{ config: any }>("SELECT config FROM institutions WHERE id = 'bank'");
      expect(instAfter.rows[0].config.lending_pool_remaining).toBe(65000);

      // Verify active loan record created
      const loanRow = await pool.query('SELECT * FROM loans WHERE company_id = $1 AND status = $2', [
        'comp_prana',
        'active',
      ]);
      expect(loanRow.rows.length).toBe(1);
      expect(loanRow.rows[0].principal).toBe(15000);

      // 4. Verify STRICT 1-loan per company enforcement:
      // comp_prana attempts to take a SECOND loan while one is already open
      const secondLoanDeal = await DealService.createDeal({
        templateType: 'loan',
        senderType: 'company',
        senderId: 'comp_prana',
        recipientType: 'institution',
        recipientId: 'bank',
        terms: {
          principal: 5000,
          interest_rate_percent: 10,
        },
        authoriser: 'vc_p_019',
      });

      await expect(
        DealService.acceptDeal(secondLoanDeal.dealId, 'op_bank', false)
      ).rejects.toThrow(/Company already has an open loan/);
    });
  });

  describe('Frontier Venture Fund (140,000 VB Fund & Max 7 Deals)', () => {
    it('executes equity investment deal, enforces 140k fund limit, and dilutes cap table atomically', async () => {
      // comp_nxtgrid pitches for 20,000 VB investment for 10% equity
      const investDealRes = await DealService.createDeal({
        templateType: 'investment',
        senderType: 'company',
        senderId: 'comp_nxtgrid',
        recipientType: 'institution',
        recipientId: 'investor',
        terms: {
          amount: 20000,
          equity_percent: 10.0,
          pre_money_valuation: 180000,
          rights: { board_observer: true, info_rights: true },
        },
        authoriser: 'vc_p_028',
      });

      const nxtgridBalBefore = await LedgerService.getBalance('company', 'comp_nxtgrid');

      // Investor accepts deal
      const acceptRes = await DealService.acceptDeal(investDealRes.dealId, 'op_investor', false);
      expect(acceptRes.success).toBe(true);

      // Verify funds transferred
      const nxtgridBalAfter = await LedgerService.getBalance('company', 'comp_nxtgrid');
      expect(nxtgridBalAfter).toBe(nxtgridBalBefore + 20000);

      // Verify Investor fund remaining decreased from 140,000 to 120,000
      const fundRes = await pool.query<{ config: any }>("SELECT config FROM institutions WHERE id = 'investor'");
      expect(fundRes.rows[0].config.fund_size_remaining).toBe(120000);
      expect(fundRes.rows[0].config.investments_completed).toBe(1);

      // Verify Cap Table was atomically diluted:
      // In seed: Founder was 60%, Employee was 25%, Reserve was 15%.
      // After 10% dilution, existing holders are scaled by (100 - 10)/100 = 0.9:
      // Founder -> 60 * 0.9 = 54%
      // Employee -> 25 * 0.9 = 22.5%
      // Reserve -> 15 * 0.9 = 13.5%
      // Investor -> 10.0%
      // Total sum = 54 + 22.5 + 13.5 + 10.0 = 100.0%
      const capRows = await pool.query<{ shareholder_type: string; shares_or_percent: string }>(
        'SELECT shareholder_type, shares_or_percent FROM cap_table WHERE company_id = $1 ORDER BY shares_or_percent DESC',
        ['comp_nxtgrid']
      );

      const totalShares = capRows.rows.reduce((sum, r) => sum + parseFloat(r.shares_or_percent), 0);
      expect(Math.round(totalShares)).toBe(100);

      const investorShare = capRows.rows.find((r) => r.shareholder_type === 'investor');
      expect(investorShare).toBeDefined();
      expect(parseFloat(investorShare!.shares_or_percent)).toBe(10.0);
    });
  });

  describe('Competitive Auctions Engine', () => {
    it('creates an auction, accepts verified bids, and settles atomically to highest bidder', async () => {
      // 1. comp_vayu creates auction for rare space sensor payload
      const auction = await AuctionService.createAuction({
        title: 'Micro-Satellite Sub-orbital Payload Slot',
        itemType: 'payload_slot',
        itemData: { orbit: 'LEO', mass_kg: 25 },
        sellerType: 'company',
        sellerId: 'comp_vayu',
        reservePrice: 5000,
        authoriserId: 'vc_p_046',
      });

      expect(auction.id).toBeDefined();
      expect(auction.status).toBe('active');

      // 2. comp_samudra bids 6,000 VB
      const bid1 = await AuctionService.placeBid({
        auctionId: auction.id,
        bidderType: 'company',
        bidderId: 'comp_samudra',
        amount: 6000,
      });
      expect(bid1.amount).toBe(6000);

      // 3. comp_quantum outbids with 8,000 VB
      const bid2 = await AuctionService.placeBid({
        auctionId: auction.id,
        bidderType: 'company',
        bidderId: 'comp_quantum',
        amount: 8000,
      });
      expect(bid2.amount).toBe(8000);

      // Verify lower bid rejected
      await expect(
        AuctionService.placeBid({
          auctionId: auction.id,
          bidderType: 'company',
          bidderId: 'comp_samudra',
          amount: 7000,
        })
      ).rejects.toThrow(/must exceed current high bid/);

      // 4. Settle auction
      const vayuBalBefore = await LedgerService.getBalance('company', 'comp_vayu');
      const quantumBalBefore = await LedgerService.getBalance('company', 'comp_quantum');

      const settlement = await AuctionService.settleAuction(auction.id, 'op_admin');
      expect(settlement.winnerId).toBe('comp_quantum');
      expect(settlement.winningAmount).toBe(8000);

      // Verify atomic ledger transfer between winner and seller
      const vayuBalAfter = await LedgerService.getBalance('company', 'comp_vayu');
      const quantumBalAfter = await LedgerService.getBalance('company', 'comp_quantum');

      expect(vayuBalAfter).toBe(vayuBalBefore + 8000);
      expect(quantumBalAfter).toBe(quantumBalBefore - 8000);

      // Verify auction marked settled
      const settledAuction = await AuctionService.getAuction(auction.id);
      expect(settledAuction.status).toBe('settled');
    });
  });
});
