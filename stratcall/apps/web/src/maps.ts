import type { MapName } from './types';

export interface MapInfo {
  name: MapName;
  displayName: string;
  // CS2 world coordinate metadata (from awpy/Valve VDF files)
  pos_x: number;
  pos_y: number;
  scale: number;
  radarSize: number; // native radar image size in pixels
  hasNavMesh: boolean;
}

export const maps: MapInfo[] = [
  { name: 'mirage', displayName: 'Mirage', pos_x: -3230, pos_y: 1713, scale: 5.0, radarSize: 1024, hasNavMesh: true },
  { name: 'inferno', displayName: 'Inferno', pos_x: -2087, pos_y: 3870, scale: 4.9, radarSize: 1024, hasNavMesh: true },
  { name: 'dust2', displayName: 'Dust II', pos_x: -2476, pos_y: 3239, scale: 4.4, radarSize: 1024, hasNavMesh: true },
  { name: 'train', displayName: 'Train', pos_x: -2308, pos_y: 2078, scale: 4.082077, radarSize: 1024, hasNavMesh: true },
  { name: 'nuke', displayName: 'Nuke', pos_x: -3453, pos_y: 2887, scale: 7.0, radarSize: 1024, hasNavMesh: true },
  { name: 'overpass', displayName: 'Overpass', pos_x: -4831, pos_y: 1781, scale: 5.2, radarSize: 1024, hasNavMesh: true },
  { name: 'ancient', displayName: 'Ancient', pos_x: -2953, pos_y: 2164, scale: 5.0, radarSize: 1024, hasNavMesh: true },
  { name: 'vertigo', displayName: 'Vertigo', pos_x: -3168, pos_y: 1762, scale: 4.0, radarSize: 1024, hasNavMesh: true },
  { name: 'anubis', displayName: 'Anubis', pos_x: -2796, pos_y: 3328, scale: 5.22, radarSize: 1024, hasNavMesh: true },
  // Legacy maps — no official CS2 radar/navmesh
  { name: 'cache', displayName: 'Cache', pos_x: -2000, pos_y: 3250, scale: 5.5, radarSize: 1024, hasNavMesh: false },
  { name: 'cobblestone', displayName: 'Cobblestone', pos_x: -3840, pos_y: 3072, scale: 6.0, radarSize: 1024, hasNavMesh: false },
];

export function getMapInfo(name: MapName): MapInfo {
  return maps.find(m => m.name === name)!;
}

// Convert normalized position (0-1) to CS2 world coordinates
export function pixelToWorld(map: MapInfo, nx: number, ny: number): { x: number; y: number } {
  const px = nx * map.radarSize;
  const py = ny * map.radarSize;
  return {
    x: px * map.scale + map.pos_x,
    y: map.pos_y - py * map.scale,
  };
}

// Convert CS2 world coordinates to normalized position (0-1)
export function worldToPixel(map: MapInfo, wx: number, wy: number): { x: number; y: number } {
  return {
    x: (wx - map.pos_x) / map.scale / map.radarSize,
    y: (map.pos_y - wy) / map.scale / map.radarSize,
  };
}
