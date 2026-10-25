import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
const latlng = (p) => [p.latitude, p.longitude];
const textNode = (text) => {
  const el = document.createElement('div');
  el.textContent = text;
  return el;
};
const ROLE_COLOR = {
  supplier: '#183b35',
  reserve: '#176b4c',
  pump: '#387c89',
  pond: '#507ea1',
  school: '#a67b32',
  crew: '#706386',
};
export function MVPMap({
  region,
  graph,
  scenario,
  result,
  selectedRoute,
  selectedId,
  onSelect,
  selectedEdge,
  onEdge,
  playback,
  deviceFix,
  pollution = [],
  pickPoint,
  onPickPoint,
  fitKey,
}) {
  const host = useRef(null),
    map = useRef(null),
    staticLayer = useRef(null),
    movingLayer = useRef(null),
    vehicleMarker = useRef(null),
    gpsMarker = useRef(null),
    gpsCircle = useRef(null),
    previousRegion = useRef(null),
    handlers = useRef({});
  const [tilesFailed, setTilesFailed] = useState(false);
  handlers.current = { onSelect, onEdge, onPickPoint, pickPoint };
  useEffect(() => {
    const m = L.map(host.current, {
      preferCanvas: true,
      scrollWheelZoom: false,
      zoomControl: false,
    }).setView([22.55, 89.51], 12);
    map.current = m;
    L.control.zoom({ position: 'topleft' }).addTo(m);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })
      .on('tileerror', () => setTilesFailed(true))
      .addTo(m);
    staticLayer.current = L.featureGroup().addTo(m);
    movingLayer.current = L.layerGroup().addTo(m);
    vehicleMarker.current = null;
    gpsMarker.current = null;
    gpsCircle.current = null;
    m.on('click', (e) => {
      if (handlers.current.pickPoint)
        handlers.current.onPickPoint?.({ latitude: e.latlng.lat, longitude: e.latlng.lng });
    });
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(host.current);
    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
      previousRegion.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current || !scenario) return;
    const layer = staticLayer.current;
    layer.clearLayers();
    // Local road geometry remains visible when network tiles are unavailable.
    graph.edges.forEach((e) =>
      L.polyline(
        e.coordinates.map((p) => [p[1], p[0]]),
        { color: '#657970', weight: 1, opacity: tilesFailed ? 0.44 : 0.16, interactive: false },
      ).addTo(layer),
    );
    if (result.activeHazard)
      L.geoJSON(result.activeHazard, {
        style: {
          color: result.heldAssetIds.length ? '#387c89' : '#a8573c',
          weight: 1,
          dashArray: '5 4',
          fillOpacity: 0.13,
        },
      })
        .bindTooltip(textNode('Representational calamity area — not a live warning'))
        .addTo(layer);
    const excluded = new Set(result.excludedEdgeIds || []);
    graph.edges
      .filter((e) => excluded.has(e.id))
      .forEach((e) =>
        L.polyline(
          e.coordinates.map((p) => [p[1], p[0]]),
          { color: '#ab4f37', weight: 5, dashArray: '5 4' },
        )
          .bindTooltip(textNode(`Scenario blocked road · ${e.id}`))
          .addTo(layer),
      );
    [...(result.routes || [])].reverse().forEach((route) => {
      const chosen = route.id === selectedRoute?.id;
      L.geoJSON(route.geometry, {
        style: {
          color: chosen ? '#176b4c' : '#7e79a7',
          weight: chosen ? 5 : 4,
          opacity: 0.9,
          dashArray: chosen ? undefined : '7 6',
        },
        interactive: false,
      }).addTo(layer);
      if (chosen)
        route.edges.forEach((e) =>
          L.polyline(
            e.coordinates.map((p) => [p[1], p[0]]),
            {
              color: e.id === selectedEdge ? '#ad5a36' : '#176b4c',
              weight: e.id === selectedEdge ? 9 : 13,
              opacity: e.id === selectedEdge ? 1 : 0,
            },
          )
            .on('click', (event) => {
              L.DomEvent.stopPropagation(event);
              if (handlers.current.pickPoint)
                return handlers.current.onPickPoint?.({
                  latitude: event.latlng.lat,
                  longitude: event.latlng.lng,
                });
              handlers.current.onEdge?.(e.id);
            })
            .bindTooltip(textNode(`${e.name} · click to inspect this road segment`))
            .addTo(layer),
        );
    });
    pollution.forEach((f) => {
      const p = f.properties,
        xy = f.geometry.coordinates,
        color =
          p.sourceKind === 'publisher-context'
            ? '#85749b'
            : p.screening?.failed
              ? '#b66b36'
              : '#557782';
      const mark = L.circleMarker([xy[1], xy[0]], {
        radius: p.id === selectedId ? 9 : 5,
        color: p.id === selectedId ? '#183b35' : color,
        weight: p.id === selectedId ? 3 : 1,
        fillColor: color,
        fillOpacity: 0.8,
      }).bindTooltip(textNode(`${p.name} · ${p.sourceKind} · ${p.date || 'sample date unknown'}`));
      mark.on('click', (event) => {
        L.DomEvent.stopPropagation(event);
        if (handlers.current.pickPoint)
          return handlers.current.onPickPoint?.({ latitude: xy[1], longitude: xy[0] });
        handlers.current.onSelect?.({ kind: 'pollution', id: p.id });
      });
      mark.addTo(layer);
    });
    scenario.assets.forEach((a) => {
      const held = result.heldAssetIds.includes(a.id),
        selected = a.id === selectedId,
        color = held ? '#a85b39' : ROLE_COLOR[a.role] || '#52675f';
      const mark = L.circleMarker(latlng(a), {
        radius: selected ? 11 : 8,
        color: selected ? '#183b35' : '#fff',
        weight: selected ? 3 : 2,
        fillColor: color,
        fillOpacity: 1,
      }).bindTooltip(
        textNode(
          `${a.role}: ${a.name} · scenario asset${held ? ' · held in salinity scenario' : ''}`,
        ),
      );
      mark.on('click', (event) => {
        L.DomEvent.stopPropagation(event);
        if (handlers.current.pickPoint)
          return handlers.current.onPickPoint?.({ latitude: a.latitude, longitude: a.longitude });
        handlers.current.onSelect?.({ kind: 'asset', id: a.id });
      });
      mark.addTo(layer);
    });
    const extent = `${region.id}-${fitKey || 0}-${selectedRoute?.id || 'none'}-${pollution.length}`;
    if (previousRegion.current !== extent) {
      const b = L.latLngBounds(scenario.assets.map(latlng));
      if (selectedRoute) b.extend(L.geoJSON(selectedRoute.geometry).getBounds());
      pollution.forEach((f) => b.extend([f.geometry.coordinates[1], f.geometry.coordinates[0]]));
      map.current.fitBounds(b, { padding: [40, 40], maxZoom: 16 });
      previousRegion.current = extent;
    }
  }, [
    region,
    graph,
    scenario,
    result,
    selectedRoute,
    selectedId,
    selectedEdge,
    pollution,
    fitKey,
    tilesFailed,
  ]);
  useEffect(() => {
    if (!movingLayer.current) return;
    const layer = movingLayer.current;
    if (playback) {
      if (vehicleMarker.current) vehicleMarker.current.setLatLng(latlng(playback));
      else
        vehicleMarker.current = L.circleMarker(latlng(playback), {
          radius: 9,
          color: '#fff',
          weight: 3,
          fillColor: '#b06b28',
          fillOpacity: 1,
        })
          .bindTooltip(textNode('Delivery playback — not live GPS'), {
            permanent: true,
            direction: 'auto',
            offset: [8, 0],
            className: 'mvp-vehicle-label',
          })
          .addTo(layer);
    } else if (vehicleMarker.current) {
      layer.removeLayer(vehicleMarker.current);
      vehicleMarker.current = null;
    }
    if (deviceFix) {
      if (gpsMarker.current) {
        gpsMarker.current.setLatLng(latlng(deviceFix));
        gpsMarker.current.setTooltipContent(
          textNode(`Device GPS · ±${Math.round(deviceFix.accuracyM)}m · ${deviceFix.capturedAt}`),
        );
        gpsCircle.current.setLatLng(latlng(deviceFix)).setRadius(deviceFix.accuracyM);
      } else {
        gpsCircle.current = L.circle(latlng(deviceFix), {
          radius: deviceFix.accuracyM,
          color: '#246d9e',
          weight: 1,
          fillOpacity: 0.05,
        }).addTo(layer);
        gpsMarker.current = L.circleMarker(latlng(deviceFix), {
          radius: 7,
          color: '#fff',
          weight: 2,
          fillColor: '#246d9e',
          fillOpacity: 1,
        })
          .bindTooltip(
            textNode(`Device GPS · ±${Math.round(deviceFix.accuracyM)}m · ${deviceFix.capturedAt}`),
          )
          .addTo(layer);
      }
    } else if (gpsMarker.current) {
      layer.removeLayer(gpsMarker.current);
      layer.removeLayer(gpsCircle.current);
      gpsMarker.current = null;
      gpsCircle.current = null;
    }
  }, [playback, deviceFix]);
  return (
    <div className={`mvp-map-frame ${pickPoint ? 'is-picking' : ''}`}>
      <div
        ref={host}
        className="mvp-map"
        role="region"
        aria-label={`${region.name} interactive calamity-response map; the adjacent point list supports keyboard selection`}
      />
      <div className="mvp-map-caption">
        {pickPoint
          ? 'Click the map to set observation coordinates'
          : tilesFailed
            ? 'Local road vectors · basemap tiles unavailable'
            : 'OSM roads · scenario assets & hazards'}
      </div>
    </div>
  );
}
