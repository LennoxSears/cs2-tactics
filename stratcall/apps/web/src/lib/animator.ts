import type { Phase, Position, PlayerToken, UtilityMarker, Drawing } from '../types';
import type { NavMesh } from './navmesh';
import type { MapInfo } from '../maps';
import { findPath, interpolatePath } from './navmesh';

export interface AnimationFrame {
  time: number;
  players: { id: string; side: string; number: number; role: string | null; position: Position }[];
  utilities: { id: string; type: string; position: Position; opacity: number }[];
  drawings: Drawing[];
}

export interface AnimationTimeline {
  totalFrames: number;
  phaseBoundaries: number[];
  getFrame: (frame: number) => AnimationFrame;
}

const FPS = 60;
const PLAYER_SPEED = 215;   // AK-47 running speed (units/sec)
const UTILITY_SPEED = 500;  // grenade throw speed (units/sec)
const HOLD_FRAMES = 60;     // 1s hold per phase
const MIN_TRANSITION_FRAMES = 30; // 0.5s minimum

function normalizedToWorldDist(d: number, map: MapInfo): number {
  return d * map.radarSize * map.scale;
}

function pathLen(path: Position[]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

function matchPlayers(from: PlayerToken[], to: PlayerToken[]) {
  const moving: { from: PlayerToken; to: PlayerToken }[] = [];
  const appearing: PlayerToken[] = [];
  const usedFrom = new Set<string>();

  for (const toP of to) {
    const fromP = from.find(f => f.side === toP.side && f.number === toP.number && !usedFrom.has(f.id));
    if (fromP) {
      usedFrom.add(fromP.id);
      moving.push({ from: fromP, to: toP });
    } else {
      appearing.push(toP);
    }
  }
  return { moving, appearing, disappearing: from.filter(f => !usedFrom.has(f.id)) };
}

function matchUtilities(from: UtilityMarker[], to: UtilityMarker[]) {
  const TOL = 0.02;
  const persisting: { from: UtilityMarker; to: UtilityMarker }[] = [];
  const appearing: UtilityMarker[] = [];
  const usedFrom = new Set<string>();

  for (const toU of to) {
    const fromU = from.find(f =>
      !usedFrom.has(f.id) && f.type === toU.type &&
      Math.abs(f.position.x - toU.position.x) < TOL &&
      Math.abs(f.position.y - toU.position.y) < TOL
    );
    if (fromU) { usedFrom.add(fromU.id); persisting.push({ from: fromU, to: toU }); }
    else appearing.push(toU);
  }
  return { persisting, appearing, disappearing: from.filter(f => !usedFrom.has(f.id)) };
}

interface PlayerAnim {
  to: PlayerToken;
  path: Position[];
  frames: number;
}

interface UtilityAnim {
  utility: UtilityMarker;
  fromPos: Position;
  toPos: Position;
  frames: number;
  isThrow: boolean;
}

interface Transition {
  playerAnims: PlayerAnim[];
  appearingPlayers: PlayerToken[];
  disappearingPlayers: PlayerToken[];
  persistingUtils: { from: UtilityMarker; to: UtilityMarker }[];
  appearingUtils: UtilityAnim[];
  disappearingUtils: UtilityMarker[];
  fromDrawings: Drawing[];
  toDrawings: Drawing[];
  transitionFrames: number;
}

export function buildTimeline(phases: Phase[], navMesh: NavMesh | null, map: MapInfo): AnimationTimeline {
  if (phases.length === 0) {
    return { totalFrames: 0, phaseBoundaries: [], getFrame: () => ({ time: 0, players: [], utilities: [], drawings: [] }) };
  }

  const transitions: Transition[] = [];

  for (let i = 0; i < phases.length - 1; i++) {
    const fromState = phases[i].boardState;
    const toState = phases[i + 1].boardState;
    const { moving, appearing, disappearing } = matchPlayers(fromState.players, toState.players);

    let maxPlayerFrames = 0;
    const playerAnims: PlayerAnim[] = moving.map(m => {
      // Straight-line distance in normalized coords
      const dx = m.to.position.x - m.from.position.x;
      const dy = m.to.position.y - m.from.position.y;
      const straightDist = Math.sqrt(dx * dx + dy * dy);

      // Only use nav mesh for longer moves (>15% of map) where wall avoidance matters.
      // Short moves use straight lines to avoid centroid zigzag.
      let raw: Position[];
      if (navMesh && straightDist > 0.15) {
        raw = findPath(navMesh, m.from.position, m.to.position);
      } else {
        raw = [m.from.position, m.to.position];
      }

      const nDist = pathLen(raw);
      const wDist = normalizedToWorldDist(nDist, map);
      const frames = Math.max(MIN_TRANSITION_FRAMES, Math.round((wDist / PLAYER_SPEED) * FPS));
      const path = interpolatePath(raw, frames);
      maxPlayerFrames = Math.max(maxPlayerFrames, frames);
      return { to: m.to, path, frames };
    });

    const utilMatch = matchUtilities(fromState.utilities, toState.utilities);
    let maxUtilFrames = 0;

    const appearingUtils: UtilityAnim[] = utilMatch.appearing.map(u => {
      if (u.thrownBy != null && u.side != null) {
        const thrower = toState.players.find(p => p.number === u.thrownBy && p.side === u.side)
          || fromState.players.find(p => p.number === u.thrownBy && p.side === u.side);
        if (thrower) {
          const dx = u.position.x - thrower.position.x;
          const dy = u.position.y - thrower.position.y;
          const nDist = Math.sqrt(dx * dx + dy * dy);
          const wDist = normalizedToWorldDist(nDist, map);
          const frames = Math.max(MIN_TRANSITION_FRAMES, Math.round((wDist / UTILITY_SPEED) * FPS));
          maxUtilFrames = Math.max(maxUtilFrames, frames);
          return { utility: u, fromPos: { ...thrower.position }, toPos: u.position, frames, isThrow: true };
        }
      }
      // No thrower — fade in
      const frames = 30;
      maxUtilFrames = Math.max(maxUtilFrames, frames);
      return { utility: u, fromPos: u.position, toPos: u.position, frames, isThrow: false };
    });

    const transitionFrames = Math.max(maxPlayerFrames, maxUtilFrames, MIN_TRANSITION_FRAMES);

    transitions.push({
      playerAnims, appearingPlayers: appearing, disappearingPlayers: disappearing,
      persistingUtils: utilMatch.persisting, appearingUtils, disappearingUtils: utilMatch.disappearing,
      fromDrawings: fromState.drawings, toDrawings: toState.drawings, transitionFrames,
    });
  }

  // Total frames and boundaries
  let totalFrames = HOLD_FRAMES;
  const phaseBoundaries: number[] = [HOLD_FRAMES];
  for (let i = 0; i < transitions.length; i++) {
    totalFrames += transitions[i].transitionFrames + HOLD_FRAMES;
    phaseBoundaries.push(totalFrames);
  }

  function getFrame(f: number): AnimationFrame {
    f = Math.max(0, Math.min(totalFrames - 1, f));
    let elapsed = 0;

    for (let i = 0; i < phases.length; i++) {
      const holdEnd = elapsed + HOLD_FRAMES;
      if (f < holdEnd) {
        const bs = phases[i].boardState;
        return {
          time: 0,
          players: bs.players.map(p => ({ ...p })),
          utilities: bs.utilities.map(u => ({ id: u.id, type: u.type, position: u.position, opacity: 1 })),
          drawings: bs.drawings,
        };
      }
      elapsed = holdEnd;

      if (i < phases.length - 1) {
        const trans = transitions[i];
        const transEnd = elapsed + trans.transitionFrames;

        if (f < transEnd) {
          const fi = f - elapsed; // frame index within transition
          const t = fi / trans.transitionFrames;
          const players: AnimationFrame['players'] = [];

          for (const a of trans.playerAnims) {
            if (fi < a.frames) {
              const idx = Math.min(Math.floor((fi / a.frames) * a.path.length), a.path.length - 1);
              players.push({ id: a.to.id, side: a.to.side, number: a.to.number, role: a.to.role, position: a.path[idx] });
            } else {
              players.push({ id: a.to.id, side: a.to.side, number: a.to.number, role: a.to.role, position: a.to.position });
            }
          }

          for (const p of trans.disappearingPlayers) { if (t < 0.3) players.push({ ...p }); }
          for (const p of trans.appearingPlayers) { if (t > 0.7) players.push({ ...p }); }

          const utilities: AnimationFrame['utilities'] = [];

          for (const pu of trans.persistingUtils) {
            utilities.push({ id: pu.to.id, type: pu.to.type, position: pu.to.position, opacity: 1 });
          }
          for (const du of trans.disappearingUtils) {
            utilities.push({ id: du.id, type: du.type, position: du.position, opacity: Math.max(0, 1 - t / 0.4) });
          }
          for (const au of trans.appearingUtils) {
            const ut = Math.min(fi / au.frames, 1);
            if (au.isThrow) {
              utilities.push({
                id: au.utility.id, type: au.utility.type,
                position: { x: au.fromPos.x + (au.toPos.x - au.fromPos.x) * ut, y: au.fromPos.y + (au.toPos.y - au.fromPos.y) * ut },
                opacity: Math.min(ut * 3, 1),
              });
            } else {
              utilities.push({ id: au.utility.id, type: au.utility.type, position: au.toPos, opacity: ut });
            }
          }

          return { time: t, players, utilities, drawings: t < 0.5 ? trans.fromDrawings : trans.toDrawings };
        }
        elapsed = transEnd;
      }
    }

    const bs = phases[phases.length - 1].boardState;
    return {
      time: 1,
      players: bs.players.map(p => ({ ...p })),
      utilities: bs.utilities.map(u => ({ id: u.id, type: u.type, position: u.position, opacity: 1 })),
      drawings: bs.drawings,
    };
  }

  return { totalFrames, phaseBoundaries, getFrame };
}
