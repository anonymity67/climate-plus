# Optional local EVM demonstration

Install from the project root with `npm run chain:install`, test with `npm run test:chain`, then start `npm run chain`. Run the root development server in another terminal. Only this directory installs ethers, Solidity compiler and Ganache. The root dashboard does not import them and works without this installation.

`registry.mjs` reads the shared `../../contracts/EvidenceRegistry.sol`. `server.mjs` exposes loopback HTTP on port 5174; Vite proxies `/chain` during development. GET `/chain/status` identifies chain 1337 and the current registry address. POST `/chain/anchor` accepts a bytes32 `digest` and optional bytes32 `previous`. Duplicate or invalid-parent registration is rejected by the contract. Requests are serialized. A restart creates a fresh chain and loses the registry history.

This legacy Ganache dependency tree has unresolved advisories, including critical severity; see `verification/optional-chain-audit.json`. Do not expose this service to the internet, use real keys/funds, or treat this demo as production infrastructure. There is no public-testnet deployment or independent timestamp guarantee. On Node 24 the bundled µWS binary is unavailable and Ganache uses its JavaScript fallback, which was exercised during the handoff test. The warning is expected and is not a failing contract assertion.

Use an actively maintained and independently reviewed chain/database solution before any production evidence service. A signed append-only database may be sufficient. Hash registration proves an integrity commitment, not the truth of environmental measurements.
