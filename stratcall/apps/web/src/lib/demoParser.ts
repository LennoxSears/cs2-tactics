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
  yaw: number;        // facing direction in degrees (CS2: 0=east, 90=north)
}

export interface DemoUtilityEvent {
  type: 'smoke' | 'flash' | 'molotov' | 'he' | 'decoy';
  position: Position;       // pixel coords (landing)
  worldPos: { x: number; y: number }; // world coords
  tick: number;             // detonation tick
  throwTick?: number;       // exact tick when grenade was thrown
  durationTicks: number;    // how long the effect lasts
  throwerName: string;
  throwerSteamId: string;
  throwOrigin?: Position;   // pixel coords of thrower at throw time
}

export type BombEventType =
  | 'plant_begin' | 'plant_fake' | 'planted'
  | 'defuse_begin' | 'defuse_fake' | 'defused'
  | 'exploded' | 'dropped' | 'pickup';

export interface DemoBombEvent {
  type: BombEventType;
  tick: number;
  playerName: string;
  playerSteamId: string;
  site: number;           // 0 = unknown, site entity index
  position?: Position;    // pixel coords (for plant/defuse/drop)
  hasKit?: boolean;
}

export interface DemoKillEvent {
  tick: number;
  victimName: string;
  victimSteamId: string;
  victimPos: Position;      // pixel coords
  attackerName: string;
  attackerSteamId: string;
  attackerPos: Position;    // pixel coords
  weapon: string;
  headshot: boolean;
  assisterName?: string;
  assisterSteamId?: string;
  assisterPos?: Position;   // pixel coords
}

export interface DemoGunFireEvent {
  tick: number;
  playerSteamId: string;
  position: Position;     // pixel coords
  yaw: number;            // degrees, CS2 convention
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
  bombEvents: DemoBombEvent[];
  killEvents: DemoKillEvent[];
  gunFireEvents: DemoGunFireEvent[];
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
        yaw: row.yaw ?? 0,
      });
    }
  }

  const ticks = Array.from(tickMap.values()).sort((a, b) => a.tick - b.tick);

  // Process utility events — convert world coords to pixel coords
  const utilityEvents: DemoUtilityEvent[] = [];
  if (Array.isArray(data.utilityEvents) && mapInfo) {
    for (const u of data.utilityEvents) {
      const pos = worldToPixel(mapInfo, u.x ?? 0, u.y ?? 0);

      // Use exact throw origin from weapon_fire event if available
      let throwOrigin: Position | undefined;
      if (u.throwX != null && u.throwY != null) {
        throwOrigin = worldToPixel(mapInfo, u.throwX, u.throwY);
      }

      utilityEvents.push({
        type: u.type as DemoUtilityEvent['type'],
        position: pos,
        worldPos: { x: u.x ?? 0, y: u.y ?? 0 },
        tick: u.tick ?? 0,
        throwTick: u.throwTick ?? undefined,
        durationTicks: u.durationTicks ?? 0,
        throwerName: u.thrower || '',
        throwerSteamId: u.steamid || '',
        throwOrigin,
      });
    }
  }

  // Process bomb events
  const bombEvents: DemoBombEvent[] = [];
  if (Array.isArray(data.bombEvents) && mapInfo) {
    for (const b of data.bombEvents) {
      const pos = (b.x && b.y) ? worldToPixel(mapInfo, b.x, b.y) : undefined;
      bombEvents.push({
        type: b.type as BombEventType,
        tick: b.tick ?? 0,
        playerName: b.player || '',
        playerSteamId: b.steamid || '',
        site: b.site ?? 0,
        position: pos,
        hasKit: b.hasKit ?? false,
      });
    }
  }

  // Process kill events
  const killEvents: DemoKillEvent[] = [];
  if (Array.isArray(data.killEvents) && mapInfo) {
    for (const k of data.killEvents) {
      const kill: DemoKillEvent = {
        tick: k.tick ?? 0,
        victimName: k.victimName || '',
        victimSteamId: k.victimSteamid || '',
        victimPos: worldToPixel(mapInfo, k.victimX ?? 0, k.victimY ?? 0),
        attackerName: k.attackerName || '',
        attackerSteamId: k.attackerSteamid || '',
        attackerPos: worldToPixel(mapInfo, k.attackerX ?? 0, k.attackerY ?? 0),
        weapon: k.weapon || '',
        headshot: k.headshot ?? false,
      };
      if (k.assisterName) {
        kill.assisterName = k.assisterName;
        kill.assisterSteamId = k.assisterSteamid || '';
        if (k.assisterX != null && k.assisterY != null) {
          kill.assisterPos = worldToPixel(mapInfo, k.assisterX, k.assisterY);
        }
      }
      killEvents.push(kill);
    }
  }

  // Process gun fire events
  const gunFireEvents: DemoGunFireEvent[] = [];
  if (Array.isArray(data.gunFireEvents) && mapInfo) {
    for (const f of data.gunFireEvents) {
      gunFireEvents.push({
        tick: f.tick ?? 0,
        playerSteamId: f.steamid || '',
        position: worldToPixel(mapInfo, f.x ?? 0, f.y ?? 0),
        yaw: f.yaw ?? 0,
      });
    }
  }

  const totalTicks = ticks.length > 0 ? ticks[ticks.length - 1].tick : 0;

  onProgress?.('Done');

  return {
    mapName,
    tickRate: data.tickRate || 64,
    rounds: data.rounds || [],
    ticks,
    utilityEvents,
    bombEvents,
    killEvents,
    gunFireEvents,
    totalTicks,
  };
}

// ── Convert demo tick to BoardState ──

const FLIGHT_TICKS = 96; // ~1.5s at 64 tick

export interface ActiveUtility {
  event: DemoUtilityEvent;
  state: 'flying' | 'landing' | 'active';
  /** 0..1 progress through current state */
  progress: number;
  /** Current interpolated position (for flying state) */
  currentPos: Position;
}

/** Get utilities visible at a given tick (flying, landing, or active) */
export function getActiveUtilities(
  utilityEvents: DemoUtilityEvent[],
  currentTick: number,
): ActiveUtility[] {
  const result: ActiveUtility[] = [];
  const LANDING_TICKS = 8; // brief landing animation

  for (const u of utilityEvents) {
    // Use exact throwTick if available, otherwise estimate
    const flightStart = u.throwTick ?? (u.tick - FLIGHT_TICKS);
    const flightDuration = u.tick - flightStart;
    const effectEnd = u.tick + u.durationTicks;

    if (currentTick < flightStart || currentTick > effectEnd) continue;

    if (currentTick < u.tick - LANDING_TICKS) {
      // Flying phase
      const totalFlight = Math.max(1, flightDuration - LANDING_TICKS);
      const elapsed = currentTick - flightStart;
      const progress = Math.min(1, Math.max(0, elapsed / totalFlight));
      const origin = u.throwOrigin || u.position;
      result.push({
        event: u,
        state: 'flying',
        progress,
        currentPos: {
          x: origin.x + (u.position.x - origin.x) * progress,
          y: origin.y + (u.position.y - origin.y) * progress,
        },
      });
    } else if (currentTick < u.tick) {
      // Landing phase
      const progress = (currentTick - (u.tick - LANDING_TICKS)) / LANDING_TICKS;
      result.push({
        event: u,
        state: 'landing',
        progress: Math.min(1, Math.max(0, progress)),
        currentPos: u.position,
      });
    } else {
      // Active effect phase
      const progress = u.durationTicks > 0
        ? Math.min(1, (currentTick - u.tick) / u.durationTicks)
        : 1;
      result.push({
        event: u,
        state: 'active',
        progress,
        currentPos: u.position,
      });
    }
  }

  return result;
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
