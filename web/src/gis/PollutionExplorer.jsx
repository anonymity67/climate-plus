import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Download, MapPin } from 'lucide-react';
import {
  contextClass,
  decodeWaterInventory,
  measuredPriority,
  nearbyRecords,
} from '../gis-engine.mjs';
import { useResource } from './use-resource.mjs';
import { GISMap } from './GISMap.jsx';
import { DataState, SourceLink, number, saveJSON } from './shared.jsx';

export function PollutionExplorer({ bn, onEvidence }) {
  const water = useResource('/data/water-evidence.json');
  const context = useResource('/data/river-pollution-context.json');
  const inventory = useResource('/data/water-access-candidates.json');
  if (!water.data) return <DataState resource={water} label="Loading dated river measurements…" />;
  if (!context.data)
    return <DataState resource={context} label="Loading publisher-classified GIS context…" />;
  if (!inventory.data)
    return <DataState resource={inventory} label="Loading nearby inventory context…" />;
  return (
    <LoadedPollution
      water={water.data}
      context={context.data}
      inventory={inventory.data}
      bn={bn}
      onEvidence={onEvidence}
    />
  );
}

const measuredColors = {
  'multiple-exceedances': '#9c4035',
  'one-exceedance': '#996013',
  'within-tested-objectives': '#647787',
  'not-measured': '#77817c',
};
function LoadedPollution({ water, context, inventory, bn, onEvidence }) {
  const [layer, setLayer] = useState('measured'),
    [river, setRiver] = useState('All rivers'),
    [year, setYear] = useState('2021');
  const [classFilter, setClassFilter] = useState('All classes'),
    [multipleOnly, setMultipleOnly] = useState(false),
    [selectedId, setSelectedId] = useState(null),
    [radius, setRadius] = useState(500),
    [visible, setVisible] = useState(20);
  const inventoryPoints = useMemo(() => decodeWaterInventory(inventory), [inventory]);
  const rivers = useMemo(
    () => ['All rivers', ...new Set(water.observations.map((r) => r.river))].sort(),
    [water],
  );
  const measured = useMemo(() => {
    const sites = new Map();
    water.observations
      .filter(
        (row) =>
          (year === 'All years' || row.date.startsWith(year)) &&
          (river === 'All rivers' || row.river === river),
      )
      .forEach((row) => {
        const old = sites.get(row.site);
        if (!old || row.date > old.date) sites.set(row.site, row);
      });
    return [...sites.values()]
      .map((row) => ({ ...row, priority: measuredPriority(row) }))
      .filter((row) => !multipleOnly || row.priority.failed >= 2)
      .sort((a, b) => b.priority.failed - a.priority.failed || a.site.localeCompare(b.site));
  }, [water, river, year, multipleOnly]);
  const contextRows = useMemo(
    () =>
      context.rows.map(([id, latitude, longitude, publisherValue, publisherClass]) => ({
        id,
        latitude,
        longitude,
        publisherValue,
        publisherClass,
        name: 'Publisher ' + publisherClass + ' · ' + id,
      })),
    [context],
  );
  const filteredContext = useMemo(
    () =>
      contextRows.filter(
        (row) =>
          classFilter === 'All classes' ||
          (classFilter === 'High & Very High'
            ? contextClass(row.publisherClass).priority
            : row.publisherClass === classFilter),
      ),
    [contextRows, classFilter],
  );
  const rows = layer === 'measured' ? measured : filteredContext;
  const selected = rows.find((row) => row.id === selectedId) || rows[0] || null;
  const points = useMemo(
    () =>
      rows.map((row) => ({
        ...row,
        color:
          layer === 'measured'
            ? measuredColors[row.priority.level]
            : contextClass(row.publisherClass).color,
        name: layer === 'measured' ? row.location + ' · ' + row.date : row.name,
        radius: layer === 'measured' ? 6 : 3,
        opacity: layer === 'measured' ? 0.85 : 0.6,
      })),
    [rows, layer],
  );
  const nearby = useMemo(
    () => (selected ? nearbyRecords(inventoryPoints, selected, radius) : null),
    [inventoryPoints, selected, radius],
  );
  const ring = useMemo(
    () =>
      selected
        ? { latitude: selected.latitude, longitude: selected.longitude, radiusM: radius }
        : null,
    [selected, radius],
  );
  const extentKey = JSON.stringify([layer, river, year, classFilter, multipleOnly]);
  function exportReview() {
    if (!selected) return;
    saveJSON('climateplus-pollution-review-' + selected.id + '.json', {
      schema: 'climate-plus/pollution-proximity-review-v1',
      createdAt: new Date().toISOString(),
      layer,
      selected,
      source:
        layer === 'measured'
          ? water.sources[0]
          : { url: context.url, version: context.version, rawSha256: context.rawSha256 },
      nearbyInventory: nearby,
      inventorySourceSha256: inventory.source_sha256,
      status:
        'Research review only. Proximity is not exposure; no health-risk boundary, present-day compliance, groundwater contamination or industrial emitter has been established.',
      followUp: [
        'Obtain current chemical and microbial measurements with laboratory QA and custody.',
        'Check actual water intakes, drainage connectivity, flow direction and timing.',
        'Assess alternatives before authorized source-control action.',
      ],
    });
  }
  return (
    <div className="gis-pollution">
      <div className="gis-section-intro">
        <div>
          <h2>
            {bn
              ? 'দূষণের প্রমাণ দেখুন। সঠিক জায়গায় পরীক্ষা করুন।'
              : 'See the evidence. Target the next field check.'}
          </h2>
          <p>
            {bn
              ? 'পরিমাপ করা নদীর তথ্য ও প্রকাশকের শ্রেণিবিন্যাস আলাদা রাখুন। এগুলো বর্তমান পানীয় জলের ছাড়পত্র নয়।'
              : 'Dated measurements and publisher classifications answer different questions. Neither is a current drinking-water clearance.'}
          </p>
        </div>
        <button className="secondary" onClick={() => onEvidence('trace')}>
          Investigate a measured source
          <ArrowRight size={16} />
        </button>
      </div>
      <div className="gis-layer-switch" role="group" aria-label="Pollution evidence layer">
        <button
          aria-pressed={layer === 'measured'}
          className={layer === 'measured' ? 'selected' : ''}
          onClick={() => {
            setLayer('measured');
            setSelectedId(null);
            setVisible(20);
          }}
        >
          Measured river samples <small>Dhaka · 2017–2021</small>
        </button>
        <button
          aria-pressed={layer === 'context'}
          className={layer === 'context' ? 'selected' : ''}
          onClick={() => {
            setLayer('context');
            setSelectedId(null);
            setVisible(20);
          }}
        >
          Kaggle GIS context <small>{number(context.rows.length, 0)} classified coordinates</small>
        </button>
      </div>
      <div className="gis-filter-row">
        {layer === 'measured' ? (
          <>
            <label>
              River
              <select
                value={river}
                onChange={(e) => {
                  setRiver(e.target.value);
                  setSelectedId(null);
                }}
              >
                {rivers.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label>
              Sample year
              <select
                value={year}
                onChange={(e) => {
                  setYear(e.target.value);
                  setSelectedId(null);
                }}
              >
                {['2021', '2020', '2019', '2018', '2017', 'All years'].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </label>
            <label className="gis-checkbox">
              <input
                type="checkbox"
                checked={multipleOnly}
                onChange={(e) => {
                  setMultipleOnly(e.target.checked);
                  setSelectedId(null);
                }}
              />
              Only two or more tested exceedances
            </label>
          </>
        ) : (
          <label>
            Publisher class
            <select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setSelectedId(null);
                setVisible(20);
              }}
            >
              {[
                'All classes',
                'High & Very High',
                'Very High',
                'High',
                'Moderate',
                'Low',
                'Very Low',
                'Unclassified',
              ].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          Investigation distance
          <select
            aria-label="Investigation distance"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          >
            {[250, 500, 1000, 2500, 5000].map((value) => (
              <option key={value} value={value}>
                {number(value, 0)} m
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="gis-layer-note">
        <AlertTriangle size={18} />
        <p>
          {layer === 'measured'
            ? 'Historical samples against three fisheries objectives: pH 6–9, DO ≥5 and COD ≤50 mg/L. This is a partial environmental screen, not a human-health or drinking-water index.'
            : 'Kaggle classes are retained as published. No sampling dates, pollutant units, class method or laboratory validation were supplied. A Low class must not be read as safe water.'}
        </p>
      </div>
      <div className="gis-map-layout">
        <section className="gis-map-column">
          <GISMap
            points={points}
            selectedId={selected?.id}
            onSelect={(point) => setSelectedId(point.id)}
            extentKey={'pollution:' + extentKey}
            ring={ring}
            label="Historical river evidence and investigation-distance circle. Select a record in the accompanying list for keyboard access."
          />
          <div className="gis-map-caption gis-pollution-key">
            {layer === 'measured' ? (
              <>
                <span>
                  <i className="gis-dot" style={{ background: '#9c4035' }} />
                  2+ tested objectives exceeded
                </span>
                <span>
                  <i className="gis-dot" style={{ background: '#996013' }} />1 exceeded
                </span>
                <span>
                  <i className="gis-dot" style={{ background: '#647787' }} />
                  Within tested objectives
                </span>
              </>
            ) : (
              ['Very High', 'High', 'Moderate', 'Low', 'Very Low', 'Unclassified'].map((value) => (
                <span key={value}>
                  <i className="gis-dot" style={{ background: contextClass(value).color }} />
                  {value}
                </span>
              ))
            )}
          </div>
          <p className="gis-micro">
            Dashed circle = a field-investigation distance only. It is not a contaminant plume, an
            affected population, an exclusion zone or a safe boundary. Water flow and exposure are
            not inferred from distance.
          </p>
        </section>
        <aside className="gis-inspector" aria-label="Selected pollution evidence">
          {selected ? (
            <>
              <div className="gis-inspector-heading">
                <MapPin size={20} />
                <h3>{layer === 'measured' ? selected.location : selected.id}</h3>
              </div>
              {layer === 'measured' ? (
                <>
                  <p>
                    {selected.river} · sampled {selected.date}
                  </p>
                  <div className="gis-screen-summary">
                    <b>
                      {selected.priority.index === null ? '—' : Math.round(selected.priority.index)}
                      <small>/100</small>
                    </b>
                    <span>
                      {selected.priority.failed} of {selected.priority.tested} valid tested
                      parameters exceeded
                    </span>
                  </div>
                  <p className="gis-micro">
                    Partial objective exceedance index · at most 3/12 fisheries parameters. Zero
                    does not mean potable.
                  </p>
                  <dl className="gis-details">
                    <div>
                      <dt>pH</dt>
                      <dd>{number(selected.ph, 2)}</dd>
                    </div>
                    <div>
                      <dt>Dissolved oxygen</dt>
                      <dd>{number(selected.do, 2)} mg/L</dd>
                    </div>
                    <div>
                      <dt>COD</dt>
                      <dd>{number(selected.cod, 2)} mg/L</dd>
                    </div>
                    <div>
                      <dt>Source</dt>
                      <dd>Sinha et al. · Mendeley v1</dd>
                    </div>
                  </dl>
                </>
              ) : (
                <>
                  <p>Publisher classification · research context</p>
                  <div
                    className="gis-publisher-class"
                    style={{ color: contextClass(selected.publisherClass).color }}
                  >
                    {selected.publisherClass}
                  </div>
                  <dl className="gis-details">
                    <div>
                      <dt>Published intensity value</dt>
                      <dd>{number(selected.publisherValue, 5)}</dd>
                    </div>
                    <div>
                      <dt>Physical pollutant unit</dt>
                      <dd>Not supplied</dd>
                    </div>
                    <div>
                      <dt>Sampling date / lab evidence</dt>
                      <dd>Not supplied</dd>
                    </div>
                    <div>
                      <dt>Dataset version</dt>
                      <dd>
                        {context.version} · updated {context.publisherUpdated.slice(0, 10)}
                      </dd>
                    </div>
                  </dl>
                </>
              )}
              <div className="gis-proximity-result">
                <strong>
                  {number(nearby.records.length, 0)} inventory candidates within {number(radius, 0)}{' '}
                  m
                </strong>
                <p>
                  Locations a field team could check. They are old public water-point records, not
                  people affected or confirmed contaminated sources.
                </p>
                {nearby.records.slice(0, 3).map((point) => (
                  <p key={point.id}>
                    {point.sourceType} · {number(point.distanceKm * 1000, 0)} m · assessed{' '}
                    {point.assessedAt}
                  </p>
                ))}
                {nearby.records.length === 0 && (
                  <p>
                    No inventory coverage found nearby. This says nothing about actual local intakes
                    or exposure.
                  </p>
                )}
              </div>
              <button className="secondary full" onClick={exportReview}>
                <Download size={16} />
                Export evidence & follow-up area
              </button>
            </>
          ) : (
            <div className="gis-empty">
              <h3>No matching samples</h3>
              <p>Change the river, year or priority filter.</p>
            </div>
          )}
        </aside>
      </div>
      <div className="gis-list-heading">
        <div>
          <h3>
            {layer === 'measured'
              ? 'Selected historical sampling sites'
              : 'Published coordinate records'}
          </h3>
          <p>{number(rows.length, 0)} matching records · use the list to select a marker</p>
        </div>
        {layer === 'measured' && (
          <button className="quiet" onClick={() => onEvidence('model')}>
            Inspect the trained DO model
            <ArrowRight size={16} />
          </button>
        )}
      </div>
      <div className="gis-result-list gis-pollution-results">
        {rows.slice(0, visible).map((row) => (
          <button
            className={'gis-result-row ' + (selected?.id === row.id ? 'selected' : '')}
            key={row.id}
            onClick={() => setSelectedId(row.id)}
            aria-pressed={selected?.id === row.id}
          >
            <span>
              <b>{layer === 'measured' ? row.location : row.id}</b>
              <small>
                {layer === 'measured' ? row.river + ' · ' + row.date : 'No sampling date supplied'}
              </small>
            </span>
            <span className="gis-row-status">
              {layer === 'measured'
                ? row.priority.failed + ' / ' + row.priority.tested + ' exceedances'
                : row.publisherClass}
              <ArrowRight size={15} />
            </span>
          </button>
        ))}
      </div>
      {visible < rows.length && (
        <button
          className="secondary gis-load-more"
          onClick={() => setVisible((v) => Math.min(v + 50, rows.length))}
        >
          Show more records
        </button>
      )}
      <div className="gis-source-footer">
        <SourceLink href={layer === 'measured' ? water.sources[0].url : context.url}>
          {layer === 'measured'
            ? 'Measured source · Sinha et al. · CC BY 4.0'
            : context.provider + ' · Kaggle v' + context.version + ' · publisher-declared MIT'}
        </SourceLink>
        <SourceLink href="/data/river-pollution-context.json">
          Download normalized Kaggle context
        </SourceLink>
        <SourceLink href="/data/gis-source-audit.json">Data-quality audit</SourceLink>
      </div>
      <details className="gis-methods">
        <summary>How to interpret the map responsibly</summary>
        <p>
          The measured layer selects the latest available sample per source site within the selected
          year; different markers may represent different dates. It is not a simultaneous survey or
          current condition map. The Kaggle coordinate values are not substituted for laboratory
          measurements, used to train the DO estimator, or combined into a new health-risk score.
        </p>
        <p>
          A nearby drinking-water point is not proved polluted by proximity to a river marker.
          Establish actual intake/drainage connections, flow, chemical and microbial measurements,
          timing, and sample custody. No industrial facility is identified or blamed by this map.
        </p>
      </details>
    </div>
  );
}
