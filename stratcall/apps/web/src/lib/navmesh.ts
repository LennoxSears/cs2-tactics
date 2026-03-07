import type { MapName, Position } from '../types';

// Compact nav mesh format (loaded from /navmesh/{map}.json)
export interface NavArea {
  id: number;
  cx: number; // centroid x (0-1 normalized)
  cy: number; // centroid y (0-1 normalized)
  v: [number, number][]; // polygon vertices (normalized)
  c: number[]; // connected area IDs
}

export interface NavMesh {
  areas: NavArea[];
  areaById: Map<number, NavArea>;
}

/**
 * Overlay format for custom navmesh modifications.
 * Loaded from /navmesh/{map}.overlay.json (optional).
 *
 * - extraAreas: new nav areas (e.g., jump/boost landing spots)
 * - extraConnections: bidirectional links between existing area IDs
 */
export interface NavMeshOverlay {
  extraAreas?: NavArea[];
  extraConnections?: [number, number][];
}

// Cache loaded nav meshes
const cache = new Map<MapName, NavMesh>();

export async function loadNavMesh(mapName: MapName): Promise<NavMesh | null> {
  if (cache.has(mapName)) return cache.get(mapName)!;

  try {
    const res = await fetch(`/navmesh/${mapName}.json`);
    if (!res.ok) return null;
    const data = await res.json() as { areas: NavArea[] };

    const areaById = new Map<number, NavArea>();
    for (const area of data.areas) {
      areaById.set(area.id, area);
    }

    // Apply overlay if available
    try {
      const overlayRes = await fetch(`/navmesh/${mapName}.overlay.json`);
      if (overlayRes.ok) {
        const overlay = await overlayRes.json() as NavMeshOverlay;
        applyOverlay(data.areas, areaById, overlay);
      }
    } catch {
      // No overlay — that's fine
    }

    const navMesh: NavMesh = { areas: data.areas, areaById };
    cache.set(mapName, navMesh);
    return navMesh;
  } catch {
    return null;
  }
}

function applyOverlay(
  areas: NavArea[],
  areaById: Map<number, NavArea>,
  overlay: NavMeshOverlay,
) {
  // Add extra areas
  if (overlay.extraAreas) {
    for (const area of overlay.extraAreas) {
      if (!areaById.has(area.id)) {
        areas.push(area);
        areaById.set(area.id, area);
      }
    }
  }

  // Add extra bidirectional connections
  if (overlay.extraConnections) {
    for (const [aId, bId] of overlay.extraConnections) {
      const aArea = areaById.get(aId);
      const bArea = areaById.get(bId);
      if (aArea && bArea) {
        if (!aArea.c.includes(bId)) aArea.c.push(bId);
        if (!bArea.c.includes(aId)) bArea.c.push(aId);
      }
    }
  }
}

// Find the nearest nav area to a normalized position
export function findNearestArea(navMesh: NavMesh, pos: Position): NavArea | null {
  let best: NavArea | null = null;
  let bestDist = Infinity;

  for (const area of navMesh.areas) {
    const dx = area.cx - pos.x;
    const dy = area.cy - pos.y;
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = area;
    }
  }

  return best;
}

// A* pathfinding between two normalized positions
// Returns array of normalized positions along the path
export function findPath(navMesh: NavMesh, from: Position, to: Position): Position[] {
  const startArea = findNearestArea(navMesh, from);
  const endArea = findNearestArea(navMesh, to);
  if (!startArea || !endArea) return [from, to];
  if (startArea.id === endArea.id) return [from, to];

  // A* over nav area graph
  const openSet = new Set<number>([startArea.id]);
  const cameFrom = new Map<number, number>();
  const gScore = new Map<number, number>();
  const fScore = new Map<number, number>();

  gScore.set(startArea.id, 0);
  fScore.set(startArea.id, heuristic(startArea, endArea));

  while (openSet.size > 0) {
    // Find node in openSet with lowest fScore
    let currentId = -1;
    let currentF = Infinity;
    for (const id of openSet) {
      const f = fScore.get(id) ?? Infinity;
      if (f < currentF) {
        currentF = f;
        currentId = id;
      }
    }

    if (currentId === endArea.id) {
      // Reconstruct path
      return reconstructPath(navMesh, cameFrom, currentId, from, to);
    }

    openSet.delete(currentId);
    const current = navMesh.areaById.get(currentId);
    if (!current) break;

    for (const neighborId of current.c) {
      const neighbor = navMesh.areaById.get(neighborId);
      if (!neighbor) continue;

      const tentativeG = (gScore.get(currentId) ?? Infinity) + dist(current, neighbor);

      if (tentativeG < (gScore.get(neighborId) ?? Infinity)) {
        cameFrom.set(neighborId, currentId);
        gScore.set(neighborId, tentativeG);
        fScore.set(neighborId, tentativeG + heuristic(neighbor, endArea));
        openSet.add(neighborId);
      }
    }
  }

  // No path found — return direct line
  return [from, to];
}

function heuristic(a: NavArea, b: NavArea): number {
  const dx = a.cx - b.cx;
  const dy = a.cy - b.cy;
  return Math.sqrt(dx * dx + dy * dy);
}

function dist(a: NavArea, b: NavArea): number {
  const dx = a.cx - b.cx;
  const dy = a.cy - b.cy;
  return Math.sqrt(dx * dx + dy * dy);
}

function reconstructPath(
  navMesh: NavMesh,
  cameFrom: Map<number, number>,
  endId: number,
  from: Position,
  to: Position,
): Position[] {
  const areaIds: number[] = [endId];
  let current = endId;
  while (cameFrom.has(current)) {
    current = cameFrom.get(current)!;
    areaIds.unshift(current);
  }

  // Convert area centroids to positions, with start and end points
  const raw: Position[] = [from];
  for (const id of areaIds) {
    const area = navMesh.areaById.get(id);
    if (area) {
      raw.push({ x: area.cx, y: area.cy });
    }
  }
  raw.push(to);

  return simplifyPath(raw);
}

// Ramer-Douglas-Peucker path simplification.
// Removes intermediate points that are within `epsilon` distance of the
// straight line between their neighbors, eliminating centroid zigzag.
function simplifyPath(path: Position[]): Position[] {
  if (path.length <= 2) return path;
  return rdp(path, 0.008); // ~0.8% of map — aggressive smoothing
}

function rdp(points: Position[], epsilon: number): Position[] {
  if (points.length <= 2) return points;

  // Find the point farthest from the line between first and last
  let maxDist = 0;
  let maxIdx = 0;
  const first = points[0];
  const last = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const d = pointToLineDist(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      maxIdx = i;
    }
  }

  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, maxIdx + 1), epsilon);
    const right = rdp(points.slice(maxIdx), epsilon);
    return [...left.slice(0, -1), ...right];
  }

  // All points are close to the line — keep only endpoints
  return [first, last];
}

function pointToLineDist(p: Position, a: Position, b: Position): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = p.x - a.x;
    const ey = p.y - a.y;
    return Math.sqrt(ex * ex + ey * ey);
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  const ex = p.x - projX;
  const ey = p.y - projY;
  return Math.sqrt(ex * ex + ey * ey);
}

// Interpolate along a path to generate smooth animation positions
// Returns `steps` evenly-spaced positions along the path
export function interpolatePath(path: Position[], steps: number): Position[] {
  if (path.length < 2 || steps < 2) return path;

  // Calculate total path length
  let totalLen = 0;
  const segLens: number[] = [];
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    const len = Math.sqrt(dx * dx + dy * dy);
    segLens.push(len);
    totalLen += len;
  }

  if (totalLen === 0) return [path[0]];

  const result: Position[] = [];
  for (let s = 0; s < steps; s++) {
    const t = s / (steps - 1);
    const targetDist = t * totalLen;

    let accumulated = 0;
    for (let i = 0; i < segLens.length; i++) {
      if (accumulated + segLens[i] >= targetDist) {
        const segT = (targetDist - accumulated) / segLens[i];
        result.push({
          x: path[i].x + (path[i + 1].x - path[i].x) * segT,
          y: path[i].y + (path[i + 1].y - path[i].y) * segT,
        });
        break;
      }
      accumulated += segLens[i];
      if (i === segLens.length - 1) {
        result.push(path[path.length - 1]);
      }
    }
  }

  return result;
}
