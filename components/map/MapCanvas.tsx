import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LngLatTuple } from '../../types';

interface PolygonFeature {
  id: string | number;
  coordinates: LngLatTuple[][];
  properties?: Record<string, unknown>;
  color?: string;
}

export interface SliceFeature {
  id: string | number;
  coordinates: LngLatTuple[];
  color: string;
  label?: string;
}

interface MapCanvasProps {
  route?: LngLatTuple[];
  routes?: LngLatTuple[][];
  points?: LngLatTuple[];
  polygons?: PolygonFeature[];
  slices?: SliceFeature[];
  /** Limita el mapa a esta franja [[oeste, sur], [este, norte]] (por ejemplo, una zona UTM). */
  maxBounds?: [LngLatTuple, LngLatTuple];
  viewCenter?: LngLatTuple;
  viewZoom?: number;
  /** Unidad resaltada con un contorno oscuro. */
  selectedPolygonId?: string | number;
  /** A partir de este zoom se oculta el eje de la ruta y las unidades se dibujan con su ancho real. */
  detailZoom?: number;
  onMapClick?: (point: LngLatTuple) => void;
  onPolygonClick?: (properties: Record<string, any>, point: LngLatTuple) => void;
  /** Panel flotante anclado a una coordenada del mapa (se mueve con el mapa). */
  popup?: { coordinate: LngLatTuple; content: React.ReactNode } | null;
  height?: number;
  routeColor?: string;
}

type BaseLayer = 'streets' | 'satellite';
const BASE_LAYER_STORAGE_KEY = 'asphalt-pci-mapa.base-layer';

// Calles: OpenStreetMap. Satélite: Esri World Imagery (sin clave). En la zona de trabajo la imagen real
// llega hasta el nivel 18; con más zoom se amplían esas teselas en vez de pedir las vacías del nivel 19.
const mapStyle: any = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap contributors',
    },
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      maxzoom: 18,
      attribution: 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
    },
  },
  layers: [
    { id: 'osm', type: 'raster', source: 'osm' },
    { id: 'satellite', type: 'raster', source: 'satellite', layout: { visibility: 'none' } },
  ],
};

const readStoredBaseLayer = (): BaseLayer => {
  try { return localStorage.getItem(BASE_LAYER_STORAGE_KEY) === 'satellite' ? 'satellite' : 'streets'; }
  catch { return 'streets'; }
};

// Referencias estables: un valor por defecto `[]` crearía un arreglo nuevo en cada render
// y volvería a ejecutar el efecto de dibujo (y el reencuadre del mapa) sin que cambie nada.
const NO_POINTS: LngLatTuple[] = [];
const NO_POLYGONS: PolygonFeature[] = [];
const NO_SLICES: SliceFeature[] = [];

const ringContains = (ring: LngLatTuple[], [x, y]: LngLatTuple): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

// Distancia aproximada (m) de un punto al contorno de un anillo, en un plano local.
const distanceToRingMeters = (ring: LngLatTuple[], [x, y]: LngLatTuple): number => {
  const metersPerLon = 111320 * Math.cos(y * Math.PI / 180);
  const metersPerLat = 110540;
  let best = Number.POSITIVE_INFINITY;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const ax = (ring[index][0] - x) * metersPerLon;
    const ay = (ring[index][1] - y) * metersPerLat;
    const dx = (ring[index + 1][0] - ring[index][0]) * metersPerLon;
    const dy = (ring[index + 1][1] - ring[index][1]) * metersPerLat;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0;
    best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return best;
};

// Unidad bajo el punto; si no hay ninguna, la más cercana dentro de la tolerancia (las unidades son
// muy estrechas con poco zoom, así que se acepta un margen de unos píxeles alrededor).
const polygonAt = (polygons: PolygonFeature[], point: LngLatTuple, toleranceMeters = 0): PolygonFeature | undefined => {
  let nearest: PolygonFeature | undefined;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (let index = polygons.length - 1; index >= 0; index -= 1) {
    const ring = polygons[index].coordinates[0];
    if (!ring) continue;
    if (ringContains(ring, point)) return polygons[index];
    if (toleranceMeters > 0) {
      const distance = distanceToRingMeters(ring, point);
      if (distance <= toleranceMeters && distance < nearestDistance) { nearest = polygons[index]; nearestDistance = distance; }
    }
  }
  return nearest;
};

const HIT_TOLERANCE_PIXELS = 7;
// Metros por píxel de pantalla en la latitud y el zoom actuales (mapa de 512 px por nivel).
const hitToleranceMeters = (map: MapLibreMap, latitude: number) =>
  HIT_TOLERANCE_PIXELS * 78271.517 * Math.cos(latitude * Math.PI / 180) / 2 ** map.getZoom();

const coordinateKey = (point?: LngLatTuple) => point ? `${point[0].toFixed(6)},${point[1].toFixed(6)}` : '';

export const MapCanvas: React.FC<MapCanvasProps> = ({ route = NO_POINTS, routes, points = NO_POINTS, polygons = NO_POLYGONS, slices = NO_SLICES, maxBounds, viewCenter, viewZoom, selectedPolygonId, detailZoom, popup, onMapClick, onPolygonClick, height = 430, routeColor = '#2563eb' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<SVGSVGElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const clickHandlerRef = useRef(onMapClick);
  const polygonHandlerRef = useRef(onPolygonClick);
  const polygonsRef = useRef(polygons);
  const fitKeyRef = useRef('');
  const boundsKeyRef = useRef('');
  const [mapReady, setMapReady] = useState(false);
  const [baseLayer, setBaseLayer] = useState<BaseLayer>(readStoredBaseLayer);

  useEffect(() => { clickHandlerRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { polygonHandlerRef.current = onPolygonClick; }, [onPolygonClick]);
  useEffect(() => { polygonsRef.current = polygons; }, [polygons]);

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({ container: containerRef.current, style: mapStyle, center: [-79.52, 8.98], zoom: 7 });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    // Las unidades se detectan sobre el mapa y no sobre el SVG, para que el arrastre y el zoom
    // sigan funcionando cuando el cursor está encima de un polígono.
    map.on('click', event => {
      const point: LngLatTuple = [event.lngLat.lng, event.lngLat.lat];
      const polygon = polygonHandlerRef.current ? polygonAt(polygonsRef.current, point, hitToleranceMeters(map, point[1])) : undefined;
      if (polygon) polygonHandlerRef.current?.(polygon.properties || {}, point);
      else clickHandlerRef.current?.(point);
    });
    map.on('mousemove', event => {
      const overPolygon = polygonHandlerRef.current && polygonsRef.current.length > 0
        && polygonAt(polygonsRef.current, [event.lngLat.lng, event.lngLat.lat], hitToleranceMeters(map, event.lngLat.lat));
      map.getCanvas().style.cursor = overPolygon ? 'pointer' : '';
    });
    // La capa de ruta y unidades no depende de las teselas: se dibuja en cuanto el estilo está listo.
    map.once('styledata', () => setMapReady(true));
    map.on('load', () => setMapReady(true));
    const mapElement = containerRef.current;
    const onWheel = (event: WheelEvent) => {
      const step = Math.abs(event.deltaY);
      const looksLikeMouseWheel = event.deltaMode !== 0 || (event.deltaX === 0 && step >= 100 && (step % 100 === 0 || step % 120 === 0));
      if (event.ctrlKey || event.metaKey || looksLikeMouseWheel) return;
      event.preventDefault();
      event.stopPropagation();
      map.panBy([event.deltaX, event.deltaY], { duration: 0 });
    };
    mapElement.addEventListener('wheel', onWheel, { passive: false, capture: true });
    mapRef.current = map;
    return () => {
      mapElement.removeEventListener('wheel', onWheel, { capture: true });
      markersRef.current.forEach(marker => marker.remove());
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    map.setLayoutProperty('osm', 'visibility', baseLayer === 'streets' ? 'visible' : 'none');
    map.setLayoutProperty('satellite', 'visibility', baseLayer === 'satellite' ? 'visible' : 'none');
  }, [mapReady, baseLayer]);

  const chooseBaseLayer = (layer: BaseLayer) => {
    setBaseLayer(layer);
    try { localStorage.setItem(BASE_LAYER_STORAGE_KEY, layer); } catch { /* sin almacenamiento disponible */ }
  };

  const maxBoundsKey = maxBounds ? maxBounds.flat().join(',') : '';
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const hasGeometry = route.length > 0 || points.length > 0 || slices.length > 0 || polygons.length > 0 || Boolean(routes?.length);
    map.setMaxBounds(maxBounds ?? null);
    if (maxBounds && viewCenter && !hasGeometry) map.jumpTo({ center: viewCenter, zoom: viewZoom ?? 6 });
    else if (!maxBounds && boundsKeyRef.current && !hasGeometry) map.jumpTo({ center: [-79.52, 8.98], zoom: 7 });
    boundsKeyRef.current = maxBoundsKey;
  }, [mapReady, maxBoundsKey]);

  useEffect(() => {
    const map = mapRef.current;
    const overlay = overlayRef.current;
    if (!map || !overlay || !mapReady) return;

    const routeLines = routes || (route.length ? [route] : []);
    const svgNamespace = 'http://www.w3.org/2000/svg';
    const pathData = (coordinates: LngLatTuple[], close = false) => coordinates.map((coordinate, index) => {
      const point = map.project(coordinate);
      return `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    }).join(' ') + (close ? ' Z' : '');

    const redrawOverlay = () => {
      overlay.replaceChildren();
      const drawableSlices = slices.filter(slice => slice.coordinates.length >= 2);
      const sliceGeometries = drawableSlices.map(slice => pathData(slice.coordinates));
      const sliceStroke = (geometry: string, color: string, width: number, opacity?: number) => {
        const stroke = document.createElementNS(svgNamespace, 'path');
        stroke.setAttribute('d', geometry);
        stroke.setAttribute('fill', 'none');
        stroke.setAttribute('stroke', color);
        stroke.setAttribute('stroke-width', String(width));
        stroke.setAttribute('stroke-linecap', 'butt');
        stroke.setAttribute('stroke-linejoin', 'round');
        if (opacity !== undefined) stroke.setAttribute('stroke-opacity', String(opacity));
        overlay.appendChild(stroke);
      };
      sliceGeometries.forEach(geometry => sliceStroke(geometry, '#ffffff', 10, 0.9));
      sliceGeometries.forEach((geometry, index) => sliceStroke(geometry, drawableSlices[index].color, 6));
      drawableSlices.forEach(slice => {
        if (!slice.label) return;
        const pixels = slice.coordinates.map(coordinate => map.project(coordinate));
        const segmentLengths = pixels.slice(1).map((pixel, index) => Math.hypot(pixel.x - pixels[index].x, pixel.y - pixels[index].y));
        const total = segmentLengths.reduce((sum, value) => sum + value, 0);
        if (total < 34) return;
        let remaining = total / 2;
        let segment = 0;
        while (segment < segmentLengths.length - 1 && remaining > segmentLengths[segment]) { remaining -= segmentLengths[segment]; segment += 1; }
        const ratio = segmentLengths[segment] > 0 ? remaining / segmentLengths[segment] : 0;
        const x = pixels[segment].x + (pixels[segment + 1].x - pixels[segment].x) * ratio;
        const y = pixels[segment].y + (pixels[segment + 1].y - pixels[segment].y) * ratio;
        const text = document.createElementNS(svgNamespace, 'text');
        text.setAttribute('x', x.toFixed(1));
        text.setAttribute('y', (y - 9).toFixed(1));
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', '11');
        text.setAttribute('font-weight', '700');
        text.setAttribute('fill', '#0f172a');
        text.setAttribute('stroke', '#ffffff');
        text.setAttribute('stroke-width', '3');
        text.setAttribute('paint-order', 'stroke');
        text.textContent = slice.label;
        overlay.appendChild(text);
      });
      const routeVisible = detailZoom === undefined || map.getZoom() < detailZoom;
      routeLines.forEach(line => {
        if (!routeVisible || line.length < 2) return;
        const geometry = pathData(line);
        const casing = document.createElementNS(svgNamespace, 'path');
        casing.setAttribute('d', geometry);
        casing.setAttribute('fill', 'none');
        casing.setAttribute('stroke', '#ffffff');
        casing.setAttribute('stroke-opacity', '0.9');
        casing.setAttribute('stroke-width', '9');
        casing.setAttribute('stroke-linecap', 'round');
        casing.setAttribute('stroke-linejoin', 'round');
        const linePath = document.createElementNS(svgNamespace, 'path');
        linePath.setAttribute('d', geometry);
        linePath.setAttribute('fill', 'none');
        linePath.setAttribute('stroke', routeColor);
        linePath.setAttribute('stroke-width', '5');
        linePath.setAttribute('stroke-linecap', 'round');
        linePath.setAttribute('stroke-linejoin', 'round');
        overlay.append(casing, linePath);
      });

      // Con zoom lejano las unidades son tan estrechas que se dibujan como una línea del color del PCI.
      const detailed = detailZoom === undefined || map.getZoom() >= detailZoom;
      const drawPolygon = (polygon: PolygonFeature) => {
        const isSelected = selectedPolygonId !== undefined && polygon.id === selectedPolygonId;
        const color = polygon.color || '#94a3b8';
        const shape = document.createElementNS(svgNamespace, 'path');
        shape.setAttribute('d', polygon.coordinates.map(ring => pathData(ring, true)).join(' '));
        shape.setAttribute('fill', color);
        shape.setAttribute('fill-opacity', '0.72');
        shape.setAttribute('stroke', isSelected ? '#0f172a' : detailed ? '#ffffff' : color);
        shape.setAttribute('stroke-width', isSelected ? '3' : detailed ? '1.5' : '5');
        shape.setAttribute('stroke-linejoin', 'round');
        overlay.appendChild(shape);
      };
      polygons.filter(polygon => polygon.id !== selectedPolygonId).forEach(drawPolygon);
      polygons.filter(polygon => polygon.id === selectedPolygonId).forEach(drawPolygon);
    };

    redrawOverlay();
    map.on('move', redrawOverlay);
    map.on('resize', redrawOverlay);
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = points.map((point, index) => {
      const element = document.createElement('div');
      element.className = 'map-waypoint-marker';
      element.style.cssText = `width:26px;height:26px;border-radius:9999px;border:3px solid white;background:${index === 0 ? '#16a34a' : index === points.length - 1 ? '#dc2626' : '#2563eb'};color:white;box-shadow:0 2px 8px #0006;display:grid;place-items:center;font:bold 11px sans-serif`;
      element.textContent = index === 0 ? 'I' : index === points.length - 1 ? 'F' : String(index);
      return new maplibregl.Marker({ element }).setLngLat(point).addTo(map);
    });

    // Solo se reencuadra cuando cambia la geometría que se muestra (ruta, unidades o los
    // extremos), no en cada render ni al añadir un punto de paso o escribir coordenadas.
    const fitKey = [
      routeLines.map(line => `${line.length}:${coordinateKey(line[0])}:${coordinateKey(line[line.length - 1])}`).join('|'),
      polygons.length ? `${polygons.length}:${coordinateKey(polygons[0].coordinates[0]?.[0])}` : '',
      slices.length ? `${coordinateKey(slices[0].coordinates[0])}>${coordinateKey(slices[slices.length - 1].coordinates.at(-1))}` : '',
      points.length >= 2 ? `${coordinateKey(points[0])}>${coordinateKey(points[points.length - 1])}` : '',
    ].join('#');
    const shouldFit = fitKey !== fitKeyRef.current && fitKey.replace(/#/g, '') !== '';
    fitKeyRef.current = fitKey;
    const allCoordinates = [...routeLines.flat(), ...slices.flatMap(slice => slice.coordinates), ...points, ...polygons.flatMap(p => p.coordinates[0] || [])];
    if (shouldFit && allCoordinates.length > 0) {
      const bounds = allCoordinates.reduce((box, point) => box.extend(point), new maplibregl.LngLatBounds(allCoordinates[0], allCoordinates[0]));
      map.fitBounds(bounds, { padding: 55, maxZoom: 17, duration: 450 });
    }
    return () => {
      map.off('move', redrawOverlay);
      map.off('resize', redrawOverlay);
    };
  }, [mapReady, route, routes, points, polygons, slices, routeColor, selectedPolygonId, detailZoom]);

  // Posición en pantalla del panel flotante; se recalcula al mover o acercar el mapa
  const [popupPos, setPopupPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !popup) { setPopupPos(null); return; }
    const update = () => { const point = map.project(popup.coordinate); setPopupPos({ x: point.x, y: point.y }); };
    update();
    map.on('move', update);
    return () => { map.off('move', update); };
  }, [mapReady, popup]);

  const renderPopup = () => {
    if (!popup || !popupPos) return null;
    const width = containerRef.current?.clientWidth ?? 0;
    const heightPx = containerRef.current?.clientHeight ?? 0;
    if (popupPos.x < 0 || popupPos.y < 0 || popupPos.x > width || popupPos.y > heightPx) return null;
    const below = popupPos.y < 240; // si no cabe arriba del punto, se abre hacia abajo
    const left = Math.min(Math.max(popupPos.x, 150), Math.max(150, width - 150));
    return (
      <div className="absolute z-30" style={{ left, top: popupPos.y, transform: below ? 'translate(-50%, 16px)' : 'translate(-50%, calc(-100% - 16px))' }}>
        {popup.content}
      </div>
    );
  };

  return <div className="relative w-full overflow-hidden rounded-xl border border-border-muted bg-slate-100" style={{ height }}>
    <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
    <svg ref={overlayRef} className="pointer-events-none absolute inset-0 z-10 h-full w-full" aria-hidden="true" />
    <div role="group" aria-label="Mapa base" className="absolute left-2 top-2 z-20 flex overflow-hidden rounded-lg border border-border-muted bg-bg-surface text-xs font-semibold shadow-md">
      {([['streets', 'Calles'], ['satellite', 'Satélite']] as const).map(([layer, label]) => (
        <button
          key={layer}
          type="button"
          aria-pressed={baseLayer === layer}
          onClick={() => chooseBaseLayer(layer)}
          className={`px-3 py-1.5 transition-colors ${baseLayer === layer ? 'bg-primary text-text-inverted' : 'text-text-base hover:bg-primary/10'}`}
        >{label}</button>
      ))}
    </div>
    {renderPopup()}
  </div>;
};
