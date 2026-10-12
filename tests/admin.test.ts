import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roleLabel } from '../src/lib/presidents.ts';
import { normalizeDraft } from '../src/lib/members.ts';

test('admin role label displays as Administrator', () => {
  assert.equal(roleLabel('admin'), 'Administrator');
  assert.equal(roleLabel('district'), 'District president');
  assert.equal(roleLabel('taluka'), 'Taluka president');
});

test('member normalization preserves taluka and cleans whitespace', () => {
  const normalized = normalizeDraft({
    name: '  Rahul  Shinde ',
    email: ' Rahul@Test.com ',
    mobile: '+91 9876543210',
    residence: '  Main Road  ',
    dob: ' 15/08/1995 ',
    taluka: '  Haveli  ',
  });
  assert.equal(normalized.name, 'Rahul Shinde');
  assert.equal(normalized.email, 'rahul@test.com');
  assert.equal(normalized.mobile, '9876543210');
  assert.equal(normalized.taluka, 'Haveli');
});
