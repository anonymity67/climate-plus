import http from 'node:http';
import { ZeroHash } from 'ethers';
import { createRegistry } from './registry.mjs';
const { contract, raw } = await createRegistry();
let queue = Promise.resolve();
const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  const send = (status, body) => {
    res.writeHead(status);
    res.end(JSON.stringify(body));
  };
  if (req.method === 'GET' && req.url === '/chain/status')
    return send(200, {
      chainId: 1337,
      network: 'local-development',
      contract: await contract.getAddress(),
    });
  if (req.method !== 'POST' || req.url !== '/chain/anchor')
    return send(404, { error: 'Unknown endpoint' });
  const origin = req.headers.origin;
  if (origin && !['http://127.0.0.1:5173', 'http://localhost:5173'].includes(origin))
    return send(403, { error: 'Origin not allowed' });
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 4096) return send(413, { error: 'Receipt request too large' });
  }
  try {
    const { digest, previous = ZeroHash } = JSON.parse(body);
    if (!/^0x[a-fA-F0-9]{64}$/.test(digest) || !/^0x[a-fA-F0-9]{64}$/.test(previous))
      return send(400, { error: 'Expected bytes32 digest and parent' });
    const operation = queue.then(async () => {
      const tx = await contract.anchor(digest, previous);
      const receipt = await tx.wait();
      return {
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        chainId: 1337,
        network: 'local-development',
        contract: await contract.getAddress(),
        digest,
      };
    });
    queue = operation.catch(() => {});
    send(200, await operation);
  } catch (error) {
    send(400, { error: error.shortMessage || error.message });
  }
});
server.listen(5174, '127.0.0.1', () =>
  console.log(
    'Local EVM receipt service: http://127.0.0.1:5174/chain/status (ephemeral chain 1337)',
  ),
);
process.on('SIGINT', () => {
  server.close();
  raw.disconnect();
  process.exit();
});
