import assert from 'node:assert/strict';
import test from 'node:test';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { operatorSession } from '../backend/operator-session.ts';

test('the default and explicitly public Workers never use incoming identity headers', async () => {
  const request = new Request('https://aquavelle.example/api/water/session', {
    headers: {
      'oai-authenticated-user-id': 'fixture',
      'oai-authenticated-user-email': 'fixture@example.test',
    },
  });
  for (const mode of [undefined, 'public', 'local']) {
    const session = await operatorSession(request, { DB: {}, AQUAVELLE_AUTH_MODE: mode });
    assert.equal(session.actor, null);
    assert.equal(session.signIn, null);
  }
});

test('operator identity requires the configured origin, signed issuer, audience and current expiry', async () => {
  const issuer = 'https://aquavelle-test.cloudflareaccess.com';
  const audience = 'a'.repeat(64);
  const operator = 'https://field.aquavelle.example';
  const env = {
    DB: {},
    AQUAVELLE_AUTH_MODE: 'access',
    AQUAVELLE_ACCESS_ISSUER: issuer,
    AQUAVELLE_ACCESS_AUDIENCE: audience,
    AQUAVELLE_OPERATOR_ORIGIN: operator,
  };
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const other = await generateKeyPair('RS256');
  const jwks = createLocalJWKSet({
    keys: [{ ...(await exportJWK(publicKey)), kid: 'local-test' }],
  });
  const keys = (configuredIssuer) => {
    assert.equal(configuredIssuer, issuer);
    return jwks;
  };
  const token = ({ iss = issuer, aud = audience, exp = '2m', key = privateKey } = {}) =>
    new SignJWT({ email: 'fixture@example.test' })
      .setProtectedHeader({ alg: 'RS256', kid: 'local-test' })
      .setIssuer(iss)
      .setAudience(aud)
      .setSubject('operator-fixture')
      .setExpirationTime(exp)
      .sign(key);
  const request = (origin, jwt) =>
    new Request(origin + '/api/water/session', {
      headers: { 'Cf-Access-Jwt-Assertion': jwt },
    });
  const valid = await token();
  const session = await operatorSession(request(operator, valid), env, keys);
  assert.equal(session.actor.id, 'access:operator-fixture');
  assert.equal(session.signIn, operator + '/?view=records');
  assert.equal(
    (await operatorSession(request('https://aquavelle.example', valid), env, keys)).actor,
    null,
  );
  for (const invalid of [
    await token({ aud: 'wrong-application' }),
    await token({ iss: 'https://other.cloudflareaccess.com' }),
    await token({ exp: '1 second ago' }),
    await token({ key: other.privateKey }),
  ]) {
    assert.equal((await operatorSession(request(operator, invalid), env, keys)).actor, null);
  }
});
