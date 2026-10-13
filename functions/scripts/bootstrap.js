import { FieldValue } from 'firebase-admin/firestore';
import { apply, argument, auth, db, projectId } from './context.js';
import { stateId, districtId, normalizePhone, seedCommittees } from '../src/domain.js';

const phone = argument('phone'), name = argument('district'), stateName = argument('state', 'Maharashtra');
if (!phone || !name) throw new Error('Provide --phone and --district. Optionally provide --state. Dry-run by default; use --apply after review.');
const phoneNumber = normalizePhone(phone), legacyUid = argument('legacy-uid');
let user;
try { user = legacyUid ? await auth.getUser(legacyUid) : await auth.getUserByPhoneNumber(phoneNumber); } catch (e) { if (e.code !== 'auth/user-not-found') throw e; }
const owners = await db.collection('accounts').where('role', '==', 'superadmin').get();
if (owners.docs.some(s => s.id !== user?.uid)) throw new Error('A different Super Admin is already configured. No account has been changed.');
console.log(JSON.stringify({ projectId, state: stateName, district: name, phoneNumber, apply }, null, 2));
if (apply) {
  if (!user) user = await auth.createUser({ phoneNumber });
  if (legacyUid && user.phoneNumber !== phoneNumber) user = await auth.updateUser(user.uid, { phoneNumber });
  await db.runTransaction(async tx => {
    const accountRef = db.collection('accounts').doc(user.uid), current = await tx.get(accountRef);
    const currentOwners = await tx.get(db.collection('accounts').where('role', '==', 'superadmin'));
    if (currentOwners.docs.some(s => s.id !== user.uid)) throw new Error('Another central owner has been configured.');
    const catalogue = seedCommittees(name, stateName);
    const existing = await Promise.all(catalogue.map(c => tx.get(db.collection('committees').doc(c.id))));
    for (let i = 0; i < catalogue.length; i++) if (!existing[i].exists) tx.set(existing[i].ref, { ...catalogue[i], presidentName: '', pendingInvitationId: '', createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    tx.set(accountRef, { ...(current.data() || {}), uid: user.uid, personId: current.data()?.personId || user.uid, role: 'superadmin', level: 'state', committeeId: stateId, parentCommitteeId: '', status: 'active', districtId, phoneNumber, createdBy: 'bootstrap', createdAt: current.data()?.createdAt || FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    tx.set(db.collection('system').doc('owner'), { uid: user.uid });
    tx.set(db.collection('activity').doc(), { actorUid: 'bootstrap', action: 'configure-superadmin', target: user.uid, createdAt: FieldValue.serverTimestamp() });
  });
  console.log('Super Admin and hierarchy configured. Set up one maker and one checker per State, District and Taluka.');
}
