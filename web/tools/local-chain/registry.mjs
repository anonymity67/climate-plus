import { readFileSync } from 'node:fs';
import solc from 'solc';
import ganache from 'ganache';
import { BrowserProvider, ContractFactory } from 'ethers';
export async function createRegistry() {
  const source = readFileSync(
    new URL('../../contracts/EvidenceRegistry.sol', import.meta.url),
    'utf8',
  );
  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: 'Solidity',
        sources: { 'EvidenceRegistry.sol': { content: source } },
        settings: {
          evmVersion: 'shanghai',
          outputSelection: { '*': { '*': ['abi', 'evm.bytecode'] } },
        },
      }),
    ),
  );
  const errors = (output.errors || []).filter((e) => e.severity === 'error');
  if (errors.length) throw Error(errors.map((e) => e.formattedMessage).join('\n'));
  const artifact = output.contracts['EvidenceRegistry.sol'].EvidenceRegistry;
  const raw = ganache.provider({
    logging: { quiet: true },
    chain: { chainId: 1337, hardfork: 'shanghai' },
    wallet: { totalAccounts: 2 },
  });
  const provider = new BrowserProvider(raw);
  const signer = await provider.getSigner();
  const contract = await new ContractFactory(
    artifact.abi,
    artifact.evm.bytecode.object,
    signer,
  ).deploy();
  await contract.waitForDeployment();
  return { contract, provider, raw, artifact };
}
