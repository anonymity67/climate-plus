import reference from '../../public/data/borsha-bandhu-profiles.json' with { type: 'json' };

export const harvestReference = reference;

function inRange(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

export function seasonalHarvest({ profile, rainfall, roofM2, tankL, dailyDemandL }) {
  const region = reference.profiles.find(({ id }) => id === profile);
  if (
    !region ||
    !['typical', 'lower'].includes(rainfall) ||
    !inRange(roofM2, 1, 10000) ||
    !inRange(tankL, 0, 1000000) ||
    !inRange(dailyDemandL, 1, 100000)
  ) {
    throw Error('Check your region, rainfall scenario, roof, tank and daily demand.');
  }

  const rainfallFactor = rainfall === 'lower' ? reference.dryFactor : 1;
  let endL = tankL;
  let stable = false;
  let months = [];
  for (let year = 0; year < 60 && !stable; year++) {
    const openYearL = endL;
    months = region.mm.map((amount, index) => {
      const startL = endL;
      const rainfallMm = amount * rainfallFactor;
      const collectedL = rainfallMm * roofM2 * reference.runoff;
      const demandL = reference.days[index] * dailyDemandL;
      const spillL = Math.max(0, startL + collectedL - tankL);
      const availableL = Math.min(tankL, startL + collectedL);
      const servedL = Math.min(availableL, demandL);
      endL = availableL - servedL;
      return {
        month: index + 1,
        rainfallMm,
        startL,
        collectedL,
        servedL,
        demandL,
        shortL: demandL - servedL,
        spillL,
        endL,
      };
    });
    stable = Math.abs(openYearL - endL) < 0.5;
  }
  const dry = months.filter(({ month }) => month >= 11 || month <= 5);
  const sum = (period, field) => period.reduce((total, month) => total + month[field], 0);
  return {
    months,
    stable,
    annualServedL: sum(months, 'servedL'),
    shortL: sum(months, 'shortL'),
    dryShortL: sum(dry, 'shortL'),
    dryCoveragePct: (sum(dry, 'servedL') / sum(dry, 'demandL')) * 100,
    spillL: sum(months, 'spillL'),
    endL,
    assumptions: {
      source: reference.source,
      profile,
      rainfallFactor,
      collectedShare: reference.runoff,
      order: 'Rain enters the tank before monthly demand is applied; excess spills.',
      dryMonths: 'November to May',
      waterQuality: 'unknown',
    },
  };
}

const normalise = (value) =>
  String(value ?? '')
    .trim()
    .replace(/[০-৯]/g, (digit) => '০১২৩৪৫৬৭৮৯'.indexOf(digit));
export const parseHarvestNumber = (value) => {
  const text = normalise(value);
  return /^(?:\d+(?:\.\d+)?|\.\d+)$/.test(text) ? Number(text) : NaN;
};
