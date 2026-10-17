import assert from 'node:assert/strict';
import { test } from 'node:test';
import { backendSession, createUserPayload, restoreBackendSession, signupAreas } from '../src/lib/backend-auth.ts';
import type { ApiCommittee } from '../src/lib/backend-auth.ts';
import { emptyPerson, validatePerson } from '../src/lib/community.ts';
import { BackendApiError, createBackendApi } from '../src/services/backend-api.ts';

const committees: ApiCommittee[] = [
  { committeeId: 1, name: 'District', level: 'district', active: true },
  { committeeId: 6, name: 'Ghansoli', level: 'area', active: true },
  { committeeId: 3, name: 'Belapur', level: 'area', active: true },
  { committeeId: 10, name: 'Cell', level: 'cell', active: true },
  { committeeId: 13, name: 'Ward', level: 'ward', active: true },
  { committeeId: 20, name: 'Inactive', level: 'area', active: false },
];
const draft = { ...emptyPerson, name: ' Test Member ', email: ' Test@EXAMPLE.COM ', mobile: '9000000001', residence: 'Test residence', dob: '08/06/1998', areaId: '6', photoPaths: ['drafts/test/profile.jpg'] };

test('signup shows only active area committees and submits the selected numeric committeeId as areaId', () => {
  assert.deepEqual(signupAreas(committees).map(c => c.committeeId), [3, 6]);
  const body = createUserPayload(draft, 'test-password', committees);
  assert.equal(body.areaId, 6);
  assert.equal(body.dob, '1998-06-08');
  assert.equal(body.email, 'test@example.com');
  assert.equal(body.name, 'Test Member');
  assert.equal(body.password, 'test-password');
  for (const areaId of ['1', '10', '13', '20', '999', 'NaN', '']) {
    assert.throws(() => createUserPayload({ ...draft, areaId }, 'test-password', committees));
  }
  assert.throws(() => createUserPayload(draft, 'short', committees));
});

test('REST login, creation and committee requests use the supplied contracts and bearer authorization', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchRequest: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    const data = url.includes('/auth/login/email') ? { token: 'test-token', userId: 9, name: 'Test Member', expiresIn: 86400 }
      : url.includes('/user/profile') ? { userId: 15, emailNeedsVerification: true } : { committees };
    return new Response(JSON.stringify(data), { status: 200 });
  };
  const client = createBackendApi('http://test.local:9595/', fetchRequest);
  await client.loginEmail(' TEST@example.com ', 'case-Sensitive-password');
  assert.equal(calls[0].url, 'http://test.local:9595/api/v1/auth/login/email');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { email: 'test@example.com', password: 'case-Sensitive-password' });
  await client.createUser(createUserPayload({ ...draft, photoPaths: [] }, 'test-password', committees));
  assert.equal(calls[1].url, 'http://test.local:9595/api/v1/user/profile');
  assert.equal((calls[1].init?.headers as Record<string, string>).Authorization, undefined);
  assert.equal(JSON.parse(String(calls[1].init?.body)).areaId, 6);
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)).photoPaths, []);
  assert.deepEqual(await client.getAllCommittees('api-token'), committees);
  assert.equal(calls[2].url, 'http://test.local:9595/api/v1/committees/getAllCommittees?active=true');
  assert.equal(calls[2].init?.method, 'GET');
  assert.equal((calls[2].init?.headers as Record<string, string>).Authorization, 'Bearer api-token');
});

test('REST signup permits an empty photo list while the original profile flow still requires a photo', () => {
  const withoutPhoto = { ...draft, photoPaths: [] };
  assert.deepEqual(createUserPayload(withoutPhoto, 'test-password', committees).photoPaths, []);
  assert.equal(validatePerson(withoutPhoto).photoPaths, 'Add a profile photograph.');
  assert.equal(validatePerson(withoutPhoto, { requirePhoto: false }).photoPaths, undefined);
});

test('HTTP authorization errors and malformed committee responses do not become empty dropdowns', async () => {
  const unauthorized = createBackendApi('http://test.local', async () => new Response('', { status: 401 }));
  await assert.rejects(unauthorized.getAllCommittees(), (error: unknown) => error instanceof BackendApiError && error.status === 401);
  const malformed = createBackendApi('http://test.local', async () => new Response(JSON.stringify({ committees: [{ committeeId: '6', name: 'Area', level: 'area', active: true }] })));
  await assert.rejects(malformed.getAllCommittees(), /invalid committee list/);
  const offline = createBackendApi('http://test.local', async () => { throw new TypeError('fetch failed'); });
  await assert.rejects(offline.loginEmail('test@example.com', 'test-password'), /Cannot reach/);
});

test('backend sessions expire, stay bound to their server and contain no password', () => {
  const session = backendSession({ token: 'test-token', userId: 9, name: 'Test Member', expiresIn: 86400 }, 'TEST@example.com', 'http://test.local', 1000);
  assert.equal(session.expiresAt, 86401000);
  assert.equal(session.email, 'test@example.com');
  assert.equal('password' in session, false);
  assert.deepEqual(restoreBackendSession(JSON.stringify(session), 'http://test.local', 2000), session);
  assert.equal(restoreBackendSession(JSON.stringify(session), 'http://other.local', 2000), null);
  assert.equal(restoreBackendSession(JSON.stringify(session), 'http://test.local', session.expiresAt), null);
  assert.equal(restoreBackendSession('{broken', 'http://test.local'), null);
  assert.throws(() => backendSession({ token: '', userId: 9, name: 'Test', expiresIn: 0 }, '', ''));
});
