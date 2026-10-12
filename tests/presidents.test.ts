import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emptyPresident, needsTaluka, presidentRoles, validatePresident } from '../src/lib/presidents.ts';

const draft = { ...emptyPresident, name: 'Test President', email: 'test@example.org', mobile: '9876543210', district: 'Mumbai', role: 'district' as const };

test('all president roles validate with their relevant area details', () => {
  for (const { value: role } of presidentRoles) {
    assert.deepEqual(validatePresident({ ...draft, role, taluka: 'Test taluka', locality: 'Test area', cell: 'OBC' }, 'password123', 'password123'), {}, role);
  }
});
test('taluka, ward and village roles require a taluka; other roles do not', () => {
  for (const { value: role } of presidentRoles) {
    const errors = validatePresident({ ...draft, role }, 'password123', 'password123');
    assert.equal(!!errors.taluka, needsTaluka(role), role);
    assert.equal(!!errors.locality, ['city', 'ward', 'village'].includes(role), role);
    assert.equal(!!errors.cell, role === 'cell', role);
  }
});
test('incomplete account setup can resume without asking for another password', () => {
  assert.deepEqual(validatePresident(draft, '', '', true), {});
  assert.ok(validatePresident(draft, '', '').password);
  assert.ok(validatePresident(draft, 'password123', 'different').confirm);
});
test('malformed contacts, unknown roles and oversized profile values are rejected', () => {
  assert.ok(validatePresident({ ...draft, role: '' }, 'password123', 'password123').role);
  const errors = validatePresident({ ...draft, name: 'x'.repeat(121), district: 'x'.repeat(101), email: 'invalid', mobile: '1234' }, 'password123', 'password123');
  assert.equal(Object.keys(errors).length, 4);
});
