import { NextRequest } from 'next/server';
import { verifySessionToken, UserSession } from './session';

export async function getUserFromRequest(request: NextRequest): Promise<UserSession | null> {
  // Check cookie
  const cookie = request.cookies.get('vc_session')?.value;
  if (cookie) {
    const session = await verifySessionToken(cookie);
    if (session) return session;
  }

  // Check Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const session = await verifySessionToken(token);
    if (session) return session;
  }

  return null;
}
