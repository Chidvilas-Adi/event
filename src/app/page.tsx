import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifySessionToken } from '@/lib/auth/session';

export default async function IndexPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('vc_session')?.value;

  if (token) {
    const session = await verifySessionToken(token);
    if (session) {
      if (session.role === 'gm' || session.role === 'admin' || session.role === 'event_lead') {
        redirect('/gm');
      } else {
        redirect('/portal');
      }
    }
  }

  redirect('/login');
}
