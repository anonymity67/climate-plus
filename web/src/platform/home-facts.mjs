// Headline numbers for the home page. They are copied from the published model and screening
// outputs so the home page can render on the server without loading large data files.
// tests/home-facts.test.mjs checks every value against public/data/rainhub-model.json.
export const homeFacts = {
  monthlyMm: [9, 15, 67, 222, 333, 341, 461, 306, 270, 234, 26, 17], // CHIRPS 2017–2021, Jan..Dec
  yearMm: 2301,
  dryFiveMm: 134, // the five driest months together
  rainRangeMm: [2200, 2491], // annual rain across the model grid
  population: 24.7, // million, Dhaka study area (WorldPop 2020)
  exposed: 12.6, // million living where the river is likely severely polluted (model)
  samples: 1495,
  oxygenPassPct: 18, // samples with dissolved oxygen of at least 5 mg/L
  hubs: 15,
  tankM3: 12000,
  hubPeople: 75000,
  reliabilityPct: [90, 93],
  accessBasePct: 49,
  accessWithCleanupPct: 66,
};

const bnDigits = '০১২৩৪৫৬৭৮৯';
export const bnNum = (value) => String(value).replace(/[0-9]/g, (d) => bnDigits[d]);
export const fmt = (n, bn) => {
  const s = Number(n).toLocaleString('en-US');
  return bn ? bnNum(s) : s;
};
