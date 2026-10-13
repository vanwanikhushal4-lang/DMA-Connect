import { FieldValue } from 'firebase-admin/firestore';
import { apply, argument, auth, db, projectId } from './context.js';
import { districtId, normalizePhone, seedCommittees } from '../src/domain.js';

const phone = argument('phone'), name = argument('district');
if (!phone || !name) throw new Error('Provide --phone with the Super Admin mobile and --district with the district display name. Add --apply after reviewing the plan.');
const phoneNumber = normalizePhone(phone);
const root = await db.collection('committees').doc(districtId).get();
const legacyUid = argument('legacy-uid');
let user;
try { user = legacyUid ? await auth.getUser(legacyUid) : await auth.getUserByPhoneNumber(phoneNumber); }
catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
if (root.data()?.presidentUid && root.data().presidentUid !== user?.uid) throw new Error('A different Super Admin is already configured. No account has been changed.');
console.log(JSON.stringify({ projectId, district: name, phoneNumber, account: user ? 'Use existing verified identity' : 'Create phone identity', initialAreaCount: 8, initialCellCount: 3, apply }, null, 2));
if (apply) {
  if (!user) user = await auth.createUser({ phoneNumber });
  if (legacyUid && user.phoneNumber !== phoneNumber) user = await auth.updateUser(user.uid, { phoneNumber });
  await db.runTransaction(async tx => {
    const accountRef = db.collection('accounts').doc(user.uid), current = await tx.get(accountRef);
    const catalogue = seedCommittees(name);
    const existing = await Promise.all(catalogue.map(c => tx.get(db.collection('committees').doc(c.id))));
    for (let i = 0; i < catalogue.length; i++) {
      const c = catalogue[i];
      if (!existing[i].exists) tx.set(existing[i].ref, { ...c, presidentName: '', pendingInvitationId: '', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), ...(c.id === districtId ? { presidentUid: user.uid } : {}) });
      else if (c.id === districtId) tx.update(existing[i].ref, { name, presidentUid: user.uid, updatedAt: FieldValue.serverTimestamp() });
    }
    tx.set(accountRef, { ...(current.data() || {}), uid: user.uid, personId: current.data()?.personId || user.uid, role: 'superadmin', level: 'district', committeeId: districtId, parentCommitteeId: '', status: 'active', districtId, phoneNumber, createdBy: 'bootstrap', createdAt: current.data()?.createdAt || FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    tx.set(db.collection('activity').doc(), { actorUid: 'bootstrap', action: 'configure-superadmin', target: user.uid, createdAt: FieldValue.serverTimestamp() });
  });
  console.log('Super Admin and committee catalogue configured. Sign in with this phone and complete the profile.');
}
