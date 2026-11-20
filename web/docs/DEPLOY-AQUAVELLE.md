# Deploy Aquavelle

Aquavelle uses a Cloudflare Worker with D1 for private field records. The public site serves historical source and river data and runs rainwater calculations without an account. Use Node.js 24 LTS.

## Verify locally

From this web directory:

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd run setup:local
npm.cmd run serve:local -- --port 5198
```

Open http://127.0.0.1:5198/. In a second terminal, run `node scripts/smoke-water-platform.mjs http://127.0.0.1:5198`. The preview binds to loopback and offers a test account so you can save and reopen checks. Keep it on loopback. For a direct production-style public preview use `npm.cmd run start` after building and migrating locally. On macOS or Linux use `npm`.

## Package and deploy the public site

```powershell
npm.cmd run deploy:cloudflare -- --dry-run
npx.cmd wrangler login
npx.cmd wrangler d1 create aquavelle-db
$env:AQUAVELLE_D1_ID = '<the database UUID from Wrangler>'
npm.cmd run deploy:cloudflare
```

The dry run builds and validates the deployment bundle without modifying your account. A real deployment validates the bundle first, applies the four versioned migrations, then deploys the Worker. Set `AQUAVELLE_WORKER_NAME` if you want a name other than `aquavelle`. Enable your workers.dev hostname for public access or attach your public custom domain in Cloudflare. Keep the old Worker version and a D1 recovery point for rollback. During a release, check the anonymous home page, the Bangla safety page, water search, calculation and the health route on the intended public URL.

Always set real operator identity before inviting field users. In public mode the Worker ignores identity headers and private record pages are unavailable. You can launch the public product without an identity provider.

## Enable field records

Create a Cloudflare Access self-hosted application for an entire dedicated operator hostname on a zone in the deployment account. Grant access only to the field accounts you intend to invite. Use the application audience tag from Access. Keep the public hostname outside this policy.

```powershell
$env:AQUAVELLE_AUTH_MODE = 'access'
$env:AQUAVELLE_ACCESS_ISSUER = 'https://your-team.cloudflareaccess.com'
$env:AQUAVELLE_ACCESS_AUDIENCE = '<the application audience tag>'
$env:AQUAVELLE_OPERATOR_ORIGIN = 'https://field.your-domain.example'
npm.cmd run deploy:cloudflare -- --dry-run
npm.cmd run deploy:cloudflare
```

The script attaches the operator custom domain to the same Worker. The Worker accepts a signed Access assertion only for that exact origin, with the configured audience, issuer, expiry and signature. Configure a cache bypass for the operator host and keep HTTPS enabled. Use two real operator accounts to verify record isolation, sign-out, and expiry on the deployed host. The new Access account namespace is separate from hosted Sites identities. Plan any historical account migration explicitly with data owners.

[Cloudflare Access token validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/) · [D1 recovery documentation](https://developers.cloudflare.com/d1/reference/time-travel/)

Sites is a separate deployment path. The app only accepts Sites identity headers when the managed deployment sets `AQUAVELLE_AUTH_MODE=sites` behind its trusted identity boundary. The standalone script rejects this mode.

## Operate the public pilot

- Inventory dates and coverage are visible to residents. Before promoting specific points, work with a local water provider or DPHE to confirm access, available supply and recent source-specific tests. The platform has no live service or quality feed.
- Use a Bangla field review on low-cost phones and record whether residents can find an area, understand the record date and identify whom to ask. This repository ships with no field usability or impact study.
- Public point search needs no identity. The optional near-me search sends a location rounded to four decimal places in a request body. The server does not save it to D1 or return it with the results. Configure hosting logs and any proxies to avoid collecting request bodies. The water-source map has no external tiles. Some technical maps use OpenStreetMap tiles, so review the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/) and provision a suitable tile service for large field rollouts.
- Agree with your partner who can access private visit notes, measurements and GPS records, how long to retain them and how to respond to access or deletion requests. Restrict database credentials and backup access. Exercise a D1 recovery and review application errors without recording sensitive request data.
