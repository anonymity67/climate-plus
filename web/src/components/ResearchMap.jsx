import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { markerColor } from '../map-style.mjs';

export function ResearchMap({ rows, layer, selected, onSelect }) {
  const host = useRef(null);
  const map = useRef(null);
  const markers = useRef(null);
  const previousExtent = useRef(null);
  const select = useRef(onSelect);
  const [tileError, setTileError] = useState(false);

  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!host.current) return;
    map.current = L.map(host.current, { scrollWheelZoom: false }).setView([23.8, 90.4], 10);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })
      .on('tileerror', () => setTileError(true))
      .addTo(map.current);
    markers.current = L.layerGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
      previousExtent.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !markers.current) return;
    markers.current.clearLayers();
    const located = rows.filter(
      (r) =>
        Number.isFinite(r.latitude) &&
        Math.abs(r.latitude) <= 90 &&
        Number.isFinite(r.longitude) &&
        Math.abs(r.longitude) <= 180,
    );
    located.forEach((r) => {
      const color = markerColor(r, layer);
      const marker = L.circleMarker([r.latitude, r.longitude], {
        radius: selected?.id === r.id ? 10 : 6,
        color,
        weight: 2,
        fillColor: color,
        fillOpacity: 0.8,
      }).addTo(markers.current);
      const label = document.createElement('div');
      label.textContent = (r.location || r.id) + ' · ' + r.date;
      marker.bindTooltip(label);
      marker.on('click', () => select.current(r));
    });
    // Selecting a point must preserve the analyst's zoom and pan. Only a changed
    // layer or coordinate set changes the extent, including a new imported sample.
    const extent = JSON.stringify([layer, located.map((r) => [r.latitude, r.longitude])]);
    if (located.length && previousExtent.current !== extent) {
      map.current.fitBounds(L.latLngBounds(located.map((r) => [r.latitude, r.longitude])), {
        padding: [28, 28],
        maxZoom: 13,
      });
      previousExtent.current = extent;
    }
  }, [rows, layer, selected?.id]);

  return (
    <div className="research-map-wrap">
      <div
        ref={host}
        className="research-map"
        role="region"
        aria-label="Interactive map of source-labelled measurement coordinates. Use the station selector for keyboard access."
      />
      {tileError && (
        <div className="map-warning">
          Basemap unavailable. Coordinate markers remain available; use the station table.
        </div>
      )}
      <div className="map-key">
        {layer === 'survey' ? (
          <span>
            <i style={{ background: '#357e8d' }} />
            Velocity survey location · no pollution classification
          </span>
        ) : (
          <>
            <span>
              <i style={{ background: '#a74635' }} />
              Two or more tested objectives exceeded
            </span>
            <span>
              <i style={{ background: '#a87920' }} />
              One exceeded
            </span>
            <span>
              <i style={{ background: '#3d7a66' }} />
              None of the tested objectives exceeded
            </span>
            <span>
              <i style={{ background: '#77817c' }} />
              No valid tested parameter
            </span>
          </>
        )}
      </div>
    </div>
  );
}
