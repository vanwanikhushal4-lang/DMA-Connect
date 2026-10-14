import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveEmulatorHost } from '../src/lib/emulator-host.ts';

test('physical phones use the Metro computer address without its port', () => {
  assert.equal(resolveEmulatorHost(undefined, '192.168.0.211:8081'), '192.168.0.211');
  assert.equal(resolveEmulatorHost(undefined, 'exp://192.168.1.10:8093'), '192.168.1.10');
});

test('explicit emulator addresses override Metro and support the Android emulator', () => {
  assert.equal(resolveEmulatorHost('10.0.2.2', '192.168.0.211:8081'), '10.0.2.2');
  assert.equal(resolveEmulatorHost(' 192.168.1.20 ', '192.168.0.211:8081'), '192.168.1.20');
});

test('non-Metro previews and malformed hosts fall back to localhost', () => {
  assert.equal(resolveEmulatorHost(), 'localhost');
  assert.equal(resolveEmulatorHost('', 'not a valid host'), 'localhost');
});
