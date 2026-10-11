import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { createSessionToken, hashPassword, UserSession } from '@/lib/auth/session';
import { checkRateLimit } from '@/lib/auth/policy';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
    const rate = checkRateLimit(`login_${ip}`, 20, 60);
    if (!rate.allowed) {
      return NextResponse.json({ error: 'RATE_LIMITED: Too many login attempts. Please wait.' }, { status: 429 });
    }

    const body = await req.json();
    const { loginType = 'participant' } = body;

    if (loginType === 'participant') {
      const { citizenCode, eventCode } = body;
      if (!citizenCode || !eventCode) {
        return NextResponse.json({ error: 'Citizen Code and Event Code are required.' }, { status: 400 });
      }

      const normalizedCode = citizenCode.trim().toUpperCase();
      const normalizedEvent = eventCode.trim().toUpperCase();

      // Find participant by citizen_code or id
      const res = await pool.query(
        `SELECT p.*, m.company_id, m.role as company_role
         FROM participants p
         LEFT JOIN memberships m ON p.id = m.participant_id AND m.status = 'active'
         WHERE (UPPER(p.citizen_code) = $1 OR UPPER(p.id) = $1)
         LIMIT 1`,
        [normalizedCode]
      );

      if (res.rows.length === 0) {
        // Fallback: check if an operator username was entered in the primary entry form
        const opRes = await pool.query(
          'SELECT * FROM operator_accounts WHERE LOWER(username) = LOWER($1) AND is_active = TRUE',
          [citizenCode.trim()]
        );
        if (opRes.rows.length > 0) {
          const op = opRes.rows[0];
          const hashed = hashPassword(eventCode.trim());
          if (op.password_hash === hashed) {
            const sessionData: UserSession = {
              userId: op.id,
              role: op.role_id,
              name: op.name,
              institutionId: op.institution_id || null,
              isElevated: true,
            };
            const token = await createSessionToken(sessionData);
            await logAuthAttempt(op.id, op.role_id, true, `Operator ${op.role_id} authenticated via primary entry`);
            const response = NextResponse.json({ success: true, user: sessionData });
            response.cookies.set('vc_session', token, {
              httpOnly: true,
              sameSite: 'lax',
              path: '/',
              maxAge: 86400,
            });
            return response;
          }
        }
        await logAuthAttempt('unknown', 'participant', false, 'Participant code not found');
        return NextResponse.json({ error: 'Citizen Code not found.' }, { status: 401 });
      }

      const p = res.rows[0];
      if (p.event_code.toUpperCase() !== normalizedEvent) {
        await logAuthAttempt(p.id, 'participant', false, 'Invalid event code');
        return NextResponse.json({ error: 'Invalid Event Code.' }, { status: 401 });
      }

      const isFounder = p.company_role && (
        p.company_role.toLowerCase().includes('founder') ||
        p.company_role.toLowerCase().includes('ceo')
      );
      const role = isFounder ? 'company_lead' : 'participant';
      const sessionData: UserSession = {
        userId: p.id,
        role,
        name: p.name,
        citizenCode: p.citizen_code,
        companyId: p.company_id || null,
        companyRole: p.company_role,
        isElevated: false,
      };

      const token = await createSessionToken(sessionData);
      await logAuthAttempt(p.id, role, true, 'Citizen logged in');

      const response = NextResponse.json({
        success: true,
        user: sessionData,
      });

      response.cookies.set('vc_session', token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 86400,
      });

      return response;
    }

    if (loginType === 'operator') {
      const { username, password, totpCode } = body;
      if (!username || !password) {
        return NextResponse.json({ error: 'Username and password required.' }, { status: 400 });
      }

      const res = await pool.query(
        'SELECT * FROM operator_accounts WHERE username = $1 AND is_active = TRUE',
        [username.trim().toLowerCase()]
      );

      if (res.rows.length === 0) {
        await logAuthAttempt(username, 'operator', false, 'Operator not found');
        return NextResponse.json({ error: 'Invalid operator credentials.' }, { status: 401 });
      }

      const op = res.rows[0];
      const hashed = hashPassword(password);
      if (op.password_hash !== hashed) {
        await logAuthAttempt(op.id, op.role_id, false, 'Invalid password');
        return NextResponse.json({ error: 'Invalid operator credentials.' }, { status: 401 });
      }

      // Elevated MFA check for GM & Admin
      if ((op.role_id === 'gm' || op.role_id === 'admin') && op.totp_secret) {
        if (!totpCode || totpCode.trim() !== op.totp_secret) {
          await logAuthAttempt(op.id, op.role_id, false, 'Invalid one-time code');
          return NextResponse.json({ error: 'Elevated verification code required.' }, { status: 401 });
        }
      }

      const sessionData: UserSession = {
        userId: op.id,
        role: op.role_id,
        name: op.name,
        institutionId: op.institution_id || null,
        isElevated: true,
      };

      const token = await createSessionToken(sessionData);
      await logAuthAttempt(op.id, op.role_id, true, `Operator ${op.role_id} authenticated`);

      const response = NextResponse.json({
        success: true,
        user: sessionData,
      });

      response.cookies.set('vc_session', token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 86400,
      });

      return response;
    }

    return NextResponse.json({ error: 'Invalid login type.' }, { status: 400 });
  } catch (err: any) {
    console.error('Login error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

async function logAuthAttempt(actorId: string, role: string, success: boolean, reason: string) {
  try {
    const auditId = `aud_auth_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    await pool.query(
      `INSERT INTO audit_log (
        id, timestamp, actor_id, actor_role, action, object_type, object_id, reason, source
      ) VALUES ($1, NOW(), $2, $3, $4, 'auth', $2, $5, 'api_login')`,
      [auditId, actorId, role, success ? 'AUTH_SUCCESS' : 'AUTH_FAILED', reason]
    );
  } catch (err) {
    console.error('Audit log failed during login:', err);
  }
}
