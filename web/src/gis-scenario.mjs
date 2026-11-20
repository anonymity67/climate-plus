export function applyGISScenario(config, network) {
  const derived = network?.derived?.[config?.id];
  const reserve = network?.nodes?.find((n) => n.id === 'reserve');
  if (
    network?.schema !== 'climate-plus/gis-network-v1' ||
    !/^[a-f0-9]{64}$/.test(network?.source?.sha256 || '') ||
    !derived ||
    !Array.isArray(derived.blockedDays) ||
    derived.blockedDays.some((d) => !Number.isInteger(d) || d < 0 || d >= config.days) ||
    reserve?.capacityL !== config.capacity
  ) {
    throw Error('Invalid GIS scenario inputs or snapshot lineage.');
  }
  return {
    ...structuredClone(config),
    ...(config.id === 'storm'
      ? {
          signal:
            'GIS detour rule excludes delivery days: ' +
            (derived.blockedDays.map((day) => day + 1).join(', ') || 'none') +
            '. Pump outage is a separate scenario assumption.',
          action: 'Inspect pump power and actual route conditions before authorizing a delivery.',
        }
      : {}),
    blockedDays: [...new Set(derived.blockedDays)].sort((a, b) => a - b),
    gisEvidence: {
      schema: network.schema,
      status: 'synthetic-scenario',
      sourceFile: network.source.file,
      sourceSha256: network.source.sha256,
      assumptions: structuredClone(network.assumptions),
      geographicRestrictedSources: [...derived.restrictedSourcesFromGeography],
      operatorScenarioRestrictedSources: [...config.restrictedSources],
      qualification:
        'Fictional network and hazards on real road geometry. Detour thresholds do not establish physically closed or flood-safe roads. Pump outage remains an independent scenario assumption.',
    },
  };
}
