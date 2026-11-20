import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
export function AtlasMap({
  points = [],
  ways = [],
  center,
  selectedId,
  onSelect,
  extentKey,
  component,
  zoom = 13,
  tiles = true,
  bangla = false,
  label = 'Map. The adjacent list provides the same selectable points.',
}) {
  const host = useRef(null),
    map = useRef(null),
    pointLayer = useRef(null),
    streamLayer = useRef(null),
    select = useRef(onSelect),
    previous = useRef(null);
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    if (!host.current) return;
    const instance = L.map(host.current, { preferCanvas: true, scrollWheelZoom: false }).setView(
      [23.89, 90.39],
      11,
    );
    map.current = instance;
    if (tiles)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      })
        .on('tileerror', () => setTileError(true))
        .addTo(instance);
    streamLayer.current = L.featureGroup().addTo(instance);
    pointLayer.current = L.featureGroup().addTo(instance);
    const resize = new ResizeObserver(() => instance.invalidateSize());
    resize.observe(host.current);
    return () => {
      resize.disconnect();
      instance.remove();
      map.current = null;
      previous.current = null;
    };
  }, [tiles]);
  useEffect(() => {
    if (!map.current) return;
    streamLayer.current.clearLayers();
    ways.forEach((w) =>
      L.polyline(
        w.geometry.coordinates.map(([x, y]) => [y, x]),
        {
          color: component && w.component === component ? '#176b68' : '#78aeb5',
          weight: component && w.component === component ? 4 : 1.5,
          opacity: component && w.component === component ? 0.95 : 0.55,
        },
      )
        .bindTooltip(document.createTextNode(w.name + ' · mapped ' + w.kind + '; flow unverified'))
        .addTo(streamLayer.current),
    );
  }, [ways, component]);
  useEffect(() => {
    if (!map.current) return;
    pointLayer.current.clearLayers();
    points.forEach((p) => {
      const title = document.createElement('span');
      title.textContent =
        (p.name || p.id) +
        (p.kind === 'private-observation'
          ? ' · ' + p.date + ' · private unverified entry'
          : p.kind === 'publisher-context'
            ? ' · date and units unverified'
            : p.assessedAt
              ? ' · inventory ' + p.assessedAt
              : p.latestDate
                ? ' · sampled ' + p.latestDate
                : ' · velocity survey only');
      L.circleMarker([p.latitude, p.longitude], {
        radius: p.id === selectedId ? 10 : 5.5,
        color: p.id === selectedId ? '#122f2b' : '#fff',
        weight: p.id === selectedId ? 3 : 1.5,
        fillColor:
          p.kind === 'private-observation'
            ? '#5367a1'
            : p.kind === 'velocity'
              ? '#7f6895'
              : p.kind === 'publisher-context'
                ? '#806090'
                : p.latest?.screening?.failed
                  ? '#ad5a32'
                  : p.latest
                    ? '#458078'
                    : '#427992',
        fillOpacity: 0.95,
      })
        .bindTooltip(title, { direction: 'auto' })
        .on('click', () => select.current?.(p))
        .addTo(pointLayer.current);
    });
    const resolvedExtent =
      String(extentKey) + ':' + (center ? center.latitude + ',' + center.longitude : 'points');
    if (previous.current !== resolvedExtent) {
      if (center && Number.isFinite(center.latitude) && Number.isFinite(center.longitude))
        map.current.setView([center.latitude, center.longitude], zoom, { animate: false });
      else if (points.length)
        map.current.fitBounds(L.latLngBounds(points.map((p) => [p.latitude, p.longitude])), {
          padding: [35, 35],
          maxZoom: 15,
          animate: false,
        });
      previous.current = resolvedExtent;
    }
  }, [points, selectedId, extentKey, center, zoom]);
  return (
    <div className="water-map-frame">
      <div ref={host} className="water-atlas" role="group" aria-label={label} />
      <p className="water-map-note">
        {!tiles
          ? bangla
            ? 'শুধু নথিভুক্ত বিন্দুগুলো দেখানো হয়েছে।'
            : 'Recorded points only.'
          : tileError
            ? 'Base map unavailable. Recorded points are still shown.'
            : '© OpenStreetMap contributors'}
        {ways.length > 0 ? ' · mapped channels; flow unverified' : ''}
      </p>
    </div>
  );
}
