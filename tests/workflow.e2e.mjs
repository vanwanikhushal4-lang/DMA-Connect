import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { seedCommittees, phoneKey } from '../functions/src/domain.js';
const projectId = process.env.GCLOUD_PROJECT;
if (projectId !== 'demo-dma-workflow' || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Run only in the isolated demo-dma-workflow test emulators.');
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp, deleteApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const app = initializeApp({ projectId });
const db = getFirestore(app, 'dma-connect');
const authUrl = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`;
const apiUrl = `http://127.0.0.1:15001/${projectId}/asia-south1/dmaApi`;
async function http(url, body, token) {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  const result = await r.json();
  if (result.error) throw new Error(result.error.message);
  return result;
}
async function call(user, operation, payload = {}) { return (await http(apiUrl, { data: { operation, payload } }, user.token)).result; }
async function login(phone) {
  const base = authUrl + '/identitytoolkit.googleapis.com/v1/';
  const { sessionInfo } = await http(base + 'accounts:sendVerificationCode?key=demo-key', { phoneNumber: phone, recaptchaToken: 'emulator' });
  const codes = await (await fetch(authUrl + `/emulator/v1/projects/${projectId}/verificationCodes`)).json();
  const code = codes.verificationCodes.find(c => c.sessionInfo === sessionInfo).code;
  const user = await http(base + 'accounts:signInWithPhoneNumber?key=demo-key', { sessionInfo, code });
  return { uid: user.localId, token: user.idToken, phone };
}
const logo = (await readFile(new URL('../assets/foundation-logo.png', import.meta.url))).toString('base64');
async function profile(user, name) {
  const { path } = await call(user, 'uploadPhoto', { base64: logo });
  const payload = { name, email: `workflow-${user.phone.slice(3)}@example.invalid`, mobile: user.phone.slice(3), residence: 'Demo residence', dob: '1990-01-01', areaId: 'area-vashi', socials: { facebook: '', linkedin: '', instagram: '' }, photoPaths: [path], birthdayEmailsEnabled: false };
  await call(user, 'completeProfile', { ...payload, role: 'superadmin', level: 'state' });
  return payload;
}
let checks = 0;
async function test(name, run) { await run(); checks++; console.log('PASS ' + name); }
try {
  const root = await login('+919110000001');
  const batch = db.batch();
  for (const c of seedCommittees()) batch.set(db.collection('committees').doc(c.id), { ...c, createdAt: FieldValue.serverTimestamp() });
  batch.set(db.collection('accounts').doc(root.uid), { uid: root.uid, personId: root.uid, role: 'superadmin', level: 'state', committeeId: 'dma-state', status: 'active', phoneNumber: root.phone });
  await batch.commit(); await profile(root, 'Demo Root');
  let seq = 2;
  async function team(id, role) {
    const phone = '+91911000' + String(seq++).padStart(4, '0');
    await call(root, 'configureTeam', { name: `Demo ${id} ${role}`, email: `team-${seq}@example.invalid`, mobile: phone, committeeId: id, role });
    const user = await login(phone); await profile(user, `Demo ${id} ${role}`);
    assert.equal((await db.collection('accounts').doc(user.uid).get()).data().role, role);
    return user;
  }
  const sm = await team('dma-state', 'maker'), sc = await team('dma-state', 'checker');
  const dm = await team('dma-district', 'maker'), dc = await team('dma-district', 'checker');
  const tm = await team('area-vashi', 'maker'), tc = await team('area-vashi', 'checker');
  const nm = await team('area-nerul', 'maker'), nc = await team('area-nerul', 'checker');
  await test('one maker and one checker seat per State, District and Taluka; no double role or duplicate seat', async () => {
    await assert.rejects(call(root, 'configureTeam', { committeeId: 'dma-state', role: 'checker', uid: sm.uid }));
    await assert.rejects(call(root, 'configureTeam', { committeeId: 'dma-state', role: 'maker', name: 'Duplicate', email: 'duplicate@example.invalid', mobile: '9110099991' }));
    const a = (await db.collection('committees').doc('dma-state').get()).data();
    assert.equal(a.makerUid, sm.uid); assert.equal(a.checkerUid, sc.uid);
  });
  const presidents = {};
  for (const [id, m, c] of [['dma-state', sm, sc], ['dma-district', sm, sc], ['area-vashi', dm, dc]]) {
    const phone = '+91911000' + String(seq++).padStart(4, '0');
    const work = await call(m, 'createInvitation', { name: 'Demo ' + id + ' President', email: `president-${seq}@example.invalid`, mobile: phone, role: 'president', committeeId: id });
    assert.equal(work.status, 'pending');
    assert.equal((await db.collection('invitations').doc(phoneKey(phone)).get()).exists, false);
    await test(`${id}: maker cannot approve; other team checker cannot approve; assigned checker activates invitation atomically`, async () => {
      await assert.rejects(call(m, 'reviewWork', { workId: work.workId, decision: 'approved' }));
      await assert.rejects(call(id === 'area-vashi' ? sc : dc, 'reviewWork', { workId: work.workId, decision: 'approved' }));
      const r = await Promise.allSettled([call(c, 'reviewWork', { workId: work.workId, decision: 'approved' }), call(c, 'reviewWork', { workId: work.workId, decision: 'approved' })]);
      assert.equal(r.filter(x => x.status === 'fulfilled').length, 1);
      assert.equal((await db.collection('workItems').doc(work.workId).get()).data().reviewedBy, c.uid);
      assert.equal((await db.collection('invitations').doc(phoneKey(phone)).get()).data().approvedBy, c.uid);
    });
    const president = await login(phone); await profile(president, 'Demo ' + id + ' President'); presidents[id] = president;
    assert.equal((await db.collection('accounts').doc(president.uid).get()).data().role, 'president');
  }
  await test('all three president levels are view-only; root cannot bypass maker/checker creation', async () => {
    for (const p of [...Object.values(presidents), root]) {
      await assert.rejects(call(p, 'createInvitation', { name: 'Bypass', email: 'bypass@example.invalid', mobile: '9110099992', committeeId: 'area-nerul' }));
      await assert.rejects(call(p, 'addMember', {}));
    }
    await assert.rejects(call(tc, 'createInvitation', { name: 'Bypass', email: 'bypass@example.invalid', mobile: '9110099992' }));
  });
  await call(root, 'createCommittee', { name: 'Demo Ward', level: 'ward', parentId: 'area-vashi' });
  const wardId = 'ward-area-vashi-demo-ward';
  await call(root, 'createCommittee', { name: 'Demo Local', level: 'local', parentId: wardId });
  const localId = 'local-' + wardId + '-demo-local';
  await test('ward/local and cell have no operational seats; lower presidency work routes to Taluka or District', async () => {
    await assert.rejects(call(root, 'configureTeam', { role: 'maker', committeeId: wardId, name: 'No', email: 'no@example.invalid', mobile: '9110099993' }));
    for (const id of [wardId, localId]) {
      const item = await call(tm, 'createInvitation', { name: 'Lower President', email: 'lower@example.invalid', mobile: '9110099994', committeeId: id });
      await call(tm, 'withdrawWork', { workId: item.workId });
    }
    await assert.rejects(call(nm, 'createInvitation', { name: 'Wrong branch', email: 'wrong@example.invalid', mobile: '9110099994', committeeId: wardId }));
    const cell = await call(dm, 'createInvitation', { name: 'Cell President', email: 'cell@example.invalid', mobile: '9110099995', committeeId: 'cell-obc' });
    await call(dm, 'withdrawWork', { workId: cell.workId });
  });
  const image = await call(tm, 'uploadPhoto', { base64: logo });
  const draft = { name: 'Demo Pending Member', email: 'pending@example.invalid', mobile: '9110099988', residence: 'Vashi', dob: '1990-01-01', areaId: 'area-vashi', socials: { facebook: '', linkedin: '', instagram: '' }, photoPaths: [image.path], birthdayEmailsEnabled: false, committeeId: wardId };
  const memberWork = await call(tm, 'addMember', draft);
  await test('pending member remains outside member counts, while scoped presidents see details and photographs', async () => {
    assert.equal((await call(presidents['dma-state'], 'memberDirectory')).total, 0);
    assert.equal((await call(presidents['area-vashi'], 'workDirectory')).items.some(i => i.id === memberWork.workId), true);
    assert.equal((await call(presidents['area-vashi'], 'workDetail', { workId: memberWork.workId })).item.payload.residence, 'Vashi');
    assert.ok((await call(tc, 'workPhoto', { workId: memberWork.workId, path: image.path })).uri.startsWith('data:image/jpeg'));
    await assert.rejects(call(nc, 'workDetail', { workId: memberWork.workId }));
    await assert.rejects(call(nc, 'workPhoto', { workId: memberWork.workId, path: image.path }));
    await assert.rejects(call(presidents['area-vashi'], 'reviewWork', { workId: memberWork.workId, decision: 'approved' }));
  });
  await test('checker approval creates the member and affiliation once, including state ancestry', async () => {
    await call(tc, 'reviewWork', { workId: memberWork.workId, decision: 'approved' });
    const result = (await db.collection('workItems').doc(memberWork.workId).get()).data().result;
    const p = (await db.collection('people').doc(result.personId).get()).data();
    assert.equal(p.activeMember, true); assert.ok(p.activeScopeIds.includes('dma-state')); assert.ok(p.activeScopeIds.includes('dma-district'));
    assert.equal((await call(presidents['dma-state'], 'memberDirectory')).total, 1);
    assert.equal((await call(presidents['area-vashi'], 'statistics', { period: 'week' })).total, 1);
    await assert.rejects(call(tc, 'reviewWork', { workId: memberWork.workId, decision: 'approved' }));
  });
  const reject = await call(tm, 'addMember', { ...draft, name: 'Rejected Member', mobile: '9110099987' });
  await test('rejection requires a reason, creates no identity or membership and stays visible in history', async () => {
    await assert.rejects(call(tc, 'reviewWork', { workId: reject.workId, decision: 'declined' }));
    await call(tc, 'reviewWork', { workId: reject.workId, decision: 'declined', reason: 'Incorrect residence details' });
    assert.equal((await db.collection('phoneIndex').doc(phoneKey('+919110099987')).get()).exists, false);
    const h = await call(presidents['dma-state'], 'workDirectory', { status: 'declined' });
    assert.ok(h.items.some(w => w.reason === 'Incorrect residence details'));
  });
  await test('revoked maker authority invalidates previously submitted work', async () => {
    const work = await call(nm, 'createInvitation', { name: 'Revoked Maker Work', email: 'revoked@example.invalid', mobile: '9110099986', role: 'member' });
    await db.collection('accounts').doc(nm.uid).update({ status: 'suspended' });
    await assert.rejects(call(nc, 'reviewWork', { workId: work.workId, decision: 'approved' }));
    assert.equal((await db.collection('workItems').doc(work.workId).get()).data().status, 'pending');
    await db.collection('accounts').doc(nm.uid).update({ status: 'active' });
  });
  const member = await login('+919110099985'); await profile(member, 'Demo Self Member');
  await call(member, 'requestAffiliation', { committeeId: localId }); await call(member, 'requestAffiliation', { committeeId: 'cell-obc' });
  await test('self-signup stays a member; Taluka and District checkers approve local and cell links independently', async () => {
    assert.equal((await db.collection('accounts').doc(member.uid).get()).data().role, 'member');
    const localRequest = member.uid + '__' + localId, cellRequest = member.uid + '__cell-obc';
    await assert.rejects(call(presidents['area-vashi'], 'decideRequest', { requestId: localRequest, decision: 'approved' }));
    await assert.rejects(call(dc, 'decideRequest', { requestId: localRequest, decision: 'approved' }));
    await call(tc, 'decideRequest', { requestId: localRequest, decision: 'approved' });
    assert.equal((await db.collection('requests').doc(cellRequest).get()).data().status, 'pending');
    await call(dc, 'decideRequest', { requestId: cellRequest, decision: 'approved' });
    assert.equal((await call(presidents['dma-state'], 'memberDirectory')).total, 2);
  });
  await test('account changes are queued and require the proper checker', async () => {
    const work = await call(dm, 'changeAppointment', { uid: presidents['area-vashi'].uid, status: 'suspended' });
    assert.equal((await db.collection('accounts').doc(presidents['area-vashi'].uid).get()).data().status, 'active');
    await call(dc, 'reviewWork', { workId: work.workId, decision: 'approved' });
    await assert.rejects(call(presidents['area-vashi'], 'staffState'));
    const restore = await call(dm, 'changeAppointment', { uid: presidents['area-vashi'].uid, status: 'active' });
    await call(dc, 'reviewWork', { workId: restore.workId, decision: 'approved' });
  });
  await test('multiple districts can contain identically named Talukas with separate maker/checker authority', async () => {
    await call(root, 'createCommittee', { name: 'Second Demo District', level: 'district', parentId: 'dma-state' });
    const district = 'district-dma-state-second-demo-district';
    await call(root, 'createCommittee', { name: 'Vashi', level: 'taluka', parentId: district });
    const secondTaluka = 'taluka-' + district + '-vashi';
    assert.notEqual(secondTaluka, 'area-vashi');
    const otherMaker = await team(district, 'maker'), otherChecker = await team(district, 'checker');
    const work = await call(otherMaker, 'createInvitation', { name: 'Second Vashi President', email: 'second-vashi@example.invalid', mobile: '9110099980', committeeId: secondTaluka });
    await assert.rejects(call(dc, 'reviewWork', { workId: work.workId, decision: 'approved' }));
    await assert.rejects(call(dm, 'createInvitation', { name: 'Wrong District', email: 'wrong-district@example.invalid', mobile: '9110099981', committeeId: secondTaluka }));
    await call(otherChecker, 'reviewWork', { workId: work.workId, decision: 'approved' });
    assert.equal((await call(otherMaker, 'memberDirectory')).total, 0);
    assert.ok((await call(presidents['dma-state'], 'workDirectory', { status: 'approved' })).items.some(w => w.id === work.workId));
  });
  console.log(`Passed ${checks} maker/checker integration checks.`);
} finally { await deleteApp(app); }
process.exit(0);
