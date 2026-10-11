import { NextRequest } from 'next/server';
import { GET as getSession } from '../src/app/api/auth/session/route';
import { POST as postLogin } from '../src/app/api/auth/login/route';
import { GET as getTransfer } from '../src/app/api/ledger/transfer/route';
import { GET as getAnnouncements } from '../src/app/api/announcements/route';
import { GET as getWorldClock } from '../src/app/api/world/clock/route';
import { GET as getCompanies } from '../src/app/api/companies/route';
import { GET as getMissions } from '../src/app/api/missions/route';
import { GET as getOpportunities } from '../src/app/api/opportunities/route';
import { GET as getDisputes } from '../src/app/api/disputes/route';
import { GET as getDeals } from '../src/app/api/deals/route';
import { createSessionToken } from '../src/lib/auth/session';

async function run() {
  console.log('--- Testing Endpoints for /portal ---');

  // 1. Participant login (VC-002)
  console.log('\n[1] Testing Login for VC-002:');
  const loginReq = new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ loginType: 'participant', citizenCode: 'VC-002', eventCode: 'VC2026' }),
  });
  const loginRes = await postLogin(loginReq);
  console.log('Login status:', loginRes.status);
  const loginData = await loginRes.json();
  console.log('Login body:', loginData);
  const cookieHeader = loginRes.headers.get('set-cookie');
  console.log('Set-Cookie:', cookieHeader);

  // Extract session token
  const tokenMatch = cookieHeader?.match(/vc_session=([^;]+)/);
  const token = tokenMatch ? tokenMatch[1] : '';

  // 2. Testing Session with VC-002 token
  console.log('\n[2] Testing /api/auth/session with VC-002 token:');
  const sessReq = new NextRequest('http://localhost:3000/api/auth/session', {
    headers: { cookie: `vc_session=${token}` },
  });
  const sessRes = await getSession(sessReq);
  console.log('Session status:', sessRes.status);
  const sessData = await sessRes.json();
  console.log('Session body:', sessData);

  // 3. Testing /api/ledger/transfer
  console.log('\n[3] Testing GET /api/ledger/transfer:');
  const txReq = new NextRequest('http://localhost:3000/api/ledger/transfer', {
    headers: { cookie: `vc_session=${token}` },
  });
  const txRes = await getTransfer(txReq);
  console.log('Transfer status:', txRes.status);
  const txData = await txRes.json();
  console.log('Transactions count:', txData.transactions?.length, 'Ledger count:', txData.ledgerEntries?.length);

  // 4. Testing GET /api/announcements
  console.log('\n[4] Testing GET /api/announcements:');
  const annReq = new NextRequest('http://localhost:3000/api/announcements', {
    headers: { cookie: `vc_session=${token}` },
  });
  const annRes = await getAnnouncements(annReq);
  console.log('Announcements status:', annRes.status);
  const annData = await annRes.json();
  console.log('Announcements count:', Array.isArray(annData) ? annData.length : 'Not an array: ' + JSON.stringify(annData));

  // 5. Testing GET /api/world/clock
  console.log('\n[5] Testing GET /api/world/clock:');
  const clockRes = await getWorldClock();
  console.log('World Clock status:', clockRes.status);
  const clockData = await clockRes.json();
  console.log('World Clock data:', clockData);

  // 6. Testing GET /api/companies
  console.log('\n[6] Testing GET /api/companies:');
  const compReq = new NextRequest('http://localhost:3000/api/companies', {
    headers: { cookie: `vc_session=${token}` },
  });
  const compRes = await getCompanies(compReq);
  console.log('Companies status:', compRes.status);
  const compData = await compRes.json();
  console.log('Companies count:', compData.companies?.length);

  // 7. Testing GET /api/missions
  console.log('\n[7] Testing GET /api/missions:');
  const missReq = new NextRequest('http://localhost:3000/api/missions', {
    headers: { cookie: `vc_session=${token}` },
  });
  const missRes = await getMissions(missReq);
  console.log('Missions status:', missRes.status);
  const missData = await missRes.json();
  console.log('Missions count:', missData.missions?.length);

  // 8. Testing GET /api/opportunities
  console.log('\n[8] Testing GET /api/opportunities:');
  const oppReq = new NextRequest('http://localhost:3000/api/opportunities', {
    headers: { cookie: `vc_session=${token}` },
  });
  const oppRes = await getOpportunities(oppReq);
  console.log('Opportunities status:', oppRes.status);
  const oppData = await oppRes.json();
  console.log('Opportunities count:', oppData.opportunities?.length);

  // 9. Testing GET /api/disputes
  console.log('\n[9] Testing GET /api/disputes:');
  const dispReq = new NextRequest('http://localhost:3000/api/disputes', {
    headers: { cookie: `vc_session=${token}` },
  });
  const dispRes = await getDisputes(dispReq);
  console.log('Disputes status:', dispRes.status);
  const dispData = await dispRes.json();
  console.log('Disputes count:', dispData.disputes?.length);

  // 10. Testing GET /api/deals
  console.log('\n[10] Testing GET /api/deals:');
  const dealsReq = new NextRequest('http://localhost:3000/api/deals', {
    headers: { cookie: `vc_session=${token}` },
  });
  const dealsRes = await getDeals(dealsReq);
  console.log('Deals status:', dealsRes.status);
  const dealsData = await dealsRes.json();
  console.log('Deals count:', dealsData.deals?.length);

  // 11. Testing what happens if GM views /api/auth/session and then hits /portal
  console.log('\n[11] Testing GM session:');
  const gmToken = await createSessionToken({
    userId: 'op_gm',
    role: 'gm',
    name: 'Game Master',
    isElevated: true,
  });
  const gmSessReq = new NextRequest('http://localhost:3000/api/auth/session', {
    headers: { cookie: `vc_session=${gmToken}` },
  });
  const gmSessRes = await getSession(gmSessReq);
  const gmSessData = await gmSessRes.json();
  console.log('GM Session user keys:', Object.keys(gmSessData.user || {}));
  console.log('GM walletBalance:', gmSessData.user?.walletBalance);

  process.exit(0);
}

run().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
