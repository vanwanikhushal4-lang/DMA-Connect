import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';

let env;
before(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-dma-connect', firestore: { host: '127.0.0.1', port: 8180, rules: await readFile('firestore.rules', 'utf8') } });
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const [path, data] of [
      ['accounts/owner', { uid: 'owner', personId: 'canonical-person', role: 'member', status: 'active', committeeId: '' }],
      ['accounts/president', { uid: 'president', personId: 'president-person', role: 'president', status: 'active', committeeId: 'area-vashi' }],
      ['people/canonical-person', { personId: 'canonical-person', name: 'Member', photoPaths: ['private.jpg'] }],
      ['people/president-person', { personId: 'president-person', name: 'President' }],
      ['committees/area-vashi', { active: true, name: 'Vashi' }],
      ['committees/area-inactive', { active: false, name: 'Inactive' }],
      ['requests/own', { applicantUid: 'owner', personId: 'canonical-person', status: 'pending' }],
      ['requests/other', { applicantUid: 'president', personId: 'president-person', status: 'pending' }],
      ['affiliations/own', { personId: 'canonical-person', status: 'active' }],
      ['affiliations/other', { personId: 'president-person', status: 'active' }],
      ['workspaceEvents/owner', { revision: 1 }],
      ['phoneIndex/private', { personId: 'canonical-person' }],
      ['invitations/private', { phoneNumber: '+919000000001' }],
      ['birthdayDeliveries/private', { email: 'private@example.com' }],
      ['people/canonical-person/access/area-vashi', { active: true }],
    ]) await setDoc(doc(db, path), data);
  });
});
after(async () => { await env?.cleanup(); });
const dbFor = uid => uid ? env.authenticatedContext(uid).firestore() : env.unauthenticatedContext().firestore();

test('only the account owner can read account metadata, including a missing onboarding account', async () => {
  await assertSucceeds(getDoc(doc(dbFor('owner'), 'accounts', 'owner')));
  await assertSucceeds(getDoc(doc(dbFor('new-user'), 'accounts', 'new-user')));
  await assertFails(getDoc(doc(dbFor('president'), 'accounts', 'owner')));
  await assertFails(getDoc(doc(dbFor(), 'accounts', 'owner')));
  await assertFails(getDocs(collection(dbFor('owner'), 'accounts')));
});
test('profile ownership uses the trusted canonical person ID rather than the auth UID', async () => {
  assert.equal((await assertSucceeds(getDoc(doc(dbFor('owner'), 'people', 'canonical-person')))).data().name, 'Member');
  await assertFails(getDoc(doc(dbFor('owner'), 'people', 'president-person')));
  await assertFails(getDoc(doc(dbFor('canonical-person'), 'people', 'canonical-person')));
  await assertFails(getDoc(doc(dbFor('president'), 'people', 'canonical-person')));
  await assertFails(getDocs(collection(dbFor('owner'), 'people')));
});
test('every client account/profile mutation is denied even with valid-looking or oversized data', async () => {
  const db = dbFor('owner');
  await assertFails(setDoc(doc(db, 'accounts', 'owner'), { uid: 'owner', personId: 'canonical-person', role: 'superadmin', status: 'active', committeeId: 'dma-district' }));
  await assertFails(updateDoc(doc(db, 'people', 'canonical-person'), { activeScopeIds: ['dma-district'], name: 'x'.repeat(100000) }));
  await assertFails(deleteDoc(doc(db, 'people', 'canonical-person')));
  await assertFails(setDoc(doc(db, 'people', 'stolen'), { name: 'Stolen', accountUid: 'owner' }));
});
test('active catalogue queries are allowed only after authentication and inactive records are private', async () => {
  assert.equal((await assertSucceeds(getDocs(query(collection(dbFor('owner'), 'committees'), where('active', '==', true))))).size, 1);
  await assertFails(getDocs(collection(dbFor('owner'), 'committees')));
  await assertFails(getDoc(doc(dbFor('owner'), 'committees', 'area-inactive')));
  await assertFails(getDoc(doc(dbFor(), 'committees', 'area-vashi')));
  await assertFails(updateDoc(doc(dbFor('owner'), 'committees', 'area-vashi'), { presidentUid: 'owner' }));
});
test('request queries must be scoped to the authenticated applicant', async () => {
  assert.equal((await assertSucceeds(getDocs(query(collection(dbFor('owner'), 'requests'), where('applicantUid', '==', 'owner'))))).size, 1);
  await assertFails(getDocs(query(collection(dbFor('owner'), 'requests'), where('applicantUid', '==', 'president'))));
  await assertFails(getDoc(doc(dbFor('president'), 'requests', 'own')));
  await assertFails(updateDoc(doc(dbFor('owner'), 'requests', 'own'), { status: 'approved' }));
});
test('affiliation queries must match the canonical person owned by the session', async () => {
  assert.equal((await assertSucceeds(getDocs(query(collection(dbFor('owner'), 'affiliations'), where('personId', '==', 'canonical-person'))))).size, 1);
  await assertFails(getDocs(collection(dbFor('owner'), 'affiliations')));
  await assertFails(getDoc(doc(dbFor('owner'), 'affiliations', 'other')));
  await assertFails(updateDoc(doc(dbFor('owner'), 'affiliations', 'own'), { status: 'active', committeeId: 'cell-obc' }));
});
test('workspace invalidation is private and cannot be written by clients', async () => {
  await assertSucceeds(getDoc(doc(dbFor('owner'), 'workspaceEvents', 'owner')));
  await assertFails(getDoc(doc(dbFor('president'), 'workspaceEvents', 'owner')));
  await assertFails(setDoc(doc(dbFor('owner'), 'workspaceEvents', 'owner'), { revision: 100 }));
});
test('identity indexes, invitations, activity, deliveries, access grants and legacy data are server only', async () => {
  for (const path of ['phoneIndex/private', 'invitations/private', 'activity/private', 'birthdayDeliveries/private', 'system/birthday-service', 'people/canonical-person/access/area-vashi', 'presidents/owner', 'presidents/owner/members/9000000001']) {
    await assertFails(getDoc(doc(dbFor('owner'), path)));
    await assertFails(setDoc(doc(dbFor('owner'), path), { active: true, role: 'superadmin' }));
  }
});
