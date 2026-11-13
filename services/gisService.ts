import proj4 from 'proj4';
import { GeodeticDatum, LngLatTuple, RouteLocation, Section } from '../types';

export interface SampleMapFeature {
  sampleId: number;
  startStation: number;
  endStation: number;
  evaluated: boolean;
  coordinates: LngLatTuple[][];
  startPoint: LngLatTuple;
  endPoint: LngLatTuple;
}

// NAD 27 usa la elipse Clarke 1866 con la transformación media de la Zona del Canal de Panamá
// (NIMA TR8350.2: dX 0, dY +125, dZ +201 m). La definición +datum=NAD27 de proj4 depende de rejillas
// NADCON que no cubren Panamá, así que sin estos parámetros solo se aplicaba el cambio de elipsoide.
const utmDefinition = (zone: number, hemisphere: 'N' | 'S', datum: GeodeticDatum = 'WGS84') => {
  const datumPart = datum === 'NAD27' ? '+ellps=clrk66 +towgs84=0,125,201,0,0,0,0' : '+datum=WGS84';
  return `+proj=utm +zone=${zone} ${hemisphere === 'S' ? '+south ' : ''}${datumPart} +units=m +no_defs`;
};

export const toUtm = (point: LngLatTuple, zone: number, hemisphere: 'N' | 'S', datum: GeodeticDatum = 'WGS84'): LngLatTuple =>
  proj4('EPSG:4326', utmDefinition(zone, hemisphere, datum), point) as LngLatTuple;

export const fromUtm = (point: LngLatTuple, zone: number, hemisphere: 'N' | 'S', datum: GeodeticDatum = 'WGS84'): LngLatTuple =>
  proj4(utmDefinition(zone, hemisphere, datum), 'EPSG:4326', point) as LngLatTuple;

export interface UtmZoneView {
  bounds: [LngLatTuple, LngLatTuple];
  center: LngLatTuple;
  zoom: number;
}

// Franja que cubre una zona UTM (6° de longitud) y vista inicial para mostrarla en el mapa.
export const utmZoneView = (zone: number, hemisphere: 'N' | 'S'): UtmZoneView => {
  const west = (zone - 31) * 6;
  return {
    bounds: [[west, hemisphere === 'N' ? 0 : -80], [west + 6, hemisphere === 'N' ? 84 : 0]],
    center: [west + 3, hemisphere === 'N' ? 8.5 : -8.5],
    zoom: 6,
  };
};

export const suggestedUtmZone = (longitude: number): number =>
  Math.max(1, Math.min(60, Math.floor((longitude + 180) / 6) + 1));

type RouteGeometry = Pick<RouteLocation, 'routeCoordinates' | 'utmZone' | 'hemisphere' | 'datum'>;

const projectedRoute = (location: RouteGeometry): LngLatTuple[] =>
  location.routeCoordinates.map(point => toUtm(point, location.utmZone, location.hemisphere, location.datum));

const cumulativeDistances = (points: LngLatTuple[]): number[] => {
  const distances = [0];
  for (let index = 1; index < points.length; index += 1) {
    distances.push(distances[index - 1] + Math.hypot(points[index][0] - points[index - 1][0], points[index][1] - points[index - 1][1]));
  }
  return distances;
};

export const measureRouteUtm = (coordinates: LngLatTuple[], zone: number, hemisphere: 'N' | 'S', datum: GeodeticDatum = 'WGS84'): number => {
  const points = coordinates.map(point => toUtm(point, zone, hemisphere, datum));
  return cumulativeDistances(points).at(-1) || 0;
};

const pointAt = (points: LngLatTuple[], cumulative: number[], distance: number): LngLatTuple => {
  const target = Math.max(0, Math.min(distance, cumulative.at(-1) || 0));
  let index = 1;
  while (index < cumulative.length && cumulative[index] < target) index += 1;
  if (index >= points.length) return points.at(-1)!;
  const segmentLength = cumulative[index] - cumulative[index - 1];
  const ratio = segmentLength > 0 ? (target - cumulative[index - 1]) / segmentLength : 0;
  return [
    points[index - 1][0] + (points[index][0] - points[index - 1][0]) * ratio,
    points[index - 1][1] + (points[index][1] - points[index - 1][1]) * ratio,
  ];
};

const sliceProjectedLine = (points: LngLatTuple[], start: number, end: number): LngLatTuple[] => {
  const cumulative = cumulativeDistances(points);
  const result: LngLatTuple[] = [pointAt(points, cumulative, start)];
  points.forEach((point, index) => {
    if (cumulative[index] > start && cumulative[index] < end) result.push(point);
  });
  result.push(pointAt(points, cumulative, end));
  return result;
};

const corridorPolygon = (line: LngLatTuple[], width: number): LngLatTuple[] => {
  const half = width / 2;
  const left: LngLatTuple[] = [];
  const right: LngLatTuple[] = [];
  line.forEach((point, index) => {
    const previous = line[Math.max(0, index - 1)];
    const next = line[Math.min(line.length - 1, index + 1)];
    const dx = next[0] - previous[0];
    const dy = next[1] - previous[1];
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    left.push([point[0] + nx * half, point[1] + ny * half]);
    right.push([point[0] - nx * half, point[1] - ny * half]);
  });
  return [...left, ...right.reverse(), left[0]];
};

export const buildSampleMapFeatures = (section: Section): SampleMapFeature[] => {
  if (!section.routeLocation || section.routeLocation.routeCoordinates.length < 2) return [];
  const location = section.routeLocation;
  const points = projectedRoute(location);
  const totalLength = cumulativeDistances(points).at(-1) || 0;
  const evaluatedIds = new Set(section.samples.map(sample => sample.id));
  const features: SampleMapFeature[] = [];
  for (let id = 1; id <= section.totalSampleUnits; id += 1) {
    const start = Math.min((id - 1) * section.sampleUnitLength, totalLength);
    const end = Math.min(id * section.sampleUnitLength, totalLength);
    if (end <= start) break;
    const slice = sliceProjectedLine(points, start, end);
    const ring = corridorPolygon(slice, section.width).map(point => fromUtm(point, location.utmZone, location.hemisphere, location.datum));
    features.push({
      sampleId: id,
      startStation: section.startStation + start,
      endStation: section.startStation + end,
      evaluated: evaluatedIds.has(id),
      coordinates: [ring],
      startPoint: fromUtm(slice[0], location.utmZone, location.hemisphere, location.datum),
      endPoint: fromUtm(slice.at(-1)!, location.utmZone, location.hemisphere, location.datum),
    });
  }
  return features;
};

export const getPredominantDistress = (section: Section, sampleId: number): string | undefined => {
  const summaries = section.samples.find(sample => sample.id === sampleId)?.calculationDetails?.summaries || [];
  return [...summaries].sort((a, b) => b.deductValue - a.deductValue)[0]?.nameKey;
};

export interface RouteSlice {
  id: number;
  startStation: number;
  endStation: number;
  coordinates: LngLatTuple[];
}

const MAX_SLICES = 2000;

// Divide la ruta en tramos consecutivos de `unitLength` metros (medidos en UTM), uno por unidad de muestra.
export const sliceRouteByUnits = (location: RouteGeometry, unitLength: number, startStation = 0, totalUnits?: number): RouteSlice[] => {
  if (location.routeCoordinates.length < 2 || !(unitLength > 0)) return [];
  const points = projectedRoute(location);
  const totalLength = cumulativeDistances(points).at(-1) || 0;
  const count = Math.min(totalUnits ?? Math.ceil(totalLength / unitLength), MAX_SLICES);
  const slices: RouteSlice[] = [];
  for (let id = 1; id <= count; id += 1) {
    const start = (id - 1) * unitLength;
    if (start >= totalLength) break;
    const end = Math.min(id * unitLength, totalLength);
    slices.push({
      id,
      startStation: startStation + start,
      endStation: startStation + end,
      coordinates: sliceProjectedLine(points, start, end).map(point => fromUtm(point, location.utmZone, location.hemisphere, location.datum)),
    });
  }
  return slices;
};

export const formatStation = (value: number): string =>
  `${Math.floor(value / 1000)}+${(value % 1000).toFixed(2).padStart(6, '0')}`;

export interface SampleUnitRow {
  id: number;
  startStation: number;
  endStation: number;
  evaluated: boolean;
  pci?: number;
  predominant?: string;
  /** Coordenadas geográficas (longitud, latitud); solo si el tramo tiene ruta. */
  start?: LngLatTuple;
  end?: LngLatTuple;
  /** Coordenadas UTM (este, norte) en el datum y la zona de la ruta. */
  startUtm?: LngLatTuple;
  endUtm?: LngLatTuple;
}

// Una fila por unidad de muestra del tramo. Las progresivas siempre se calculan; las coordenadas solo existen si el
// tramo tiene una ruta fijada en el mapa.
export const buildSampleUnitRows = (section: Section): SampleUnitRow[] => {
  const location = section.routeLocation;
  const slices = location && location.routeCoordinates.length >= 2
    ? sliceRouteByUnits(location, section.sampleUnitLength, section.startStation, section.totalSampleUnits)
    : [];
  const sliceById = new Map(slices.map(slice => [slice.id, slice]));
  const rows: SampleUnitRow[] = [];
  for (let id = 1; id <= section.totalSampleUnits; id += 1) {
    const slice = sliceById.get(id);
    const startStation = slice ? slice.startStation : section.startStation + (id - 1) * section.sampleUnitLength;
    const endStation = slice ? slice.endStation : section.startStation + Math.min(id * section.sampleUnitLength, section.length);
    if (!slice && startStation >= section.startStation + section.length) break;
    const sample = section.samples.find(item => item.id === id);
    const row: SampleUnitRow = {
      id,
      startStation,
      endStation,
      evaluated: Boolean(sample),
      pci: sample?.calculationDetails?.pci,
      predominant: sample ? getPredominantDistress(section, id) : undefined,
    };
    if (slice && location) {
      row.start = slice.coordinates[0];
      row.end = slice.coordinates[slice.coordinates.length - 1];
      row.startUtm = toUtm(row.start, location.utmZone, location.hemisphere, location.datum);
      row.endUtm = toUtm(row.end, location.utmZone, location.hemisphere, location.datum);
    }
    rows.push(row);
  }
  return rows;
};
