import type { MapName, Position } from '../types';
import { maps, worldToPixel } from '../maps';
import type { MapInfo } from '../maps';
import { getAuthHeaders } from './auth';

// ── Types ──

export interface DemoPlayer {
  steamId: string;
  name: string;
  team: number;       // 2 = T, 3 = CT
  side: 'ct' | 't';
  position: Position;
  health: number;
  isAlive: boolean;
}

export interface DemoGrenade {
  type: 'smoke' | 'flash' | 'molotov' | 'he' | 'decoy';
  position: Position;
  throwerName: string;
}

export interface DemoTick {
  tick: number;
  players: DemoPlayer[];
  grenades: DemoGrenade[];
}

export interface DemoRound {
  roundNum: number;
  startTick: number;
  endTick: number;
}

export interface DemoData {
  mapName: MapName | null;
  tickRate: number;
  rounds: DemoRound[];
  ticks: DemoTick[];       // sampled ticks (every Nth tick)
  totalTicks: number;
}

// ── Server-side parsing ──

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const GRENADE_MAP: Record<string, DemoGrenade['type']> = {
  smokegrenade: 'smoke',
  flashbang: 'flash',
  molotov: 'molotov',
  incgrenade: 'molotov',
  hegrenade: 'he',
  decoy: 'decoy',
};

function detectMap(mapStr: string): MapName | null {
  const lower = mapStr.toLowerCase();
  for (const m of maps) {
    if (lower.includes(m.name)) return m.name;
  }
  return null;
}

export async function parseDemo(
  buffer: ArrayBuffer,
  onProgress?: (msg: string) => void,
): Promise<DemoData> {
  onProgress?.('Uploading demo to server...');

  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
    ...getAuthHeaders(),
  };
  if (import.meta.env.DEV && !headers['Authorization']) {
    headers['X-User-Id'] = 'local-dev-user';
  }

  const res = await fetch(`${API_BASE}/demo/parse`, {
    method: 'POST',
    headers,
    body: buffer,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Server error' }));
    throw new Error(err.error || `Parse failed (${res.status})`);
  }

  onProgress?.('Processing results...');
  const data = await res.json();

  const mapName = detectMap(data.mapName || '');
  const mapInfo = mapName ? maps.find(m => m.name === mapName) : null;

  // Build tick map from raw tick data
  const tickMap = new Map<number, DemoTick>();

  if (Array.isArray(data.tickData)) {
    for (const row of data.tickData) {
      const tick = row.tick;
      if (tick == null) continue;
      if (tick % 32 !== 0) continue;

      if (!tickMap.has(tick)) {
        tickMap.set(tick, { tick, players: [], grenades: [] });
      }

      const dt = tickMap.get(tick)!;
      const teamNum = row.team_num ?? 0;
      const side: 'ct' | 't' = teamNum === 3 ? 'ct' : 't';

      const pos = mapInfo
        ? worldToPixel(mapInfo, row.X ?? 0, row.Y ?? 0)
        : { x: 0, y: 0 };

      dt.players.push({
        steamId: row.player_steamid || '',
        name: row.player_name || 'Unknown',
        team: teamNum,
        side,
        position: pos,
        health: row.health ?? 0,
        isAlive: row.is_alive ?? false,
      });
    }
  }

  // Add grenades to nearest tick
  if (Array.isArray(data.grenadeData) && mapInfo) {
    for (const g of data.grenadeData) {
      const gType = GRENADE_MAP[g.grenade_type];
      if (!gType) continue;

      const tick = g.destroy_tick ?? g.tick ?? 0;
      const snapped = Math.round(tick / 32) * 32;
      const dt = tickMap.get(snapped);
      if (!dt) continue;

      const pos = worldToPixel(mapInfo, g.entity_x ?? g.X ?? 0, g.entity_y ?? g.Y ?? 0);
      dt.grenades.push({
        type: gType,
        position: pos,
        throwerName: g.thrower_name || g.player_name || '',
      });
    }
  }

  const ticks = Array.from(tickMap.values()).sort((a, b) => a.tick - b.tick);
  const totalTicks = ticks.length > 0 ? ticks[ticks.length - 1].tick : 0;

  onProgress?.('Done');

  return {
    mapName,
    tickRate: data.tickRate || 64,
    rounds: data.rounds || [],
    ticks,
    totalTicks,
  };
}

// ── Convert demo tick to BoardState ──

export function demoTickToBoardState(
  tick: DemoTick,
  _mapInfo: MapInfo,
): {
  players: Array<{
    id: string; side: string; number: number; role: string | null;
    position: Position; label?: string;
  }>;
  utilities: Array<{
    id: string; type: string; position: Position;
    thrownBy?: number | null; side?: string | null; label?: string;
  }>;
  drawings: never[];
} {
  const ctPlayers = tick.players.filter(p => p.side === 'ct' && p.isAlive);
  const tPlayers = tick.players.filter(p => p.side === 't' && p.isAlive);

  const players = [
    ...ctPlayers.map((p, i) => ({
      id: `ct-${i + 1}`,
      side: 'ct' as const,
      number: i + 1,
      role: null,
      position: p.position,
      label: p.name,
    })),
    ...tPlayers.map((p, i) => ({
      id: `t-${i + 1}`,
      side: 't' as const,
      number: i + 1,
      role: null,
      position: p.position,
      label: p.name,
    })),
  ];

  const utilities = tick.grenades.map((g, i) => ({
    id: `util-${i}`,
    type: g.type,
    position: g.position,
    thrownBy: null,
    side: null,
    label: g.throwerName,
  }));

  return { players, utilities, drawings: [] };
}
