import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth/get-user';
import { LedgerService } from '@/lib/ledger/service';
import { pool } from '@/lib/db';

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }

  let walletBalance = 0;
  let companyData = null;
  let pendingCount = 0;

  if (user.role === 'participant' || user.role === 'company_lead') {
    walletBalance = await LedgerService.getBalance('participant', user.userId);

    // Get pending transactions in inbox
    const pendingRes = await pool.query<{ count: string }>(
      "SELECT COUNT(*) FROM transactions WHERE recipient_id = $1 AND status = 'pending_confirmation'",
      [user.userId]
    );
    pendingCount = parseInt(pendingRes.rows[0]?.count || '0', 10);

    // Get company role from active membership
    const memRes = await pool.query(
      "SELECT role FROM memberships WHERE participant_id = $1 AND status = 'active' LIMIT 1",
      [user.userId]
    );
    const companyRole = memRes.rows[0]?.role || user.companyRole || (user.role === 'company_lead' ? 'Founder & CEO' : 'Independent Free Agent');

    // Get company details if associated
    if (user.companyId) {
      const compRes = await pool.query(
        'SELECT id, name, tagline, status, tier FROM companies WHERE id = $1',
        [user.companyId]
      );
      if (compRes.rows.length > 0) {
        const comp = compRes.rows[0];
        const compBalance = await LedgerService.getBalance('company', user.companyId);
        companyData = {
          ...comp,
          balance: compBalance,
        };
      }
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        ...user,
        walletBalance,
        company: companyData,
        companyRole,
        pendingCount,
      },
    });
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      ...user,
      walletBalance: 0,
      company: null,
      companyRole: user.role === 'gm' ? 'Game Master' : user.role === 'admin' ? 'Tech Admin' : user.role,
      pendingCount: 0,
    },
  });
}
