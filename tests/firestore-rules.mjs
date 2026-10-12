import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-dma-connect', firestore: { host: '127.0.0.1', port: 8180, rules: await readFile('firestore.rules', 'utf8') } });
  await env.clearFirestore();
});
after(async () => { await env?.cleanup(); });
const dbFor = uid => env.authenticatedContext(uid, { email: `${uid}@example.org` }).firestore();
const profile = (uid, extra = {}) => ({ uid, name: 'Test President', email: `${uid}@example.org`, mobile: '9876543210', role: 'district', district: 'Mumbai', taluka: '', locality: '', cell: '', createdAt: serverTimestamp(), ...extra });
const member = (uid, extra = {}) => ({ ownerUid: uid, name: 'Test Member', email: '', mobile: '9876543210', residence: 'Test residence', dob: Timestamp.fromDate(new Date('2000-01-01T00:00:00Z')), taluka: 'Thane', createdAt: serverTimestamp(), ...extra });
const parent = (db, uid) => doc(db, 'presidents', uid);
const child = (db, uid, mobile = '9876543210') => doc(db, 'presidents', uid, 'members', mobile);

test('owner can create and read their profile, while strangers cannot', async () => {
  const uid = 'owner'; const db = dbFor(uid);
  await assertSucceeds(setDoc(parent(db, uid), profile(uid)));
  await assertSucceeds(getDoc(parent(db, uid)));
  await assertFails(getDoc(parent(dbFor('stranger'), uid)));
  await assertFails(getDoc(parent(env.unauthenticatedContext().firestore(), uid)));
  await assertFails(getDocs(collection(db, 'presidents')));
});
test('unauthenticated and cross-account profile creation is denied', async () => {
  await assertFails(setDoc(parent(env.unauthenticatedContext().firestore(), 'anonymous'), profile('anonymous')));
  await assertFails(setDoc(parent(dbFor('attacker'), 'victim'), profile('victim')));
});
test('roles never confer administrator privileges or allow unknown schema fields', async () => {
  for (const extra of [{ role: 'admin' }, { admin: true }, { uid: 'victim' }, { email: 'victim@example.org' }, { name: 123 }, { name: '' }, { name: 'x'.repeat(121) }, { mobile: '123' }, { createdAt: Timestamp.fromMillis(0) }]) {
    await assertFails(setDoc(parent(dbFor('invalid'), 'invalid'), profile('invalid', extra)));
  }
});
test('role-specific areas are required', async () => {
  for (const role of ['taluka', 'ward', 'village', 'city', 'cell']) {
    const uid = `area-${role}`; const db = dbFor(uid);
    await assertFails(setDoc(parent(db, uid), profile(uid, { role })));
    await assertSucceeds(setDoc(parent(db, uid), profile(uid, { role, taluka: 'Thane', locality: 'Test area', cell: 'OBC' })));
  }
});
test('profiles cannot be modified or deleted by clients', async () => {
  const db = dbFor('owner');
  await assertFails(updateDoc(parent(db, 'owner'), { role: 'district', admin: true }));
  await assertFails(deleteDoc(parent(db, 'owner')));
});
test('owner can create, read and query members ordered by registration date', async () => {
  const db = dbFor('owner');
  await assertSucceeds(setDoc(child(db, 'owner'), member('owner')));
  await assertSucceeds(getDoc(child(db, 'owner')));
  const snapshot = await assertSucceeds(getDocs(query(collection(db, 'presidents', 'owner', 'members'), orderBy('createdAt', 'desc'))));
  assert.equal(snapshot.size, 1);
});
test('members are private even when another account chooses district president', async () => {
  const db = dbFor('district-attacker');
  await assertSucceeds(setDoc(parent(db, 'district-attacker'), profile('district-attacker')));
  await assertFails(getDoc(child(db, 'owner')));
  await assertFails(getDocs(collection(db, 'presidents', 'owner', 'members')));
  await assertFails(setDoc(child(db, 'owner', '9876543211'), member('owner', { mobile: '9876543211' })));
});
test('member writes require an existing president profile', async () => {
  await assertFails(setDoc(child(dbFor('orphan'), 'orphan'), member('orphan')));
});
test('malformed member data and ownership tampering are denied', async () => {
  const uid = 'member-validation'; const db = dbFor(uid);
  await assertSucceeds(setDoc(parent(db, uid), profile(uid)));
  for (const extra of [{ ownerUid: 'victim' }, { name: 7 }, { email: 'not-an-email' }, { mobile: '9876543211' }, { residence: '' }, { residence: 'x'.repeat(501) }, { taluka: '' }, { isAdmin: true }, { dob: '01/01/2000' }, { dob: Timestamp.fromDate(new Date('1899-12-31')) }, { dob: Timestamp.fromMillis(Date.now() + 172800000) }, { createdAt: Timestamp.fromMillis(0) }]) {
    await assertFails(setDoc(child(db, uid), member(uid, extra)));
  }
});
test('DOB supports today across time zones', async () => {
  const uid = 'today'; const db = dbFor(uid);
  await assertSucceeds(setDoc(parent(db, uid), profile(uid)));
  const now = new Date();
  const nextUtcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  await assertSucceeds(setDoc(child(db, uid), member(uid, { dob: Timestamp.fromDate(nextUtcMidnight) })));
});
test('duplicate records cannot overwrite existing members, and client deletes are denied', async () => {
  const db = dbFor('owner');
  await assertFails(setDoc(child(db, 'owner'), member('owner')));
  await assertFails(updateDoc(child(db, 'owner'), { ownerUid: 'victim', mobile: '9876543211' }));
  await assertFails(deleteDoc(child(db, 'owner')));
});
test('assigned taluka is enforced for ward, taluka and village presidents', async () => {
  for (const role of ['ward', 'taluka', 'village']) {
    const uid = `area-${role}`; const db = dbFor(uid);
    await assertFails(setDoc(child(db, uid), member(uid, { taluka: 'Another taluka' })));
    await assertSucceeds(setDoc(child(db, uid), member(uid)));
  }
});
test('unmodelled collections deny all access', async () => {
  const db = dbFor('owner');
  await assertFails(setDoc(doc(db, 'admins', 'owner'), { admin: true }));
  await assertFails(getDoc(doc(db, 'admins', 'owner')));
});
