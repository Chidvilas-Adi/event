import { createSessionToken } from '../src/lib/auth/session';

async function runTests() {
  console.log('🚀 Running Full GM CRUD Verification Suite...');

  const gmToken = await createSessionToken({
    userId: 'op_gm',
    role: 'gm',
    name: 'Game Master Prime',
    isElevated: true,
  });

  const headers = {
    'Content-Type': 'application/json',
    'Cookie': `vc_session=${gmToken}`,
  };

  const { POST: createPart, GET: getParts, PUT: updatePart, DELETE: delPart } = await import('../src/app/api/participants/route');
  const { POST: createComp, GET: getComps, PUT: updateComp, DELETE: delComp } = await import('../src/app/api/companies/route');
  const { POST: createMsn, GET: getMsns, PUT: updateMsn, DELETE: delMsn } = await import('../src/app/api/missions/route');
  const { POST: createInst, GET: getInsts, PUT: updateInst, DELETE: delInst } = await import('../src/app/api/institutions/route');
  const { POST: createAnn, GET: getAnns, PUT: updateAnn, DELETE: delAnn } = await import('../src/app/api/announcements/route');
  const { NextRequest } = await import('next/server');

  function makeReq(url: string, method: string, body?: any) {
    const req = new NextRequest(url, {
      method,
      headers: {
        'cookie': `vc_session=${gmToken}`,
        'authorization': `Bearer ${gmToken}`,
        'content-type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    req.cookies.set('vc_session', gmToken);
    return req;
  }

  // --- 1. PARTICIPANT CRUD ---
  console.log('\n[1] Testing PARTICIPANT CRUD:');
  const testPartCode = `VC-TEST-${Date.now().toString().slice(-4)}`;
  const pCreateRes = await createPart(makeReq('http://localhost:3000/api/participants', 'POST', {
    name: 'Test Citizen Alpha',
    citizenCode: testPartCode,
    role: 'participant',
    initialBalance: 750,
  }));
  const pCreateData = await pCreateRes.json();
  console.log('Create Participant:', pCreateRes.status, pCreateData);
  if (!pCreateData.citizenId) throw new Error('Participant creation failed');

  const pGetRes = await getParts(makeReq(`http://localhost:3000/api/participants?q=${testPartCode}`, 'GET'));
  const pGetData = await pGetRes.json();
  console.log('Read Participant found:', pGetData.participants.length);

  const pUpdateRes = await updatePart(makeReq('http://localhost:3000/api/participants', 'PUT', {
    id: pCreateData.citizenId,
    name: 'Test Citizen Alpha (Updated)',
  }));
  console.log('Update Participant:', pUpdateRes.status, await pUpdateRes.json());

  const pDelRes = await delPart(makeReq(`http://localhost:3000/api/participants?id=${pCreateData.citizenId}`, 'DELETE'));
  console.log('Delete Participant:', pDelRes.status, await pDelRes.json());

  const pGetAfter = await getParts(makeReq(`http://localhost:3000/api/participants?q=${testPartCode}`, 'GET'));
  const pGetAfterData = await pGetAfter.json();
  console.log('Verify Participant deleted, remaining count:', pGetAfterData.participants.length);
  if (pGetAfterData.participants.length !== 0) throw new Error('Participant was not hard deleted!');

  // --- 2. COMPANY CRUD ---
  console.log('\n[2] Testing COMPANY CRUD:');
  const testCompId = `comp_test_${Date.now()}`;
  const cCreateRes = await createComp(makeReq('http://localhost:3000/api/companies', 'POST', {
    id: testCompId,
    name: `Test Venture ${Date.now()}`,
    tagline: 'Futuristic AI compute broker',
    description: 'Venture created for verification',
    tier: 2,
    initialTreasury: 3000,
  }));
  const cCreateData = await cCreateRes.json();
  console.log('Create Company:', cCreateRes.status, cCreateData);
  if (!cCreateData.companyId) throw new Error('Company creation failed');

  const cGetRes = await getComps(makeReq(`http://localhost:3000/api/companies?id=${testCompId}`, 'GET'));
  const cGetData = await cGetRes.json();
  console.log('Read Company:', cGetRes.status, cGetData.company?.name);

  const cUpdateRes = await updateComp(makeReq('http://localhost:3000/api/companies', 'PUT', {
    id: testCompId,
    tagline: 'Updated futuristic tagline',
    tier: 3,
  }));
  console.log('Update Company:', cUpdateRes.status, await cUpdateRes.json());

  const cDelRes = await delComp(makeReq(`http://localhost:3000/api/companies?id=${testCompId}`, 'DELETE'));
  console.log('Delete Company:', cDelRes.status, await cDelRes.json());

  const cGetAfter = await getComps(makeReq(`http://localhost:3000/api/companies?id=${testCompId}`, 'GET'));
  console.log('Verify Company deleted status:', cGetAfter.status);
  if (cGetAfter.status !== 404) throw new Error('Company was not deleted!');

  // --- 3. MISSION CRUD ---
  console.log('\n[3] Testing MISSION CRUD:');
  const mCreateRes = await createMsn(makeReq('http://localhost:3000/api/missions', 'POST', {
    title: 'Test Synthetic Grid Stress-test',
    tier: 2,
    wave: 1,
    objective: 'Demonstrate resilience under compute load',
    rewardVb: 800,
  }));
  const mCreateData = await mCreateRes.json();
  console.log('Create Mission:', mCreateRes.status, mCreateData);
  if (!mCreateData.missionId) throw new Error('Mission creation failed');

  const mUpdateRes = await updateMsn(makeReq('http://localhost:3000/api/missions', 'PUT', {
    id: mCreateData.missionId,
    title: 'Test Synthetic Grid Stress-test (Phase 2)',
    rewardVb: 1200,
  }));
  console.log('Update Mission:', mUpdateRes.status, await mUpdateRes.json());

  const mDelRes = await delMsn(makeReq(`http://localhost:3000/api/missions?id=${mCreateData.missionId}`, 'DELETE'));
  console.log('Delete Mission:', mDelRes.status, await mDelRes.json());

  // --- 4. INSTITUTION CRUD ---
  console.log('\n[4] Testing INSTITUTION CRUD:');
  const testInstId = `inst_test_${Date.now()}`;
  const iCreateRes = await createInst(makeReq('http://localhost:3000/api/institutions', 'POST', {
    action: 'create',
    id: testInstId,
    name: 'Test Innovation Desk',
    type: 'commercial',
    capacity: 150,
    config: { testParam: 42 },
  }));
  const iCreateData = await iCreateRes.json();
  console.log('Create Institution:', iCreateRes.status, iCreateData);
  if (!iCreateData.id) throw new Error('Institution creation failed');

  const iGetRes = await getInsts();
  const iGetData = await iGetRes.json();
  const foundInst = iGetData.find((x: any) => x.id === testInstId);
  console.log('Read Institution found:', Boolean(foundInst));

  const iUpdateRes = await updateInst(makeReq('http://localhost:3000/api/institutions', 'PUT', {
    id: testInstId,
    name: 'Test Innovation Desk (Expanded)',
    capacity: 250,
  }));
  console.log('Update Institution:', iUpdateRes.status, await iUpdateRes.json());

  const iDelRes = await delInst(makeReq(`http://localhost:3000/api/institutions?id=${testInstId}`, 'DELETE'));
  console.log('Delete Institution:', iDelRes.status, await iDelRes.json());

  const iGetAfter = await getInsts();
  const iGetAfterData = await iGetAfter.json();
  const foundAfter = iGetAfterData.find((x: any) => x.id === testInstId);
  console.log('Verify Institution deleted:', !foundAfter);
  if (foundAfter) throw new Error('Institution was not deleted!');

  // --- 5. ANNOUNCEMENT CRUD ---
  console.log('\n[5] Testing ANNOUNCEMENT CRUD:');
  const aCreateRes = await createAnn(makeReq('http://localhost:3000/api/announcements', 'POST', {
    message: 'Test Transmission for Suite Verification',
    priority: 'urgent',
    audience: 'all',
  }));
  const aCreateData = await aCreateRes.json();
  console.log('Create Announcement:', aCreateRes.status, aCreateData.announcement?.id);
  const annId = aCreateData.announcement?.id;
  if (!annId) throw new Error('Announcement creation failed');

  const aUpdateRes = await updateAnn(makeReq('http://localhost:3000/api/announcements', 'PUT', {
    id: annId,
    message: 'Updated Test Transmission Broadcast',
    priority: 'critical',
  }));
  console.log('Update Announcement:', aUpdateRes.status, await aUpdateRes.json());

  const aDelRes = await delAnn(makeReq(`http://localhost:3000/api/announcements?id=${annId}`, 'DELETE'));
  console.log('Delete Announcement:', aDelRes.status, await aDelRes.json());

  console.log('\n✅ ALL GM CRUD VERIFICATIONS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
