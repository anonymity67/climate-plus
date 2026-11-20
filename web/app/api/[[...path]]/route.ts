import { env } from 'cloudflare:workers';
import { createApi } from '../../../backend/api.mjs';
import { createD1Store } from '../../../backend/store.mjs';
import { routingPool, regionalCatalogue } from '../../../routing/registry.mjs';
import { operatorSession } from '../../../backend/operator-session';
import { createWaterApi } from '../../../backend/water-api.mjs';
import { waterCatalogue } from '../../../backend/water-registry.mjs';

export const dynamic = 'force-dynamic';

const privateHeaders = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
};

async function handle(request: Request) {
  const path = new URL(request.url).pathname.replace(/\/$/, '');
  const isWater = path.startsWith('/api/water/');
  const privateWater = path === '/api/water/checks' || path === '/api/water/checks-export';
  const session =
    !isWater || privateWater || path === '/api/water/session'
      ? await operatorSession(request, env)
      : null;
  if (request.method === 'GET' && path === '/api/water/session') {
    return Response.json(
      {
        mode: session?.mode,
        signedIn: Boolean(session?.actor),
        signIn: session?.signIn,
        signOut: session?.actor ? session.signOut : null,
      },
      { headers: privateHeaders },
    );
  }
  if ((!isWater || privateWater) && !env.DB)
    return Response.json(
      {
        error: {
          code: 'database_unavailable',
          message: 'Field records are temporarily unavailable.',
        },
      },
      { status: 503, headers: privateHeaders },
    );
  if (isWater) {
    return createWaterApi({
      store: env.DB ? createD1Store(env.DB) : null,
      catalogue: waterCatalogue(),
    })(request, session?.actor ?? null);
  }
  return createApi({
    store: createD1Store(env.DB!),
    routing: routingPool,
    catalogue: regionalCatalogue,
  })(request, session?.actor ?? null);
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
