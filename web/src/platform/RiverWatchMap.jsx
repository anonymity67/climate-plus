import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useMapData } from '../mvp/use-map-data.mjs';

const bounds = [
  [20.57, 87.95],
  [26.65, 92.78],
];
const places = [
  ['Rangpur', 'রংপুর', 25.76, 89.25],
  ['Rajshahi', 'রাজশাহী', 24.37, 88.59],
  ['Sylhet', 'সিলেট', 24.9, 91.87],
  ['Dhaka', 'ঢাকা', 23.8, 90.41],
  ['Khulna', 'খুলনা', 22.82, 89.53],
  ['Barisal', 'বরিশাল', 22.7, 90.35],
  ['Chattogram', 'চট্টগ্রাম', 22.35, 91.81],
];
const mapStyles = {
  divisions: { color: '#8faba0', weight: 1.4, fillColor: '#eaf0e4', fillOpacity: 0.92 },
  districts: { color: '#a8bbb1', weight: 0.7, fill: false, dashArray: '3 3' },
  rivers_display: { color: '#7daebe', weight: 0.85, opacity: 0.76 },
  osm_rivers: { color: '#689faf', weight: 1.35, opacity: 0.88 },
  water_bodies: { color: '#8ab3be', weight: 0.6, fillColor: '#aacdd6', fillOpacity: 0.8 },
};
const styles = {
  link: { color: '#814a2f', weight: 2.5, dashArray: '3 6' },
  trace: { color: '#246c87', weight: 4.5, dashArray: '9 6', opacity: 0.95 },
  zone: { color: '#246c87', fillColor: '#5799ad', weight: 1, fillOpacity: 0.18 },
};
const latLng = ([x, y]) => [y, x];

function tooltip(text) {
  const container = document.createElement('span');
  container.textContent = text;
  return container;
}

function drawSites(map, group, sites, selectedId, onPick) {
  const scale = map.getZoom();
  const cellSize = scale < 8 ? 60 : 43;
  const clusters = new Map();
  const chosen = sites.find((site) => site.id === selectedId);
  for (const site of sites) {
    if (site === chosen) continue;
    const point = map.project(latLng(site.point), scale);
    const cell = [Math.floor(point.x / cellSize), Math.floor(point.y / cellSize)].join(',');
    if (!clusters.has(cell)) clusters.set(cell, []);
    clusters.get(cell).push(site);
  }
  group.clearLayers();
  function dot(site, selected) {
    const fillColor = site.reference ? '#725794' : site.priority ? '#9b542d' : '#22645b';
    const point = L.circleMarker(latLng(site.point), {
      radius: selected ? 9 : site.priority ? 5.5 : 4,
      color: selected ? '#102f2d' : '#fff',
      fillColor,
      fillOpacity: 0.96,
      weight: selected ? 3 : 1.25,
    });
    point
      .bindTooltip(tooltip(site.name))
      .on('click', () => onPick(site))
      .addTo(group);
  }
  for (const cluster of clusters.values()) {
    if (cluster.length === 1 || scale >= 15) {
      cluster.forEach((site) => dot(site, false));
      continue;
    }
    const center = L.latLngBounds(cluster.map((site) => latLng(site.point))).getCenter();
    const icon = L.divIcon({
      className: 'rw-cluster',
      html: String(cluster.length),
      iconSize: [31, 31],
      iconAnchor: [15, 15],
    });
    L.marker(center, { icon, keyboard: false })
      .on('click', () => map.setView(center, Math.min(scale + 2, 15)))
      .addTo(group);
  }
  if (chosen) dot(chosen, true);
}

export function RiverWatchMap({
  base,
  sites,
  selection,
  detail,
  samples,
  district,
  run,
  onPick,
  onSample,
  showZone,
  bn,
}) {
  const [detailed, setDetailed] = useState(false);
  const waterways = useMapData('/data/riverwatch/waterways-detail.json', detailed);
  const host = useRef(null);
  const current = useRef(null);
  const filtered = useRef({ sites, selectedId: selection?.id });
  const events = useRef({ onPick, onSample });
  events.current = { onPick, onSample };
  filtered.current = { sites, selectedId: selection?.id };
  useEffect(() => {
    const map = L.map(host.current, {
      scrollWheelZoom: false,
      minZoom: 5,
      maxZoom: 16,
      zoomSnap: 0.5,
      zoomControl: false,
      preferCanvas: true,
      attributionControl: false,
    }).fitBounds(bounds, { padding: [16, 14] });
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
    const layers = {
      base: L.layerGroup().addTo(map),
      selected: L.layerGroup().addTo(map),
      sites: L.layerGroup().addTo(map),
      samples: L.layerGroup().addTo(map),
      text: L.layerGroup().addTo(map),
    };
    const redraw = () =>
      drawSites(
        map,
        layers.sites,
        filtered.current.sites,
        filtered.current.selectedId,
        events.current.onPick,
      );
    const resize = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    resize.observe(host.current);
    map.on('zoomend', () => {
      redraw();
      setDetailed(map.getZoom() >= 8);
    });
    current.current = { map, layers, redraw };
    return () => {
      resize.disconnect();
      map.remove();
      current.current = null;
    };
  }, []);

  useEffect(() => {
    const { layers } = current.current;
    layers.base.clearLayers();
    if (base) {
      const features = [...base.features, ...(waterways.data?.features || [])];
      for (const [layer, style] of Object.entries(mapStyles)) {
        L.geoJSON(
          features.filter((feature) => feature.properties.layer === layer),
          { style, interactive: false },
        ).addTo(layers.base);
      }
    }
    layers.text.clearLayers();
    for (const [name, bangla, y, x] of places) {
      const label = L.divIcon({
        className: 'rw-place',
        html: tooltip(bn ? bangla : name),
        iconSize: [80, 18],
        iconAnchor: [40, 9],
      });
      L.marker([y, x], { icon: label, interactive: false, keyboard: false }).addTo(layers.text);
    }
  }, [base, waterways.data, bn]);

  useEffect(() => current.current.redraw(), [sites, selection]);

  useEffect(() => {
    const { map } = current.current;
    const selectedDistrict =
      district &&
      base?.features.find(
        (f) => f.properties.layer === 'districts' && f.properties.name === district,
      );
    const extent = selectedDistrict
      ? L.geoJSON(selectedDistrict).getBounds()
      : (district || run === 'dhaka_pilot') && sites.length
        ? L.latLngBounds(sites.map((s) => latLng(s.point)))
        : bounds;
    map.fitBounds(extent, { padding: [22, 24], maxZoom: 11, animate: false });
    // Site filtering inside the same area keeps the visitor's current view.
  }, [base, district, run]);

  useEffect(() => {
    const { map } = current.current;
    if (selection)
      map.setView(latLng(selection.point), Math.max(map.getZoom(), 11), { animate: false });
  }, [selection]);

  useEffect(() => {
    const { layers } = current.current;
    layers.selected.clearLayers();
    if (!detail) return;
    if (showZone && detail.zone)
      L.geoJSON(detail.zone, { style: styles.zone, interactive: false }).addTo(layers.selected);
    for (const segment of detail.trace)
      L.geoJSON(segment.geometry, { style: styles.trace, interactive: false }).addTo(
        layers.selected,
      );
    if (detail.link)
      L.geoJSON(detail.link, { style: styles.link, interactive: false }).addTo(layers.selected);
    for (const sample of detail.sampling) {
      const label = sample.side === 'up' ? (bn ? 'উজান' : 'Upstream') : bn ? 'ভাটি' : 'Downstream';
      L.circleMarker(latLng(sample.point), {
        radius: 6,
        color: '#674979',
        fillColor: '#fff',
        fillOpacity: 1,
        interactive: false,
      })
        .bindTooltip(tooltip(label), {
          permanent: true,
          direction: 'right',
          className: 'rw-sample-label',
        })
        .addTo(layers.selected);
    }
  }, [detail, showZone, bn]);

  useEffect(() => {
    if (!detail?.trace.length || !selection) return;
    const extent = L.latLngBounds([latLng(selection.point)]);
    for (const item of detail.trace) extent.extend(L.geoJSON(item.geometry).getBounds());
    current.current.map.fitBounds(extent, { padding: [44, 48], maxZoom: 13, animate: false });
  }, [detail, selection]);

  useEffect(() => {
    const { layers } = current.current;
    layers.samples.clearLayers();
    for (const sample of samples) {
      L.circleMarker([sample.latitude, sample.longitude], {
        radius: 5,
        weight: 2.5,
        color: '#41548c',
        fillColor: '#fff',
        fillOpacity: 1,
      })
        .bindTooltip(tooltip(sample.name))
        .on('click', () => events.current.onSample(sample.id))
        .addTo(layers.samples);
    }
  }, [samples]);

  return (
    <div
      className="rw-map"
      ref={host}
      role="region"
      aria-label={bn ? 'বাংলাদেশের নদীর মানচিত্র' : 'Interactive Bangladesh river map'}
    />
  );
}
