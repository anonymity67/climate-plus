import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { describeFix } from './device-gps.mjs';

const latlng = (p) => [p.latitude, p.longitude];
const tooltip = (value) => {
  const node = document.createElement('div');
  node.textContent = value;
  return node;
};
export function OperationMap({ trip, route, fixes = [], selectedEdge, onSelectEdge }) {
  const host = useRef(null),
    map = useRef(null),
    layer = useRef(null),
    extent = useRef(null),
    select = useRef(onSelectEdge);
  const [tileError, setTileError] = useState(false);
  select.current = onSelectEdge;
  useEffect(() => {
    map.current = L.map(host.current, { scrollWheelZoom: false, preferCanvas: true }).setView(
      [22.57, 89.51],
      12,
    );
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })
      .on('tileerror', () => setTileError(true))
      .addTo(map.current);
    layer.current = L.featureGroup().addTo(map.current);
    const observer = new ResizeObserver(() => map.current?.invalidateSize());
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      map.current?.remove();
      map.current = null;
      extent.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    layer.current.clearLayers();
    const routes = route?.routes || [];
    [...routes].reverse().forEach((r) => {
      const chosen = r.id === route.selectedRouteId;
      L.geoJSON(r.geometry, {
        style: {
          color: chosen ? '#176b4c' : '#687ab1',
          weight: chosen ? 6 : 4,
          opacity: 0.85,
          dashArray: chosen ? undefined : '8 7',
        },
      })
        .bindTooltip(
          tooltip(
            `${chosen ? 'Selected route' : 'Alternative'} · ${(r.distanceM / 1000).toFixed(2)} km · assumed-speed estimate`,
          ),
        )
        .addTo(layer.current);
      if (chosen)
        r.edges.forEach((e) =>
          L.polyline(
            e.coordinates.map((p) => [p[1], p[0]]),
            {
              color: e.id === selectedEdge ? '#bd4a29' : '#176b4c',
              weight: e.id === selectedEdge ? 9 : 14,
              opacity: e.id === selectedEdge ? 1 : 0,
            },
          )
            .on('click', () => select.current?.(e.id))
            .bindTooltip(tooltip(`${e.name} · ${e.id} · select to report a blockage`))
            .addTo(layer.current),
        );
    });
    [trip.origin, trip.destination].forEach((p, i) =>
      L.circleMarker(latlng(p), {
        radius: 9,
        color: '#524e42',
        weight: 2,
        fillColor: '#fff',
        fillOpacity: 1,
      })
        .bindTooltip(
          tooltip(`${i ? 'Destination' : 'Supplier'}: ${p.label} · configured ${p.provenance}`),
        )
        .addTo(layer.current),
    );
    fixes.forEach((f) => {
      const status = describeFix(f),
        color = f.source === 'replay' ? '#9c642c' : status.live ? '#246b9f' : '#777';
      if (f.source === 'device' && Number.isFinite(f.accuracyM))
        L.circle(latlng(f), { radius: f.accuracyM, color, weight: 1, fillOpacity: 0.06 }).addTo(
          layer.current,
        );
      L.circleMarker(latlng(f), {
        radius: 7,
        color: '#fff',
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      })
        .bindTooltip(
          tooltip(
            `${f.role}: ${status.label} · ${f.capturedAt}${f.accuracyM === null ? '' : ` · ±${Math.round(f.accuracyM)} m`}`,
          ),
        )
        .addTo(layer.current);
    });
    const key = trip.id;
    if (extent.current !== key) {
      const bounds = L.latLngBounds([latlng(trip.origin), latlng(trip.destination)]);
      if (routes[0]) bounds.extend(L.geoJSON(routes[0].geometry).getBounds());
      map.current.fitBounds(bounds, { padding: [35, 35], maxZoom: 15 });
      extent.current = key;
    }
  }, [trip, route, fixes, selectedEdge]);
  return (
    <div className="op-map-wrap">
      <div
        ref={host}
        className="op-map"
        aria-label="Road routing map. Configured endpoints are hollow markers; device GPS is blue; replay is amber."
      />
      <div className="op-map-key">
        <span>━ Selected road route</span>
        <span>┄ Alternative</span>
        <span>○ Configured endpoint</span>
        <span>● Device / replay labelled on hover</span>
      </div>
      {tileError && (
        <p role="status">
          Basemap tiles could not load. Route geometry and coordinate records remain available.
        </p>
      )}
      <button
        className="quiet"
        onClick={() => {
          const b = layer.current?.getBounds();
          if (b?.isValid()) map.current.fitBounds(b, { padding: [30, 30], maxZoom: 16 });
        }}
      >
        Fit all positions
      </button>
    </div>
  );
}
