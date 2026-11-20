import { api } from '../operations/api-client.mjs';
export async function fetchScenarioPlan(
  input,
  { expectedGraphHash, signal, transport = api } = {},
) {
  const result = await transport('/scenario-route', { method: 'POST', body: input, signal });
  if (
    result?.regionId !== input.regionId ||
    result?.hazard !== input.hazard ||
    result?.calculation !== 'server' ||
    !Array.isArray(result.routes)
  )
    throw Error('Server scenario mismatch. Reload the selected region.');
  if (expectedGraphHash && result.source?.graphSha256 !== expectedGraphHash)
    throw Error('Road snapshots mismatch; reload before using a server result.');
  if (result.sourceKind !== 'representational' || result.waterSafety !== 'unknown')
    throw Error('Server result must retain representational and unknown-safety labels.');
  return result;
}
