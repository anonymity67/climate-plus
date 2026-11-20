import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Download, LocateFixed, MapPin, Search } from 'lucide-react';
import { decodeWaterInventory, findWaterPoints, validCoordinates } from '../gis-engine.mjs';
import { useResource } from './use-resource.mjs';
import { GISMap } from './GISMap.jsx';
import { DataState, SourceLink, number, saveJSON } from './shared.jsx';

const fallback = { label: 'Cox’s Bazar / Ukhia', lat: 21.19233711, lon: 92.1489277 };
export function WaterFinder({ bn, onCare }) {
  const resource = useResource('/data/water-access-candidates.json');
  return resource.data ? (
    <LoadedFinder data={resource.data} bn={bn} onCare={onCare} />
  ) : (
    <DataState resource={resource} label="Loading the public water-point inventory…" />
  );
}

function LoadedFinder({ data, bn, onCare }) {
  const points = useMemo(() => decodeWaterInventory(data), [data]);
  const presets = data.presets || [fallback];
  const initial = presets[0] || fallback;
  const [latitude, setLatitude] = useState(String(initial.lat)),
    [longitude, setLongitude] = useState(String(initial.lon));
  const [query, setQuery] = useState(''),
    [radius, setRadius] = useState(5),
    [error, setError] = useState(''),
    [locating, setLocating] = useState(false);
  const [search, setSearch] = useState({
    center: { latitude: initial.lat, longitude: initial.lon },
    query: '',
    radiusKm: 5,
  });
  const [selectedId, setSelectedId] = useState(null),
    [visible, setVisible] = useState(20),
    [locationNote, setLocationNote] = useState(initial.label + ' · preset, not your location');
  const matches = useMemo(
    () => findWaterPoints(points, { ...search, limit: 50000 }),
    [points, search],
  );
  const mapPoints = useMemo(() => matches.slice(0, 250), [matches]);
  const selected = matches.find((point) => point.id === selectedId) || matches[0] || null;
  const extentKey = JSON.stringify(search);
  function submit(event) {
    event?.preventDefault();
    const center = { latitude: Number(latitude), longitude: Number(longitude) };
    if (!latitude.trim() || !longitude.trim() || !validCoordinates(center)) {
      setError('Enter numeric latitude (−90 to 90) and longitude (−180 to 180).');
      return;
    }
    setSearch({ center, query, radiusKm: radius });
    setError('');
    setSelectedId(null);
    setVisible(20);
    setLocationNote(bn ? 'আপনার দেওয়া অনুসন্ধান কেন্দ্র' : 'Search centre you entered');
  }
  function choosePreset(value) {
    const preset = presets.find((p) => p.label === value);
    if (!preset) return;
    setLatitude(String(preset.lat));
    setLongitude(String(preset.lon));
    setQuery('');
    setSearch({
      center: { latitude: preset.lat, longitude: preset.lon },
      query: '',
      radiusKm: radius,
    });
    setSelectedId(null);
    setVisible(20);
    setError('');
    setLocationNote(preset.label + ' · preset, not your location');
  }
  function locate() {
    if (!navigator.geolocation) {
      setError('This browser does not support location. Enter coordinates instead.');
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const center = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setLatitude(String(center.latitude));
        setLongitude(String(center.longitude));
        setSearch({ center, query, radiusKm: radius });
        setSelectedId(null);
        setVisible(20);
        setLocating(false);
        setLocationNote(
          'Device location · reported accuracy ±' + Math.round(position.coords.accuracy) + ' m',
        );
      },
      () => {
        setLocating(false);
        setError(
          'Location was not shared or could not be found. Enter coordinates or select a covered area.',
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }
  function exportShortlist() {
    saveJSON('climateplus-water-candidate-shortlist.json', {
      schema: 'climate-plus/water-candidate-shortlist-v1',
      createdAt: new Date().toISOString(),
      status: 'UNVERIFIED HISTORICAL INVENTORY — NOT A SAFE-WATER OR ROUTE CLEARANCE',
      source: data.url,
      sourceSha256: data.source_sha256,
      search,
      candidates: matches.slice(0, 20),
      beforeTravel: [
        'Confirm current water availability and opening times with the operator/local authority.',
        'Obtain current fit-for-purpose chemical and microbial water-test evidence.',
        'Check flood conditions and accessible routes; the distance is straight-line only.',
      ],
      guidance: 'https://www.cdc.gov/water-emergency/about/',
    });
  }
  return (
    <div className="gis-finder">
      <div className="gis-section-intro">
        <div>
          <h2>
            {bn
              ? 'পানির উৎস খুঁজুন, যাওয়ার আগে যাচাই করুন।'
              : 'Find a water point. Confirm before travelling.'}
          </h2>
          <p>
            {bn
              ? 'প্রকাশিত তালিকার পুরোনো অবস্থান থেকে খোঁজ শুরু করুন। কোনো উৎসকে বর্তমানে নিরাপদ বলা হচ্ছে না।'
              : 'Use public inventory locations to start a local check. No point in this snapshot has current drinking-water clearance.'}
          </p>
        </div>
        <button className="secondary" onClick={onCare}>
          {bn ? 'জরুরি করণীয়' : 'Emergency precautions'}
          <ArrowRight size={16} />
        </button>
      </div>
      <div className="gis-evidence-strip">
        <span>
          <b>{number(data.record_count, 0)}</b> historical points
        </span>
        <span>
          Assessed {data.assessment_dates.min.slice(0, 4)}–{data.assessment_dates.max.slice(0, 4)}
        </span>
        <span className="gis-unknown">Current quality & availability unknown</span>
      </div>
      <form className="gis-search-form" onSubmit={submit}>
        <label>
          Covered-area presets
          <select
            aria-label="Water search area preset"
            defaultValue={initial.label}
            onChange={(e) => choosePreset(e.target.value)}
          >
            {presets.map((p) => (
              <option key={p.label}>{p.label}</option>
            ))}
            <option value="Dacope" disabled>
              Dacope · no labelled inventory coverage
            </option>
          </select>
        </label>
        <label>
          {bn ? 'অক্ষাংশ' : 'Latitude'}
          <input
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
            type="text"
            inputMode="decimal"
            aria-label="Search latitude"
          />
        </label>
        <label>
          {bn ? 'দ্রাঘিমাংশ' : 'Longitude'}
          <input
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
            type="text"
            inputMode="decimal"
            aria-label="Search longitude"
          />
        </label>
        <label>
          {bn ? 'দূরত্ব' : 'Radius'}
          <select
            aria-label="Water search radius"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
          >
            {[2, 5, 10, 25, 50].map((value) => (
              <option key={value} value={value}>
                {value} km
              </option>
            ))}
          </select>
        </label>
        <label className="gis-query-label">
          {bn ? 'এলাকা বা উৎস খুঁজুন' : 'Filter by area or source'}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ukhia, WaterAid, tubewell…"
          />
        </label>
        <button className="primary" type="submit">
          <Search size={17} />
          {bn ? 'খুঁজুন' : 'Search points'}
        </button>
      </form>
      <div className="gis-search-utilities">
        <span>{locationNote}</span>
        <button className="quiet" onClick={locate} disabled={locating}>
          <LocateFixed size={16} />
          {locating ? 'Finding location…' : bn ? 'আমার অবস্থান ব্যবহার করুন' : 'Use my location'}
        </button>
      </div>
      {error && (
        <p className="gis-form-error" role="alert">
          {error}
        </p>
      )}
      <div className="gis-map-layout">
        <section className="gis-map-column" aria-label="Water-point candidate map">
          <GISMap
            points={mapPoints}
            center={search.center}
            selectedId={selected?.id}
            onSelect={(p) => setSelectedId(p.id)}
            extentKey={'water:' + extentKey}
            label="Historical public water-point candidates. Use the accompanying list to select a point by keyboard."
          />
          <div className="gis-map-caption">
            <span>
              <i className="gis-dot gis-dot-inventory" />
              Historical inventory point
            </span>
            <span>Blue means listed, not safe.</span>
          </div>
          <p className="gis-micro">
            The map and list show up to 250 closest matches. Distances are straight-line estimates,
            not walking or flood-safe routes. Distance calculations run in this browser; map tiles
            reveal the viewed area to OpenStreetMap.
          </p>
        </section>
        <aside className="gis-inspector" aria-label="Selected water-point evidence">
          {selected ? (
            <>
              <div className="gis-inspector-heading">
                <MapPin size={20} />
                <h3>{selected.sourceType}</h3>
              </div>
              <p>
                {[selected.locality, selected.subdistrict, selected.district]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <div className="gis-availability">
                <AlertTriangle size={18} />
                <strong>{bn ? 'যাওয়ার আগে নিশ্চিত করুন' : 'Confirmation required'}</strong>
              </div>
              <dl className="gis-details">
                <div>
                  <dt>Distance from search centre</dt>
                  <dd>{number(selected.distanceKm, 2)} km · straight line</dd>
                </div>
                <div>
                  <dt>Last inventory assessment</dt>
                  <dd>{selected.assessedAt || 'Not supplied'}</dd>
                </div>
                <div>
                  <dt>Water present at that old visit</dt>
                  <dd>{selected.reportedPresence || 'Not recorded'}</dd>
                </div>
                <div>
                  <dt>Current availability</dt>
                  <dd>Unknown</dd>
                </div>
                <div>
                  <dt>Drinking-water test clearance</dt>
                  <dd>Not supplied</dd>
                </div>
                <div>
                  <dt>Original provider</dt>
                  <dd>{selected.provider}</dd>
                </div>
                <div>
                  <dt>Inventory identifier</dt>
                  <dd>{selected.id}</dd>
                </div>
              </dl>
              <p className="gis-callout">
                {bn
                  ? 'পুরোনো তালিকা বা নলকূপের ধরন পানির নিরাপত্তার প্রমাণ নয়। স্থানীয় অপারেটর বা কর্তৃপক্ষের সঙ্গে বর্তমান অবস্থা ও পরীক্ষার ফল যাচাই করুন।'
                  : 'An old presence report or improved technology is not a safety test. Confirm availability, water-test evidence and access with the operator or local authority.'}
              </p>
              <SourceLink
                href={
                  'https://www.openstreetmap.org/?mlat=' +
                  selected.latitude +
                  '&mlon=' +
                  selected.longitude +
                  '#map=17/' +
                  selected.latitude +
                  '/' +
                  selected.longitude
                }
              >
                {bn ? 'অবস্থান খুলুন' : 'Open the location pin'}
              </SourceLink>
              <small>This opens coordinates only. It does not verify a usable route.</small>
            </>
          ) : (
            <>
              <h3>No inventory candidates in this search</h3>
              <p>
                This means no matching coverage in this snapshot, not that no water source exists.
                Choose another area or ask the local DPHE/operator for confirmed current supplies.
              </p>
            </>
          )}
        </aside>
      </div>
      <div className="gis-list-heading">
        <div>
          <h3>{bn ? 'অনুসন্ধানের ফল' : 'Matching inventory candidates'}</h3>
          <p>
            {number(matches.length, 0)} within {search.radiusKm} km · every point needs current
            confirmation
          </p>
        </div>
        <button className="secondary" onClick={exportShortlist} disabled={!matches.length}>
          <Download size={16} />
          {bn ? 'তালিকা সংরক্ষণ করুন' : 'Save field shortlist'}
        </button>
      </div>
      {matches.length > 0 ? (
        <>
          <div className="gis-result-list" aria-label="Water-point candidate list">
            {matches.slice(0, Math.min(visible, 250)).map((point) => (
              <button
                className={'gis-result-row ' + (selected?.id === point.id ? 'selected' : '')}
                key={point.id}
                aria-pressed={selected?.id === point.id}
                onClick={() => setSelectedId(point.id)}
              >
                <span>
                  <b>{point.sourceType}</b>
                  <small>
                    {[point.locality, point.subdistrict, point.district]
                      .filter(Boolean)
                      .join(' · ')}
                  </small>
                  <small>WPdx {point.id}</small>
                </span>
                <span>
                  <b>{number(point.distanceKm, 2)} km</b>
                  <small>Assessed {point.assessedAt}</small>
                </span>
                <span className="gis-row-status">
                  Unverified
                  <ArrowRight size={15} />
                </span>
              </button>
            ))}
          </div>
          {visible < Math.min(matches.length, 250) && (
            <button className="secondary gis-load-more" onClick={() => setVisible((v) => v + 20)}>
              Show 20 more candidates
            </button>
          )}
        </>
      ) : (
        <div className="gis-empty">
          <Search size={25} />
          <p>
            No matching inventory coverage. Expand the radius carefully or change the place filter;
            do not assume a distant point is practical during a disaster.
          </p>
        </div>
      )}
      <div className="gis-source-footer">
        <SourceLink href="https://www.waterpointdata.org/access-data/">
          WPdx+ · UNHCR, REACH Initiative, WaterAid · CC BY 4.0
        </SourceLink>
        <SourceLink href="https://dphe.gov.bd/pages/static-pages/6922dd01933eb65569e13226">
          DPHE official water services
        </SourceLink>
        <SourceLink href="https://ffwc.gov.bd/">Check official flood information</SourceLink>
      </div>
      <details className="gis-methods">
        <summary>Coverage, verification and data limitations</summary>
        <p>{data.coverage_warning}</p>
        <p>
          All assessment dates are 2014–2019. Downloading the inventory in October 2026 does not
          make those inspections current. Water presence, physical condition and chemical/microbial
          safety are different questions. Conflicting cleaned status fields are not used to declare
          any point open or safe. Organisational provider names are retained; personal contacts,
          notes and photos are not included.
        </p>
        <SourceLink href="/data/gis-source-audit.json">Read the source audit</SourceLink>
      </details>
    </div>
  );
}
