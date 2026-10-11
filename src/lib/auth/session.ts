import { SignJWT, jwtVerify } from 'jose';
import crypto from 'crypto';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'venture_city_super_secret_jwt_key_2026_at_least_32_characters_long'
);

export interface UserSession {
  userId: string;
  role: 'gm' | 'admin' | 'event_lead' | 'volunteer' | 'observer' | 'company_lead' | 'participant';
  name: string;
  citizenCode?: string;
  companyId?: string | null;
  companyRole?: string;
  institutionId?: string | null;
  isElevated: boolean; // True for GM / Admin with verified credentials
}

export async function createSessionToken(session: UserSession): Promise<string> {
  return await new SignJWT({ ...session })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(JWT_SECRET);
}

export async function verifySessionToken(token: string): Promise<UserSession | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as UserSession;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}
