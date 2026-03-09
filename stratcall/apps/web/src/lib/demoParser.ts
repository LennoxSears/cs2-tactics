import type { MapName, Position } from '../types';
import { maps, worldToPixel } from '../maps';
import type { MapInfo } from '../maps';

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

export interface DemoUtilityEvent {
  type: 'smoke' | 'flash' | 'molotov' | 'he' | 'decoy';
  position: Position;       // pixel coords
  worldPos: { x: number; y: number }; // world coords (for reference)
  tick: number;             // activation tick
  durationTicks: number;    // how long it lasts
  throwerName: string;
}

export interface DemoTick {
  tick: number;
  players: DemoPlayer[];
}

export interface DemoRound {
  roundNum: number;
  startTick: number;
  freezeEndTick: number;
  endTick: number;
  timelimit: number; // round time in seconds (e.g. 115 = 1:55)
}

export interface DemoData {
  mapName: MapName | null;
  tickRate: number;
  rounds: DemoRound[];
  ticks: DemoTick[];
  utilityEvents: DemoUtilityEvent[];
  totalTicks: number;
}

// ── Desktop detection ──

declare global {
  interface Window {
    __STRATCALL_DESKTOP__?: boolean;
    __parseDemoFile__?: (filePath: string) => Promise<any>;
    __pickDemoFile__?: () => Promise<string | null>;
  }
}

export function isDesktop(): boolean {
  return !!window.__STRATCALL_DESKTOP__;
}

// ── Parsing (desktop only, via local binary) ──

function detectMap(mapStr: string): MapName | null {
  const lower = mapStr.toLowerCase();
  for (const m of maps) {
    if (lower.includes(m.name)) return m.name;
  }
  return null;
}

export async function pickAndParseDemoFile(
  onProgress?: (msg: string) => void,
): Promise<DemoData> {
  if (!window.__pickDemoFile__ || !window.__parseDemoFile__) {
    throw new Error('Demo parsing is only available in the desktop app');
  }

  onProgress?.('Select a demo file...');
  const filePath = await window.__pickDemoFile__();
  if (!filePath) {
    throw new Error('No file selected');
  }

  onProgress?.('Parsing demo file...');
  const data = await window.__parseDemoFile__(filePath);

  onProgress?.('Processing results...');
  const mapName = detectMap(data.mapName || '');
  const mapInfo = mapName ? maps.find(m => m.name === mapName) : null;

  // Build tick map from raw tick data
  const tickMap = new Map<number, DemoTick>();

  if (Array.isArray(data.tickData)) {
    for (const row of data.tickData) {
      const tick = row.tick;
      if (tick == null) continue;

      if (!tickMap.has(tick)) {
        tickMap.set(tick, { tick, players: [] });
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

  // Process utility events — convert world coords to pixel coords
  const utilityEvents: DemoUtilityEvent[] = [];
  if (Array.isArray(data.utilityEvents) && mapInfo) {
    for (const u of data.utilityEvents) {
      const pos = worldToPixel(mapInfo, u.x ?? 0, u.y ?? 0);
      utilityEvents.push({
        type: u.type as DemoUtilityEvent['type'],
        position: pos,
        worldPos: { x: u.x ?? 0, y: u.y ?? 0 },
        tick: u.tick ?? 0,
        durationTicks: u.durationTicks ?? 0,
        throwerName: u.thrower || '',
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
    utilityEvents,
    totalTicks,
  };
}

// ── Convert demo tick to BoardState ──

/** Get utilities active at a given tick */
export function getActiveUtilities(
  utilityEvents: DemoUtilityEvent[],
  currentTick: number,
): DemoUtilityEvent[] {
  return utilityEvents.filter(u =>
    currentTick >= u.tick && currentTick <= u.tick + u.durationTicks
  );
}

export function demoTickToBoardState(
  tick: DemoTick,
  _mapInfo: MapInfo,
  activeUtilities?: DemoUtilityEvent[],
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

  const utilities = (activeUtilities || []).map((u, i) => ({
    id: `util-${u.tick}-${i}`,
    type: u.type,
    position: u.position,
    thrownBy: null,
    side: null,
    label: u.throwerName,
  }));

  return { players, utilities, drawings: [] };
}
