import { LngLatTuple } from '../types';

const OVERPASS_URLS = Array.from(new Set([
  import.meta.env.VITE_OVERPASS_URL,
  '/api/overpass/private',
  '/api/overpass/main',
  '/api/overpass/maps',
].filter(Boolean) as string[]));
const EXCLUDED_HIGHWAYS = new Set(['footway', 'path', 'steps', 'cycleway', 'bridleway', 'corridor', 'proposed', 'construction', 'raceway']);

interface RoadNode {
  id: number;
  coordinate: LngLatTuple;
  name: string;
}

interface RoadEdge {
  to: number;
  distance: number;
}

interface RoadGraph {
  nodes: Map<number, RoadNode>;
  adjacency: Map<number, RoadEdge[]>;
}

interface OverpassWay {
  type: 'way';
  id: number;
  nodes: number[];
  geometry: Array<{ lat: number; lon: number }>;
  tags?: Record<string, string>;
}

const parseOsmWays = (xmlText: string): OverpassWay[] => {
  const documentXml = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (documentXml.querySelector('parsererror')) throw new Error('La respuesta XML de OpenStreetMap no es válida.');
  const coordinates = new Map<number, { lat: number; lon: number }>();
  documentXml.querySelectorAll('node').forEach(node => {
    coordinates.set(Number(node.getAttribute('id')), {
      lat: Number(node.getAttribute('lat')),
      lon: Number(node.getAttribute('lon')),
    });
  });
  return Array.from(documentXml.querySelectorAll('way')).flatMap(way => {
    const tags = Object.fromEntries(Array.from(way.querySelectorAll(':scope > tag')).map(tag => [tag.getAttribute('k') || '', tag.getAttribute('v') || '']));
    if (!tags.highway || EXCLUDED_HIGHWAYS.has(tags.highway)) return [];
    const nodes = Array.from(way.querySelectorAll(':scope > nd')).map(node => Number(node.getAttribute('ref'))).filter(id => coordinates.has(id));
    if (nodes.length < 2) return [];
    return [{ type: 'way' as const, id: Number(way.getAttribute('id')), nodes, geometry: nodes.map(id => coordinates.get(id)!), tags }];
  });
};

const parseOsmJsonWays = (data: any): OverpassWay[] => {
  const coordinates = new Map<number, { lat: number; lon: number }>();
  (data.elements || []).forEach((element: any) => {
    if (element.type === 'node') coordinates.set(element.id, { lat: element.lat, lon: element.lon });
  });
  return (data.elements || []).flatMap((element: any) => {
    if (element.type !== 'way' || !element.tags?.highway || EXCLUDED_HIGHWAYS.has(element.tags.highway)) return [];
    const nodes = (element.nodes || []).filter((id: number) => coordinates.has(id));
    if (nodes.length < 2) return [];
    return [{ type: 'way' as const, id: element.id, nodes, geometry: nodes.map((id: number) => coordinates.get(id)!), tags: element.tags }];
  });
};

export interface RoutedPath {
  coordinates: LngLatTuple[];
  distance: number;
  snappedWaypoints: LngLatTuple[];
  waypointNames: string[];
}

const graphCache = new Map<string, RoadGraph>();

const distanceMeters = (a: LngLatTuple, b: LngLatTuple): number => {
  const radius = 6371008.8;
  const toRadians = (value: number) => value * Math.PI / 180;
  const latitude1 = toRadians(a[1]);
  const latitude2 = toRadians(b[1]);
  const deltaLatitude = latitude2 - latitude1;
  const deltaLongitude = toRadians(b[0] - a[0]);
  const h = Math.sin(deltaLatitude / 2) ** 2 + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
};

const boundingBox = (points: LngLatTuple[], padding: number) => {
  const longitudes = points.map(point => point[0]);
  const latitudes = points.map(point => point[1]);
  return {
    west: Math.min(...longitudes) - padding,
    south: Math.min(...latitudes) - padding,
    east: Math.max(...longitudes) + padding,
    north: Math.max(...latitudes) + padding,
  };
};

const graphKey = (box: ReturnType<typeof boundingBox>) =>
  [box.south, box.west, box.north, box.east].map(value => value.toFixed(4)).join(',');

const addEdge = (graph: RoadGraph, from: number, to: number, distance: number) => {
  const edges = graph.adjacency.get(from) || [];
  edges.push({ to, distance });
  graph.adjacency.set(from, edges);
};

const buildGraph = (ways: OverpassWay[]): RoadGraph => {
  const graph: RoadGraph = { nodes: new Map(), adjacency: new Map() };
  ways.forEach(way => {
    if (!way.geometry || !way.nodes || way.geometry.length !== way.nodes.length) return;
    if (EXCLUDED_HIGHWAYS.has(way.tags?.highway || '')) return;
    const name = way.tags?.name || way.tags?.ref || 'Vía sin nombre';
    way.nodes.forEach((nodeId, index) => {
      const geometry = way.geometry[index];
      if (!graph.nodes.has(nodeId)) graph.nodes.set(nodeId, { id: nodeId, coordinate: [geometry.lon, geometry.lat], name });
      else if (graph.nodes.get(nodeId)?.name === 'Vía sin nombre' && name !== 'Vía sin nombre') graph.nodes.get(nodeId)!.name = name;
      if (index === 0) return;
      const previousId = way.nodes[index - 1];
      const previous = way.geometry[index - 1];
      const length = distanceMeters([previous.lon, previous.lat], [geometry.lon, geometry.lat]);
      addEdge(graph, previousId, nodeId, length);
      addEdge(graph, nodeId, previousId, length);
    });
  });
  return graph;
};

const fetchRoadGraph = async (points: LngLatTuple[], padding: number): Promise<RoadGraph> => {
  const box = boundingBox(points, padding);
  if (box.east - box.west > 0.35 || box.north - box.south > 0.35) {
    throw new Error('El área es demasiado extensa para el trazador de inspección. Agregue puntos intermedios o divida el tramo.');
  }
  const key = graphKey(box);
  const cached = graphCache.get(key);
  if (cached) return cached;
  const bbox = `${box.west},${box.south},${box.east},${box.north}`;
  const query = `[out:json][timeout:25];way["highway"]["highway"!~"footway|path|steps|cycleway|bridleway|corridor|proposed|construction|raceway"](${box.south},${box.west},${box.north},${box.east});out body geom;`;
  const failures: string[] = [];
  let ways: OverpassWay[] = [];

  const directController = new AbortController();
  const directTimeout = window.setTimeout(() => directController.abort(), 20000);
  try {
    const response = await fetch(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${bbox}`, { signal: directController.signal });
    if (!response.ok) throw new Error(String(response.status));
    ways = parseOsmJsonWays(await response.json());
  } catch (error: any) {
    failures.push(`OpenStreetMap JSON: ${error?.name === 'AbortError' ? 'tiempo agotado' : error?.message || 'sin conexión'}`);
  } finally {
    window.clearTimeout(directTimeout);
  }

  for (const endpoint of ways.length ? [] : OVERPASS_URLS) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: new URLSearchParams({ data: query }),
        signal: controller.signal,
      });
      if (!response.ok) {
        failures.push(`${endpoint.split('/').at(-1)}: ${response.status}`);
        continue;
      }
      const data = await response.json();
      ways = (data.elements || []).filter((element: any) => element.type === 'way') as OverpassWay[];
      if (ways.length) break;
    } catch (error: any) {
      failures.push(`${endpoint.split('/').at(-1)}: ${error?.name === 'AbortError' ? 'tiempo agotado' : 'sin conexión'}`);
    } finally {
      window.clearTimeout(timeout);
    }
  }

  if (!ways.length) {
    try {
      const response = await fetch(`/api/osm/map?bbox=${bbox}`);
      if (!response.ok) throw new Error(String(response.status));
      ways = parseOsmWays(await response.text());
    } catch (error: any) {
      failures.push(`OpenStreetMap local: ${error?.message || 'sin conexión'}`);
    }
  }
  if (!ways.length) throw new Error(`No se pudo descargar la red vial. Fuentes consultadas: ${failures.join(', ')}.`);
  const graph = buildGraph(ways);
  if (graph.nodes.size === 0) throw new Error('No se encontraron ejes viales en el área seleccionada.');
  graphCache.set(key, graph);
  return graph;
};

const bearing = (from: LngLatTuple, to: LngLatTuple): number =>
  Math.atan2(to[1] - from[1], to[0] - from[0]);

const angleDifference = (a: number, b: number): number => {
  const direct = Math.abs(a - b) % Math.PI;
  return Math.min(direct, Math.PI - direct);
};

interface SnapCandidate { node: RoadNode; score: number; links: RoadEdge[]; segmentKey?: string; }

interface RoutingContext {
  graph: RoadGraph;
  virtualNodes: Map<number, RoadNode>;
  segments: Array<[number, number]>;
  nextVirtualId: number;
}

const MAX_SNAP_DISTANCE = 250;
const MAX_CANDIDATES = 7;
const MAX_CANDIDATES_PER_ROAD = 2;
const ENDPOINT_TOLERANCE = 1;

const nodeOf = (context: RoutingContext, id: number): RoadNode =>
  (context.graph.nodes.get(id) ?? context.virtualNodes.get(id))!;

const listSegments = (graph: RoadGraph): Array<[number, number]> => {
  const segments: Array<[number, number]> = [];
  graph.adjacency.forEach((edges, from) => edges.forEach(edge => { if (from < edge.to) segments.push([from, edge.to]); }));
  return segments;
};

const segmentKeyOf = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`;

interface RawSnap { fromId: number; toId: number; t: number; segmentLength: number; score: number; name: string; }

// Proyecta el punto sobre cada tramo de vía cercano (no solo sobre sus nodos), de modo que el
// inicio y el final de la ruta coincidan con el punto elegido y no con el nodo OSM más cercano.
const snapCandidates = (context: RoutingContext, points: LngLatTuple[], pointIndex: number): SnapCandidate[] => {
  const { graph } = context;
  const point = points[pointIndex];
  const desiredBearings: number[] = [];
  if (pointIndex > 0) desiredBearings.push(bearing(points[pointIndex - 1], point));
  if (pointIndex < points.length - 1) desiredBearings.push(bearing(point, points[pointIndex + 1]));
  const metersPerLon = 111320 * Math.cos(point[1] * Math.PI / 180);
  const metersPerLat = 110540;
  const found: RawSnap[] = [];
  context.segments.forEach(([fromId, toId]) => {
    const a = graph.nodes.get(fromId)!;
    const b = graph.nodes.get(toId)!;
    const ax = (a.coordinate[0] - point[0]) * metersPerLon;
    const ay = (a.coordinate[1] - point[1]) * metersPerLat;
    const dx = (b.coordinate[0] - a.coordinate[0]) * metersPerLon;
    const dy = (b.coordinate[1] - a.coordinate[1]) * metersPerLat;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared > 0 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0;
    const proximity = Math.hypot(ax + t * dx, ay + t * dy);
    if (proximity > MAX_SNAP_DISTANCE) return;
    const roadBearing = bearing(a.coordinate, b.coordinate);
    const alignment = desiredBearings.length
      ? desiredBearings.reduce((total, desired) => total + angleDifference(desired, roadBearing), 0) / desiredBearings.length
      : 0;
    found.push({ fromId, toId, t, segmentLength: Math.sqrt(lengthSquared), score: proximity + alignment * 35, name: a.name !== 'Vía sin nombre' ? a.name : b.name });
  });
  if (!found.length) throw new Error('Uno de los puntos está a más de 250 m de una vía reconocida.');
  found.sort((x, y) => x.score - y.score);

  const perRoad = new Map<string, number>();
  const usedNodes = new Set<number>();
  const candidates: SnapCandidate[] = [];
  for (const snap of found) {
    if (candidates.length >= MAX_CANDIDATES) break;
    if ((perRoad.get(snap.name) || 0) >= MAX_CANDIDATES_PER_ROAD) continue;
    const a = graph.nodes.get(snap.fromId)!;
    const b = graph.nodes.get(snap.toId)!;
    let candidate: SnapCandidate;
    if (snap.t * snap.segmentLength < ENDPOINT_TOLERANCE || (1 - snap.t) * snap.segmentLength < ENDPOINT_TOLERANCE) {
      const node = snap.t * snap.segmentLength < ENDPOINT_TOLERANCE ? a : b;
      if (usedNodes.has(node.id)) continue;
      usedNodes.add(node.id);
      candidate = { node, score: snap.score, links: [] };
    } else {
      const coordinate: LngLatTuple = [
        a.coordinate[0] + (b.coordinate[0] - a.coordinate[0]) * snap.t,
        a.coordinate[1] + (b.coordinate[1] - a.coordinate[1]) * snap.t,
      ];
      const node: RoadNode = { id: context.nextVirtualId, coordinate, name: snap.name };
      context.nextVirtualId -= 1;
      context.virtualNodes.set(node.id, node);
      candidate = {
        node,
        score: snap.score,
        segmentKey: segmentKeyOf(snap.fromId, snap.toId),
        links: [
          { to: a.id, distance: distanceMeters(coordinate, a.coordinate) },
          { to: b.id, distance: distanceMeters(coordinate, b.coordinate) },
        ],
      };
    }
    perRoad.set(snap.name, (perRoad.get(snap.name) || 0) + 1);
    candidates.push(candidate);
  }
  return candidates;
};

class MinHeap {
  private items: Array<{ id: number; priority: number }> = [];
  push(item: { id: number; priority: number }) {
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].priority <= item.priority) break;
      this.items[index] = this.items[parent]; index = parent;
    }
    this.items[index] = item;
  }
  pop(): { id: number; priority: number } | undefined {
    if (this.items.length === 0) return undefined;
    const root = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1; const right = left + 1;
        if (left >= this.items.length) break;
        const child = right < this.items.length && this.items[right].priority < this.items[left].priority ? right : left;
        if (this.items[child].priority >= last.priority) break;
        this.items[index] = this.items[child]; index = child;
      }
      this.items[index] = last;
    }
    return root;
  }
  get size() { return this.items.length; }
}

// Aristas temporales que conectan los nodos virtuales con los extremos de su tramo.
const virtualEdges = (from: SnapCandidate, to: SnapCandidate): Map<number, RoadEdge[]> => {
  const extra = new Map<number, RoadEdge[]>();
  const add = (id: number, edge: RoadEdge) => { const list = extra.get(id) || []; list.push(edge); extra.set(id, list); };
  [from, to].forEach(candidate => candidate.links.forEach(link => {
    add(candidate.node.id, link);
    add(link.to, { to: candidate.node.id, distance: link.distance });
  }));
  if (from.segmentKey && from.segmentKey === to.segmentKey) {
    const distance = distanceMeters(from.node.coordinate, to.node.coordinate);
    add(from.node.id, { to: to.node.id, distance });
    add(to.node.id, { to: from.node.id, distance });
  }
  return extra;
};

const findPath = (context: RoutingContext, from: SnapCandidate, to: SnapCandidate): number[] => {
  const start = from.node;
  const end = to.node;
  if (start.id === end.id) return [start.id];
  const extra = virtualEdges(from, to);
  const neighbours = (id: number): RoadEdge[] => {
    const base = context.graph.adjacency.get(id) || [];
    const added = extra.get(id);
    return added ? base.concat(added) : base;
  };
  const open = new MinHeap();
  const cameFrom = new Map<number, number>();
  const cost = new Map<number, number>([[start.id, 0]]);
  open.push({ id: start.id, priority: 0 });
  while (open.size) {
    const current = open.pop()!;
    if (current.id === end.id) {
      const path = [end.id];
      while (path[0] !== start.id) path.unshift(cameFrom.get(path[0])!);
      return path;
    }
    for (const edge of neighbours(current.id)) {
      const newCost = (cost.get(current.id) || 0) + edge.distance;
      if (newCost < (cost.get(edge.to) ?? Number.POSITIVE_INFINITY)) {
        cost.set(edge.to, newCost); cameFrom.set(edge.to, current.id);
        const heuristic = distanceMeters(nodeOf(context, edge.to).coordinate, end.coordinate);
        open.push({ id: edge.to, priority: newCost + heuristic });
      }
    }
  }
  throw new Error('Los puntos no están conectados por la red vial descargada. Agregue un punto intermedio.');
};

const pathDistance = (context: RoutingContext, path: number[]): number => {
  let distance = 0;
  for (let index = 1; index < path.length; index += 1) {
    distance += distanceMeters(nodeOf(context, path[index - 1]).coordinate, nodeOf(context, path[index]).coordinate);
  }
  return distance;
};

const selectConnectedTrajectory = (context: RoutingContext, points: LngLatTuple[]) => {
  const candidates = points.map((_, index) => snapCandidates(context, points, index));
  const pathCache = new Map<string, number[] | null>();
  const getPath = (from: SnapCandidate, to: SnapCandidate) => {
    const key = `${from.node.id}:${to.node.id}`;
    if (!pathCache.has(key)) {
      try { pathCache.set(key, findPath(context, from, to)); }
      catch { pathCache.set(key, null); }
    }
    return pathCache.get(key) || null;
  };
  let states = candidates[0].map(candidate => ({ candidate, cost: candidate.score, previous: -1, path: [] as number[] }));
  const history = [states];
  for (let pointIndex = 1; pointIndex < candidates.length; pointIndex += 1) {
    const nextStates = candidates[pointIndex].map(candidate => {
      let best: { candidate: SnapCandidate; cost: number; previous: number; path: number[] } | undefined;
      states.forEach((previousState, previousIndex) => {
        const path = getPath(previousState.candidate, candidate);
        if (!path) return;
        const cost = previousState.cost + pathDistance(context, path) + candidate.score;
        if (!best || cost < best.cost) best = { candidate, cost, previous: previousIndex, path };
      });
      return best;
    }).filter(Boolean) as Array<{ candidate: SnapCandidate; cost: number; previous: number; path: number[] }>;
    if (!nextStates.length) throw new Error('No se encontró una trayectoria vial continua. Agregue un punto intermedio sobre la vía deseada.');
    states = nextStates;
    history.push(states);
  }
  let stateIndex = states.reduce((best, state, index) => state.cost < states[best].cost ? index : best, 0);
  const selectedNodes: RoadNode[] = [];
  const selectedPaths: number[][] = [];
  for (let level = history.length - 1; level >= 0; level -= 1) {
    const state = history[level][stateIndex];
    selectedNodes.unshift(state.candidate.node);
    if (level > 0) selectedPaths.unshift(state.path);
    stateIndex = state.previous;
  }
  return { selectedNodes, selectedPaths };
};

const routeWithPadding = async (points: LngLatTuple[], padding: number): Promise<RoutedPath> => {
  const graph = await fetchRoadGraph(points, padding);
  const context: RoutingContext = { graph, virtualNodes: new Map(), segments: listSegments(graph), nextVirtualId: -1 };
  const { selectedNodes: snappedNodes, selectedPaths } = selectConnectedTrajectory(context, points);
  const nodeIds = selectedPaths.flatMap((segment, index) => index === 0 ? segment : segment.slice(1));
  const coordinates = nodeIds.map(id => nodeOf(context, id).coordinate);
  let distance = 0;
  for (let index = 1; index < coordinates.length; index += 1) distance += distanceMeters(coordinates[index - 1], coordinates[index]);
  return {
    coordinates,
    distance,
    snappedWaypoints: snappedNodes.map(node => node.coordinate),
    waypointNames: snappedNodes.map(node => node.name),
  };
};

export const calculateRoadRoute = async (points: LngLatTuple[]): Promise<RoutedPath> => {
  if (points.length < 2) throw new Error('Se requieren al menos dos puntos.');
  try {
    return await routeWithPadding(points, 0.006);
  } catch (error: any) {
    if (/demasiado extensa|descargar la red vial/.test(error.message)) throw error;
    return routeWithPadding(points, 0.018);
  }
};
