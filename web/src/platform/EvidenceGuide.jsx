import React from 'react';
import { Source, count } from './shared.jsx';
export function EvidenceGuide({ meta }) {
  return (
    <div className="water-workspace water-evidence-page">
      <h1 id="water-content" tabIndex={-1}>
        What the evidence can tell you
      </h1>
      <p className="water-lead">
        Every result carries its date, source and limits. Climate++ helps you find and check
        evidence; a marker cannot promise safe water.
      </p>
      <section>
        <h2>Water-source inventory</h2>
        <p>
          {count(meta.source.records)} WPdx Bangladesh records, assessed {meta.source.dates.min} to{' '}
          {meta.source.dates.max}. UNHCR, REACH Initiative and WaterAid supplied the underlying
          records. Current supply, hours, prices and safety remain unknown. Coverage is uneven, with
          many records around Ukhia.
        </p>
        <Source href={meta.source.url}>WPdx inventory and methods</Source>
        <Source href="https://www.waterpointdata.org/share-data/">CC BY 4.0 reuse terms</Source>
      </section>
      <section>
        <h2>River measurements</h2>
        <p>
          Historical Dhaka river chemistry from Sinha, Debnath and Bhattacharjee contains 1,495
          records dated 2017–2021. Only pH, dissolved oxygen and chemical oxygen demand are compared
          to three inland-fisheries objectives. This is a partial screen, not an overall
          water-quality index, health risk or potability test. Invalid negative measurements are
          excluded from the comparison, with source values preserved.
        </p>
        {meta.chemistrySources.map((s) => (
          <Source key={s.id} href={s.url}>
            {s.id === 'dhaka' ? 'Dhaka original data' : 'Sylhet BASIS original data'} · {s.license}
          </Source>
        ))}
      </section>
      <section>
        <h2>Mapped channel connections</h2>
        <p>
          Frozen OpenStreetMap river, stream, canal, drain and ditch geometries are linked only
          where they share actual OSM node IDs. A line crossing does not create a connection.
          Samples are associated with the nearest mapped section only within 750 m; the gap is shown
          and the original coordinate is preserved.
        </p>
        <p>
          A shared connection does not prove pollutant travel, actual flow direction or industrial
          responsibility. Tides, barriers, underground sections, mapping gaps and seasonal flow need
          field verification. The 750 m threshold is a declared screening choice, not an accuracy
          guarantee or contamination boundary.
        </p>
        <div className="water-table-wrap">
          <table>
            <caption>Downloaded channel snapshots</caption>
            <thead>
              <tr>
                <th scope="col">Area</th>
                <th scope="col">Mapped sections</th>
                <th scope="col">Snapshot time, UTC</th>
              </tr>
            </thead>
            <tbody>
              {meta.streamAreas.map((a) => (
                <tr key={a.id}>
                  <th scope="row">{a.id}</th>
                  <td>{count(a.ways)}</td>
                  <td>{a.source.osmBaseTimestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Source href="https://www.openstreetmap.org/copyright">
          © OpenStreetMap contributors · ODbL 1.0
        </Source>
        <Source href="https://wiki.openstreetmap.org/wiki/Waterways">
          How waterways are mapped
        </Source>
      </section>
      <section>
        <h2>Unlocated data stays unlocated</h2>
        <p>
          The BASIS workbook's quality stations have no verified coordinate crosswalk to its{' '}
          {meta.evidenceGaps.velocitySurveyPoints} velocity-survey positions. The latter can be
          shown in Sylhet, labelled as a velocity survey. They do not inherit bacterial counts or
          other chemistry from unrelated station IDs. Unlocated quality and hydraulic records remain
          in the included source workbook for a qualified investigation.
        </p>
      </section>
      <section>
        <h2>Sustainable supply and response practice</h2>
        <p>
          The rainwater calculator accounts for daily collection, storage, demand, overflow and
          shortages under entered assumptions. It does not establish sustainable groundwater yield,
          rainfall predictions or drinking-water safety. The delivery map uses real road snapshots
          with labelled fictional assets and closures; playback is not GPS, and routes are not
          certified safe during a disaster.
        </p>
        <Source href="https://www.who.int/publications/i/item/9789240088740">
          WHO · small water supplies
        </Source>
      </section>
      <section>
        <h2>What inspired the workflow</h2>
        <p>
          WPdx's source filters and data-age analysis informed source search. mWater's asset
          revisits and records informed the private check loop. HydroSHEDS shows why stream topology
          needs explicit data. Aquavelle combines these ideas locally; it does not claim to have
          invented water maps, a globally unique system or proven environmental impact.
        </p>
        <Source href="https://www.mwater.co/">mWater</Source>
        <Source href="https://www.waterpointdata.org/2022/03/07/launch-of-wpdx-decision-support-tools/">
          WPdx tools
        </Source>
        <Source href="https://www.hydrosheds.org/products/hydrorivers">HydroRIVERS</Source>
      </section>
      <section>
        <h2>Use and sharing</h2>
        <p>
          Public source searches read the frozen public inventory. New checks and measurements are
          private to the signed-in account. Your device location is used only after you choose it;
          water-source searches send the entered coordinates to this server and do not save them as
          a visit. OpenStreetMap tiles disclose the viewed map area to their service. Exported files
          should be shared deliberately; they may include your entered locations and notes.
        </p>
        <p>
          Use the included dataset register, reproducible builders and verification report when
          presenting the work. A useful pilot measures task completion, data gaps found and
          follow-up checks completed; health outcomes and avoided pollution require separate field
          evidence.
        </p>
      </section>
    </div>
  );
}
