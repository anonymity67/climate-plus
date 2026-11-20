import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  NODE_COLOR,
  STATUS_COLOR,
  conditionRoute,
  conditionScenario,
  effectiveCondition,
  hazardPolygonId,
} from '../gis-network.mjs';
import '../continuity-map.css';

export function ContinuityMap({ gis, geo, hazard, condition, selectedId, onSelect }) {
  const host = useRef(null);
  const map = useRef(null);
  const layer = useRef(null);
  const fitted = useRef(false);
  const pick = useRef(onSelect);
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    pick.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!host.current) return;
    map.current = L.map(host.current, { scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })
      .on('tileerror', () => setTileError(true))
      .addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
      fitted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !layer.current || !geo) return;
    layer.current.clearLayers();
    const features = geo.features;
    const cond = effectiveCondition(hazard, condition);
    const hazardId = hazardPolygonId(gis, hazard, condition);
    const route = conditionRoute(gis, cond);
    const scenarioKey = conditionScenario(gis, cond);
    const bounds = [];
    const isSalt = hazard === 'salinity';

    features
      .filter((f) => f.properties.kind === 'catchment')
      .forEach((f) => {
        const on = selectedId === f.properties.id;
        const l = L.geoJSON(f, {
          style: {
            color: '#176b4c',
            weight: on ? 3 : 1,
            fillColor: '#176b4c',
            fillOpacity: on ? 0.3 : 0.12,
          },
        }).addTo(layer.current);
        l.bindTooltip(`${f.properties.name}: ${f.properties.demandLDay} L/day`);
        l.on('click', () => pick.current(f.properties.id));
        bounds.push(l.getBounds());
      });

    features
      .filter((f) => f.properties.kind === 'hazard' && f.properties.id === hazardId)
      .forEach((f) => {
        const c = isSalt ? '#2f6f8f' : '#a74635';
        L.geoJSON(f, {
          style: { color: c, weight: 1, dashArray: '4 3', fillColor: c, fillOpacity: 0.16 },
          interactive: false,
        }).addTo(layer.current);
      });

    const routes = features.filter((f) => f.properties.kind === 'route');
    const clearRoute = routes.find((f) => f.properties.scenario === 'baseline');
    if (clearRoute && cond !== 'clear') {
      L.geoJSON(clearRoute, {
        style: { color: '#52675f', weight: 3, opacity: 0.55, dashArray: '2 6' },
        interactive: false,
      }).addTo(layer.current);
    }
    const active = routes.find((f) => f.properties.scenario === scenarioKey);
    if (active) {
      const l = L.geoJSON(active, {
        style: { color: STATUS_COLOR[route?.status] || '#52675f', weight: 5, opacity: 0.9 },
        interactive: false,
      }).addTo(layer.current);
      bounds.push(l.getBounds());
    }

    features
      .filter((f) => f.properties.kind === 'node')
      .forEach((f) => {
        const [lon, lat] = f.geometry.coordinates;
        const on = selectedId === f.properties.id;
        const held = isSalt && f.properties.exposedSalinity === 1;
        const m = L.circleMarker([lat, lon], {
          radius: on ? 11 : 7,
          color: held ? '#a74635' : on ? '#183b35' : '#fff',
          weight: on || held ? 3 : 2,
          fillColor: NODE_COLOR[f.properties.type] || '#183b35',
          fillOpacity: 1,
        }).addTo(layer.current);
        m.bindTooltip(f.properties.name + (held ? ' (held: salinity)' : ''));
        m.on('click', () => pick.current(f.properties.id));
        bounds.push(L.latLngBounds([[lat, lon]]));
      });

    if (!fitted.current && bounds.length) {
      const all = bounds.reduce((a, b) => a.extend(b), L.latLngBounds(bounds[0]));
      map.current.fitBounds(all, { padding: [24, 24] });
      fitted.current = true;
    }
  }, [gis, geo, hazard, condition, selectedId]);

  return (
    <div className="cm-mapwrap">
      <div
        className="cm-host"
        ref={host}
        aria-label="Map of the fictional Dacope service network"
      />
      {tileError && (
        <p className="map-warning">
          Base map tiles did not load. The network layer is still drawn from local data.
        </p>
      )}
    </div>
  );
}
