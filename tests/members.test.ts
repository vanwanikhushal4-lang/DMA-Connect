import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDobInput, isMemberList, normalizeDraft, parseDob, validateMember } from '../src/lib/members.ts';
import type { Member, MemberDraft } from '../src/lib/members.ts';

const draft: MemberDraft = {
  name: 'Test Member', email: '', mobile: '9876543210', residence: 'Test village', dob: '29/02/2000', taluka: 'Test taluka',
};
const today = new Date(2026, 9, 9);

test('valid registration allows omitted email and Unicode names', () => {
  assert.deepEqual(validateMember({ ...draft, name: 'मंगेश आमले' }, [], today), {});
});

test('normalization preserves residence and accepts a pasted country code', () => {
  const normalized = normalizeDraft({ ...draft, name: '  Test   Member  ', email: ' TEST@EXAMPLE.ORG ', mobile: '+91 98765 43210' });
  assert.equal(normalized.name, 'Test Member');
  assert.equal(normalized.mobile, '9876543210');
  assert.equal(normalized.email, 'test@example.org');
});

test('dates validate leap years, month lengths, bounds and future dates', () => {
  assert.ok(parseDob('29/02/2000'));
  for (const date of ['29/02/2001', '31/04/2000', '00/01/2000', '01/13/2000', '01/01/0099', '1/1/2000']) assert.equal(parseDob(date), null, date);
  assert.ok(validateMember({ ...draft, dob: '10/10/2026' }, [], today).dob);
  assert.ok(validateMember({ ...draft, dob: '31/12/1899' }, [], today).dob);
  assert.equal(validateMember({ ...draft, dob: '09/10/2026' }, [], today).dob, undefined);
});

test('duplicate mobile numbers are rejected after normalization', () => {
  const member: Member = { ...draft, id: 'DMA-test', createdAt: '2026-10-09T00:00:00Z' };
  assert.match(validateMember({ ...draft, mobile: '+91 98765 43210' }, [member], today).mobile || '', /already/);
});

test('missing required fields and malformed contact information are rejected', () => {
  const errors = validateMember({ name: ' ', email: 'bad-email', mobile: '1234', residence: '', dob: '', taluka: '' }, [], today);
  assert.equal(Object.keys(errors).length, 6);
});

test('DOB formatting supports typing and deletion', () => {
  assert.equal(formatDobInput('29022000'), '29/02/2000');
  assert.equal(formatDobInput('29/02/'), '29/02');
  assert.equal(formatDobInput('29/'), '29');
  assert.equal(formatDobInput(''), '');
});

test('stored records must have complete fields and valid creation dates', () => {
  assert.equal(isMemberList([]), true);
  assert.equal(isMemberList([{ ...draft, id: 'DMA-test', createdAt: '2026-10-09T00:00:00Z' }]), true);
  assert.equal(isMemberList([{ ...draft, id: 'DMA-test', createdAt: 'invalid' }]), false);
  assert.equal(isMemberList([null]), false);
  assert.equal(isMemberList({}), false);
});
