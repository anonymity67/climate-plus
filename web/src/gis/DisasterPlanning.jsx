import React, { useMemo, useState } from 'react';
import { ArrowRight, Download, Route, ShieldAlert } from 'lucide-react';
import { useResource } from './use-resource.mjs';
import { GISMap } from './GISMap.jsx';
import { DataState, SourceLink, number, saveJSON } from './shared.jsx';

export function DisasterPlanning({ bn, onPlan }) {
  const network = useResource('/data/gis-network.json');
  const geometry = useResource('/data/gis-network.geojson');
  if (!network.data)
    return <DataState resource={network} label="Loading the supplied Dacope GIS network…" />;
  if (!geometry.data)
    return (
      <DataState resource={geometry} label="Loading road-derived routes and scenario geometry…" />
    );
  return <LoadedPlanning network={network.data} geometry={geometry.data} bn={bn} onPlan={onPlan} />;
}

const conditions = [
  ['baseline', 'Clear roads'],
  ['storm_moderate', 'Moderate storm'],
  ['storm_severe', 'Severe storm'],
  ['salinity', 'Salinity hold'],
];
function LoadedPlanning({ network, geometry, bn, onPlan }) {
  const [condition, setCondition] = useState('storm_severe'),
    [selectedId, setSelectedId] = useState('reserve'),
    [planningScenario, setPlanningScenario] = useState('storm');
  const routeKey = condition === 'salinity' ? 'baseline' : condition;
  const access = network.access[routeKey].reserve;
  const selected =
    network.nodes.find((node) => node.id === selectedId) ||
    network.nodes.find((node) => node.id === 'reserve');
  const features = useMemo(
    () =>
      geometry.features.filter((feature) => {
        const p = feature.properties;
        if (p.kind === 'route') return p.scenario === routeKey;
        if (p.kind === 'hazard')
          return condition === 'salinity'
            ? p.scenario === 'salinity'
            : p.scenario === 'storm' &&
                p.severity ===
                  (condition === 'storm_severe' ? 3 : condition === 'storm_moderate' ? 1 : -1);
        return true;
      }),
    [geometry, condition, routeKey],
  );
  const scenarioNames = {
    storm: 'Storm access disruption',
    salinity: 'Salinity source hold',
    dry: 'Dry-period replenishment',
  };
  return (
    <div className="gis-planning">
      <div className="gis-section-intro">
        <div>
          <h2>
            {bn
              ? 'দুর্যোগের আগে পরিকল্পনাটি পরীক্ষা করুন।'
              : 'Rehearse a disruption before it happens.'}
          </h2>
          <p>
            {bn
              ? 'সহযোগীর QGIS নেটওয়ার্ক: বাস্তব সড়কের উপর কাল্পনিক পানির ব্যবস্থা ও দুর্যোগ।'
              : 'Your collaborator’s QGIS network: fictional water assets and hazards placed on real Dacope roads.'}
          </p>
        </div>
        <span className="gis-scenario-tag">Planning scenario · not live directions</span>
      </div>
      <div className="gis-layer-note">
        <ShieldAlert size={21} />
        <p>
          Every water point, catchment and hazard polygon in this view is synthetic. These are not
          public drinking-water destinations, operating suppliers or current flood warnings. The
          real inventory remains in Find water.
        </p>
      </div>
      <div className="gis-condition-switch" role="group" aria-label="Dacope route condition">
        {conditions.map(([id, label]) => (
          <button
            key={id}
            className={condition === id ? 'selected' : ''}
            aria-pressed={condition === id}
            onClick={() => setCondition(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="gis-map-layout">
        <section className="gis-map-column">
          <GISMap
            features={features}
            selectedId={selected.id}
            onSelect={(point) => {
              if (network.nodes.some((node) => node.id === point.id)) setSelectedId(point.id);
            }}
            extentKey="dacope-network"
            label="Synthetic Dacope planning network on real road geometry. Use the asset selector for keyboard access."
          />
          <div className="gis-map-caption">
            <span>
              <i className="gis-route-key" />
              Supplier → reserve route
            </span>
            <span>
              <i className="gis-hazard-key" />
              Assumed hazard area
            </span>
            <span>Outlined points = fictional assets</span>
          </div>
          <p className="gis-micro">
            Road geometry © OpenStreetMap contributors · ODbL 1.0. Route distance is from the
            supplied QGIS analysis. No route is verified as currently open, driveable or flood-safe.
          </p>
        </section>
        <aside className="gis-inspector">
          <div className="gis-inspector-heading">
            <Route size={21} />
            <h3>Supplier to shared reserve</h3>
          </div>
          <div className={'gis-route-status ' + (access.status === 'blocked' ? 'blocked' : '')}>
            {access.status === 'blocked'
              ? 'Classified blocked by scenario rule'
              : access.status === 'delayed'
                ? 'Delayed by scenario rule'
                : 'Open in this scenario'}
          </div>
          <dl className="gis-details">
            <div>
              <dt>QGIS-reported distance</dt>
              <dd>{number(access.distanceM / 1000, 2)} km</dd>
            </div>
            <div>
              <dt>Estimated travel time</dt>
              <dd>{number(access.minutes)} min</dd>
            </div>
            <div>
              <dt>Assumed speed on every road</dt>
              <dd>{network.assumptions.speedKmh} km/h</dd>
            </div>
            <div>
              <dt>Compared with clear route</dt>
              <dd>{number(access.detourFactor, 2)}× distance</dd>
            </div>
            <div>
              <dt>Physically connected in supplied graph</dt>
              <dd>{access.reachable ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
          <p className="gis-callout">
            {access.status === 'blocked'
              ? 'The severe-storm graph still has a route. The planner treats it as blocked because the detour exceeds the assumed 1.75× threshold, not because physical disconnection was proved.'
              : 'Open/delayed are modelled access labels. They do not establish today’s route condition or a safe travel time.'}
          </p>
          <label>
            Inspect fictional asset
            <select value={selected.id} onChange={(e) => setSelectedId(e.target.value)}>
              {network.nodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {node.name}
                </option>
              ))}
            </select>
          </label>
          <p className="gis-asset-summary">
            <b>{selected.name}</b> ·{' '}
            {selected.capacityL === null
              ? 'no independent storage volume supplied'
              : number(selected.capacityL, 0) + ' L shared reserve'}
            <br />
            Coordinates {selected.lat}, {selected.lon}
            <br />
            Drinking-water clearance: not supplied (scenario asset).
          </p>
        </aside>
      </div>
      <section className="gis-planner-link">
        <div>
          <h3>
            {bn ? 'মানচিত্র থেকে পানির পরিকল্পনায়' : 'Connect the map to the seven-day water plan'}
          </h3>
          <p>
            The planner consumes the GIS-derived blocked days and records the source hash and
            assumptions in its receipt. It does not invent extra water or treat an assumed route as
            verified.
          </p>
        </div>
        <div className="gis-planner-controls">
          <label>
            Planning scenario
            <select value={planningScenario} onChange={(e) => setPlanningScenario(e.target.value)}>
              {Object.entries(scenarioNames).map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button className="primary" onClick={() => onPlan(planningScenario)}>
            {bn ? 'পরিকল্পনা খুলুন' : 'Open the water plan'}
            <ArrowRight size={17} />
          </button>
        </div>
      </section>
      <div className="gis-list-heading">
        <div>
          <h3>Assumed storm access over seven days</h3>
          <p>Clear → severe → moderate → clear. Only day 2 is excluded by the detour rule.</p>
        </div>
        <button
          className="secondary"
          onClick={() =>
            saveJSON('climateplus-dacope-gis-scenario.json', {
              status: 'synthetic planning scenario; not a route or water clearance',
              network,
              selectedCondition: condition,
              selectedRoute: access,
            })
          }
        >
          <Download size={16} />
          Export scenario assumptions
        </button>
      </div>
      <div className="table-scroll gis-access-table">
        <table>
          <thead>
            <tr>
              <th>Planning day</th>
              <th>Assumed condition</th>
              <th>Estimated minutes</th>
              <th>Planner access</th>
            </tr>
          </thead>
          <tbody>
            {network.stormDays.map((day) => (
              <tr
                key={day.dayIndex}
                className={day.status === 'blocked' ? 'gis-table-warning' : ''}
              >
                <th>Day {day.dayIndex + 1}</th>
                <td>{day.condition}</td>
                <td>{number(day.minutesToReserve)}</td>
                <td>
                  {day.status === 'blocked'
                    ? 'No delivery window'
                    : day.status === 'delayed'
                      ? 'Open · delayed'
                      : 'Open'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="gis-source-footer">
        <SourceLink href="/data/gis-network.geojson">Download GIS layers</SourceLink>
        <SourceLink href="/data/gis-network.json">Inspect source hash & assumptions</SourceLink>
        <SourceLink href="https://www.openstreetmap.org/copyright">
          OpenStreetMap attribution
        </SourceLink>
        <SourceLink href="https://ffwc.gov.bd/">Official flood information</SourceLink>
      </div>
      <details className="gis-methods">
        <summary>What the supplied network establishes—and what it does not</summary>
        <p>
          Six fictional nodes, two catchments, three assumed hazard polygons and three
          supplier-to-reserve routes were exported from the retained GeoPackage. The reserve is
          10,000 L; household demand and school priority match the continuity model. Geographic
          salinity exposure holds the pond. No supplied storm polygon covers the pump, so the storm
          pump outage remains an independent scenario assumption.
        </p>
        <p>
          Thresholds: delayed from 1.2× clear distance, blocked from 1.75× or unreachable. One
          constant speed is assumed on every road. The planner currently models open/blocked
          windows; delay is informative and does not alter delivery capacity. Dacope boundary
          provenance is retained in the raw GeoPackage; its upstream licence requires confirmation
          before redistributing that boundary as a separate product.
        </p>
      </details>
    </div>
  );
}
