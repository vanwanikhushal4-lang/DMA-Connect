import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldPath, FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { Resend } from 'resend';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { birthdayDeliveryId, birthdayDue, birthdayMessage, canAppoint, canReview, canViewScope, districtId, stateId, teamLevels, seatField, pendingSeatField, indiaDate, normalizePhone, phoneKey, slug, validateProfile } from './domain.js';

const projectId = process.env.GCLOUD_PROJECT || 'dma-connect-foundation';
initializeApp({ storageBucket: process.env.STORAGE_BUCKET || `${projectId}.firebasestorage.app` });
const db = getFirestore('dma-connect');
const bucket = getStorage().bucket();
const timestamp = () => FieldValue.serverTimestamp();
const resendKey = defineSecret('RESEND_API_KEY');
const sender = defineString('BIRTHDAY_FROM_EMAIL', { default: '' });
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const fail = (code, message) => { throw new HttpsError(code, message); };
const uidOf = request => request.auth?.uid || fail('unauthenticated', 'Verify your mobile number to continue.');
const ref = (collection, id) => {
  if (typeof id !== 'string' || !/^[\w-]{1,300}$/.test(id)) fail('invalid-argument', 'Choose a valid record.');
  return db.collection(collection).doc(id);
};
const audit = (tx, uid, action, target, details = {}) => tx.set(ref('activity', randomUUID()), { actorUid: uid, action, target, details, createdAt: timestamp() });
const bump = (tx, uid) => { if (uid) tx.set(ref('workspaceEvents', uid), { updatedAt: timestamp() }, { merge: true }); };
function serialize(data, id) {
  return Object.fromEntries(Object.entries({ ...data, id }).map(([key, value]) => [key, value instanceof Timestamp ? value.toDate().toISOString() : value]));
}
async function phoneUser(uid) {
  const user = await getAuth().getUser(uid);
  if (user.disabled || !user.phoneNumber) fail('failed-precondition', 'Verify your own mobile number with OTP first.');
  normalizePhone(user.phoneNumber);
  return user;
}
async function actor(uid, tx) {
  const snapshot = await (tx ? tx.get(ref('accounts', uid)) : ref('accounts', uid).get());
  if (!snapshot.exists || snapshot.data().status !== 'active') fail('permission-denied', 'An active account is required.');
  return { ...snapshot.data(), uid };
}
async function staff(uid, tx) {
  const a = await actor(uid, tx);
  if (!['superadmin', 'president', 'maker', 'checker'].includes(a.role)) fail('permission-denied', 'An appointed staff account is required.');
  if (a.role !== 'superadmin') {
    const c = await (tx ? tx.get(ref('committees', a.committeeId)) : ref('committees', a.committeeId).get());
    if (!c.exists || !c.data().active || c.data()[seatField(a.role)] !== uid) fail('permission-denied', 'Your committee appointment is inactive.');
    a.staffName = c.data()[a.role + 'Name'] || a.phoneNumber;
  }
  return a;
}
async function committee(id, tx) {
  if (typeof id !== 'string' || !/^[\w-]{1,160}$/.test(id)) fail('invalid-argument', 'Choose a valid committee.');
  const s = await (tx ? tx.get(ref('committees', id)) : ref('committees', id).get());
  if (!s.exists) fail('not-found', 'This committee no longer exists.');
  return { ...s.data(), id };
}
async function reviewCommittee(id, tx) {
  const target = await committee(id, tx);
  const team = await committee(target.teamId, tx);
  return { ...target, teamCheckerUid: team.active ? team.checkerUid : '' };
}
async function maker(uid, tx) {
  const a = await staff(uid, tx);
  if (a.role !== 'maker' || !teamLevels.includes(a.level)) fail('permission-denied', 'Only the appointed maker can submit account or member work.');
  return a;
}
async function approvedActor(tx, makerUid, approval, operation) {
  if (!approval?.workId || !approval.uid || makerUid === approval.uid) fail('permission-denied', 'A separate checker approval is required.');
  const item = await tx.get(ref('workItems', approval.workId));
  if (!item.exists || item.data().status !== 'pending' || item.data().operation !== operation || item.data().createdBy !== makerUid) fail('failed-precondition', 'This work has already been handled or is unavailable.');
  const a = await maker(makerUid, tx), checker = await staff(approval.uid, tx);
  if (checker.role !== 'checker' || checker.committeeId !== a.committeeId || item.data().teamId !== a.committeeId) fail('permission-denied', 'Only this maker’s assigned checker can approve the work.');
  if (JSON.stringify(item.data().payload) !== JSON.stringify(approval.payload)) fail('aborted', 'The submitted work changed. Reload before reviewing.');
  return a;
}
function finishWork(tx, approval, result) {
  tx.update(ref('workItems', approval.workId), { status: 'approved', reviewedBy: approval.uid, reviewedByName: approval.name, reason: approval.reason, reviewedAt: timestamp(), updatedAt: timestamp(), result });
  audit(tx, approval.uid, 'approve-work', approval.workId);
  bump(tx, approval.uid);
}
async function submitWork(uid, operation, data) {
  await phoneUser(uid);
  const a = await maker(uid), team = await committee(a.committeeId);
  if (!team.checkerUid || team.checkerUid === uid) fail('failed-precondition', 'Assign a separate checker to this team before submitting work.');
  await staff(team.checkerUid);
  let payload, target;
  if (operation === 'addMember') {
    const phoneNumber = normalizePhone(data.mobile);
    payload = { ...validateProfile(data, phoneNumber), committeeId: data.committeeId };
    target = await committee(data.committeeId);
    const home = await committee(payload.areaId);
    if (!home.active || home.level !== 'taluka') fail('invalid-argument', 'Choose an active home area.');
    if (!target.active || ['state', 'district'].includes(target.level) || !canViewScope(a, target)) fail('permission-denied', 'Choose a membership committee inside your scope.');
    await assertPhotoPaths(payload.photoPaths, 'new-member', uid);
    if ((await ref('phoneIndex', phoneKey(phoneNumber)).get()).exists) fail('already-exists', 'This mobile already has a profile. Ask the member to request affiliation.');
  } else if (operation === 'createInvitation') {
    const role = data.role || 'president';
    if (!['president', 'member'].includes(role)) fail('permission-denied', 'Team maker/checker seats are configured by the Super Admin.');
    if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 120 || typeof data.email !== 'string' || data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) fail('invalid-argument', 'Enter a name and valid email.');
    payload = { name: data.name.trim(), email: data.email.trim().toLowerCase(), mobile: normalizePhone(data.mobile), role, committeeId: role === 'president' ? data.committeeId : '' };
    if (role === 'president') {
      target = await committee(data.committeeId);
      if (!canAppoint(a, target)) fail('permission-denied', 'This president appointment belongs to another team.');
      if (target.presidentUid || target.pendingInvitationId) fail('already-exists', 'This president seat is already occupied or reserved.');
    }
  } else if (operation === 'changeAppointment') {
    if (typeof data.uid !== 'string' || data.uid === uid || data.uid === team.checkerUid) fail('invalid-argument', 'Choose a member or president account.');
    const account = await ref('accounts', data.uid).get();
    if (!account.exists || !['member', 'president'].includes(account.data().role)) fail('permission-denied', 'Operational team roles cannot be changed through this workflow.');
    const oldCommittee = account.data().committeeId ? await committee(account.data().committeeId) : null;
    if (oldCommittee ? !canAppoint(a, oldCommittee) : !(await personVisible(uid, account.data().personId))) fail('permission-denied', 'This account is outside your team authority.');
    target = data.committeeId ? await committee(data.committeeId) : oldCommittee;
    if (data.committeeId && !canAppoint(a, target)) fail('permission-denied', 'This appointment belongs to another team.');
    if (data.role && data.role !== 'member') fail('invalid-argument', 'Choose a president appointment or remove the appointment.');
    if (data.status && !['active', 'suspended'].includes(data.status)) fail('invalid-argument', 'Choose active or suspended.');
    if (!data.committeeId && !data.role && !data.status) fail('invalid-argument', 'Choose an account change.');
    const person = (await ref('people', account.data().personId).get()).data();
    if (!person) fail('failed-precondition', 'The account profile is unavailable.');
    const { name, email, mobile, residence, dob, areaId, socials, photoPaths } = person;
    payload = { uid: data.uid, name, subjectProfile: { name, email, mobile, residence, dob, areaId, socials, photoPaths }, ...(data.committeeId ? { committeeId: data.committeeId } : {}), ...(data.role ? { role: data.role } : {}), ...(data.status ? { status: data.status } : {}) };
  } else fail('invalid-argument', 'Choose a supported work type.');
  const id = randomUUID();
  await db.runTransaction(async tx => {
    const current = await maker(uid, tx), currentTeam = await committee(current.committeeId, tx);
    const checker = currentTeam.checkerUid ? await staff(currentTeam.checkerUid, tx) : null;
    if (current.committeeId !== a.committeeId || checker?.role !== 'checker' || checker.committeeId !== a.committeeId || checker.uid === uid) fail('failed-precondition', 'This team needs an active separate checker.');
    const person = await tx.get(ref('people', a.personId));
    tx.set(ref('workItems', id), { id, operation, payload, name: payload.name || 'Account change', teamId: a.committeeId, teamName: team.name, createdBy: uid, createdByName: person.data()?.name || 'Maker', scopeIds: [...new Set([...team.ancestorIds, ...(target?.ancestorIds || [])])], status: 'pending', reviewedBy: '', reason: '', createdAt: timestamp(), updatedAt: timestamp() });
    audit(tx, uid, 'submit-work', id, { operation, teamId: a.committeeId });
    bump(tx, uid); bump(tx, currentTeam.checkerUid); bump(tx, currentTeam.presidentUid);
  });
  return { workId: id, status: 'pending' };
}
async function workDetail(uid, data) {
  const a = await staff(uid), item = await ref('workItems', data.workId).get();
  if (!item.exists || (a.role !== 'superadmin' && !item.data().scopeIds.includes(a.committeeId))) fail('permission-denied', 'This work is outside your scope.');
  return { item: serialize(item.data(), item.id) };
}
async function workPhoto(uid, data) {
  const { item } = await workDetail(uid, data);
  if (typeof data.path !== 'string' || !(item.payload.photoPaths || item.payload.subjectProfile?.photoPaths)?.includes(data.path)) fail('permission-denied', 'This photograph is not attached to the work.');
  const [bytes] = await bucket.file(data.path).download();
  const photo = await sharp(bytes).resize(300, 300, { fit: 'inside' }).jpeg({ quality: 78 }).toBuffer();
  return { uri: 'data:image/jpeg;base64,' + photo.toString('base64') };
}
async function workDirectory(uid, data = {}) {
  const a = await staff(uid);
  const status = ['pending', 'approved', 'declined', 'withdrawn'].includes(data.status) ? data.status : 'pending';
  let q = db.collection('workItems').where('status', '==', status);
  if (a.role !== 'superadmin') q = q.where('scopeIds', 'array-contains', a.committeeId);
  q = q.orderBy('createdAt', 'desc').orderBy(FieldPath.documentId()).limit(51);
  if (data.cursor) {
    const { item } = await workDetail(uid, { workId: data.cursor });
    if (item.status !== status) fail('invalid-argument', 'Refresh this work list before continuing.');
    q = q.startAfter(await ref('workItems', data.cursor).get());
  }
  const records = await q.get(), page = records.docs.slice(0, 50);
  return { items: page.map(s => { const { payload, ...summary } = s.data(); return serialize({ ...summary, phoneNumber: payload.mobile || '', role: payload.role || '', committeeId: payload.committeeId || '' }, s.id); }), nextCursor: records.size > 50 ? page.at(-1).id : null };
}
async function withdrawWork(uid, data) {
  await db.runTransaction(async tx => {
    await maker(uid, tx);
    const item = await tx.get(ref('workItems', data.workId));
    if (!item.exists || item.data().createdBy !== uid || item.data().status !== 'pending') fail('permission-denied', 'Withdraw only your own pending work.');
    tx.update(item.ref, { status: 'withdrawn', updatedAt: timestamp() });
    audit(tx, uid, 'withdraw-work', item.id); bump(tx, uid);
  });
  return { ok: true };
}
async function reviewWork(uid, data) {
  if (!['approved', 'declined'].includes(data.decision)) fail('invalid-argument', 'Choose approve or reject.');
  const { item } = await workDetail(uid, data);
  const reviewer = await staff(uid);
  const approval = { uid, name: reviewer.staffName || reviewer.phoneNumber, workId: item.id, payload: item.payload, reason: typeof data.reason === 'string' ? data.reason.trim().slice(0, 500) : '' };
  if (data.decision === 'declined') {
    if (!approval.reason) fail('invalid-argument', 'Explain why this work is rejected.');
    await db.runTransaction(async tx => {
      await approvedActor(tx, item.createdBy, approval, item.operation);
      tx.update(ref('workItems', item.id), { status: 'declined', reviewedBy: uid, reviewedByName: approval.name, reason: approval.reason, reviewedAt: timestamp(), updatedAt: timestamp() });
      audit(tx, uid, 'decline-work', item.id); bump(tx, item.createdBy); bump(tx, uid);
    });
  } else {
    const handler = { addMember, createInvitation, changeAppointment }[item.operation];
    if (!handler) fail('invalid-argument', 'Unsupported work operation.');
    await handler(item.createdBy, item.payload, approval);
  }
  return { ok: true };
}
async function configureTeam(uid, data) {
  if ((await staff(uid)).role !== 'superadmin' || !['maker', 'checker'].includes(data.role)) fail('permission-denied', 'Only the Super Admin configures maker/checker seats.');
  if (!data.uid) return createInvitation(uid, data);
  await db.runTransaction(async tx => {
    if ((await staff(uid, tx)).role !== 'superadmin') fail('permission-denied', 'Super Admin access is required.');
    const target = await committee(data.committeeId, tx), account = await tx.get(ref('accounts', data.uid));
    if (!target.active || !teamLevels.includes(target.level) || !account.exists || account.data().role === 'superadmin') fail('invalid-argument', 'Choose an active State, District or Taluka team and an existing account.');
    const old = account.data(), oldCommittee = old.committeeId ? await committee(old.committeeId, tx) : null;
    const person = await tx.get(ref('people', old.personId));
    if (data.remove === true) {
      if (old.role !== data.role || old.committeeId !== target.id || target[seatField(data.role)] !== data.uid) fail('invalid-argument', 'Choose the account currently holding this team seat.');
      tx.update(account.ref, { role: 'member', level: 'member', committeeId: '', parentCommitteeId: '', updatedAt: timestamp() });
      tx.update(ref('committees', target.id), { [seatField(data.role)]: '', [data.role + 'Name']: '', updatedAt: timestamp() });
      audit(tx, uid, 'remove-team-seat', data.uid, { role: data.role, committeeId: target.id }); bump(tx, data.uid); bump(tx, uid);
      return;
    }
    if ((target[seatField(data.role)] && target[seatField(data.role)] !== data.uid) || target[pendingSeatField(data.role)]) fail('already-exists', 'This seat is already occupied or reserved.');
    if (target[data.role === 'maker' ? 'checkerUid' : 'makerUid'] === data.uid) fail('permission-denied', 'Maker and checker must be separate people.');
    if (oldCommittee && seatField(old.role) && oldCommittee[seatField(old.role)] === data.uid) tx.update(ref('committees', oldCommittee.id), { [seatField(old.role)]: '', [old.role + 'Name']: '', updatedAt: timestamp() });
    tx.update(account.ref, { role: data.role, level: target.level, committeeId: target.id, parentCommitteeId: target.parentId, status: 'active', updatedAt: timestamp() });
    tx.update(ref('committees', target.id), { [seatField(data.role)]: data.uid, [data.role + 'Name']: person.data()?.name || '', updatedAt: timestamp() });
    audit(tx, uid, 'configure-team', data.uid, { role: data.role, committeeId: target.id }); bump(tx, data.uid); bump(tx, uid);
  });
  return { ok: true };
}
async function assertPhotoPaths(paths, personId, creatorUid, retained = []) {
  for (const path of paths) {
    if (!retained.includes(path) && !path.startsWith(`people/${personId}/`) && !path.startsWith(`drafts/${creatorUid}/`)) fail('permission-denied', 'Use photographs uploaded for this profile.');
    const [exists] = await bucket.file(path).exists();
    if (!exists) fail('invalid-argument', 'A photograph has not finished uploading. Try again.');
  }
}
async function personVisible(uid, personId) {
  const a = await actor(uid);
  if (a.personId === personId) return true;
  if (!['superadmin', 'president', 'maker', 'checker'].includes(a.role)) return false;
  await staff(uid);
  if (a.role === 'superadmin') return true;
  const person = await ref('people', personId).get();
  if (person.data()?.accountUid) {
    const appointed = await ref('accounts', person.data().accountUid).get();
    if (['president', 'maker', 'checker'].includes(appointed.data()?.role) && appointed.data().committeeId && canViewScope(a, await committee(appointed.data().committeeId))) return true;
  }
  const links = await ref('people', personId).collection('access').doc(a.committeeId).get();
  return links.exists && links.data().active === true;
}
async function uploadPhoto(uid, data) {
  await phoneUser(uid);
  const account = await ref('accounts', uid).get();
  if (account.exists && account.data().status !== 'active') fail('permission-denied', 'This account has been suspended.');
  if (typeof data.base64 !== 'string' || data.base64.length > MAX_PHOTO_BYTES * 1.4 || !/^[A-Za-z0-9+/=\r\n]+$/.test(data.base64)) fail('invalid-argument', 'Choose an image smaller than 3 MB.');
  const bytes = Buffer.from(data.base64, 'base64');
  if (bytes.length > MAX_PHOTO_BYTES) fail('invalid-argument', 'Choose an image smaller than 3 MB.');
  const image = sharp(bytes, { limitInputPixels: 40_000_000 });
  const meta = await image.metadata();
  if (!['jpeg', 'png', 'webp'].includes(meta.format)) fail('invalid-argument', 'Choose a JPEG, PNG or WebP photograph.');
  const jpeg = await image.rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
  const path = `drafts/${uid}/${randomUUID()}.jpg`;
  await bucket.file(path).save(jpeg, { resumable: false, metadata: { contentType: 'image/jpeg', metadata: { uploadedBy: uid } } });
  return { path };
}
async function completeProfile(uid, data) {
  const user = await phoneUser(uid);
  const clean = validateProfile(data, user.phoneNumber);
  const area = await committee(clean.areaId);
  if (area.level !== 'taluka' || !area.active) fail('invalid-argument', 'Choose an active home area.');
  const key = phoneKey(user.phoneNumber);
  const index = await ref('phoneIndex', key).get();
  const existingIdentity = await ref('accounts', uid).get();
  if (existingIdentity.exists && existingIdentity.data().status !== 'active') fail('permission-denied', 'This account has been suspended. Contact the Super Admin.');
  const personId = existingIdentity.data()?.personId || (index.exists ? index.data().personId : uid);
  const previousPerson = await ref('people', personId).get();
  await assertPhotoPaths(clean.photoPaths, personId, uid, previousPerson.data()?.photoPaths || []);
  if (user.email !== clean.email) await getAuth().updateUser(uid, { email: clean.email, emailVerified: false });
  await db.runTransaction(async tx => {
    const accountRef = ref('accounts', uid), personRef = ref('people', personId), indexRef = ref('phoneIndex', key), inviteRef = ref('invitations', key);
    const [existingAccount, existingPerson, latestIndex, invite] = await Promise.all([tx.get(accountRef), tx.get(personRef), tx.get(indexRef), tx.get(inviteRef)]);
    if (existingAccount.exists && existingAccount.data().status !== 'active') fail('permission-denied', 'This account has been suspended. Contact the Super Admin.');
    if (latestIndex.exists && latestIndex.data().personId !== personId) fail('aborted', 'This mobile number was just registered. Please retry.');
    if (existingPerson.exists && existingPerson.data().accountUid && existingPerson.data().accountUid !== uid) fail('already-exists', 'This person already has an account. Sign in with the linked number.');
    let account = existingAccount.exists ? existingAccount.data() : { role: 'member', level: 'member', committeeId: '', parentCommitteeId: '', createdBy: uid };
    let appointedCommittee;
    if (!existingAccount.exists && invite.exists && invite.data().status === 'pending' && invite.data().expiresAt.toMillis() > Date.now()) {
      const invitation = invite.data();
      if (['president', 'maker', 'checker'].includes(invitation.role)) {
        appointedCommittee = await committee(invitation.committeeId, tx);
        if (appointedCommittee[pendingSeatField(invitation.role)] !== key || appointedCommittee[seatField(invitation.role)]) fail('failed-precondition', 'This appointment is no longer available.');
        if (invitation.setupBy) {
          if ((await staff(invitation.setupBy, tx)).role !== 'superadmin') fail('failed-precondition', 'Team setup needs review by the Super Admin.');
        } else {
          const approval = await tx.get(ref('workItems', invitation.workId));
          if (!approval.exists || approval.data().status !== 'approved' || approval.data().createdBy === approval.data().reviewedBy) fail('failed-precondition', 'This appointment has not received checker approval.');
        }
      }
      account = { role: invitation.role, level: invitation.level, committeeId: invitation.committeeId, parentCommitteeId: appointedCommittee?.parentId || '', createdBy: invitation.createdBy };
    }
    tx.set(personRef, { ...clean, taluka: area.name, personId, accountUid: uid, activeMember: existingPerson.data()?.activeMember || false, activeScopeIds: existingPerson.data()?.activeScopeIds || [], activeCommitteeIds: existingPerson.data()?.activeCommitteeIds || [], source: existingPerson.data()?.source || 'self', createdBy: existingPerson.data()?.createdBy || uid, createdAt: existingPerson.data()?.createdAt || timestamp(), updatedAt: timestamp() }, { merge: true });
    tx.set(accountRef, { ...account, uid, personId, status: 'active', phoneNumber: user.phoneNumber, districtId, createdAt: account.createdAt || timestamp(), updatedAt: timestamp() });
    tx.set(indexRef, { personId, phoneNumber: user.phoneNumber });
    if (appointedCommittee) {
      tx.update(ref('committees', appointedCommittee.id), { [seatField(account.role)]: uid, [account.role + 'Name']: clean.name, [pendingSeatField(account.role)]: '', updatedAt: timestamp() });
      audit(tx, uid, 'accept-president-invitation', appointedCommittee.id);
    }
    if (invite.exists && invite.data().status === 'pending' && account.createdBy === invite.data().createdBy) tx.update(inviteRef, { status: 'accepted', acceptedBy: uid, acceptedAt: timestamp() });
    bump(tx, uid);
  });
  await getAuth().updateUser(uid, { displayName: clean.name });
  return { personId, emailNeedsVerification: !(user.email === clean.email && user.emailVerified) };
}
async function createInvitation(uid, data, approval) {
  await phoneUser(uid);
  const phoneNumber = normalizePhone(data.mobile), id = phoneKey(phoneNumber);
  if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 120 || typeof data.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > 254) fail('invalid-argument', 'Enter a name and valid email for the account.');
  const role = data.role || 'president';
  if (!['president', 'member', 'maker', 'checker'].includes(role)) fail('invalid-argument', 'Choose a valid account type.');
  await db.runTransaction(async tx => {
    const a = approval ? await approvedActor(tx, uid, approval, 'createInvitation') : await staff(uid, tx);
    if (!approval && (a.role !== 'superadmin' || !['maker', 'checker'].includes(role))) fail('permission-denied', 'Account creation requires maker submission and checker approval.');
    const [oldInvite, index] = await Promise.all([tx.get(ref('invitations', id)), tx.get(ref('phoneIndex', id))]);
    let target;
    if (role !== 'member') {
      target = await committee(data.committeeId, tx);
      if (role === 'president' ? !canAppoint(a, target) : a.role !== 'superadmin' || !teamLevels.includes(target.level) || !target.active) fail('permission-denied', 'Choose an authorised appointment.');
      if (target[seatField(role)]) fail('already-exists', 'This role already has an appointed account.');
      if (target[pendingSeatField(role)] && target[pendingSeatField(role)] !== id) fail('already-exists', 'This role already has a pending invitation.');
    } else if (a.role !== 'maker') fail('permission-denied', 'Only makers submit member account invitations.');
    if (index.exists) {
      const person = await tx.get(ref('people', index.data().personId));
      if (person.data()?.accountUid) fail('already-exists', 'This person already has an account. The Super Admin can change their appointment.');
    }
    if (oldInvite.exists && oldInvite.data().status === 'pending' && oldInvite.data().expiresAt.toMillis() > Date.now()) fail('already-exists', 'This number already has a pending invitation.');
    const invitationScope = target ? target.ancestorIds : (await committee(a.committeeId, tx)).ancestorIds;
    tx.set(ref('invitations', id), { scopeIds: invitationScope, phoneNumber, name: data.name.trim(), email: data.email.trim().toLowerCase(), role, level: target?.level || 'member', committeeId: target?.id || '', committeeName: target?.name || '', createdBy: uid, ...(approval ? { workId: approval.workId, approvedBy: approval.uid, teamId: a.committeeId } : { setupBy: uid }), status: 'pending', createdAt: timestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 14 * 24 * 60 * 60 * 1000) });
    if (target) tx.update(ref('committees', target.id), { [pendingSeatField(role)]: id, updatedAt: timestamp() });
    audit(tx, uid, 'create-invitation', id, { role, committeeId: target?.id || '' });
    if (approval) finishWork(tx, approval, { invitationId: id });
    bump(tx, uid);
  });
  return { invitationId: id, phoneNumber };
}
async function addMember(uid, data, approval) {
  await phoneUser(uid);
  const phoneNumber = normalizePhone(data.mobile), key = phoneKey(phoneNumber), personId = 'record-' + randomUUID();
  const clean = validateProfile(data, phoneNumber);
  const area = await committee(clean.areaId);
  if (area.level !== 'taluka' || !area.active) fail('invalid-argument', 'Choose an active home area.');
  await assertPhotoPaths(clean.photoPaths, personId, uid);
  await db.runTransaction(async tx => {
    const a = await approvedActor(tx, uid, approval, 'addMember'), target = await committee(data.committeeId, tx);
    const existing = await tx.get(ref('phoneIndex', key));
    if (!target.active || ['state', 'district'].includes(target.level) || !canViewScope(a, target)) fail('permission-denied', 'Add members only to your assigned committee or an authorised descendant.');
    if (existing.exists) fail('already-exists', 'This mobile number already has a member profile. Ask them to sign in and request this committee.');
    tx.set(ref('people', personId), { ...clean, personId, taluka: area.name, accountUid: '', activeMember: true, activeScopeIds: target.ancestorIds, activeCommitteeIds: [target.id], source: 'maker', createdBy: uid, createdAt: timestamp(), updatedAt: timestamp() });
    tx.set(ref('phoneIndex', key), { personId, phoneNumber });
    tx.set(ref('affiliations', personId + '__' + target.id), { personId, accountUid: '', committeeId: target.id, committeeName: target.name, branch: target.branch, ancestorIds: target.ancestorIds, status: 'active', createdAt: timestamp(), approvedBy: approval.uid });
    for (const scope of target.ancestorIds) tx.set(ref('people', personId).collection('access').doc(scope), { active: true });
    audit(tx, uid, 'add-member', personId, { committeeId: target.id });
    finishWork(tx, approval, { personId });
    bump(tx, uid); bump(tx, target.presidentUid);
  });
  return { personId };
}
async function requestAffiliation(uid, data) {
  await db.runTransaction(async tx => {
    const a = await actor(uid, tx), target = await committee(data.committeeId, tx);
    const id = a.personId + '__' + target.id;
    const [person, previous, membership] = await Promise.all([tx.get(ref('people', a.personId)), tx.get(ref('requests', id)), tx.get(ref('affiliations', id))]);
    if (!person.exists || !person.data().photoPaths?.length) fail('failed-precondition', 'Complete your profile and add a photograph first.');
    if (!target.active || ['state', 'district'].includes(target.level)) fail('invalid-argument', 'Choose an active area or cell committee.');
    if (membership.data()?.status === 'suspended') fail('failed-precondition', 'This affiliation is suspended. Contact this committee’s president or the Super Admin.');
    if (membership.data()?.status === 'active' || previous.data()?.status === 'pending') fail('already-exists', 'You already have a membership or pending request for this committee.');
    tx.set(ref('requests', id), { id, personId: a.personId, applicantUid: uid, applicantName: person.data().name, committeeId: target.id, committeeName: target.name, branch: target.branch, ancestorIds: target.ancestorIds, status: 'pending', createdAt: timestamp(), updatedAt: timestamp(), reviewedBy: '', reason: '' });
    audit(tx, uid, 'request-affiliation', id); bump(tx, target.presidentUid); bump(tx, uid);
  });
  return { ok: true };
}
async function decideRequest(uid, data) {
  if (!['approved', 'declined', 'withdrawn'].includes(data.decision) || typeof data.requestId !== 'string' || data.requestId.length > 300) fail('invalid-argument', 'Choose an approval decision.');
  const reason = typeof data.reason === 'string' ? data.reason.trim().slice(0, 500) : '';
  await db.runTransaction(async tx => {
    const a = await actor(uid, tx), requestRef = ref('requests', data.requestId), requestSnap = await tx.get(requestRef);
    if (!requestSnap.exists || requestSnap.data().status !== 'pending') fail('failed-precondition', 'This request has already been handled.');
    const r = requestSnap.data(), target = await reviewCommittee(r.committeeId, tx);
    if (data.decision === 'withdrawn') {
      if (r.applicantUid !== uid) fail('permission-denied', 'Withdraw only your own request.');
    } else {
      await staff(uid, tx);
      if (r.applicantUid === uid || !target.active || !canReview(a, target)) fail('permission-denied', 'Only the assigned team checker can review this request.');
    }
    const person = await tx.get(ref('people', r.personId));
    if (!person.exists) fail('not-found', 'The member profile is unavailable.');
    tx.update(requestRef, { status: data.decision, reason, reviewedBy: data.decision === 'withdrawn' ? '' : uid, updatedAt: timestamp() });
    if (data.decision === 'approved') {
      tx.set(ref('affiliations', data.requestId), { personId: r.personId, accountUid: r.applicantUid, committeeId: target.id, committeeName: target.name, branch: target.branch, ancestorIds: target.ancestorIds, status: 'active', createdAt: timestamp(), approvedBy: uid });
      tx.update(ref('people', r.personId), { activeMember: true, activeScopeIds: [...new Set([...(person.data().activeScopeIds || []), ...target.ancestorIds])], activeCommitteeIds: [...new Set([...(person.data().activeCommitteeIds || []), target.id])], updatedAt: timestamp() });
      for (const scope of target.ancestorIds) tx.set(ref('people', r.personId).collection('access').doc(scope), { active: true });
    }
    audit(tx, uid, data.decision + '-affiliation', data.requestId); bump(tx, uid); bump(tx, r.applicantUid); bump(tx, target.presidentUid);
  });
  return { ok: true };
}
async function leaveAffiliation(uid, data) {
  const a = await actor(uid), linkRef = ref('affiliations', a.personId + '__' + data.committeeId);
  await db.runTransaction(async tx => {
    const currentActor = await actor(uid, tx);
    if (currentActor.personId !== a.personId) fail('aborted', 'Your profile changed. Please retry.');
    const link = await tx.get(linkRef);
    const links = await tx.get(db.collection('affiliations').where('personId', '==', a.personId).where('status', '==', 'active'));
    if (!link.exists || link.data().status !== 'active') fail('failed-precondition', 'This affiliation is already inactive.');
    const remaining = links.docs.filter(s => s.id !== link.id), scopes = new Set(remaining.flatMap(s => s.data().ancestorIds));
    tx.update(linkRef, { status: 'left', leftAt: timestamp() });
    tx.update(ref('people', a.personId), { activeMember: remaining.length > 0, activeScopeIds: [...scopes], activeCommitteeIds: remaining.map(s => s.data().committeeId), updatedAt: timestamp() });
    for (const scope of link.data().ancestorIds) tx.set(ref('people', a.personId).collection('access').doc(scope), { active: scopes.has(scope) });
    audit(tx, uid, 'leave-affiliation', link.id); bump(tx, uid);
  });
  return { ok: true };
}
async function changeAffiliation(uid, data) {
  if (!['active', 'suspended'].includes(data.status)) fail('invalid-argument', 'Choose active or suspended.');
  await db.runTransaction(async tx => {
    const a = await staff(uid, tx), linkRef = ref('affiliations', data.affiliationId), link = await tx.get(linkRef);
    if (!link.exists || !['active', 'suspended'].includes(link.data().status)) fail('failed-precondition', 'Choose a current committee affiliation.');
    const target = await reviewCommittee(link.data().committeeId, tx);
    if (link.data().accountUid === uid || !canReview(a, target) || (data.status === 'active' && !target.active)) fail('permission-denied', 'Only a separate assigned checker can change this affiliation.');
    const personId = link.data().personId;
    const links = await tx.get(db.collection('affiliations').where('personId', '==', personId).where('status', '==', 'active'));
    const active = links.docs.filter(s => s.id !== link.id).map(s => s.data());
    if (data.status === 'active') active.push(link.data());
    const scopes = new Set(active.flatMap(s => s.ancestorIds));
    tx.update(linkRef, { status: data.status, updatedAt: timestamp(), changedBy: uid });
    tx.update(ref('people', personId), { activeMember: active.length > 0, activeScopeIds: [...scopes], activeCommitteeIds: active.map(s => s.committeeId), updatedAt: timestamp() });
    for (const scope of target.ancestorIds) tx.set(ref('people', personId).collection('access').doc(scope), { active: scopes.has(scope) });
    audit(tx, uid, data.status === 'active' ? 'restore-affiliation' : 'suspend-affiliation', link.id);
    bump(tx, uid); bump(tx, link.data().accountUid);
  });
  return { ok: true };
}
async function affiliationDirectory(uid, data = {}) {
  const a = await staff(uid);
  const status = data.status === 'suspended' ? 'suspended' : 'active';
  let q = db.collection('affiliations').where('status', '==', status);
  if (a.role !== 'superadmin') q = q.where('ancestorIds', 'array-contains', a.committeeId);
  else if (data.committeeId) q = q.where('committeeId', '==', (await committee(data.committeeId)).id);
  q = q.orderBy(FieldPath.documentId()).limit(51);
  if (data.cursor) q = q.startAfter(ref('affiliations', data.cursor).id);
  const snapshot = await q.get(), page = snapshot.docs.slice(0, 50);
  const people = page.length ? await db.getAll(...page.map(s => ref('people', s.data().personId))) : [];
  return { affiliations: page.map((s, i) => ({ ...serialize(s.data(), s.id), personName: people[i].data()?.name || 'Member' })), nextCursor: snapshot.size > 50 ? page.at(-1).id : null };
}
async function lookupAccount(uid, data) {
  await staff(uid);
  const phoneNumber = normalizePhone(data.mobile);
  const user = await getAuth().getUserByPhoneNumber(phoneNumber).catch(error => {
    if (error.code === 'auth/user-not-found') fail('not-found', 'This mobile number has not signed up yet. Create an invitation instead.');
    throw error;
  });
  const account = await ref('accounts', user.uid).get();
  if (!account.exists) fail('failed-precondition', 'This account still needs to complete its member profile.');
  const person = await ref('people', account.data().personId).get();
  if (!person.exists) fail('failed-precondition', 'This account still needs to complete its member profile.');
  if (!(await personVisible(uid, person.id))) fail('permission-denied', 'This account is outside your visible scope.');
  return { account: serialize(account.data(), account.id), person: serialize(person.data(), person.id) };
}
async function createCommittee(uid, data) {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name || name.length > 100 || !slug(name)) fail('invalid-argument', 'Enter a committee name up to 100 characters.');
  await db.runTransaction(async tx => {
    const a = await staff(uid, tx);
    if (a.role !== 'superadmin') fail('permission-denied', 'The Super Admin configures committee units.');
    const parent = await committee(data.parentId, tx);
    const level = data.level;
    if (!parent.active || !((parent.level === 'state' && level === 'district') || (parent.level === 'district' && ['taluka', 'cell'].includes(level)) || (parent.level === 'taluka' && level === 'ward') || (parent.level === 'ward' && level === 'local'))) fail('invalid-argument', 'Choose a valid parent and child level.');
    const id = `${level}-${parent.id}-${slug(name)}`;
    const existing = await tx.get(ref('committees', id));
    if (existing.exists) fail('already-exists', 'That committee already exists under this parent.');
    tx.set(ref('committees', id), { id, name, level, parentId: parent.id, branch: level === 'cell' ? 'cell' : level === 'district' ? 'district' : 'area', areaId: level === 'taluka' ? id : parent.areaId, teamId: teamLevels.includes(level) ? id : parent.teamId, appointmentTeamId: parent.teamId, ancestorIds: [...parent.ancestorIds, id], presidentUid: '', presidentName: '', pendingInvitationId: '', active: true, createdAt: timestamp(), updatedAt: timestamp() });
    audit(tx, uid, 'create-committee', id); bump(tx, uid);
  });
  return { ok: true };
}
async function staffState(uid, data) {
  const a = await staff(uid);
  // These queries serve real-time workspaces, invalidated through owner-only
  // workspaceEvents snapshots. Classic query semantics are also needed by the
  // emulator and transactional approval/access maintenance.
  let requestQuery = db.collection('requests').where('status', '==', 'pending');
  let inviteQuery = db.collection('invitations').where('status', '==', 'pending');
  let accountQuery = db.collection('accounts').where('role', 'in', ['president', 'maker', 'checker']);
  if (a.role !== 'superadmin') {
    requestQuery = requestQuery.where('ancestorIds', 'array-contains', a.committeeId);
    inviteQuery = inviteQuery.where('scopeIds', 'array-contains', a.committeeId);
  }
  const [requests, invitations, accounts, committees] = await Promise.all([requestQuery.get(), inviteQuery.get(), accountQuery.get(), db.collection('committees').get()]);
  const catalogue = committees.docs.map(s => ({ ...s.data(), id: s.id }));
  const allowed = new Set(catalogue.filter(c => canViewScope(a, c)).map(c => c.id));
  const presidents = accounts.docs.filter(s => a.role === 'superadmin' || allowed.has(s.data().committeeId));
  const directory = await memberDirectory(uid, { ...data, summaryOnly: true });
  return { requests: requests.docs.map(s => serialize(s.data(), s.id)), invitations: invitations.docs.map(s => serialize(s.data(), s.id)), presidents: presidents.map(s => serialize(s.data(), s.id)), ...(a.role === 'superadmin' ? { allCommittees: catalogue } : {}), ...directory };
}
async function memberDirectory(uid, data = {}) {
  const a = await staff(uid);
  let peopleQuery = db.collection('people').where('activeMember', '==', true);
  let linksQuery = db.collection('affiliations').where('status', '==', 'active');
  if (data.committeeId) {
    const target = await committee(data.committeeId);
    if (!canViewScope(a, target)) fail('permission-denied', 'Choose a committee within your assigned scope.');
    peopleQuery = peopleQuery.where('activeScopeIds', 'array-contains', target.id);
    linksQuery = linksQuery.where('ancestorIds', 'array-contains', target.id);
  } else if (a.role !== 'superadmin') {
    peopleQuery = peopleQuery.where('activeScopeIds', 'array-contains', a.committeeId);
    linksQuery = linksQuery.where('ancestorIds', 'array-contains', a.committeeId);
  }
  let searchField;
  if (data.search) {
    if (typeof data.search !== 'string' || data.search.length > 120) fail('invalid-argument', 'Use a shorter member search.');
    const term = data.search.trim().toLowerCase();
    searchField = /^[+\d\s-]+$/.test(term) ? 'mobile' : 'nameSearch';
    const search = searchField === 'mobile' ? term.replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '') : term;
    peopleQuery = peopleQuery.where(searchField, '>=', search).where(searchField, '<=', search + '\uf8ff');
  }
  const [peopleCount, affiliationCount] = await Promise.all([peopleQuery.count().get(), linksQuery.count().get()]);
  if (data.summaryOnly) return { members: [], total: peopleCount.data().count, affiliationTotal: affiliationCount.data().count, nextCursor: null };
  let page = (searchField ? peopleQuery.orderBy(searchField) : peopleQuery).orderBy('createdAt', 'desc').orderBy(FieldPath.documentId()).limit(51);
  if (data.cursor) {
    if (!(await personVisible(uid, data.cursor))) fail('invalid-argument', 'Refresh the member list to continue.');
    const cursor = await ref('people', data.cursor).get();
    if (!cursor.exists) fail('invalid-argument', 'Refresh the member list to continue.');
    page = page.startAfter(cursor);
  }
  const result = await page.get(), members = result.docs.slice(0, 50);
  return { members: members.map(s => serialize(s.data(), s.id)), total: peopleCount.data().count, affiliationTotal: affiliationCount.data().count, nextCursor: result.size > 50 ? members.at(-1).id : null };
}
async function statistics(uid, data) {
  const a = await staff(uid);
  const period = ['week', 'month', 'all'].includes(data.period) ? data.period : 'week';
  let base = db.collection('people').where('activeMember', '==', true);
  if (a.role !== 'superadmin') base = base.where('activeScopeIds', 'array-contains', a.committeeId);
  const now = new Date(), date = indiaDate(now);
  const midnight = new Date(date.date + 'T00:00:00+05:30');
  const series = period === 'all' ? Array.from({ length: 6 }, (_, i) => {
    const [y, m] = date.date.split('-').map(Number);
    const startUtc = new Date(Date.UTC(y, m - 6 + i, 1));
    const endUtc = new Date(Date.UTC(y, m - 5 + i, 1));
    const current = new Date(startUtc.getTime() - 19800000), end = new Date(endUtc.getTime() - 19800000);
    return { start: current, end, label: current.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'short' }), fullLabel: current.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', month: 'long', year: 'numeric' }) };
  }) : Array.from({ length: period === 'week' ? 7 : 30 }, (_, i) => {
    const start = new Date(midnight.getTime() - ((period === 'week' ? 6 : 29) - i) * 86400000);
    return { start, end: new Date(start.getTime() + 86400000), label: start.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', ...(period === 'week' ? { weekday: 'short' } : { day: 'numeric' }) }), fullLabel: start.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' }) };
  });
  const catalogue = await db.collection('committees').where('level', '==', 'taluka').get();
  const periodQuery = period === 'all' ? base : base.where('createdAt', '>=', series[0].start).where('createdAt', '<', new Date(midnight.getTime() + 86400000));
  const [total, periodTotal, today, values, distribution] = await Promise.all([
    base.count().get(), periodQuery.count().get(), base.where('createdAt', '>=', midnight).count().get(),
    Promise.all(series.map(item => base.where('createdAt', '>=', item.start).where('createdAt', '<', item.end).count().get())),
    Promise.all(catalogue.docs.map(c => periodQuery.where('areaId', '==', c.id).count().get())),
  ]);
  return { total: total.data().count, periodTotal: periodTotal.data().count, today: today.data().count, series: series.map((s, i) => ({ label: s.label, fullLabel: s.fullLabel, count: values[i].data().count })), distribution: catalogue.docs.map((c, i) => ({ label: c.data().name, count: distribution[i].data().count })).filter(c => c.count > 0).sort((a, b) => b.count - a.count) };
}
async function memberDetail(uid, data) {
  const account = await ref('accounts', uid).get();
  if (!account.exists) {
    const user = await phoneUser(uid), index = await ref('phoneIndex', phoneKey(user.phoneNumber)).get();
    if (!index.exists || index.data().personId !== data.personId) fail('permission-denied', 'Complete your account first.');
    const person = await ref('people', data.personId).get();
    if (!person.exists || (person.data().accountUid && person.data().accountUid !== uid)) fail('permission-denied', 'This profile is already linked to another account.');
    return { person: serialize(person.data(), person.id) };
  }
  const a = await actor(uid);
  let allowed = await personVisible(uid, data.personId);
  if (!allowed && a.role !== 'member' && typeof data.requestId === 'string') {
    const r = await ref('requests', data.requestId).get();
    if (r.exists && r.data().personId === data.personId && r.data().status === 'pending') allowed = canViewScope(await staff(uid), await committee(r.data().committeeId));
  }
  if (!allowed) fail('permission-denied', 'This profile is outside your assigned scope.');
  const p = await ref('people', data.personId).get();
  if (!p.exists) fail('not-found', 'This member profile no longer exists.');
  return { person: serialize(p.data(), p.id) };
}
async function getPhoto(uid, data) {
  const result = await memberDetail(uid, data);
  const path = data.path;
  if (typeof path !== 'string' || !result.person.photoPaths.includes(path)) fail('permission-denied', 'This photograph is not part of the member profile.');
  const [bytes] = await bucket.file(path).download();
  const photo = data.thumbnail ? await sharp(bytes).resize(160, 160, { fit: 'cover' }).jpeg({ quality: 72 }).toBuffer() : bytes;
  return { uri: 'data:image/jpeg;base64,' + photo.toString('base64') };
}
async function cancelInvitation(uid, data) {
  await db.runTransaction(async tx => {
    const a = await staff(uid, tx), s = await tx.get(ref('invitations', data.invitationId));
    if (!s.exists || s.data().status !== 'pending') fail('failed-precondition', 'This invitation is no longer pending.');
    if (a.role !== 'superadmin' && (a.role !== 'maker' || s.data().createdBy !== uid)) fail('permission-denied', 'Cancel only invitations created by you.');
    const c = s.data().committeeId ? await committee(s.data().committeeId, tx) : null;
    tx.update(s.ref, { status: 'cancelled', cancelledAt: timestamp(), cancelledBy: uid });
    if (c?.[pendingSeatField(s.data().role)] === s.id) tx.update(ref('committees', c.id), { [pendingSeatField(s.data().role)]: '', updatedAt: timestamp() });
    audit(tx, uid, 'cancel-invitation', s.id); bump(tx, uid);
  });
  return { ok: true };
}
async function changeAppointment(uid, data, approval) {
  await db.runTransaction(async tx => {
    const a = await approvedActor(tx, uid, approval, 'changeAppointment');
    if (typeof data.uid !== 'string' || data.uid === uid) fail('invalid-argument', 'Choose another account.');
    const s = await tx.get(ref('accounts', data.uid));
    if (!s.exists || !['member', 'president'].includes(s.data().role)) fail('invalid-argument', 'Choose a member or president account.');
    const old = s.data(), target = data.committeeId ? await committee(data.committeeId, tx) : null;
    const oldCommittee = old.committeeId ? await committee(old.committeeId, tx) : null;
    const p = await tx.get(ref('people', old.personId));
    if (oldCommittee && !canAppoint(a, oldCommittee)) fail('permission-denied', 'This account is appointed outside your team authority.');
    if (!oldCommittee && !(p.data()?.activeScopeIds || []).includes(a.committeeId)) fail('permission-denied', 'Choose a member in your team scope.');
    if (target && !canAppoint(a, target)) fail('permission-denied', 'Choose an appointment handled by your team.');
    if (target && (!target.active || (target.presidentUid && target.presidentUid !== s.id) || target.pendingInvitationId)) fail('failed-precondition', 'Choose an active committee without another president or pending invitation.');
    if (data.status && !['active', 'suspended'].includes(data.status)) fail('invalid-argument', 'Choose active or suspended.');
    const updates = { status: data.status || old.status, updatedAt: timestamp() };
    if (data.role === 'member') {
      updates.role = 'member'; updates.level = 'member'; updates.committeeId = ''; updates.parentCommitteeId = '';
      if (oldCommittee?.presidentUid === s.id) tx.update(ref('committees', oldCommittee.id), { presidentUid: '', presidentName: '', updatedAt: timestamp() });
    }
    if (target) {
      updates.role = 'president'; updates.level = target.level; updates.committeeId = target.id; updates.parentCommitteeId = target.parentId;
      if (oldCommittee && oldCommittee.id !== target.id && oldCommittee.presidentUid === s.id) tx.update(ref('committees', oldCommittee.id), { presidentUid: '', presidentName: '', updatedAt: timestamp() });
      tx.update(ref('committees', target.id), { presidentUid: s.id, presidentName: p.data()?.name || '', updatedAt: timestamp() });
    }
    tx.update(s.ref, updates); finishWork(tx, approval, { uid: s.id }); audit(tx, uid, 'change-appointment', s.id, updates); bump(tx, s.id); bump(tx, uid);
  });
  return { ok: true };
}
async function setCommitteeActive(uid, data) {
  const a = await staff(uid);
  if (a.role !== 'superadmin') fail('permission-denied', 'Only the Super Admin manages committee activation.');
  const target = await committee(data.committeeId);
  if (target.level === 'state' || typeof data.active !== 'boolean') fail('invalid-argument', 'Choose an area, ward, local committee or cell.');
  if (data.active) {
    const parent = await committee(target.parentId);
    if (!parent.active) fail('failed-precondition', 'Activate the parent committee first.');
  }
  const descendants = await db.collection('committees').where('ancestorIds', 'array-contains', target.id).get();
  const records = data.active ? descendants.docs.filter(s => s.id === target.id) : descendants.docs;
  for (let i = 0; i < records.length; i += 400) {
    const batch = db.batch();
    for (const s of records.slice(i, i + 400)) batch.update(s.ref, { active: data.active, updatedAt: timestamp() });
    await batch.commit();
  }
  await ref('activity', randomUUID()).set({ actorUid: uid, action: data.active ? 'activate-committee' : 'deactivate-committee', target: target.id, createdAt: timestamp() });
  await ref('workspaceEvents', uid).set({ updatedAt: timestamp() });
  return { ok: true };
}
async function adminHistory(uid) {
  if ((await staff(uid)).role !== 'superadmin') fail('permission-denied', 'Only the Super Admin can view district activity.');
  const [activity, deliveries, mailStatus] = await Promise.all([db.collection('activity').orderBy('createdAt', 'desc').limit(50).get(), db.collection('birthdayDeliveries').orderBy('updatedAt', 'desc').limit(50).get(), ref('system', 'birthday-service').get()]);
  return { activity: activity.docs.map(s => serialize(s.data(), s.id)), deliveries: deliveries.docs.map(s => serialize(s.data(), s.id)), mailStatus: mailStatus.exists ? serialize(mailStatus.data(), mailStatus.id) : null };
}
async function mySetup(uid) {
  const user = await phoneUser(uid), key = phoneKey(user.phoneNumber);
  const [index, invite] = await Promise.all([ref('phoneIndex', key).get(), ref('invitations', key).get()]);
  const person = index.exists ? await ref('people', index.data().personId).get() : null;
  if (person?.data()?.accountUid && person.data().accountUid !== uid) fail('already-exists', 'This phone is already linked to another account. Contact the Super Admin.');
  return { phoneNumber: user.phoneNumber, invitation: invite.exists && invite.data().status === 'pending' && invite.data().expiresAt.toMillis() > Date.now() ? serialize(invite.data(), invite.id) : null, person: person?.exists ? serialize(person.data(), person.id) : null };
}

export const dmaApi = onCall({ region: 'asia-south1', memory: '512MiB', timeoutSeconds: 120, maxInstances: 5 }, async request => {
  const { operation, payload = {} } = request.data || {};
  try {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail('invalid-argument', 'Provide valid action details.');
    if (operation === 'exchangeNativeToken') {
      if (typeof payload.idToken !== 'string' || payload.idToken.length > 15000) fail('invalid-argument', 'A valid sign-in token is required.');
      const verified = await getAuth().verifyIdToken(payload.idToken, true);
      await phoneUser(verified.uid);
      return { token: await getAuth().createCustomToken(verified.uid) };
    }
    const uid = uidOf(request);
    if (operation === 'createNativeSessionToken') return { token: await getAuth().createCustomToken(uid) };
    if (['addMember', 'createInvitation', 'changeAppointment'].includes(operation)) return await submitWork(uid, operation, payload);
    const handlers = { configureTeam, reviewWork, withdrawWork, workDirectory, workDetail, workPhoto, mySetup, uploadPhoto, completeProfile, requestAffiliation, decideRequest, leaveAffiliation, changeAffiliation, affiliationDirectory, lookupAccount, createCommittee, staffState, memberDirectory, memberDetail, getPhoto, cancelInvitation, statistics, setCommitteeActive, adminHistory };
    const handler = handlers[operation];
    if (!Object.hasOwn(handlers, operation) || typeof handler !== 'function') fail('invalid-argument', 'Unknown action.');
    return await handler(uid, payload);
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error.code === 'auth/email-already-exists') fail('already-exists', 'This email belongs to another account. Use your own email or contact the Super Admin.');
    if (error.code?.startsWith('auth/')) fail('unauthenticated', 'Your verification expired. Sign in again.');
    if (error instanceof Error && !error.code) fail('invalid-argument', error.message);
    console.error('DMA action failed', { operation, code: error.code, message: error.message });
    fail('internal', 'The action could not be completed. Please retry.');
  }
});

export async function runBirthdayGreetings(now = new Date(), emailClient) {
  const date = indiaDate(now);
  if (date.hour < 9) return { sent: 0 };
  if (!sender.value() || (!emailClient && !resendKey.value())) { console.warn('Birthday email sender is not configured.'); return { sent: 0, configurationMissing: true }; }
  const client = emailClient || new Resend(resendKey.value());
  const keys = [date.birthdayKey];
  const y = Number(date.year);
  if (date.birthdayKey === '02-28' && !(y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0))) keys.push('02-29');
  const [logo, ...snapshots] = await Promise.all([readFile(new URL('../assets/foundation-logo.png', import.meta.url)), ...keys.map(key => db.collection('people').where('birthdayKey', '==', key).where('activeMember', '==', true).where('birthdayEmailsEnabled', '==', true).get())]);
  // Queue before sending, so provider quotas or a function time limit do not
  // drop greetings at midnight. Known failures are retried for seven days.
  for (const personSnap of snapshots.flatMap(s => s.docs)) {
    const person = personSnap.data();
    if (!birthdayDue(person, date) || !person.accountUid) continue;
    const delivery = ref('birthdayDeliveries', birthdayDeliveryId(personSnap.id, date.year));
    await db.runTransaction(async tx => {
      if ((await tx.get(delivery)).exists) return;
      tx.set(delivery, { personId: personSnap.id, year: date.year, date: date.date, status: 'queued', attempts: 0, updatedAt: timestamp() });
    });
  }
  const oldest = indiaDate(new Date(now.getTime() - 7 * 86400000)).date;
  const pending = await db.collection('birthdayDeliveries').where('status', 'in', ['queued', 'failed', 'sending']).where('date', '>=', oldest).where('date', '<=', date.date).orderBy('date').orderBy(FieldPath.documentId()).limit(80).get();
  let sent = 0, failures = 0;
  for (const queued of pending.docs) {
    const personSnap = await ref('people', queued.data().personId).get(), person = personSnap.data();
    if (!person?.activeMember || !person.birthdayEmailsEnabled || !person.photoPaths?.length || !person.accountUid) {
      await queued.ref.update({ status: 'skipped', updatedAt: timestamp() }); continue;
    }
    const user = await getAuth().getUser(person.accountUid).catch(error => {
      if (error.code === 'auth/user-not-found') return null;
      throw error;
    });
    if (!user || user.disabled || !user.emailVerified || user.email !== person.email) {
      await queued.ref.update({ status: 'skipped', error: 'The recipient email is unverified, changed, or the account is unavailable.', updatedAt: timestamp() }); continue;
    }
    const account = await ref('accounts', person.accountUid).get();
    if (account.data()?.status !== 'active') {
      await queued.ref.update({ status: 'skipped', error: 'The member account is inactive.', updatedAt: timestamp() }); continue;
    }
    const id = queued.id, delivery = queued.ref;
    const leaseToken = randomUUID();
    const acquired = await db.runTransaction(async tx => {
      const previous = await tx.get(delivery);
      if (!['queued', 'failed', 'sending'].includes(previous.data()?.status) || previous.data()?.leaseUntil?.toMillis() > Date.now()) return false;
      // Resend keeps idempotency keys for 24 hours. An ambiguous transport
      // result older than that needs an operator check instead of a blind retry.
      if (previous.data()?.uncertain && now.getTime() - previous.data().firstAttemptAt?.toMillis() >= 23 * 3600000) {
        tx.update(delivery, { status: 'review', error: 'Verify delivery in Resend before retrying: the original response was not received.', updatedAt: timestamp() }); return false;
      }
      tx.set(delivery, { status: 'sending', uncertain: true, firstAttemptAt: previous.data()?.firstAttemptAt || Timestamp.fromDate(now), leaseToken, leaseUntil: Timestamp.fromMillis(Date.now() + 5 * 60 * 1000), attempts: FieldValue.increment(1), updatedAt: timestamp() }, { merge: true });
      return true;
    });
    if (!acquired) continue;
    let providerRejected = false;
    try {
      const [photo] = await bucket.file(person.photoPaths[0]).download();
      const message = birthdayMessage(person);
      const response = await client.emails.send({ from: sender.value(), to: person.email, ...message, attachments: [{ filename: 'foundation-logo.png', content: logo.toString('base64'), contentId: 'dma-logo' }, { filename: 'your-photo.jpg', content: photo.toString('base64'), contentId: 'member-photo' }] }, { idempotencyKey: 'birthday-' + id });
      if (response.error) { providerRejected = true; throw new Error(response.error.message); }
      await delivery.update({ status: 'sent', uncertain: false, error: FieldValue.delete(), providerMessageId: response.data.id, sentAt: timestamp(), updatedAt: timestamp(), leaseUntil: Timestamp.fromMillis(0) });
      sent++;
    } catch (error) {
      failures++;
      await delivery.update({ status: 'failed', uncertain: !providerRejected, error: String(error.message).slice(0, 300), updatedAt: timestamp(), leaseUntil: Timestamp.fromMillis(0) });
      console.error('Birthday delivery failed', { deliveryId: id, error: error.message });
    }
    // Stay within provider request rate limits during large birthday batches.
    await new Promise(resolve => setTimeout(resolve, 600));
  }
  return { sent, failures, processed: pending.size };
}
export const birthdayGreetings = onSchedule({ region: 'asia-south1', schedule: 'every 30 minutes', timeZone: 'Asia/Kolkata', memory: '512MiB', timeoutSeconds: 540, maxInstances: 1, secrets: [resendKey] }, async () => {
  const result = await runBirthdayGreetings();
  await ref('system', 'birthday-service').set({ ...result, lastRunAt: timestamp(), senderConfigured: !!sender.value() });
  if (result.failures) throw new Error(`${result.failures} birthday emails need retry.`);
});

async function notifyWorkspaces(scopeIds, ownerIds = []) {
  const ids = [...new Set([stateId, districtId, ...scopeIds])].filter(id => typeof id === 'string' && /^[\w-]{1,160}$/.test(id));
  const committees = await db.getAll(...ids.map(id => ref('committees', id)));
  const uids = [...new Set([...ownerIds, ...committees.flatMap(s => [s.data()?.presidentUid, s.data()?.makerUid, s.data()?.checkerUid]), ...(await db.collection('accounts').where('role', '==', 'superadmin').get()).docs.map(s => s.id)])].filter(Boolean);
  if (!uids.length) return;
  const batch = db.batch();
  for (const uid of uids) batch.set(ref('workspaceEvents', uid), { updatedAt: timestamp() }, { merge: true });
  await batch.commit();
}
const trigger = document => ({ document, database: 'dma-connect', region: 'asia-south1', maxInstances: 3 });
export const membershipUpdates = onDocumentWritten(trigger('affiliations/{id}'), event => {
  const before = event.data?.before.data(), after = event.data?.after.data();
  return notifyWorkspaces([...(before?.ancestorIds || []), ...(after?.ancestorIds || [])], [before?.accountUid, after?.accountUid]);
});
export const requestUpdates = onDocumentWritten(trigger('requests/{id}'), event => {
  const before = event.data?.before.data(), after = event.data?.after.data();
  return notifyWorkspaces([...(before?.ancestorIds || []), ...(after?.ancestorIds || [])], [before?.applicantUid, after?.applicantUid]);
});
export const profileUpdates = onDocumentWritten(trigger('people/{id}'), event => {
  const before = event.data?.before.data(), after = event.data?.after.data();
  return notifyWorkspaces([...(before?.activeScopeIds || []), ...(after?.activeScopeIds || [])], [before?.accountUid, after?.accountUid]);
});
export const committeeUpdates = onDocumentWritten(trigger('committees/{id}'), event => {
  const before = event.data?.before.data(), after = event.data?.after.data();
  return notifyWorkspaces([...(before?.ancestorIds || []), ...(after?.ancestorIds || [])], [before?.presidentUid, after?.presidentUid]);
});
export const accountUpdates = onDocumentWritten(trigger('accounts/{uid}'), async event => {
  const before = event.data?.before.data(), after = event.data?.after.data();
  const scopes = [];
  for (const id of new Set([before?.committeeId, after?.committeeId].filter(Boolean))) {
    const c = await ref('committees', id).get(); scopes.push(...(c.data()?.ancestorIds || []));
  }
  return notifyWorkspaces(scopes, [event.params.uid, before?.createdBy, after?.createdBy].filter(id => id && id !== 'bootstrap' && id !== 'migration'));
});

export const workUpdates = onDocumentWritten(trigger('workItems/{id}'), event => {
  const before = event.data?.before.data(), after = event.data?.after.data();
  return notifyWorkspaces([...(before?.scopeIds || []), ...(after?.scopeIds || [])], [before?.createdBy, after?.createdBy, after?.reviewedBy]);
});
