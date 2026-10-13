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
import { birthdayDeliveryId, birthdayDue, birthdayMessage, canAppoint, canReview, canViewScope, districtId, indiaDate, normalizePhone, phoneKey, slug, validateProfile } from './domain.js';

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
  if (!['superadmin', 'president'].includes(a.role)) fail('permission-denied', 'This action is available to appointed presidents.');
  if (a.role === 'president') {
    const c = await (tx ? tx.get(ref('committees', a.committeeId)) : ref('committees', a.committeeId).get());
    if (!c.exists || !c.data().active || c.data().presidentUid !== uid) fail('permission-denied', 'Your committee appointment is inactive.');
  }
  return a;
}
async function committee(id, tx) {
  if (typeof id !== 'string' || !/^[\w-]{1,160}$/.test(id)) fail('invalid-argument', 'Choose a valid committee.');
  const s = await (tx ? tx.get(ref('committees', id)) : ref('committees', id).get());
  if (!s.exists) fail('not-found', 'This committee no longer exists.');
  return { ...s.data(), id };
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
  if (!['superadmin', 'president'].includes(a.role)) return false;
  await staff(uid);
  if (a.role === 'superadmin') return true;
  const person = await ref('people', personId).get();
  if (person.data()?.accountUid) {
    const appointed = await ref('accounts', person.data().accountUid).get();
    if (appointed.data()?.role === 'president' && appointed.data().committeeId && canViewScope(a, await committee(appointed.data().committeeId))) return true;
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
  if (area.level !== 'area' || !area.active) fail('invalid-argument', 'Choose an active home area.');
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
      if (invitation.role === 'president') {
        appointedCommittee = await committee(invitation.committeeId, tx);
        const inviter = await staff(invitation.createdBy, tx);
        if (!canAppoint(inviter, appointedCommittee) || appointedCommittee.pendingInvitationId !== key || appointedCommittee.presidentUid) fail('failed-precondition', 'This appointment needs to be reviewed by the Super Admin.');
      }
      account = { role: invitation.role, level: invitation.level, committeeId: invitation.committeeId, parentCommitteeId: appointedCommittee?.parentId || '', createdBy: invitation.createdBy };
    }
    tx.set(personRef, { ...clean, taluka: area.name, personId, accountUid: uid, activeMember: existingPerson.data()?.activeMember || false, activeScopeIds: existingPerson.data()?.activeScopeIds || [], activeCommitteeIds: existingPerson.data()?.activeCommitteeIds || [], source: existingPerson.data()?.source || 'self', createdBy: existingPerson.data()?.createdBy || uid, createdAt: existingPerson.data()?.createdAt || timestamp(), updatedAt: timestamp() }, { merge: true });
    tx.set(accountRef, { ...account, uid, personId, status: 'active', phoneNumber: user.phoneNumber, districtId, createdAt: account.createdAt || timestamp(), updatedAt: timestamp() });
    tx.set(indexRef, { personId, phoneNumber: user.phoneNumber });
    if (appointedCommittee) {
      tx.update(ref('committees', appointedCommittee.id), { presidentUid: uid, presidentName: clean.name, pendingInvitationId: '', updatedAt: timestamp() });
      audit(tx, uid, 'accept-president-invitation', appointedCommittee.id);
    }
    if (invite.exists && invite.data().status === 'pending' && account.createdBy === invite.data().createdBy) tx.update(inviteRef, { status: 'accepted', acceptedBy: uid, acceptedAt: timestamp() });
    bump(tx, uid);
  });
  await getAuth().updateUser(uid, { displayName: clean.name });
  return { personId, emailNeedsVerification: !(user.email === clean.email && user.emailVerified) };
}
async function createInvitation(uid, data) {
  await phoneUser(uid);
  const phoneNumber = normalizePhone(data.mobile), id = phoneKey(phoneNumber);
  if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 120 || typeof data.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > 254) fail('invalid-argument', 'Enter a name and valid email for the account.');
  const role = data.role === 'member' ? 'member' : 'president';
  await db.runTransaction(async tx => {
    const a = await staff(uid, tx);
    const [oldInvite, index] = await Promise.all([tx.get(ref('invitations', id)), tx.get(ref('phoneIndex', id))]);
    let target;
    if (role === 'president') {
      target = await committee(data.committeeId, tx);
      if (!canAppoint(a, target)) fail('permission-denied', 'You can appoint only the permitted lower level in your own hierarchy.');
      if (target.presidentUid) fail('already-exists', 'This committee already has a president. Use a Super Admin transfer.');
      if (target.pendingInvitationId && target.pendingInvitationId !== id) fail('already-exists', 'This committee already has a pending invitation.');
    } else if (a.role !== 'superadmin') fail('permission-denied', 'Use Add member for member records. Only the Super Admin can invite a member account.');
    if (index.exists) {
      const person = await tx.get(ref('people', index.data().personId));
      if (person.data()?.accountUid) fail('already-exists', 'This person already has an account. The Super Admin can change their appointment.');
    }
    if (oldInvite.exists && oldInvite.data().status === 'pending' && oldInvite.data().expiresAt.toMillis() > Date.now()) fail('already-exists', 'This number already has a pending invitation.');
    tx.set(ref('invitations', id), { phoneNumber, name: data.name.trim(), email: data.email.trim().toLowerCase(), role, level: target?.level || 'member', committeeId: target?.id || '', committeeName: target?.name || '', createdBy: uid, status: 'pending', createdAt: timestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 14 * 24 * 60 * 60 * 1000) });
    if (target) tx.update(ref('committees', target.id), { pendingInvitationId: id, updatedAt: timestamp() });
    audit(tx, uid, 'create-invitation', id, { role, committeeId: target?.id || '' });
    bump(tx, uid);
  });
  return { invitationId: id, phoneNumber };
}
async function addMember(uid, data) {
  await phoneUser(uid);
  const phoneNumber = normalizePhone(data.mobile), key = phoneKey(phoneNumber), personId = 'record-' + randomUUID();
  const clean = validateProfile(data, phoneNumber);
  const area = await committee(clean.areaId);
  if (area.level !== 'area' || !area.active) fail('invalid-argument', 'Choose an active home area.');
  await assertPhotoPaths(clean.photoPaths, personId, uid);
  await db.runTransaction(async tx => {
    const a = await staff(uid, tx), target = await committee(data.committeeId, tx);
    const existing = await tx.get(ref('phoneIndex', key));
    if (!target.active || target.level === 'district' || !canViewScope(a, target)) fail('permission-denied', 'Add members only to your assigned committee or an authorised descendant.');
    if (existing.exists) fail('already-exists', 'This mobile number already has a member profile. Ask them to sign in and request this committee.');
    tx.set(ref('people', personId), { ...clean, personId, taluka: area.name, accountUid: '', activeMember: true, activeScopeIds: target.ancestorIds, activeCommitteeIds: [target.id], source: 'president', createdBy: uid, createdAt: timestamp(), updatedAt: timestamp() });
    tx.set(ref('phoneIndex', key), { personId, phoneNumber });
    tx.set(ref('affiliations', personId + '__' + target.id), { personId, accountUid: '', committeeId: target.id, committeeName: target.name, branch: target.branch, ancestorIds: target.ancestorIds, status: 'active', createdAt: timestamp(), approvedBy: uid });
    for (const scope of target.ancestorIds) tx.set(ref('people', personId).collection('access').doc(scope), { active: true });
    audit(tx, uid, 'add-member', personId, { committeeId: target.id });
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
    if (!target.active || target.level === 'district') fail('invalid-argument', 'Choose an active area or cell committee.');
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
    const r = requestSnap.data(), target = await committee(r.committeeId, tx);
    if (data.decision === 'withdrawn') {
      if (r.applicantUid !== uid) fail('permission-denied', 'Withdraw only your own request.');
    } else {
      await staff(uid, tx);
      if (!target.active || !canReview(a, target)) fail('permission-denied', 'Only this committee’s president or the Super Admin can review the request.');
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
    const target = await committee(link.data().committeeId, tx);
    if (!canReview(a, target) || (data.status === 'active' && !target.active)) fail('permission-denied', 'Only this committee’s president or the Super Admin can change this affiliation.');
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
  if (a.role !== 'superadmin') q = q.where('committeeId', '==', a.committeeId);
  else if (data.committeeId) q = q.where('committeeId', '==', (await committee(data.committeeId)).id);
  q = q.orderBy(FieldPath.documentId()).limit(51);
  if (data.cursor) q = q.startAfter(ref('affiliations', data.cursor).id);
  const snapshot = await q.get(), page = snapshot.docs.slice(0, 50);
  const people = page.length ? await db.getAll(...page.map(s => ref('people', s.data().personId))) : [];
  return { affiliations: page.map((s, i) => ({ ...serialize(s.data(), s.id), personName: people[i].data()?.name || 'Member' })), nextCursor: snapshot.size > 50 ? page.at(-1).id : null };
}
async function lookupAccount(uid, data) {
  if ((await staff(uid)).role !== 'superadmin') fail('permission-denied', 'Only the Super Admin can look up district accounts.');
  const phoneNumber = normalizePhone(data.mobile);
  const user = await getAuth().getUserByPhoneNumber(phoneNumber).catch(error => {
    if (error.code === 'auth/user-not-found') fail('not-found', 'This mobile number has not signed up yet. Create an invitation instead.');
    throw error;
  });
  const account = await ref('accounts', user.uid).get();
  if (!account.exists) fail('failed-precondition', 'This account still needs to complete its member profile.');
  const person = await ref('people', account.data().personId).get();
  if (!person.exists) fail('failed-precondition', 'This account still needs to complete its member profile.');
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
    if (!parent.active || !((parent.level === 'district' && ['area', 'cell'].includes(level)) || (parent.level === 'area' && level === 'ward') || (parent.level === 'ward' && level === 'local'))) fail('invalid-argument', 'Choose a valid parent and child level.');
    const id = `${level}-${parent.level === 'district' ? '' : parent.id + '-'}${slug(name)}`;
    const existing = await tx.get(ref('committees', id));
    if (existing.exists) fail('already-exists', 'That committee already exists under this parent.');
    tx.set(ref('committees', id), { id, name, level, parentId: parent.id, branch: level === 'cell' ? 'cell' : 'area', areaId: level === 'area' ? id : parent.areaId, ancestorIds: [...parent.ancestorIds, id], presidentUid: '', presidentName: '', pendingInvitationId: '', active: true, createdAt: timestamp(), updatedAt: timestamp() });
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
  let accountQuery = db.collection('accounts').where('role', '==', 'president');
  if (a.role !== 'superadmin') {
    requestQuery = requestQuery.where('committeeId', '==', a.committeeId);
    inviteQuery = inviteQuery.where('createdBy', '==', uid);
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
  const catalogue = await db.collection('committees').where('level', '==', 'area').get();
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
    if (r.exists && r.data().personId === data.personId && r.data().status === 'pending') allowed = canReview(await staff(uid), await committee(r.data().committeeId));
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
    if (a.role !== 'superadmin' && s.data().createdBy !== uid) fail('permission-denied', 'Cancel only invitations created by you.');
    const c = s.data().committeeId ? await committee(s.data().committeeId, tx) : null;
    tx.update(s.ref, { status: 'cancelled', cancelledAt: timestamp(), cancelledBy: uid });
    if (c?.pendingInvitationId === s.id) tx.update(ref('committees', c.id), { pendingInvitationId: '', updatedAt: timestamp() });
    audit(tx, uid, 'cancel-invitation', s.id); bump(tx, uid);
  });
  return { ok: true };
}
async function changeAppointment(uid, data) {
  await db.runTransaction(async tx => {
    const a = await staff(uid, tx);
    if (a.role !== 'superadmin') fail('permission-denied', 'Only the Super Admin can change appointments.');
    if (typeof data.uid !== 'string' || data.uid === uid) fail('invalid-argument', 'Choose another account.');
    const s = await tx.get(ref('accounts', data.uid));
    if (!s.exists || s.data().role === 'superadmin') fail('invalid-argument', 'Choose a member or president account.');
    const old = s.data(), target = data.committeeId ? await committee(data.committeeId, tx) : null;
    const oldCommittee = old.committeeId ? await committee(old.committeeId, tx) : null;
    const p = await tx.get(ref('people', old.personId));
    if (target && (!target.active || target.level === 'district' || (target.presidentUid && target.presidentUid !== s.id) || target.pendingInvitationId)) fail('failed-precondition', 'Choose an active committee without another president or pending invitation.');
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
    tx.update(s.ref, updates); audit(tx, uid, 'change-appointment', s.id, updates); bump(tx, s.id); bump(tx, uid);
  });
  return { ok: true };
}
async function setCommitteeActive(uid, data) {
  const a = await staff(uid);
  if (a.role !== 'superadmin') fail('permission-denied', 'Only the Super Admin manages committee activation.');
  const target = await committee(data.committeeId);
  if (target.level === 'district' || typeof data.active !== 'boolean') fail('invalid-argument', 'Choose an area, ward, local committee or cell.');
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
    const handlers = { mySetup, uploadPhoto, completeProfile, createInvitation, addMember, requestAffiliation, decideRequest, leaveAffiliation, changeAffiliation, affiliationDirectory, lookupAccount, createCommittee, staffState, memberDirectory, memberDetail, getPhoto, cancelInvitation, changeAppointment, statistics, setCommitteeActive, adminHistory };
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
  const ids = [...new Set([districtId, ...scopeIds])].filter(id => typeof id === 'string' && /^[\w-]{1,160}$/.test(id));
  const committees = await db.getAll(...ids.map(id => ref('committees', id)));
  const uids = [...new Set([...ownerIds, ...committees.map(s => s.data()?.presidentUid)])].filter(Boolean);
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
