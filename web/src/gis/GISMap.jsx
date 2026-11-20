import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { validCoordinates } from '../gis-engine.mjs';

export function GISMap({
  points = [],
  features = [],
  center,
  selectedId,
  onSelect,
  extentKey,
  ring = null,
  label,
  pointColor = '#357e8d',
  pointRadius = 6,
}) {
  const host = useRef(null),
    map = useRef(null),
    layer = useRef(null),
    select = useRef(onSelect),
    previousExtent = useRef(null);
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    if (!host.current) return;
    map.current = L.map(host.current, { preferCanvas: true, scrollWheelZoom: false }).setView(
      [23.7, 90.4],
      7,
    );
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })
      .on('tileerror', () => setTileError(true))
      .addTo(map.current);
    layer.current = L.featureGroup().addTo(map.current);
    return () => {
      map.current?.remove();
      map.current = null;
      previousExtent.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    const tooltip = (text) => {
      const node = document.createElement('div');
      node.textContent = text;
      return node;
    };
    points.filter(validCoordinates).forEach((point) => {
      const color = point.color || pointColor;
      const marker = L.circleMarker([point.latitude, point.longitude], {
        radius: point.id === selectedId ? 10 : point.radius || pointRadius,
        color: point.id === selectedId ? '#183b35' : color,
        weight: point.id === selectedId ? 3 : 1.5,
        fillColor: color,
        fillOpacity: point.opacity ?? 0.8,
      }).addTo(layer.current);
      marker.bindTooltip(tooltip(point.name || point.id));
      marker.on('click', () => select.current?.(point));
    });
    features.forEach((feature) => {
      const properties = feature.properties || {};
      const group = L.geoJSON(feature, {
        style: () =>
          properties.kind === 'route'
            ? {
                color: '#357e8d',
                weight: 5,
                opacity: 0.9,
                dashArray: properties.scenario === 'storm_severe' ? '9 6' : undefined,
              }
            : properties.kind === 'hazard'
              ? {
                  color: properties.scenario === 'salinity' ? '#996013' : '#9c4035',
                  weight: 2,
                  dashArray: '5 5',
                  fillOpacity: 0.09,
                }
              : { color: '#52675f', weight: 1.5, fillOpacity: 0.06 },
        pointToLayer: (_, latlng) =>
          L.circleMarker(latlng, {
            radius: properties.id === selectedId ? 10 : 7,
            color: '#183b35',
            weight: 2,
            fillColor: '#f3f5ef',
            fillOpacity: 1,
          }),
        onEachFeature: (_, item) => {
          item.bindTooltip(tooltip((properties.name || properties.id) + ' · scenario only'));
          item.on('click', () =>
            select.current?.({
              ...properties,
              latitude:
                feature.geometry?.type === 'Point' ? feature.geometry.coordinates[1] : undefined,
              longitude:
                feature.geometry?.type === 'Point' ? feature.geometry.coordinates[0] : undefined,
            }),
          );
        },
      });
      group.addTo(layer.current);
    });
    if (validCoordinates(center)) {
      L.circleMarker([center.latitude, center.longitude], {
        radius: 5,
        color: '#183b35',
        weight: 2,
        fillColor: '#fff',
        fillOpacity: 1,
      })
        .bindTooltip(tooltip('Search / investigation centre'))
        .addTo(layer.current);
    }
    if (ring && validCoordinates(ring))
      L.circle([ring.latitude, ring.longitude], {
        radius: ring.radiusM,
        color: '#996013',
        weight: 2,
        dashArray: '5 5',
        fillOpacity: 0.025,
      })
        .bindTooltip(tooltip('Investigation distance only — not a contamination boundary'))
        .addTo(layer.current);
    if (previousExtent.current !== extentKey) {
      const bounds = layer.current.getBounds();
      if (bounds.isValid()) map.current.fitBounds(bounds, { padding: [26, 26], maxZoom: 14 });
      else if (validCoordinates(center))
        map.current.setView([center.latitude, center.longitude], 12);
      previousExtent.current = extentKey;
    }
  }, [points, features, center, selectedId, extentKey, ring, pointColor, pointRadius]);

  return (
    <div className="gis-map-frame">
      <div
        ref={host}
        className="gis-map"
        role="region"
        aria-label={
          label || 'Interactive GIS map. The accompanying list provides keyboard selection.'
        }
      />
      {tileError && (
        <p className="gis-map-notice" role="status">
          Basemap unavailable. Dataset coordinates and the selectable list remain available.
        </p>
      )}
    </div>
  );
}
