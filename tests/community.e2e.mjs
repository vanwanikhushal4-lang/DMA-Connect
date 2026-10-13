import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { initializeApp as clientApp } from 'firebase/app';
import { connectAuthEmulator, getAuth as clientAuth, signInWithCustomToken } from 'firebase/auth';
import { collection, connectFirestoreEmulator, doc, getDoc, getDocs, getFirestore as clientDb, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { connectStorageEmulator, getStorage as clientStorage, ref as storageRef, uploadString, getBytes } from 'firebase/storage';
import { phoneKey, seedCommittees } from '../functions/src/domain.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const projectId = 'demo-dma-connect';
if (process.env.GCLOUD_PROJECT !== projectId || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST || !process.env.FIREBASE_STORAGE_EMULATOR_HOST) throw new Error('Run with the isolated demo Auth, Firestore, Functions and Storage emulators.');
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const adminApp = initializeApp({ projectId, storageBucket: `${projectId}.firebasestorage.app` }, 'e2e-fixtures');
const adminAuth = getAuth(adminApp), db = getFirestore(adminApp, 'dma-connect');
const checks = [];
async function check(name, action) { await action(); checks.push({ name, result: 'passed' }); console.log('PASS ' + name); }
async function http(url, body, token) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  const data = await r.json();
  if (data.error) { const e = new Error(data.error.message); e.code = data.error.status || data.error.code; throw e; }
  return data;
}
async function call(user, operation, payload = {}) {
  const r = await http(`http://127.0.0.1:5001/${projectId}/asia-south1/dmaApi`, { data: { operation, payload } }, user?.idToken);
  return r.result || r.data;
}
async function phoneSignIn(phoneNumber) {
  const endpoint = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/';
  const { sessionInfo } = await http(endpoint + 'accounts:sendVerificationCode?key=fake-api-key', { phoneNumber, recaptchaToken: 'emulator' });
  const codes = await (await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${projectId}/verificationCodes`)).json();
  const code = codes.verificationCodes.find(c => c.sessionInfo === sessionInfo)?.code;
  assert.ok(code, 'The emulator should issue a verification code to the requested phone.');
  await assert.rejects(http(endpoint + 'accounts:signInWithPhoneNumber?key=fake-api-key', { sessionInfo, code: code === '000000' ? '111111' : '000000' }));
  const signed = await http(endpoint + 'accounts:signInWithPhoneNumber?key=fake-api-key', { sessionInfo, code });
  return { uid: signed.localId, idToken: signed.idToken, phoneNumber };
}
const logo = (await readFile(new URL('../assets/foundation-logo.png', import.meta.url))).toString('base64');
async function createProfile(user, name, dob = '1990-01-01') {
  const image = await call(user, 'uploadPhoto', { base64: logo });
  await call(user, 'completeProfile', { name, email: name.toLowerCase().replace(/\s/g, '') + '@example.com', mobile: user.phoneNumber.slice(3), residence: 'Vashi, Navi Mumbai', dob, areaId: 'area-vashi', socials: { facebook: '', linkedin: '', instagram: '' }, photoPaths: [image.path], birthdayEmailsEnabled: true, role: 'superadmin', committeeId: 'dma-district', activeScopeIds: ['dma-district'] });
  return (await db.collection('people').doc(user.uid).get()).data();
}

await fetch(`http://127.0.0.1:8180/emulator/v1/projects/${projectId}/databases/dma-connect/documents`, { method: 'DELETE' });
await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${projectId}/accounts`, { method: 'DELETE' });
const admin = await phoneSignIn('+919000000001');
const batch = db.batch();
for (const c of seedCommittees('Demo Navi Mumbai')) batch.set(db.collection('committees').doc(c.id), { ...c, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), ...(c.level === 'district' ? { presidentUid: admin.uid } : {}) });
batch.set(db.collection('accounts').doc(admin.uid), { uid: admin.uid, personId: admin.uid, role: 'superadmin', level: 'district', committeeId: 'dma-district', parentCommitteeId: '', status: 'active', districtId: 'dma-district', phoneNumber: admin.phoneNumber, createdBy: 'fixtures', createdAt: FieldValue.serverTimestamp() });
await batch.commit();
await createProfile(admin, 'Demo Admin');
const vashi = await phoneSignIn('+919000000002');
await call(admin, 'createInvitation', { name: 'Vashi President', email: 'vashi@example.com', mobile: vashi.phoneNumber, committeeId: 'area-vashi' });
await createProfile(vashi, 'Vashi President');
const cell = await phoneSignIn('+919000000003');
await call(admin, 'createInvitation', { name: 'Cell President', email: 'cell@example.com', mobile: cell.phoneNumber, committeeId: 'cell-obc' });
await createProfile(cell, 'Cell President');
const member = await phoneSignIn('+919000000004');
const person = await createProfile(member, 'Demo Member', '1990-10-12');
await check('SMS signup rejects a wrong code and verifies the requested creator phone', async () => assert.equal((await adminAuth.getUser(member.uid)).phoneNumber, member.phoneNumber));
await check('public signup cannot supply a privileged role or scope', async () => {
  const a = (await db.collection('accounts').doc(member.uid).get()).data();
  assert.equal(a.role, 'member'); assert.equal(a.committeeId, ''); assert.deepEqual(person.activeScopeIds, []);
  await assert.rejects(call(member, 'createInvitation', { name: 'Fake Admin', email: 'fake@example.com', mobile: '+919000000009', committeeId: 'area-nerul' }));
});
await check('Super Admin can appoint any area or cell president', async () => {
  assert.equal((await db.collection('accounts').doc(vashi.uid).get()).data().level, 'area');
  assert.equal((await db.collection('accounts').doc(cell.uid).get()).data().level, 'cell');
});
await call(admin, 'createCommittee', { name: 'Demo Ward', level: 'ward', parentId: 'area-vashi' });
const wardId = 'ward-area-vashi-demo-ward';
const ward = await phoneSignIn('+919000000005');
await check('an area president can create only an authorised lower president', async () => {
  await call(vashi, 'createInvitation', { name: 'Ward President', email: 'ward@example.com', mobile: ward.phoneNumber, committeeId: wardId });
  await assert.rejects(call(vashi, 'createInvitation', { name: 'Bad Peer', email: 'peer@example.com', mobile: '+919000000010', committeeId: 'area-nerul' }));
  await assert.rejects(call(cell, 'createInvitation', { name: 'Bad Ward', email: 'ward2@example.com', mobile: '+919000000011', committeeId: wardId }));
});
await createProfile(ward, 'Ward President');
await call(admin, 'createCommittee', { name: 'Demo Locality', level: 'local', parentId: wardId });
const localId = 'local-' + wardId + '-demo-locality';
const local = await phoneSignIn('+919000000006');
await check('ward-to-local appointment preserves its parent hierarchy', async () => {
  await call(ward, 'createInvitation', { name: 'Local President', email: 'local@example.com', mobile: local.phoneNumber, committeeId: localId });
  await createProfile(local, 'Local President');
  const a = (await db.collection('accounts').doc(local.uid).get()).data();
  assert.equal(a.parentCommitteeId, wardId); assert.equal(a.level, 'local');
});
await call(member, 'requestAffiliation', { committeeId: 'area-vashi' });
await call(member, 'requestAffiliation', { committeeId: 'cell-obc' });
const areaRequest = member.uid + '__area-vashi', cellRequest = member.uid + '__cell-obc';
await check('a cell president cannot review an area request or grant access to an unrelated profile', async () => {
  await assert.rejects(call(cell, 'decideRequest', { requestId: areaRequest, decision: 'approved' }));
  await assert.rejects(call(cell, 'memberDetail', { personId: member.uid, requestId: areaRequest }));
  await assert.rejects(call(cell, 'getPhoto', { personId: member.uid, path: person.photoPaths[0] }));
});
await check('area approval is independent from the pending cell request', async () => {
  await call(vashi, 'decideRequest', { requestId: areaRequest, decision: 'approved' });
  assert.equal((await db.collection('requests').doc(cellRequest).get()).data().status, 'pending');
  const d = await call(vashi, 'memberDirectory'); assert.equal(d.total, 1); assert.equal(d.members[0].personId, member.uid);
  await assert.rejects(call(vashi, 'decideRequest', { requestId: areaRequest, decision: 'approved' }));
});
await check('dual affiliation counts the same person once in district totals', async () => {
  await call(cell, 'decideRequest', { requestId: cellRequest, decision: 'approved' });
  const d = await call(admin, 'memberDirectory'); assert.equal(d.total, 1); assert.equal(d.affiliationTotal, 2);
  const stats = await call(admin, 'statistics', { period: 'week' }); assert.equal(stats.total, 1);
});
await check('Super Admin can find and appoint a self-signed account without granting presidents a global phone lookup', async () => {
  const found = await call(admin, 'lookupAccount', { mobile: member.phoneNumber }); assert.equal(found.person.personId, member.uid);
  await assert.rejects(call(vashi, 'lookupAccount', { mobile: member.phoneNumber }));
  await call(admin, 'changeAppointment', { uid: member.uid, committeeId: 'area-airoli' });
  assert.equal((await db.collection('accounts').doc(member.uid).get()).data().level, 'area');
  await call(admin, 'changeAppointment', { uid: member.uid, role: 'member' });
});
await check('committee suspension removes only its own access and cannot be bypassed by resubmitting', async () => {
  await assert.rejects(call(cell, 'changeAffiliation', { affiliationId: areaRequest, status: 'suspended' }));
  await call(vashi, 'changeAffiliation', { affiliationId: areaRequest, status: 'suspended' });
  const p = (await db.collection('people').doc(member.uid).get()).data(); assert.deepEqual(p.activeCommitteeIds, ['cell-obc']); assert.equal(p.activeMember, true);
  await assert.rejects(call(vashi, 'memberDetail', { personId: member.uid }));
  await assert.rejects(call(member, 'requestAffiliation', { committeeId: 'area-vashi' }));
  const page = await call(vashi, 'affiliationDirectory', { status: 'suspended' }); assert.equal(page.affiliations[0].personName, 'Demo Member');
  await call(vashi, 'changeAffiliation', { affiliationId: areaRequest, status: 'active' });
  assert.equal((await call(vashi, 'memberDirectory')).total, 1);
});
await check('approved presidents can read the supplied private photo, while ordinary members cannot read other profiles', async () => {
  const photo = await call(vashi, 'getPhoto', { personId: member.uid, path: person.photoPaths[0], thumbnail: true }); assert.ok(photo.uri.startsWith('data:image/jpeg;base64,'));
  await assert.rejects(call(member, 'memberDetail', { personId: vashi.uid }));
  await assert.rejects(call(member, 'getPhoto', { personId: vashi.uid, path: person.photoPaths[0] }));
});
await check('leaving one committee preserves the other affiliation and its scope', async () => {
  await call(member, 'leaveAffiliation', { committeeId: 'area-vashi' });
  const p = (await db.collection('people').doc(member.uid).get()).data(); assert.equal(p.activeMember, true); assert.deepEqual(p.activeCommitteeIds, ['cell-obc']); assert.equal(p.activeScopeIds.includes('area-vashi'), false);
  await assert.rejects(call(vashi, 'memberDetail', { personId: member.uid }));
});
await check('account suspension prevents staff mutations and reactivation restores the appointment', async () => {
  await call(admin, 'changeAppointment', { uid: vashi.uid, status: 'suspended' });
  await assert.rejects(call(vashi, 'memberDirectory'));
  await assert.rejects(call(vashi, 'uploadPhoto', { base64: logo }));
  const previousUser = await adminAuth.getUser(vashi.uid), previousProfile = (await db.collection('people').doc(vashi.uid).get()).data();
  await assert.rejects(call(vashi, 'completeProfile', { ...previousProfile, email: 'suspended-change@example.com' }));
  assert.equal((await adminAuth.getUser(vashi.uid)).email, previousUser.email);
  await call(admin, 'changeAppointment', { uid: vashi.uid, status: 'active' });
  assert.equal((await call(vashi, 'staffState')).requests.length, 0);
});
await check('canonical mobile identities reject duplicate member registration across presidents', async () => {
  await assert.rejects(call(vashi, 'addMember', { ...person, committeeId: 'area-vashi', mobile: member.phoneNumber }));
});
await check('member directory paginates beyond 50 records and searches the full authorised scope', async () => {
  const photo = await call(admin, 'uploadPhoto', { base64: logo });
  for (let i = 0; i < 55; i++) await call(admin, 'addMember', { name: 'Load Member ' + String(i).padStart(2, '0'), email: `load${i}@example.com`, mobile: '9000001' + String(i).padStart(3, '0'), residence: 'Nerul', dob: '1991-01-01', areaId: 'area-nerul', socials: { facebook: '', linkedin: '', instagram: '' }, photoPaths: [photo.path], birthdayEmailsEnabled: false, committeeId: 'area-nerul' });
  const first = await call(admin, 'memberDirectory'); assert.equal(first.members.length, 50); assert.equal(first.total, 56); assert.ok(first.nextCursor);
  const second = await call(admin, 'memberDirectory', { cursor: first.nextCursor }); assert.equal(second.members.length, 6);
  assert.equal(new Set([...first.members, ...second.members].map(p => p.id)).size, 56);
  const found = await call(admin, 'memberDirectory', { search: 'Load Member 54' }); assert.equal(found.total, 1); assert.equal(found.members[0].name, 'Load Member 54');
  const own = await call(vashi, 'memberDirectory'); assert.equal(own.total, 0);
});

const app = clientApp({ projectId, apiKey: 'fake-api-key', storageBucket: `${projectId}.firebasestorage.app` }, 'e2e-client');
const auth = clientAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const firestore = clientDb(app, 'dma-connect'); connectFirestoreEmulator(firestore, '127.0.0.1', 8180);
const storage = clientStorage(app); connectStorageEmulator(storage, '127.0.0.1', 9199);
const bridge = await call(null, 'exchangeNativeToken', { idToken: member.idToken });
await signInWithCustomToken(auth, bridge.token);
await check('owner-only profile reads work in the named database', async () => assert.equal((await getDoc(doc(firestore, 'people', member.uid))).data().personId, member.uid));
await check('security rules reject private profile lists, mixed-content reads and direct privilege writes', async () => {
  await assert.rejects(getDoc(doc(firestore, 'people', vashi.uid)));
  await assert.rejects(getDocs(collection(firestore, 'people')));
  await assert.rejects(setDoc(doc(firestore, 'accounts', member.uid), { uid: member.uid, personId: member.uid, role: 'superadmin', status: 'active', committeeId: 'dma-district' }));
  await assert.rejects(updateDoc(doc(firestore, 'people', member.uid), { name: 'x'.repeat(1000000), activeScopeIds: ['dma-district'], createdAt: '1900-01-01' }));
  await assert.rejects(setDoc(doc(firestore, 'people', 'stolen'), { ...person, accountUid: member.uid, createdAt: new Date(), updatedAt: new Date() }));
  await assert.rejects(getDoc(doc(firestore, 'phoneIndex', phoneKey(member.phoneNumber))));
  await assert.rejects(getDoc(doc(firestore, 'invitations', phoneKey(vashi.phoneNumber))));
  await assert.rejects(getDoc(doc(firestore, 'people', member.uid, 'access', 'dma-district')));
});
await check('rules allow the exact owner request and affiliation queries used by the app', async () => {
  assert.equal((await getDocs(query(collection(firestore, 'requests'), where('applicantUid', '==', member.uid)))).size, 2);
  assert.equal((await getDocs(query(collection(firestore, 'affiliations'), where('personId', '==', member.uid)))).size, 2);
  await assert.rejects(getDocs(query(collection(firestore, 'requests'), where('applicantUid', '==', vashi.uid))));
});
await check('Storage rules reject unauthorised direct uploads and raw photo downloads', async () => {
  await assert.rejects(uploadString(storageRef(storage, 'stolen.jpg'), logo, 'base64'));
  await assert.rejects(getBytes(storageRef(storage, person.photoPaths[0])));
});
await check('birthday delivery includes the member photo and is idempotent across retries', async () => {
  await adminAuth.updateUser(member.uid, { emailVerified: true });
  process.env.BIRTHDAY_FROM_EMAIL = 'DMA Connect <birthday@example.com>';
  const { runBirthdayGreetings } = await import('../functions/src/index.js');
  const sent = [];
  const emailClient = { emails: { send: async (payload, options) => { sent.push({ payload, options }); return { data: { id: 'test-message-id' }, error: null }; } } };
  const now = new Date('2026-10-12T04:00:00Z');
  const first = await runBirthdayGreetings(now, emailClient), second = await runBirthdayGreetings(now, emailClient);
  assert.equal(first.sent, 1); assert.equal(second.sent, 0); assert.equal(sent.length, 1);
  assert.equal(sent[0].payload.to, person.email);
  assert.equal(sent[0].payload.attachments.length, 2);
  assert.ok(sent[0].payload.attachments.some(a => a.contentId === 'member-photo' && a.content.length > 100));
  assert.ok(sent[0].payload.html.includes('Demo Member'));
  assert.equal(sent[0].options.idempotencyKey, 'birthday-' + member.uid + '_2026');
});
await check('provider quota failures stay queued and retry on the following day', async () => {
  const { runBirthdayGreetings } = await import('../functions/src/index.js');
  const quotaClient = { emails: { send: async () => ({ data: null, error: { message: 'Daily sending quota exceeded' } }) } };
  assert.equal((await runBirthdayGreetings(new Date('2028-10-12T04:00:00Z'), quotaClient)).failures, 1);
  const successClient = { emails: { send: async () => ({ data: { id: 'delayed-message-id' }, error: null }) } };
  assert.equal((await runBirthdayGreetings(new Date('2028-10-13T04:00:00Z'), successClient)).sent, 1);
  assert.equal((await db.collection('birthdayDeliveries').doc(member.uid + '_2028').get()).data().date, '2028-10-12');
});
await check('ambiguous delivery outcomes require review after the provider idempotency window', async () => {
  const { runBirthdayGreetings } = await import('../functions/src/index.js');
  let attempts = 0;
  const client = { emails: { send: async () => { attempts++; throw new Error('Transport response lost'); } } };
  assert.equal((await runBirthdayGreetings(new Date('2029-10-12T04:00:00Z'), client)).failures, 1);
  assert.equal((await runBirthdayGreetings(new Date('2029-10-13T04:00:00Z'), client)).sent, 0);
  assert.equal(attempts, 1);
  assert.equal((await db.collection('birthdayDeliveries').doc(member.uid + '_2029').get()).data().status, 'review');
});
await check('birthday opt-out prevents a new annual delivery', async () => {
  await db.collection('people').doc(member.uid).update({ birthdayEmailsEnabled: false });
  const { runBirthdayGreetings } = await import('../functions/src/index.js');
  const emailClient = { emails: { send: async () => { throw new Error('Opted-out member must not receive email.'); } } };
  assert.equal((await runBirthdayGreetings(new Date('2027-10-12T04:00:00Z'), emailClient)).sent, 0);
});
await check('signup claims a president-added record with its private photos and skips unverified birthday recipients', async () => {
  const photo = await call(admin, 'uploadPhoto', { base64: logo });
  const added = await call(admin, 'addMember', { name: 'Claimed Member', email: 'claimed@example.com', mobile: '9000002001', residence: 'Nerul', dob: '2000-10-12', areaId: 'area-nerul', socials: { facebook: '', linkedin: '', instagram: '' }, photoPaths: [photo.path], birthdayEmailsEnabled: true, committeeId: 'area-nerul' });
  const claimant = await phoneSignIn('+919000002001');
  const setup = await call(claimant, 'mySetup'); assert.equal(setup.person.personId, added.personId);
  await call(claimant, 'completeProfile', setup.person);
  const account = (await db.collection('accounts').doc(claimant.uid).get()).data(); assert.equal(account.personId, added.personId); assert.equal(account.role, 'member');
  const claimed = await call(claimant, 'memberDetail', { personId: added.personId }); assert.equal(claimed.person.accountUid, claimant.uid); assert.equal(claimed.person.activeMember, true);
  assert.ok((await call(claimant, 'getPhoto', { personId: added.personId, path: photo.path })).uri.startsWith('data:image/jpeg;'));
  const { runBirthdayGreetings } = await import('../functions/src/index.js');
  let attempts = 0;
  const client = { emails: { send: async () => { attempts++; throw new Error('Unverified recipient should not receive a greeting'); } } };
  await runBirthdayGreetings(new Date('2030-10-12T04:00:00Z'), client);
  assert.equal(attempts, 0); assert.equal((await db.collection('birthdayDeliveries').doc(added.personId + '_2030').get()).data().status, 'skipped');
  await runBirthdayGreetings(new Date('2030-10-12T05:00:00Z'), client); assert.equal(attempts, 0);
});
await check('bootstrap refuses a different central owner and its dry run writes nothing', async () => {
  const run = promisify(execFile), root = db.collection('committees').doc('dma-district');
  await run(process.execPath, ['functions/scripts/bootstrap.js', '--project', projectId, '--phone', admin.phoneNumber, '--district', 'Dry run district']);
  assert.equal((await root.get()).data().name, 'Demo Navi Mumbai');
  await assert.rejects(run(process.execPath, ['functions/scripts/bootstrap.js', '--project', projectId, '--phone', '+919000000999', '--district', 'Different owner', '--apply']));
  assert.equal((await root.get()).data().presidentUid, admin.uid);
});
await check('legacy migration is explicit, preserves sources and timestamps, is idempotent, and never grants admin', async () => {
  const run = promisify(execFile), owner = 'legacy-email-owner';
  await adminAuth.createUser({ uid: owner, email: 'legacy-owner@example.com', password: 'TestLegacyOnly123!' });
  const createdAt = new Date('2020-02-03T04:05:00Z'), legacy = db.collection('presidents').doc(owner), source = legacy.collection('members').doc('9000000999');
  await legacy.set({ name: 'Legacy Owner', email: 'legacy-owner@example.com', mobile: '9000000998', role: 'district', createdAt });
  await source.set({ name: 'Legacy Member', mobile: '9000000999', email: '', residence: 'Nerul', dob: new Date('2000-01-02T00:00:00Z'), taluka: 'Nerul', createdAt });
  const args = ['functions/scripts/migrate.js', '--project', projectId, '--owner', owner, '--committee', 'area-nerul'];
  await run(process.execPath, args);
  assert.equal((await db.collection('phoneIndex').doc(phoneKey('+919000000999')).get()).exists, false);
  await run(process.execPath, [...args, '--apply']);
  const index = await db.collection('phoneIndex').doc(phoneKey('+919000000999')).get(), personRef = db.collection('people').doc(index.data().personId);
  const copied = (await personRef.get()).data();
  assert.equal(copied.legacySourcePath, source.path); assert.equal(copied.createdAt.toDate().toISOString(), createdAt.toISOString()); assert.equal(copied.dob, '2000-01-02'); assert.equal(copied.birthdayEmailsEnabled, false);
  assert.equal((await source.get()).exists, true); assert.equal((await db.collection('accounts').doc(owner).get()).data().role, 'member');
  await run(process.execPath, [...args, '--apply']);
  assert.equal((await personRef.get()).data().updatedAt.toMillis(), copied.updatedAt.toMillis());
});
await mkdir('tmp/security', { recursive: true });
await writeFile('tmp/security/attack-report.json', JSON.stringify({ projectId, database: 'dma-connect', checks }, null, 2));
console.log(`Passed ${checks.length} integration and access-control checks.`);
process.exit(0);
