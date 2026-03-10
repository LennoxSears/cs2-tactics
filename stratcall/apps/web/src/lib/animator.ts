import type { Phase, Position, PlayerToken, UtilityMarker, Drawing } from '../types';
import type { NavMesh } from './navmesh';
import type { MapInfo } from '../maps';
import { findPath, interpolatePath } from './navmesh';

export type UtilityEffectState = 'flying' | 'landing' | 'active' | 'fading';

export interface AnimFramePlayer {
  id: string;
  side: string;
  number: number;
  role: string | null;
  position: Position;
  yaw?: number;
}

export interface AnimFrameUtility {
  id: string;
  type: string;
  position: Position;
  opacity: number;
  effectState: UtilityEffectState;
  /** 0-1 progress within the current effect state */
  effectProgress: number;
  /** Trajectory trail for flying grenades (positions from thrower to current) */
  trail: Position[] | null;
}

export interface AnimationFrame {
  time: number;
  players: AnimFramePlayer[];
  utilities: AnimFrameUtility[];
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
const LANDING_FRAMES = 18;  // 0.3s landing burst effect

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

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

/** Catmull-Rom spline interpolation between p1 and p2 */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t
  );
}

/** Smooth position along a path using Catmull-Rom spline at float index */
function samplePathSmooth(path: Position[], rawIdx: number): Position {
  if (path.length === 0) return { x: 0, y: 0 };
  if (path.length === 1) return path[0];

  const maxIdx = path.length - 1;
  rawIdx = Math.max(0, Math.min(maxIdx, rawIdx));

  const lo = Math.floor(rawIdx);
  const hi = Math.min(lo + 1, maxIdx);
  const frac = rawIdx - lo;

  if (frac < 0.001) return path[lo];

  // Catmull-Rom needs 4 control points: clamp at boundaries
  const p0 = path[Math.max(lo - 1, 0)];
  const p1 = path[lo];
  const p2 = path[hi];
  const p3 = path[Math.min(hi + 1, maxIdx)];

  return {
    x: catmullRom(p0.x, p1.x, p2.x, p3.x, frac),
    y: catmullRom(p0.y, p1.y, p2.y, p3.y, frac),
  };
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
  from: PlayerToken;
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
    return {
      totalFrames: 0,
      phaseBoundaries: [],
      getFrame: () => ({ time: 0, players: [], utilities: [], drawings: [] }),
    };
  }

  const transitions: Transition[] = [];

  for (let i = 0; i < phases.length - 1; i++) {
    const fromState = phases[i].boardState;
    const toState = phases[i + 1].boardState;
    const { moving, appearing, disappearing } = matchPlayers(fromState.players, toState.players);

    let maxPlayerFrames = 0;
    const playerAnims: PlayerAnim[] = moving.map(m => {
      const dx = m.to.position.x - m.from.position.x;
      const dy = m.to.position.y - m.from.position.y;
      const straightDist = Math.sqrt(dx * dx + dy * dy);

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
      return { from: m.from, to: m.to, path, frames };
    });

    const utilMatch = matchUtilities(fromState.utilities, toState.utilities);
    let maxUtilFrames = 0;

    const appearingUtils: UtilityAnim[] = utilMatch.appearing.map(u => {
      if (u.thrownBy != null && u.side != null) {
        // Use fromState first — the throw originates from where the player
        // was before moving, not where they end up
        const thrower = fromState.players.find(p => p.number === u.thrownBy && p.side === u.side)
          || toState.players.find(p => p.number === u.thrownBy && p.side === u.side);
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
          players: bs.players.map(p => ({ id: p.id, side: p.side, number: p.number, role: p.role, position: p.position, yaw: p.yaw })),
          utilities: bs.utilities.map(u => ({
            id: u.id, type: u.type, position: u.position, opacity: 1,
            effectState: 'active' as UtilityEffectState,
            effectProgress: 1,
            trail: null,
          })),
          drawings: bs.drawings,
        };
      }
      elapsed = holdEnd;

      if (i < phases.length - 1) {
        const trans = transitions[i];
        const transEnd = elapsed + trans.transitionFrames;

        if (f < transEnd) {
          const fi = f - elapsed; // float frame index within transition
          const t = fi / trans.transitionFrames;

          // --- Players with smooth Catmull-Rom + easing ---
          const players: AnimFramePlayer[] = [];

          for (const a of trans.playerAnims) {
            if (fi < a.frames) {
              const rawProgress = fi / a.frames;
              const easedProgress = easeInOutCubic(rawProgress);
              const rawIdx = easedProgress * (a.path.length - 1);
              const position = samplePathSmooth(a.path, rawIdx);
              // Interpolate yaw (shortest path)
              let yaw = a.to.yaw;
              if (a.from.yaw != null && a.to.yaw != null) {
                let diff = a.to.yaw - a.from.yaw;
                if (diff > 180) diff -= 360;
                if (diff < -180) diff += 360;
                yaw = a.from.yaw + diff * easedProgress;
              }
              players.push({ id: a.to.id, side: a.to.side, number: a.to.number, role: a.to.role, position, yaw });
            } else {
              players.push({ id: a.to.id, side: a.to.side, number: a.to.number, role: a.to.role, position: a.to.position, yaw: a.to.yaw });
            }
          }

          for (const p of trans.disappearingPlayers) { if (t < 0.3) players.push({ id: p.id, side: p.side, number: p.number, role: p.role, position: p.position, yaw: p.yaw }); }
          for (const p of trans.appearingPlayers) { if (t > 0.7) players.push({ id: p.id, side: p.side, number: p.number, role: p.role, position: p.position, yaw: p.yaw }); }

          // --- Utilities with effect states ---
          const utilities: AnimFrameUtility[] = [];

          for (const pu of trans.persistingUtils) {
            utilities.push({
              id: pu.to.id, type: pu.to.type, position: pu.to.position, opacity: 1,
              effectState: 'active', effectProgress: 1, trail: null,
            });
          }

          for (const du of trans.disappearingUtils) {
            const fadeProgress = Math.min(t / 0.4, 1);
            utilities.push({
              id: du.id, type: du.type, position: du.position,
              opacity: Math.max(0, 1 - fadeProgress),
              effectState: 'fading', effectProgress: fadeProgress, trail: null,
            });
          }

          for (const au of trans.appearingUtils) {
            const ut = Math.min(fi / au.frames, 1);

            if (au.isThrow) {
              const landingStart = Math.max(0, au.frames - LANDING_FRAMES);
              const curX = au.fromPos.x + (au.toPos.x - au.fromPos.x) * ut;
              const curY = au.fromPos.y + (au.toPos.y - au.fromPos.y) * ut;

              // Build trajectory trail
              const trailCount = 5;
              const trail: Position[] = [];
              for (let ti = 0; ti <= trailCount; ti++) {
                const tt = (ti / trailCount) * ut;
                trail.push({
                  x: au.fromPos.x + (au.toPos.x - au.fromPos.x) * tt,
                  y: au.fromPos.y + (au.toPos.y - au.fromPos.y) * tt,
                });
              }

              let effectState: UtilityEffectState;
              let effectProgress: number;

              if (fi >= au.frames) {
                effectState = 'active';
                effectProgress = 1;
              } else if (fi >= landingStart) {
                effectState = 'landing';
                effectProgress = (fi - landingStart) / LANDING_FRAMES;
              } else {
                effectState = 'flying';
                effectProgress = ut;
              }

              utilities.push({
                id: au.utility.id, type: au.utility.type,
                position: { x: curX, y: curY },
                opacity: Math.min(ut * 3, 1),
                effectState, effectProgress,
                trail: effectState === 'flying' ? trail : null,
              });
            } else {
              const effectState: UtilityEffectState = ut < 0.5 ? 'landing' : 'active';
              utilities.push({
                id: au.utility.id, type: au.utility.type, position: au.toPos,
                opacity: ut,
                effectState, effectProgress: ut, trail: null,
              });
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
      players: bs.players.map(p => ({ id: p.id, side: p.side, number: p.number, role: p.role, position: p.position, yaw: p.yaw })),
      utilities: bs.utilities.map(u => ({
        id: u.id, type: u.type, position: u.position, opacity: 1,
        effectState: 'active' as UtilityEffectState,
        effectProgress: 1,
        trail: null,
      })),
      drawings: bs.drawings,
    };
  }

  return { totalFrames, phaseBoundaries, getFrame };
}
