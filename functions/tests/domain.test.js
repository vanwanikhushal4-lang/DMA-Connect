import test from 'node:test';
import assert from 'node:assert/strict';
import { birthdayDeliveryId, birthdayDue, birthdayMessage, canAppoint, canReview, canViewScope, indiaDate, normalizePhone, seedCommittees, validateProfile } from '../src/domain.js';

const admin = { uid: 'admin', role: 'superadmin', status: 'active' };
const area = { uid: 'area-owner', role: 'president', level: 'taluka', committeeId: 'area-vashi', status: 'active' };
const ward = { id: 'ward-one', active: true, level: 'ward', parentId: 'area-vashi', ancestorIds: ['dma-district', 'area-vashi', 'ward-one'], presidentUid: 'ward-owner' };
const draft = { name: 'Test Member', email: 'member@example.com', residence: 'Vashi', dob: '1990-02-28', areaId: 'area-vashi', socials: { facebook: '', linkedin: '', instagram: '@member' }, photoPaths: ['drafts/member/photo.jpg'], birthdayEmailsEnabled: true };
test('district catalogue has eight areas and the three initial cells', () => {
  const catalogue = seedCommittees();
  assert.equal(catalogue.filter(c => c.level === 'taluka').length, 8);
  assert.equal(catalogue.filter(c => c.level === 'cell').length, 3);
  assert.ok(catalogue.some(c => c.name === 'Kopar Khairane'));
});
test('only makers appoint presidents in the assigned team, including the three main levels', () => {
  const stateMaker = { uid: 'state-maker', role: 'maker', level: 'state', committeeId: 'dma-state', status: 'active' };
  const districtMaker = { ...stateMaker, uid: 'district-maker', level: 'district', committeeId: 'dma-district' };
  const talukaMaker = { ...stateMaker, uid: 'taluka-maker', level: 'taluka', committeeId: 'area-vashi' };
  for (const c of seedCommittees()) {
    assert.equal(canAppoint(stateMaker, c), ['state', 'district'].includes(c.level));
    assert.equal(canAppoint(districtMaker, c), ['taluka', 'cell'].includes(c.level));
    assert.equal(canAppoint(admin, c), false);
    assert.equal(canAppoint(area, c), false);
  }
  assert.equal(canAppoint(talukaMaker, { ...ward, appointmentTeamId: 'area-vashi' }), true);
  assert.equal(canAppoint(talukaMaker, { ...ward, appointmentTeamId: 'area-nerul' }), false);
  assert.equal(canAppoint({ ...talukaMaker, status: 'suspended' }, { ...ward, appointmentTeamId: 'area-vashi' }), false);
});
test('checkers review only their operational team; presidents retain scoped visibility', () => {
  const target = { ...ward, teamId: 'area-vashi', teamCheckerUid: 'checker' };
  const checker = { uid: 'checker', role: 'checker', level: 'taluka', committeeId: 'area-vashi', status: 'active' };
  assert.equal(canReview(checker, target), true);
  assert.equal(canReview({ ...checker, uid: 'forged' }, target), false);
  assert.equal(canReview({ ...checker, committeeId: 'area-nerul' }, target), false);
  assert.equal(canReview(area, target), false);
  assert.equal(canReview(admin, target), false);
  assert.equal(canViewScope(area, ward), true);
  assert.equal(canViewScope({ ...area, committeeId: 'area-nerul' }, ward), false);
});
test('profile input cannot supply privilege, timestamps or a different phone identity', () => {
  const result = validateProfile({ ...draft, mobile: '9999999999', role: 'superadmin', activeScopeIds: ['dma-district'], createdAt: '1900-01-01' }, '+919123456789');
  assert.equal(result.mobile, '9123456789');
  assert.equal(result.role, undefined);
  assert.equal(result.activeScopeIds, undefined);
  assert.equal(result.createdAt, undefined);
  assert.equal(result.socials.instagram, 'https://www.instagram.com/member/');
});
test('invalid birthdays, missing photographs and spoofed social links are rejected', () => {
  for (const dob of ['1990-02-30', '1990-13-01', '3000-01-01', '1/1/1990', '1800-01-01']) assert.throws(() => validateProfile({ ...draft, dob }, '+919123456789'));
  assert.throws(() => validateProfile({ ...draft, photoPaths: [] }, '+919123456789'));
  assert.throws(() => validateProfile({ ...draft, socials: { ...draft.socials, facebook: 'https://facebook.com.evil.example/me' } }, '+919123456789'));
  assert.throws(() => validateProfile({ ...draft, socials: { ...draft.socials, linkedin: 'javascript:alert(1)' } }, '+919123456789'));
  assert.throws(() => normalizePhone('12345'));
  assert.equal(normalizePhone('91 91234 56789'), '+919123456789');
});
test('birthday checks use India time and one annual identity across committees', () => {
  const midnight = indiaDate(new Date('2026-10-11T19:00:00Z'));
  assert.equal(midnight.date, '2026-10-12');
  assert.equal(midnight.hour, 0);
  assert.equal(birthdayDeliveryId('person', '2026'), 'person_2026');
  const member = { ...draft, activeMember: true, birthdayKey: '02-29' };
  assert.equal(birthdayDue(member, { year: '2026', birthdayKey: '02-28' }), true);
  assert.equal(birthdayDue(member, { year: '2028', birthdayKey: '02-28' }), false);
  assert.equal(birthdayDue(member, { year: '2028', birthdayKey: '02-29' }), true);
  assert.equal(birthdayDue({ ...member, birthdayEmailsEnabled: false }, { year: '2026', birthdayKey: '02-28' }), false);
  assert.equal(birthdayDue({ ...member, activeMember: false }, { year: '2026', birthdayKey: '02-28' }), false);
});
test('birthday email personalises the name and includes photo and logo without HTML injection', () => {
  const message = birthdayMessage({ name: '<script>alert(1)</script>' });
  assert.ok(message.html.includes('cid:member-photo'));
  assert.ok(message.html.includes('cid:dma-logo'));
  assert.ok(message.html.includes('&lt;script&gt;'));
  assert.equal(message.html.includes('<script>'), false);
  assert.ok(message.text.includes('Dr. Mangesh Amale Foundation'));
});
