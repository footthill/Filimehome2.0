import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePublicConfig } from '../shared/public-config.mjs';
const url = 'https://exampleproject.supabase.co';
const jwt = claims => ['header', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'signature'].join('.');
const claims = { role: 'anon', ref: 'exampleproject', exp: 4102444800 };
test('public configuration accepts matching legacy anon or publishable keys', () => {
  assert.equal(validatePublicConfig(url, jwt(claims)).kind, 'legacy-anon');
  assert.equal(validatePublicConfig(url, 'sb_publishable_example').kind, 'publishable');
});
test('public configuration rejects private, expired and wrong-project credentials', () => {
  for (const key of ['sb_secret_example', jwt({ ...claims, role: 'service_role' }), jwt({ ...claims, exp: 1 }), jwt({ ...claims, ref: 'otherproject' }), 'invalid']) assert.throws(() => validatePublicConfig(url, key));
  for (const badUrl of ['http://exampleproject.supabase.co', 'https://user:password@exampleproject.supabase.co', url + '/rest/v1', 'https://unrelated.example']) assert.throws(() => validatePublicConfig(badUrl, jwt(claims)));
});
