import { pool, withTransaction } from '../db';
import { LedgerService } from '../ledger/service';
import { eventBus } from '../events/bus';
import crypto from 'crypto';

export class AuctionService {
  /**
   * Create an auction for resources, broadcast licenses, or customer tenders.
   */
  static async createAuction(params: {
    itemType?: string;
    title: string;
    description?: string;
    startingBid?: number;
    reservePrice?: number;
    sellerType?: string;
    sellerId?: string;
    durationMinutes?: number;
    itemData?: any;
    authoriserId?: string;
  }): Promise<{ id: string; auctionId: string; status: string }> {
    const itemType = params.itemType || 'asset';
    const title = params.title;
    const description = params.description || title || 'Standard Auction Lot';
    const startingBid = params.startingBid ?? params.reservePrice ?? 1000;
    const sellerType = params.sellerType || 'system';
    const sellerId = params.sellerId || 'system';
    const durationMinutes = params.durationMinutes ?? 30;

    const auctionId = `auc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const endsAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    await pool.query(
      `INSERT INTO auctions (
        id, item_type, title, description, seller_type, seller_id, starting_bid, current_bid, status, ends_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, 'active', $8)`,
      [auctionId, itemType, title, description, sellerType, sellerId, startingBid, endsAt]
    );

    eventBus.broadcast('auction_created', { auctionId, title, startingBid });

    return { id: auctionId, auctionId, status: 'active' };
  }

  /**
   * Place a bid on an auction. Verifies bidder balance and checks if bid exceeds current highest bid.
   */
  static async placeBid(
    auctionIdOrParams: string | { auctionId: string; bidderType?: string; bidderId: string; amount: number },
    bidderIdParam?: string,
    bidAmountParam?: number
  ): Promise<{ amount: number }> {
    let auctionId: string;
    let bidderId: string;
    let bidAmount: number;

    if (typeof auctionIdOrParams === 'object') {
      auctionId = auctionIdOrParams.auctionId;
      bidderId = auctionIdOrParams.bidderId;
      bidAmount = auctionIdOrParams.amount;
    } else {
      auctionId = auctionIdOrParams;
      bidderId = bidderIdParam!;
      bidAmount = bidAmountParam!;
    }

    if (!Number.isInteger(bidAmount) || bidAmount <= 0) {
      throw new Error('INVALID_BID: Bid must be a positive integer.');
    }

    await withTransaction(async (client) => {
      // 1. Lock auction row
      const aucRes = await client.query('SELECT * FROM auctions WHERE id = $1 FOR UPDATE', [auctionId]);
      if (aucRes.rows.length === 0) throw new Error('AUCTION_NOT_FOUND');

      const auc = aucRes.rows[0];
      if (auc.status !== 'active') {
        throw new Error(`AUCTION_CLOSED: Auction is currently ${auc.status}.`);
      }

      if (bidAmount <= auc.current_bid) {
        throw new Error(`BID_TOO_LOW: Bid of ${bidAmount} VB must exceed current high bid (${auc.current_bid} VB).`);
      }

      // 2. Check bidder balance (participant or company)
      const isCompany = bidderId.startsWith('comp_');
      const entityType = isCompany ? 'company' : 'participant';
      const balance = await LedgerService.getBalance(entityType, bidderId);
      if (balance < bidAmount) {
        throw new Error(`INSUFFICIENT_FUNDS: Current balance is ${balance} VB, required ${bidAmount} VB to bid.`);
      }

      // 3. Append bid to history and update high bidder
      const existingBids = auc.bids || [];
      const newBidEntry = {
        bidder_id: bidderId,
        amount: bidAmount,
        timestamp: new Date().toISOString(),
      };
      existingBids.push(newBidEntry);

      await client.query(
        `UPDATE auctions SET
          current_bid = $1,
          highest_bidder_id = $2,
          bids = $3
         WHERE id = $4`,
        [bidAmount, bidderId, JSON.stringify(existingBids), auctionId]
      );

      // Audit log
      const auditId = `aud_auc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (
          id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
        ) VALUES ($1, NOW(), $2, 'bidder', 'AUCTION_BID_PLACED', 'auctions', $3, $4, 'auction_service')`,
        [auditId, bidderId, auctionId, `Placed bid of ${bidAmount} VB`]
      );

      eventBus.broadcast('auction_bid_placed', { auctionId, bidderId, amount: bidAmount });
    });

    return { amount: bidAmount };
  }

  /**
   * Settle an auction atomically: debits winner, credits seller (if non-system),
   * assigns asset, marks auction settled.
   */
  static async settleAuction(auctionId: string, authoriserId: string): Promise<{ winnerId: string; winningBid: number; winningAmount: number }> {
    return await withTransaction(async (client) => {
      const aucRes = await client.query('SELECT * FROM auctions WHERE id = $1 FOR UPDATE', [auctionId]);
      if (aucRes.rows.length === 0) throw new Error('AUCTION_NOT_FOUND');

      const auc = aucRes.rows[0];
      if (auc.status === 'settled') throw new Error('ALREADY_SETTLED');

      if (!auc.highest_bidder_id) {
        // No bids placed: close auction with no winner
        await client.query("UPDATE auctions SET status = 'closed', settled_at = NOW() WHERE id = $1", [auctionId]);
        return { winnerId: 'none', winningBid: 0, winningAmount: 0 };
      }

      const winnerId = auc.highest_bidder_id;
      const winningBid = auc.current_bid;
      const isCompany = winnerId.startsWith('comp_');
      const winnerType = isCompany ? 'company' : 'participant';

      // 1. Debit winner
      await client.query(
        `INSERT INTO ledger_entries (
          id, timestamp, from_type, from_id, to_type, to_id, amount, type, reason, authoriser, linked_transaction_id
        ) VALUES ($1, NOW(), $2, $3, $4, $5, $6, 'transfer', $7, $8, $9)`,
        [
          `ledg_auc_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`,
          winnerType,
          winnerId,
          auc.seller_type || 'system',
          auc.seller_id === 'system' ? null : auc.seller_id,
          winningBid,
          `Auction Settlement: ${auc.title}`,
          authoriserId,
          auctionId,
        ]
      );

      // 2. Mark auction settled
      await client.query(
        "UPDATE auctions SET status = 'settled', winner_id = $1, settled_at = NOW() WHERE id = $2",
        [winnerId, auctionId]
      );

      // 3. Audit log
      const auditId = `aud_auc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      await client.query(
        `INSERT INTO audit_log (
          id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
        ) VALUES ($1, NOW(), $2, 'gm', 'AUCTION_SETTLED', 'auctions', $3, $4, 'auction_service')`,
        [auditId, authoriserId, auctionId, `Settled auction to ${winnerId} for ${winningBid} VB`]
      );

      eventBus.broadcast('auction_settled', { auctionId, winnerId, winningBid });

      return { winnerId, winningBid, winningAmount: winningBid };
    });
  }

  /**
   * Retrieves an auction by ID.
   */
  static async getAuction(auctionId: string): Promise<any> {
    const res = await pool.query('SELECT * FROM auctions WHERE id = $1', [auctionId]);
    return res.rows[0] || null;
  }

  /**
   * List all active or recent auctions.
   */
  static async listAuctions(): Promise<any[]> {
    const res = await pool.query('SELECT * FROM auctions ORDER BY created_at DESC LIMIT 30');
    return res.rows;
  }
}
