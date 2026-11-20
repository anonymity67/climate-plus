import { createRemoteJWKSet, jwtVerify } from 'jose';

type Settings = {
  AQUAVELLE_AUTH_MODE?: string;
  AQUAVELLE_ACCESS_ISSUER?: string;
  AQUAVELLE_ACCESS_AUDIENCE?: string;
  AQUAVELLE_OPERATOR_ORIGIN?: string;
  DB?: unknown;
};

const jwksByIssuer = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function accessSettings(env: Settings) {
  const issuer = env.AQUAVELLE_ACCESS_ISSUER;
  const audience = env.AQUAVELLE_ACCESS_AUDIENCE;
  const operator = env.AQUAVELLE_OPERATOR_ORIGIN;
  if (
    !issuer ||
    !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(issuer) ||
    !audience ||
    !/^[a-f0-9]{64}$/i.test(audience) ||
    !operator ||
    !/^https:\/\/(?:[a-z0-9-]+\.)+[a-z0-9-]+$/.test(operator)
  )
    return null;
  return { issuer, audience, operator };
}

function headerAuthEnabled(env: Settings, origin: URL) {
  return (
    env.AQUAVELLE_AUTH_MODE === 'sites' ||
    (env.AQUAVELLE_AUTH_MODE === 'local' &&
      origin.protocol === 'http:' &&
      origin.hostname === '127.0.0.1')
  );
}

function remoteKeys(issuer: string) {
  let jwks = jwksByIssuer.get(issuer);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL('/cdn-cgi/access/certs', issuer));
    jwksByIssuer.set(issuer, jwks);
  }
  return jwks;
}

export async function operatorSession(request: Request, env: Settings, keys = remoteKeys) {
  const url = new URL(request.url);
  if (!env.DB) return { mode: 'public', actor: null, signIn: null, signOut: null };
  if (headerAuthEnabled(env, url)) {
    const id = request.headers.get('oai-authenticated-user-id');
    const email = request.headers.get('oai-authenticated-user-email');
    // This mode is only for the managed Sites identity boundary or loopback test adapter.
    return {
      mode: env.AQUAVELLE_AUTH_MODE,
      actor: id && email ? { id, email, displayName: email } : null,
      signIn: '/signin-with-chatgpt?return_to=%2F%3Fview%3Drecords',
      signOut: '/signout-with-chatgpt?return_to=%2F',
    };
  }
  const access = env.AQUAVELLE_AUTH_MODE === 'access' ? accessSettings(env) : null;
  if (!access) return { mode: 'public', actor: null, signIn: null, signOut: null };

  const signIn = access.operator + '/?view=records';
  const signOut = access.operator + '/cdn-cgi/access/logout';
  const token = request.headers.get('cf-access-jwt-assertion');
  let actor = null;
  if (url.origin === access.operator && token && token.length < 8192) {
    try {
      const { payload } = await jwtVerify(token, keys(access.issuer), {
        issuer: access.issuer,
        audience: access.audience,
        algorithms: ['RS256'],
        requiredClaims: ['exp', 'sub', 'email'],
      });
      if (
        payload.sub &&
        payload.sub.length <= 128 &&
        typeof payload.email === 'string' &&
        payload.email.length <= 254 &&
        payload.email.includes('@')
      ) {
        actor = { id: 'access:' + payload.sub, email: payload.email, displayName: payload.email };
      }
    } catch {
      // Invalid tokens and unavailable verification keys both fail closed.
    }
  }
  return { mode: 'access', actor, signIn, signOut };
}
