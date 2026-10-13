import { createHash } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import { apply, argument, auth, db, projectId } from './context.js';
import { normalizePhone, phoneKey } from '../src/domain.js';

const owner = argument('owner'), committeeId = argument('committee');
if (!owner || !committeeId) throw new Error('Provide --owner with the legacy president UID and --committee with the confirmed destination committee. The default is a dry run; add --apply to copy records.');
const [legacy, target, members] = await Promise.all([db.collection('presidents').doc(owner).get(), db.collection('committees').doc(committeeId).get(), db.collection('presidents').doc(owner).collection('members').get()]);
if (!legacy.exists || !target.exists || !target.data().active || target.data().level === 'district') throw new Error('Choose an existing legacy owner and an active confirmed area or cell committee.');
const plan = [], conflicts = [];
for (const member of members.docs) {
  const old = member.data(), phoneNumber = normalizePhone(old.mobile), key = phoneKey(phoneNumber);
  const personId = 'legacy-' + createHash('sha256').update(owner + ':' + member.id).digest('hex').slice(0, 40);
  const index = await db.collection('phoneIndex').doc(key).get();
  if (index.exists && index.data().personId !== personId) { conflicts.push({ source: member.ref.path, reason: 'Phone already belongs to a different canonical profile' }); continue; }
  const dob = old.dob?.toDate?.().toISOString().slice(0, 10) || old.dob;
  const areaId = target.data().areaId || '';
  plan.push({ old, personId, phoneNumber, key, dob, areaId, sourcePath: member.ref.path });
}
console.log(JSON.stringify({ projectId, owner, committeeId, recordsToCopy: plan.length, conflicts, apply, originalsPreserved: true }, null, 2));
if (conflicts.length) throw new Error('Resolve duplicate phone identities before applying this owner’s migration. Nothing has been written.');
if (apply) {
  for (const item of plan) await db.runTransaction(async tx => {
    const personRef = db.collection('people').doc(item.personId), indexRef = db.collection('phoneIndex').doc(item.key);
    const [person, index] = await Promise.all([tx.get(personRef), tx.get(indexRef)]);
    if (index.exists && index.data().personId !== item.personId) throw new Error('A phone identity changed during migration. Stop and review.');
    if (person.exists) return;
    tx.set(personRef, { personId: item.personId, accountUid: '', name: item.old.name, nameSearch: item.old.name.toLowerCase(), email: item.old.email || '', mobile: item.phoneNumber.slice(3), phoneNumber: item.phoneNumber, residence: item.old.residence, dob: item.dob, birthdayKey: item.dob.slice(5), areaId: item.areaId, taluka: item.old.taluka, socials: { facebook: '', linkedin: '', instagram: '' }, photoPaths: [], birthdayEmailsEnabled: false, activeMember: true, activeScopeIds: target.data().ancestorIds, activeCommitteeIds: [committeeId], source: 'legacy', legacySourcePath: item.sourcePath, createdBy: owner, createdAt: item.old.createdAt || FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    tx.set(indexRef, { personId: item.personId, phoneNumber: item.phoneNumber });
    tx.set(db.collection('affiliations').doc(item.personId + '__' + committeeId), { personId: item.personId, accountUid: '', committeeId, committeeName: target.data().name, branch: target.data().branch, ancestorIds: target.data().ancestorIds, status: 'active', approvedBy: 'migration', createdAt: item.old.createdAt || FieldValue.serverTimestamp() });
    for (const scope of target.data().ancestorIds) tx.set(personRef.collection('access').doc(scope), { active: true });
    tx.set(db.collection('activity').doc(), { actorUid: 'migration', action: 'import-member', target: item.personId, sourcePath: item.sourcePath, createdAt: FieldValue.serverTimestamp() });
  });
  const user = await auth.getUser(owner), previous = legacy.data();
  const accountRef = db.collection('accounts').doc(owner);
  if (!(await accountRef.get()).exists) {
    const batch = db.batch();
    batch.set(accountRef, { uid: owner, personId: owner, role: 'member', level: 'member', committeeId: '', parentCommitteeId: '', status: 'active', districtId: 'dma-district', phoneNumber: user.phoneNumber || '', createdBy: 'migration', createdAt: previous.createdAt || FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    batch.set(db.collection('people').doc(owner), { personId: owner, accountUid: owner, name: previous.name, nameSearch: previous.name.toLowerCase(), email: user.email || previous.email, mobile: user.phoneNumber ? user.phoneNumber.slice(3) : previous.mobile, phoneNumber: user.phoneNumber || '', residence: '', dob: '', birthdayKey: '', areaId: '', taluka: previous.taluka || '', socials: { facebook: '', linkedin: '', instagram: '' }, photoPaths: [], birthdayEmailsEnabled: false, activeMember: false, activeScopeIds: [], activeCommitteeIds: [], source: 'legacy-account', createdBy: 'migration', createdAt: previous.createdAt || FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    await batch.commit();
  }
  console.log('Migration copied member records and preserved their original sources. Legacy account roles require explicit appointments.');
}
