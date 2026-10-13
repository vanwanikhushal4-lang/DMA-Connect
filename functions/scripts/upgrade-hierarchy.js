// Dry-run by default. Preserves identities and affiliations; adds state ancestry.
import { FieldValue } from 'firebase-admin/firestore';
import { apply, db, projectId } from './context.js';
import { stateId, districtId, teamLevels, seedCommittees } from '../src/domain.js';

const records = await db.collection('committees').get();
const catalogue = new Map(records.docs.map(s => [s.id, { ...s.data(), id: s.id }]));
if (!catalogue.has(stateId)) catalogue.set(stateId, seedCommittees()[0]);
const visiting = new Set();
function upgrade(id) {
  const c = catalogue.get(id);
  if (!c) throw new Error('Missing hierarchy parent: ' + id);
  if (c.upgraded) return c;
  if (visiting.has(id)) throw new Error('Hierarchy cycle: ' + id);
  visiting.add(id);
  if (id === stateId) c.parentId = '';
  if (id === districtId) c.parentId = stateId;
  if (c.level === 'area') c.level = 'taluka';
  const parent = c.parentId ? upgrade(c.parentId) : null;
  c.ancestorIds = [...(parent?.ancestorIds || []), id];
  c.teamId = teamLevels.includes(c.level) ? id : parent?.teamId;
  c.appointmentTeamId = parent?.teamId || id;
  if (!c.teamId) throw new Error('Missing operational team: ' + id);
  c.upgraded = true; visiting.delete(id); return c;
}
for (const id of catalogue.keys()) upgrade(id);
const accounts = await db.collection('accounts').get();
const owners = accounts.docs.filter(s => s.data().role === 'superadmin');
if (owners.length > 1) throw new Error('Resolve duplicate central owners before upgrading.');
console.log(JSON.stringify({ projectId, apply, committees: catalogue.size, ownerCount: owners.length, change: 'State → District → Taluka; one maker/checker seat at each of those levels. Presidents become view-only.' }, null, 2));
if (apply) {
  // Chunk writes; fail-closed permissions are installed before any data upgrade.
  const writes = [];
  for (const c of catalogue.values()) {
    const { upgraded, ...data } = c;
    if (owners.some(s => s.id === data.presidentUid)) { data.presidentUid = ''; data.presidentName = ''; }
    writes.push([db.collection('committees').doc(c.id), { ...data, updatedAt: FieldValue.serverTimestamp() }]);
  }
  for (const s of accounts.docs) {
    const a = s.data();
    const c = catalogue.get(a.committeeId);
    writes.push([s.ref, { ...a, ...(a.role === 'superadmin' ? { level: 'state', committeeId: stateId, parentCommitteeId: '' } : c ? { level: c.level, parentCommitteeId: c.parentId } : {}), updatedAt: FieldValue.serverTimestamp() }]);
  }
  for (const collection of ['affiliations', 'requests']) {
    for (const s of (await db.collection(collection).get()).docs) {
      const c = catalogue.get(s.data().committeeId);
      if (c) writes.push([s.ref, { ...s.data(), ancestorIds: c.ancestorIds }]);
    }
  }
  for (const s of (await db.collection('people').get()).docs) {
    const active = await db.collection('affiliations').where('personId', '==', s.id).where('status', '==', 'active').get();
    const scopes = [...new Set(active.docs.flatMap(a => catalogue.get(a.data().committeeId)?.ancestorIds || []))];
    writes.push([s.ref, { ...s.data(), activeScopeIds: scopes }]);
    for (const scope of scopes) writes.push([s.ref.collection('access').doc(scope), { active: true }]);
  }
  // Legacy, unchecked president invitations must be resubmitted through a maker.
  for (const s of (await db.collection('invitations').where('status', '==', 'pending').get()).docs) {
    if (!s.data().workId && !s.data().setupBy) {
      writes.push([s.ref, { ...s.data(), status: 'cancelled', reason: 'Resubmit through the maker/checker workflow.', cancelledAt: FieldValue.serverTimestamp() }]);
      const c = catalogue.get(s.data().committeeId);
      if (c?.pendingInvitationId === s.id) writes.push([db.collection('committees').doc(c.id), { pendingInvitationId: '' }]);
    }
  }
  for (let i = 0; i < writes.length; i += 350) {
    const batch = db.batch();
    for (const [ref, data] of writes.slice(i, i + 350)) batch.set(ref, data, { merge: true });
    await batch.commit();
  }
  await db.collection('system').doc('hierarchy').set({ version: 2, upgradedAt: FieldValue.serverTimestamp() });
  console.log('Hierarchy upgraded. Configure makers and checkers before account creation.');
}
