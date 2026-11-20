import test from 'node:test';
import assert from 'node:assert/strict';
import { ZeroHash, ZeroAddress, id } from 'ethers';
import { createRegistry } from '../registry.mjs';
test('EVM registry stores author, rejects duplicates and links corrections', async () => {
  const { contract, raw } = await createRegistry();
  try {
    const first = id('original');
    await (await contract.anchor(first, ZeroHash)).wait();
    const entry = await contract.records(first);
    assert.notEqual(entry.author, ZeroAddress);
    assert.ok(entry.timestamp > 0n);
    await assert.rejects(async () => {
      await (await contract.anchor(first, ZeroHash)).wait();
    });
    await assert.rejects(async () => {
      await (await contract.anchor(ZeroHash, ZeroHash)).wait();
    });
    await assert.rejects(async () => {
      await (await contract.anchor(id('bad-parent'), id('missing'))).wait();
    });
    const second = id('correction');
    await (await contract.anchor(second, first)).wait();
    assert.equal((await contract.records(second)).previous, first);
  } finally {
    await raw.disconnect();
  }
});
