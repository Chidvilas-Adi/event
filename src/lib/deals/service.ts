import { pool, withTransaction } from '../db';
import { LedgerService } from '../ledger/service';
import { eventBus } from '../events/bus';
import crypto from 'crypto';

export type DealTemplateType =
  | 'Sale'
  | 'Employment'
  | 'Freelance'
  | 'ResourceTrade'
  | 'Loan'
  | 'Investment'
  | 'Grant'
  | 'Acquisition'
  | 'Merger'
  | 'SpinOut'
  | 'InformationTrade';

export interface CreateDealParams {
  templateType: DealTemplateType | string;
  senderType: 'participant' | 'company' | 'institution';
  senderId: string;
  recipientType: 'participant' | 'company' | 'institution';
  recipientId: string;
  terms: Record<string, any>;
  authoriser: string;
}

export class DealService {
  /**
   * Normalizes template type string to official PascalCase enum.
   */
  static normalizeTemplate(t: string): DealTemplateType {
    const clean = (t || '').toLowerCase().replace(/[-_]/g, '');
    const map: Record<string, DealTemplateType> = {
      sale: 'Sale',
      employment: 'Employment',
      freelance: 'Freelance',
      resourcetrade: 'ResourceTrade',
      loan: 'Loan',
      investment: 'Investment',
      grant: 'Grant',
      acquisition: 'Acquisition',
      merger: 'Merger',
      spinout: 'SpinOut',
      informationtrade: 'InformationTrade',
    };
    return map[clean] || (t as DealTemplateType);
  }

  /**
   * Normalizes terms attributes (e.g. price -> price_vb, principal -> principal_vb).
   */
  static normalizeTerms(templateType: DealTemplateType, terms: Record<string, any>): Record<string, any> {
    const t = { ...(terms || {}) };
    switch (templateType) {
      case 'Sale':
        if (!t.item) t.item = t.deliverable || t.description || 'Deliverable Item';
        if (t.quantity === undefined) t.quantity = 1;
        if (t.price_vb === undefined) t.price_vb = t.price ?? t.payment_vb ?? 0;
        break;
      case 'Loan':
        if (t.principal_vb === undefined) t.principal_vb = t.principal ?? 0;
        if (t.interest_rate_percent === undefined) t.interest_rate_percent = 10;
        break;
      case 'Investment':
        if (t.amount_vb === undefined) t.amount_vb = t.amount ?? 0;
        if (t.equity_percent === undefined) t.equity_percent = t.equity ?? 10;
        break;
      case 'Grant':
        if (t.amount_vb === undefined) t.amount_vb = t.amount ?? t.grant_amount_vb ?? 0;
        if (!t.purpose) t.purpose = t.title || t.deliverable || 'Civic Non-Dilutive Grant';
        break;
      case 'ResourceTrade':
        if (!t.resource_id) t.resource_id = t.resource_type || t.resource;
        if (t.quantity === undefined) t.quantity = 1;
        if (t.payment_vb === undefined) t.payment_vb = t.price_per_unit ? t.price_per_unit * t.quantity : (t.price ?? t.amount_vb ?? 0);
        break;
      case 'Freelance':
        if (!t.deliverable) t.deliverable = t.scope || t.description || 'Specialist Contract';
        if (t.fee_vb === undefined) t.fee_vb = t.rate ?? t.price ?? t.fee ?? 0;
        break;
      case 'Employment':
        if (!t.role) t.role = t.role_title || 'Operator';
        if (t.salary_per_tick_vb === undefined) t.salary_per_tick_vb = t.salary ?? 100;
        break;
      case 'Acquisition':
        if (t.payment_vb === undefined) t.payment_vb = t.price ?? t.amount_vb ?? 0;
        break;
      case 'InformationTrade':
        if (!t.description) t.description = t.intel_scope || 'Market telemetry';
        if (t.price_vb === undefined) t.price_vb = t.price ?? 0;
        if (!t.permitted_use) t.permitted_use = 'internal_only';
        break;
    }
    return t;
  }

  /**
   * Validates required fields for each deal template according to Section 4 specifications.
   */
  static validateTemplateFields(templateType: DealTemplateType, terms: Record<string, any>): void {
    const norm = this.normalizeTerms(templateType, terms);
    switch (templateType) {
      case 'Sale':
        if (!norm.item || norm.quantity === undefined || !norm.price_vb) {
          throw new Error('MISSING_FIELDS: Sale template requires item, quantity, and price_vb.');
        }
        break;

      case 'Employment':
        if (!norm.role || !norm.salary_per_tick_vb) {
          throw new Error('MISSING_FIELDS: Employment template requires role and salary_per_tick_vb.');
        }
        break;

      case 'Freelance':
        if (!norm.deliverable || !norm.fee_vb) {
          throw new Error('MISSING_FIELDS: Freelance template requires deliverable and fee_vb.');
        }
        break;

      case 'ResourceTrade':
        if (!norm.resource_id || !norm.quantity || !norm.payment_vb) {
          throw new Error('MISSING_FIELDS: Resource trade requires resource_id, quantity, and payment_vb.');
        }
        break;

      case 'Loan':
        if (!norm.principal_vb || norm.interest_rate_percent === undefined) {
          throw new Error('MISSING_FIELDS: Loan requires principal_vb and interest_rate_percent.');
        }
        break;

      case 'Investment':
        if (!norm.amount_vb || norm.equity_percent === undefined) {
          throw new Error('MISSING_FIELDS: Investment requires amount_vb and equity_percent.');
        }
        break;

      case 'Acquisition':
        if (!norm.payment_vb) {
          throw new Error('MISSING_FIELDS: Acquisition requires payment_vb.');
        }
        break;

      case 'Merger':
        if (!norm.ownership_structure) {
          throw new Error('MISSING_FIELDS: Merger requires ownership_structure.');
        }
        break;

      case 'SpinOut':
        if (!norm.team_lead_id || !norm.assets_moved) {
          throw new Error('MISSING_FIELDS: Spin-out requires team_lead_id and assets_moved.');
        }
        break;

      case 'InformationTrade':
        if (!norm.description || !norm.price_vb || !norm.permitted_use) {
          throw new Error('MISSING_FIELDS: Information trade requires description, price_vb, and permitted_use.');
        }
        break;

      default:
        throw new Error(`UNKNOWN_TEMPLATE: Unsupported deal template ${templateType}`);
    }
  }

  /**
   * Creates a deal proposal and sends it straight to the recipient's inbox.
   */
  static async createDeal(params: CreateDealParams): Promise<{ dealId: string }> {
    const { templateType, senderType, senderId, recipientType, recipientId, terms, authoriser } = params;

    const normType = this.normalizeTemplate(templateType);
    const normTerms = this.normalizeTerms(normType, terms);

    // Validate fields
    this.validateTemplateFields(normType, normTerms);

    if (senderId === recipientId && senderType === recipientType) {
      throw new Error('INVALID_COUNTERPARTY: Counterparty cannot be yourself.');
    }

    const dealId = `deal_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    return await withTransaction(async (client) => {
      // Check world freeze
      const worldRes = await client.query<{ is_frozen: boolean }>(
        'SELECT is_frozen FROM world_state WHERE id = $1',
        ['default']
      );
      if (worldRes.rows[0]?.is_frozen) {
        throw new Error('WORLD_IS_FROZEN: Simulation is frozen. Deal proposals locked.');
      }

      await client.query(
        `INSERT INTO deals (
          id, template_type, sender_type, sender_id, recipient_type, recipient_id, version, terms, status
        ) VALUES ($1, $2, $3, $4, $5, $6, 1, $7, 'proposed')`,
        [dealId, normType, senderType, senderId, recipientType, recipientId, JSON.stringify(normTerms)]
      );

      // Create notification for recipient
      const notifId = `notif_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const title = `New ${templateType} Deal Proposal`;
      const desc = terms.title || terms.item || terms.deliverable || `Proposal from ${senderId}`;

      // Notify recipient
      await client.query(
        `INSERT INTO notifications (
          id, recipient_id, type, title, message, payload
        ) VALUES ($1, $2, 'deal_proposal', $3, $4, $5)`,
        [notifId, recipientId, title, `Incoming proposal: "${desc}"`, JSON.stringify({ dealId, templateType, senderId })]
      );

      // Audit log
      const auditId = `aud_deal_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (
          id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
        ) VALUES ($1, NOW(), $2, 'citizen', 'DEAL_PROPOSAL_CREATED', 'deals', $3, $4, 'deal_service')`,
        [auditId, authoriser, dealId, `Created ${templateType} proposal to ${recipientId}`]
      );

      eventBus.broadcast('deal_created', { dealId, templateType, senderId, recipientId });

      return { dealId };
    });
  }

  /**
   * Counter a deal. Marks parent deal as 'countered', creates version N+1 pointing to parent.
   * Swaps sender and recipient so the revised terms go back to counterparty.
   */
  static async counterDeal(params: {
    parentDealId: string;
    authoriserId: string;
    updatedTerms: Record<string, any>;
    reason: string;
  }): Promise<{ dealId: string; version: number }> {
    const { parentDealId, authoriserId, updatedTerms, reason } = params;

    return await withTransaction(async (client) => {
      const parentRes = await client.query('SELECT * FROM deals WHERE id = $1 FOR UPDATE', [parentDealId]);
      if (parentRes.rows.length === 0) throw new Error('DEAL_NOT_FOUND');

      const parent = parentRes.rows[0];
      if (parent.status !== 'pending' && parent.status !== 'proposed') {
        throw new Error(`CANNOT_COUNTER: Deal is already in status "${parent.status}".`);
      }

      // Mark parent as countered
      await client.query("UPDATE deals SET status = 'countered', updated_at = NOW() WHERE id = $1", [parentDealId]);

      // Create counter deal (swapping sender and recipient)
      const newVersion = (parent.version || 1) + 1;
      const counterDealId = `deal_${Date.now()}_v${newVersion}_${crypto.randomBytes(2).toString('hex')}`;

      // Merge terms and preserve original roles
      const normChildTerms = this.normalizeTerms(parent.template_type as DealTemplateType, updatedTerms);
      const mergedTerms = {
        ...parent.terms,
        ...normChildTerms,
        counter_notes: reason,
      };
      if (!mergedTerms.seller_id) mergedTerms.seller_id = parent.sender_id;
      if (!mergedTerms.buyer_id) mergedTerms.buyer_id = parent.recipient_id;

      await client.query(
        `INSERT INTO deals (
          id, template_type, sender_type, sender_id, recipient_type, recipient_id, version, parent_deal_id, terms, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'proposed')`,
        [
          counterDealId,
          parent.template_type,
          parent.recipient_type, // Now sender
          parent.recipient_id,
          parent.sender_type, // Now recipient
          parent.sender_id,
          newVersion,
          parentDealId,
          JSON.stringify(mergedTerms),
        ]
      );

      // Audit log
      const auditId = `aud_deal_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (
          id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, related_record_id, source
        ) VALUES ($1, NOW(), $2, 'citizen', 'DEAL_COUNTERED', 'deals', $3, $4, $5, 'deal_service')`,
        [auditId, authoriserId, counterDealId, `Counter-offer version ${newVersion}: ${reason}`, parentDealId]
      );

      eventBus.broadcast('deal_countered', { dealId: counterDealId, parentDealId, version: newVersion });

      return { dealId: counterDealId, version: newVersion };
    });
  }

  /**
   * Reject a deal proposal.
   */
  static async rejectDeal(dealId: string, authoriserId: string, reason = 'Declined by counterparty'): Promise<void> {
    await withTransaction(async (client) => {
      const dealRes = await client.query('SELECT * FROM deals WHERE id = $1 FOR UPDATE', [dealId]);
      if (dealRes.rows.length === 0) throw new Error('DEAL_NOT_FOUND');

      const deal = dealRes.rows[0];
      if (deal.status !== 'pending') {
        throw new Error(`CANNOT_REJECT: Deal is already in status "${deal.status}".`);
      }

      await client.query(
        "UPDATE deals SET status = 'rejected', rejection_reason = $1, updated_at = NOW() WHERE id = $2",
        [reason, dealId]
      );

      // Audit log
      const auditId = `aud_deal_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (
          id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
        ) VALUES ($1, NOW(), $2, 'citizen', 'DEAL_REJECTED', 'deals', $3, $4, 'deal_service')`,
        [auditId, authoriserId, dealId, reason]
      );

      eventBus.broadcast('deal_rejected', { dealId, authoriserId });
    });
  }

  /**
   * Accepts a deal proposal. Commits ALL financial, resource, loan, or equity changes
   * atomically in one step, enforces institutional limits, creates signed contract receipt.
   */
  static async acceptDeal(dealId: string, authoriserId: string, isGmOverride = false): Promise<{ success: boolean; contractId: string }> {
    return await withTransaction(async (client) => {
      // 1. Lock deal row
      const dealRes = await client.query('SELECT * FROM deals WHERE id = $1 FOR UPDATE', [dealId]);
      if (dealRes.rows.length === 0) throw new Error('DEAL_NOT_FOUND');

      const deal = dealRes.rows[0];
      if (deal.status !== 'pending' && deal.status !== 'proposed') {
        throw new Error(`CANNOT_ACCEPT: Deal is already "${deal.status}".`);
      }

      // 2. Check world freeze
      const worldRes = await client.query<{ is_frozen: boolean }>(
        'SELECT is_frozen FROM world_state WHERE id = $1',
        ['default']
      );
      if (worldRes.rows[0]?.is_frozen && !isGmOverride) {
        throw new Error('WORLD_IS_FROZEN: Simulation is frozen. Deal acceptance locked.');
      }

      const terms = deal.terms;
      const template = deal.template_type as DealTemplateType;

      // 3. Template-specific execution logic & hard limits enforcement
      switch (template) {
        case 'Sale': {
          const price = parseInt(terms.price_vb || terms.price || terms.amount_vb || terms.amount || '0', 10);
          if (price > 0) {
            // Recipient pays sender (or sender pays recipient based on buyer/seller)
            const buyerType = terms.buyer_type || deal.recipient_type;
            const buyerId = terms.buyer_id || deal.recipient_id;
            const sellerType = terms.seller_type || deal.sender_type;
            const sellerId = terms.seller_id || deal.sender_id;

            // Check buyer balance with advisory lock inside current transaction
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [buyerId]);
            const buyerBalRes = await client.query<{ balance: string }>(
              `SELECT
                COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE to_type = $1 AND to_id = $2), 0) -
                COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE from_type = $1 AND from_id = $2), 0) AS balance`,
              [buyerType, buyerId]
            );
            const buyerBal = parseInt(buyerBalRes.rows[0]?.balance || '0', 10);
            if (buyerBal < price) {
              throw new Error(`INSUFFICIENT_FUNDS: Buyer ${buyerId} has ${buyerBal} VB, required ${price} VB.`);
            }

            // Transfer VB
            await client.query(
              `INSERT INTO ledger_entries (
                id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser, linked_transaction_id
              ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, 'transfer', $7, $8, $9)`,
              [
                `ledg_sale_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
                buyerType,
                buyerId,
                sellerType,
                sellerId,
                price,
                `Sale Contract Payment: ${terms.item || terms.title || 'Commercial deliverable'} (Qty: ${terms.quantity || 1})`,
                authoriserId,
                dealId,
              ]
            );
          }
          break;
        }

        case 'ResourceTrade': {
          const payment = parseInt(terms.payment_vb || terms.payment || terms.price_vb || terms.price || terms.amount || '0', 10);
          const resourceId = terms.resource_id || terms.resource_type;
          const qty = parseInt(terms.quantity, 10);
          const buyerId = terms.buyer_id || deal.recipient_id;
          const buyerType = terms.buyer_type || deal.recipient_type;
          const sellerId = terms.seller_id || deal.sender_id;
          const sellerType = terms.seller_type || deal.sender_type;

          // Check buyer cash with advisory lock
          if (payment > 0) {
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [buyerId]);
            const buyerBalRes = await client.query<{ balance: string }>(
              `SELECT
                COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE to_type = $1 AND to_id = $2), 0) -
                COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE from_type = $1 AND from_id = $2), 0) AS balance`,
              [buyerType, buyerId]
            );
            const buyerBal = parseInt(buyerBalRes.rows[0]?.balance || '0', 10);
            if (buyerBal < payment) {
              throw new Error(`INSUFFICIENT_FUNDS: Buyer has ${buyerBal} VB, required ${payment} VB.`);
            }

            // Move money
            await client.query(
              `INSERT INTO ledger_entries (
                id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser, linked_transaction_id
              ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, 'transfer', $7, $8, $9)`,
              [
                `ledg_res_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
                buyerType,
                buyerId,
                sellerType,
                sellerId,
                payment,
                `Resource Trade: ${qty} units of ${resourceId}`,
                authoriserId,
                dealId,
              ]
            );
          }

          // Move resource (Debit seller, credit buyer)
          await client.query(
            `INSERT INTO resource_ledger (id, timestamp, resource_id, owner_type, owner_id, quantity, reason, authoriser)
             VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7)`,
            [
              `res_out_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
              resourceId,
              sellerType,
              sellerId,
              -qty,
              `Resource Trade Delivery to ${buyerId}`,
              authoriserId,
            ]
          );

          await client.query(
            `INSERT INTO resource_ledger (id, timestamp, resource_id, owner_type, owner_id, quantity, reason, authoriser)
             VALUES ($1, NOW(), $2, $3, $4, $5, $6, $7)`,
            [
              `res_in_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
              resourceId,
              buyerType,
              buyerId,
              qty,
              `Resource Trade Received from ${sellerId}`,
              authoriserId,
            ]
          );
          break;
        }

        case 'Loan': {
          // Bank lending limits enforcement (80,000 VB pool for N=10, max 1 open loan)
          let companyId = terms.borrower_id || terms.company_id || (deal.sender_type === 'company' ? deal.sender_id : deal.recipient_id);
          if (!companyId || !companyId.startsWith('comp_')) {
            const memRes = await client.query(
              "SELECT company_id FROM memberships WHERE participant_id = $1 AND status = 'active'",
              [deal.recipient_id]
            );
            if (memRes.rows.length > 0) {
              companyId = memRes.rows[0].company_id;
            }
          }

          const compCheck = await client.query('SELECT id FROM companies WHERE id = $1', [companyId]);
          if (compCheck.rows.length === 0) {
            throw new Error(`COMPANY_NOT_FOUND: Company ${companyId} does not exist in registry. Loans can only be issued to registered venture companies.`);
          }

          const principal = parseInt(terms.principal_vb || terms.principal || '0', 10);
          const interestPercent = parseInt(terms.interest_rate_percent || '10', 10);
          const repaymentTotal = Math.round(principal * (1 + interestPercent / 100));

          // 1. Check open loans limit (Max 1 open loan per company)
          const openLoansRes = await client.query(
            "SELECT COUNT(*) as count FROM loans WHERE company_id = $1 AND status = 'active'",
            [companyId]
          );
          const openLoans = parseInt(openLoansRes.rows[0]?.count || '0', 10);
          if (openLoans >= 1 && !isGmOverride) {
            throw new Error(`LOAN_LIMIT_EXCEEDED: Company already has an open loan. Bank credit policy allows max 1 open loan per venture.`);
          }

          // 2. Check Bank lending pool remaining capacity
          const bankRes = await client.query('SELECT config FROM institutions WHERE id = $1 FOR UPDATE', ['bank']);
          const bankConfig = bankRes.rows[0]?.config || {};
          const remainingPool = bankConfig.lending_pool_remaining ?? bankConfig.lending_pool_total ?? 80000;

          if (principal > remainingPool && !isGmOverride) {
            throw new Error(`LENDING_POOL_EXHAUSTED: Requested ${principal} VB exceeds Bank lending pool remaining (${remainingPool} VB).`);
          }

          // Deduct from lending pool
          bankConfig.lending_pool_remaining = remainingPool - principal;
          await client.query('UPDATE institutions SET config = $1, updated_at = NOW() WHERE id = $2', [
            JSON.stringify(bankConfig),
            'bank',
          ]);

          // Credit company treasury from Bank
          await client.query(
            `INSERT INTO ledger_entries (
              id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser, linked_transaction_id
            ) VALUES ($1, NOW(), 'institution', 'bank', 'company', $2, $3, 'credit', $4, $5, $6)`,
            [
              `ledg_loan_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
              companyId,
              principal,
              `Bank Loan Principal Disbursed: ${principal} VB @ ${interestPercent}% interest`,
              authoriserId,
              dealId,
            ]
          );

          // Insert into loans table
          const loanId = `loan_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
          await client.query(
            `INSERT INTO loans (
              id, company_id, lender_id, principal, interest_rate_percent, repayment_total, amount_repaid, status
            ) VALUES ($1, $2, 'bank', $3, $4, $5, 0, 'active')`,
            [loanId, companyId, principal, interestPercent, repaymentTotal]
          );
          break;
        }

        case 'Investment': {
          // Investor Fund limits (140,000 VB fund size, max 7 deals for N=10)
          let companyId = terms.company_id || (deal.sender_type === 'company' ? deal.sender_id : deal.recipient_id);
          if (!companyId || !companyId.startsWith('comp_')) {
            const memRes = await client.query(
              "SELECT company_id FROM memberships WHERE participant_id = $1 AND status = 'active'",
              [deal.recipient_id]
            );
            if (memRes.rows.length > 0) {
              companyId = memRes.rows[0].company_id;
            }
          }

          const compCheck = await client.query('SELECT id FROM companies WHERE id = $1', [companyId]);
          if (compCheck.rows.length === 0) {
            throw new Error(`COMPANY_NOT_FOUND: Company ${companyId} does not exist in registry. Investments can only be made into registered venture companies.`);
          }

          const amount = parseInt(terms.amount_vb || terms.amount || '0', 10);
          const equityPercent = parseFloat(terms.equity_percent || terms.equity || '10');

          // 1. Check Investor Fund status
          const fundRes = await client.query('SELECT config FROM institutions WHERE id = $1 FOR UPDATE', ['investor']);
          const fundConfig = fundRes.rows[0]?.config || {};
          const remainingFund = fundConfig.fund_size_remaining ?? fundConfig.total_fund_size ?? fundConfig.fund_size_total ?? 140000;
          const dealsCount = fundConfig.investments_completed ?? fundConfig.deals_completed ?? 0;
          const maxDeals = fundConfig.max_investments ?? fundConfig.max_investments_count ?? 7;

          if (dealsCount >= maxDeals && !isGmOverride) {
            throw new Error(`INVESTOR_DEAL_LIMIT_EXCEEDED: Investor Syndicate has reached maximum portfolio cap of ${maxDeals} deals.`);
          }

          if (amount > remainingFund && !isGmOverride) {
            throw new Error(`FUND_SIZE_EXHAUSTED: Investment amount ${amount} VB exceeds remaining fund size (${remainingFund} VB).`);
          }

          // Update investor fund config
          fundConfig.fund_size_remaining = remainingFund - amount;
          fundConfig.investments_completed = dealsCount + 1;
          fundConfig.deals_completed = dealsCount + 1;
          await client.query('UPDATE institutions SET config = $1, updated_at = NOW() WHERE id = $2', [
            JSON.stringify(fundConfig),
            'investor',
          ]);

          // Credit company treasury from Investor
          await client.query(
            `INSERT INTO ledger_entries (
              id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser, linked_transaction_id
            ) VALUES ($1, NOW(), 'institution', 'investor', 'company', $2, $3, 'credit', $4, $5, $6)`,
            [
              `ledg_inv_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
              companyId,
              amount,
              `Syndicate Equity Investment: ${amount} VB for ${equityPercent}% Equity`,
              authoriserId,
              dealId,
            ]
          );

          // Insert into investments table
          const invId = `inv_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
          await client.query(
            `INSERT INTO investments (
              id, investor_id, company_id, amount, equity_percent, terms, status
            ) VALUES ($1, 'investor', $2, $3, $4, $5, 'active')`,
            [invId, companyId, amount, equityPercent, JSON.stringify(terms)]
          );

          // Dilute existing shareholders proportionally
          await client.query(
            `UPDATE cap_table SET shares_or_percent = ROUND((shares_or_percent * (100.0 - $1) / 100.0)::numeric, 2)
             WHERE company_id = $2`,
            [equityPercent, companyId]
          );

          // Update Cap Table: Allocate equity to investor
          const capId = `cap_${companyId}_investor_${Date.now()}`;
          await client.query(
            `INSERT INTO cap_table (
              id, company_id, shareholder_type, shareholder_id, shares_or_percent, rights
            ) VALUES ($1, $2, 'investor', 'investor', $3, $4)`,
            [capId, companyId, equityPercent, JSON.stringify({ board_observer: true, information_rights: true })]
          );
          break;
        }

        case 'Grant': {
          const grantAmount = parseInt(terms.amount_vb || terms.amount || terms.price_vb || '0', 10);
          if (grantAmount > 0) {
            // Deduct from government grant pool if government is grantor
            if (deal.sender_id === 'government' || deal.sender_type === 'institution') {
              const govRes = await client.query('SELECT config FROM institutions WHERE id = $1 FOR UPDATE', ['government']);
              const govConfig = govRes.rows[0]?.config || {};
              const remainingPool = govConfig.grant_pool_remaining ?? govConfig.grant_pool_total ?? 30000;
              if (grantAmount > remainingPool && !isGmOverride) {
                throw new Error(`GRANT_POOL_EXHAUSTED: Grant amount ${grantAmount} VB exceeds Government grant pool remaining (${remainingPool} VB).`);
              }
              govConfig.grant_pool_remaining = Math.max(0, remainingPool - grantAmount);
              await client.query('UPDATE institutions SET config = $1, updated_at = NOW() WHERE id = $2', [
                JSON.stringify(govConfig),
                'government',
              ]);
            }

            await client.query(
              `INSERT INTO ledger_entries (
                id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser, linked_transaction_id
              ) VALUES ($1, NOW(), 'institution', 'government', $2, $3, $4, 'grant', $5, $6, $7)`,
              [
                `ledg_grnt_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
                deal.recipient_type,
                deal.recipient_id,
                grantAmount,
                `Civic Grant Disbursed: ${terms.purpose || 'Civic Development Grant'}`,
                authoriserId,
                dealId,
              ]
            );
          }
          break;
        }

        case 'Freelance':
        case 'Employment': {
          const fee = parseInt(terms.fee_vb || terms.fee || terms.salary_per_tick_vb || terms.salary || terms.price_vb || terms.price || terms.amount || '0', 10);
          if (fee > 0) {
            const payerId = deal.sender_id;
            const payerType = deal.sender_type;
            const payeeId = deal.recipient_id;
            const payeeType = deal.recipient_type;

            // Check payer balance with advisory lock inside current transaction
            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [payerId]);
            const payerBalRes = await client.query<{ balance: string }>(
              `SELECT
                COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE to_type = $1 AND to_id = $2), 0) -
                COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE from_type = $1 AND from_id = $2), 0) AS balance`,
              [payerType, payerId]
            );
            const payerBal = parseInt(payerBalRes.rows[0]?.balance || '0', 10);
            if (payerBal < fee) {
              throw new Error(`INSUFFICIENT_FUNDS: Employer/Client has ${payerBal} VB, required ${fee} VB.`);
            }

            await client.query(
              `INSERT INTO ledger_entries (
                id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser, linked_transaction_id
              ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, 'transfer', $7, $8, $9)`,
              [
                `ledg_srv_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
                payerType,
                payerId,
                payeeType,
                payeeId,
                fee,
                `${template} Agreement Compensation: ${terms.deliverable || terms.role || 'Service delivery'}`,
                authoriserId,
                dealId,
              ]
            );
          }
          break;
        }

        case 'InformationTrade': {
          const price = parseInt(terms.price_vb || terms.price || terms.amount_vb || terms.amount || '0', 10);
          if (price > 0) {
            const buyerId = deal.recipient_id;
            const buyerType = deal.recipient_type;
            const sellerId = deal.sender_id;
            const sellerType = deal.sender_type;

            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [buyerId]);
            const buyerBalRes = await client.query<{ balance: string }>(
              `SELECT
                COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE to_type = $1 AND to_id = $2), 0) -
                COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE from_type = $1 AND from_id = $2), 0) AS balance`,
              [buyerType, buyerId]
            );
            const buyerBal = parseInt(buyerBalRes.rows[0]?.balance || '0', 10);
            if (buyerBal < price) {
              throw new Error(`INSUFFICIENT_FUNDS: Buyer has ${buyerBal} VB, required ${price} VB.`);
            }

            await client.query(
              `INSERT INTO ledger_entries (
                id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser, linked_transaction_id
              ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, 'transfer', $7, $8, $9)`,
              [
                `ledg_info_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
                buyerType,
                buyerId,
                sellerType,
                sellerId,
                price,
                `Information Trade: ${terms.description || 'Intel dossier'} (Permitted Use: ${terms.permitted_use || 'Operational'})`,
                authoriserId,
                dealId,
              ]
            );
          }
          break;
        }

        case 'Acquisition':
        case 'Merger': {
          const purchasePrice = parseInt(terms.purchase_price_vb || terms.price_vb || terms.price || terms.amount_vb || terms.amount || '0', 10);
          if (purchasePrice > 0) {
            const buyerId = deal.sender_id;
            const buyerType = deal.sender_type;
            const sellerId = deal.recipient_id;
            const sellerType = deal.recipient_type;

            await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [buyerId]);
            const buyerBalRes = await client.query<{ balance: string }>(
              `SELECT
                COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE to_type = $1 AND to_id = $2), 0) -
                COALESCE((SELECT SUM(amount) FROM ledger_entries WHERE from_type = $1 AND from_id = $2), 0) AS balance`,
              [buyerType, buyerId]
            );
            const buyerBal = parseInt(buyerBalRes.rows[0]?.balance || '0', 10);
            if (buyerBal < purchasePrice) {
              throw new Error(`INSUFFICIENT_FUNDS: Acquirer has ${buyerBal} VB, required ${purchasePrice} VB.`);
            }

            await client.query(
              `INSERT INTO ledger_entries (
                id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser, linked_transaction_id
              ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, 'transfer', $7, $8, $9)`,
              [
                `ledg_ma_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
                buyerType,
                buyerId,
                sellerType,
                sellerId,
                purchasePrice,
                `${template} Transaction Consideration: ${terms.notes || 'Corporate asset purchase'}`,
                authoriserId,
                dealId,
              ]
            );
          }
          break;
        }

        default:
          break;
      }

      // 4. Update deal state to accepted
      await client.query(
        "UPDATE deals SET status = 'accepted', executed_at = NOW(), updated_at = NOW() WHERE id = $1",
        [dealId]
      );

      // 5. Create formal contract record
      const contractId = `ct_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await client.query(
        `INSERT INTO contracts (id, deal_id, type, terms, status, signed_at)
         VALUES ($1, $2, $3, $4, 'active', NOW())`,
        [contractId, dealId, template, JSON.stringify(terms)]
      );

      // 6. Audit log
      const auditId = `aud_deal_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (
          id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, related_record_id, source
        ) VALUES ($1, NOW(), $2, 'citizen', 'DEAL_EXECUTED_CONTRACT_SIGNED', 'contracts', $3, $4, $5, 'deal_service')`,
        [auditId, authoriserId, contractId, `Accepted and committed ${template} deal in atomic step`, dealId]
      );

      eventBus.broadcast('deal_accepted', { dealId, contractId, template });

      return { success: true, contractId };
    });
  }

  /**
   * Retrieves a deal and its version lineage.
   */
  static async getDeal(dealId: string): Promise<any> {
    const res = await pool.query('SELECT * FROM deals WHERE id = $1', [dealId]);
    return res.rows[0] || null;
  }

  /**
   * List all deals for an entity.
   */
  static async listDealsForEntity(entityId: string): Promise<any[]> {
    const res = await pool.query(
      `SELECT d.*, c.name as company_name, p.name as sender_name, rp.name as recipient_name
       FROM deals d
       LEFT JOIN companies c ON d.sender_id = c.id OR d.recipient_id = c.id
       LEFT JOIN participants p ON d.sender_id = p.id
       LEFT JOIN participants rp ON d.recipient_id = rp.id
       WHERE d.sender_id = $1 OR d.recipient_id = $1
       ORDER BY d.created_at DESC LIMIT 50`,
      [entityId]
    );
    return res.rows;
  }
}
