/** Standalone built-app preview with a clearly labelled loopback-only test identity. */
import './sites-env.mjs';
import http from 'node:http';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { once } from 'node:events';
const args = process.argv.slice(2),
  argIndex = args.indexOf('--port'),
  port = argIndex < 0 ? 5198 : Number(args[argIndex + 1]);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw Error('Choose --port 1024–65535.');
if (!existsSync('dist/server/wrangler.json')) throw Error('Run npm run build first.');
const reservation = net.createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const workerPort = reservation.address().port;
await new Promise((r) => reservation.close(r));
const worker = spawn(
  process.execPath,
  [
    '--import',
    './scripts/sites-env.mjs',
    'node_modules/wrangler/bin/wrangler.js',
    'dev',
    '--config',
    'dist/server/wrangler.json',
    '--local',
    '--var',
    'AQUAVELLE_AUTH_MODE:local',
    '--persist-to',
    '.wrangler/state',
    '--ip',
    '127.0.0.1',
    '--port',
    String(workerPort),
    '--inspector-port',
    '0',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
);
worker.stdout.on('data', (data) => {
  const text = data.toString();
  if (/ERROR|Error|error:/.test(text)) process.stderr.write(text);
});
worker.stderr.on('data', (data) => process.stderr.write(data));
let exited = false;
worker.once('exit', () => {
  exited = true;
});
const workerOrigin = 'http://127.0.0.1:' + workerPort,
  origin = 'http://127.0.0.1:' + port,
  cookieName = 'climateplus_local_signin';
let ready = false;
for (let i = 0; i < 60; i++) {
  if (exited) throw Error('The local Worker stopped during startup.');
  try {
    const response = await fetch(workerOrigin + '/api/health', {
      signal: AbortSignal.timeout(1000),
    });
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((r) => setTimeout(r, 500));
}
if (!ready) {
  worker.kill();
  throw Error('The built Worker did not start. Apply local migrations and check the build.');
}
const server = http.createServer(async (request, response) => {
  try {
    // Never accept a user-supplied authenticated header or proxy a foreign Host.
    if (request.headers.host !== '127.0.0.1:' + port) {
      response.writeHead(403);
      response.end('Use the printed 127.0.0.1 URL.');
      return;
    }
    const url = new URL(request.url, origin),
      method = request.method;
    if (!['GET', 'HEAD'].includes(method) && request.headers.origin !== origin) {
      response.writeHead(403);
      response.end('Same-origin requests only.');
      return;
    }
    if (url.pathname === '/signin-with-chatgpt' || url.pathname === '/signout-with-chatgpt') {
      if (method !== 'GET') {
        response.writeHead(405);
        response.end();
        return;
      }
      const signIn = url.pathname === '/signin-with-chatgpt';
      let target = url.searchParams.get('return_to') || '/';
      if (
        !target.startsWith('/') ||
        target.startsWith('//') ||
        new URL(target, origin).origin !== origin ||
        /^\/(signin|signout)-with-chatgpt/.test(target)
      )
        target = '/';
      response.writeHead(302, {
        'Set-Cookie': `${cookieName}=${signIn ? '1' : ''}; HttpOnly; SameSite=Lax; Path=/; ${signIn ? '' : 'Max-Age=0;'}`,
        Location: target,
        'Cache-Control': 'no-store',
      });
      response.end();
      return;
    }
    const headers = new Headers();
    const forwardedHeaders = new Set([
      'accept',
      'accept-language',
      'content-type',
      'cookie',
      'range',
      'if-none-match',
      'sec-fetch-site',
    ]);
    for (const [key, value] of Object.entries(request.headers)) {
      if (!forwardedHeaders.has(key)) continue;
      if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(',') : value);
    }
    if (request.headers.origin === origin) headers.set('origin', workerOrigin);
    if ((request.headers.cookie || '').split(';').some((c) => c.trim() === cookieName + '=1')) {
      headers.set('oai-authenticated-user-id', 'local_seedy');
      headers.set('oai-authenticated-user-email', 'seedy@sites.test');
    }
    // A bounded, replayable body also handles local Worker transport retries.
    // Forwarding IncomingMessage directly leaves Fetch with a non-replayable source.
    let body;
    if (!['GET', 'HEAD'].includes(method)) {
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 32768) {
          response.writeHead(413, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ error: { message: 'Request body exceeds 32 KiB.' } }));
          return;
        }
        chunks.push(chunk);
      }
      body = Buffer.concat(chunks);
    }
    const upstream = await fetch(workerOrigin + url.pathname + url.search, {
      method,
      headers,
      body,
      redirect: 'manual',
    });
    const outgoing = {};
    for (const [key, value] of upstream.headers)
      if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(key))
        outgoing[key] = value;
    outgoing['X-ClimatePlus-Local-Preview'] =
      'Loopback-only test identity; not production authentication';
    response.writeHead(upstream.status, outgoing);
    if (method === 'HEAD' || !upstream.body) {
      response.end();
      return;
    }
    for await (const chunk of upstream.body) {
      if (!response.write(chunk)) await once(response, 'drain');
    }
    response.end();
  } catch (error) {
    console.error(
      'Local preview transport failure:',
      error.name,
      error.message,
      error.cause?.code,
      error.cause?.message,
    );
    if (!response.headersSent) response.writeHead(502, { 'Content-Type': 'text/plain' });
    response.end('Local preview request failed. Check the Worker and local migrations.');
  }
});
server.listen(port, '127.0.0.1');
await once(server, 'listening');
console.log('Aquavelle built full-stack preview: ' + origin);
console.log(
  'Local sign-in is a loopback-only test account: seedy@sites.test. Never expose this service or proxy it publicly.',
);
const stop = () => {
  server.close();
  worker.kill();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('error', (error) => {
  worker.kill();
  throw error;
});
