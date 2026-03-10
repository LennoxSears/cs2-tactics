/**
 * Shared canvas drawing functions for player tokens, utility effects,
 * and drawings. Used by both AnimationPlayer and DemoPlayer.
 */

import type { Position } from '../types';
import { getUtilitySprite, getRasterizedSprite } from '../assets/utilitySprites';

// ── Color constants ──

export const CT_COLOR = '#4a9eff';
export const CT_FILL = 'rgba(10, 20, 40, 0.9)';
export const T_COLOR = '#ff8c00';
export const T_FILL = 'rgba(40, 20, 5, 0.9)';

export const UTIL_COLORS: Record<string, { fill: string; stroke: string; glow: string }> = {
  smoke:   { fill: 'rgba(136,136,136,0.5)',  stroke: '#888888', glow: 'rgba(136,136,136,0.3)' },
  flash:   { fill: 'rgba(255,255,255,0.7)',  stroke: '#ffffff', glow: 'rgba(255,255,255,0.5)' },
  molotov: { fill: 'rgba(255,68,68,0.5)',    stroke: '#ff4444', glow: 'rgba(255,100,30,0.4)' },
  he:      { fill: 'rgba(68,204,68,0.5)',    stroke: '#44cc44', glow: 'rgba(68,204,68,0.3)' },
};

// ── Player drawing ──

export interface DrawablePlayer {
  side: string;
  number: number;
  position: Position;
  label?: string;
  yaw?: number;  // facing direction in degrees (CS2: 0=east, 90=north)
}

export function drawPlayer(ctx: CanvasRenderingContext2D, p: DrawablePlayer, size: number) {
  const x = p.position.x * size;
  const y = p.position.y * size;
  const radius = size * 0.012;
  const isCT = p.side === 'ct';
  const color = isCT ? CT_COLOR : T_COLOR;
  const fill = isCT ? CT_FILL : T_FILL;

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.restore();

  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(radius * 1.1)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(p.number), x, y);
}

/** Draw a map-pin shaped directional player token.
 *  Round head with a smooth taper to a pointed tip (facing direction). */
export function drawPlayerDirectional(
  ctx: CanvasRenderingContext2D,
  p: DrawablePlayer,
  size: number,
) {
  const x = p.position.x * size;
  const y = p.position.y * size;
  const r = size * 0.011;
  const isCT = p.side === 'ct';
  const color = isCT ? CT_COLOR : T_COLOR;
  const fill = isCT ? CT_FILL : T_FILL;

  // CS2 yaw: 0=east, 90=north. Canvas: 0=right, positive=clockwise.
  const angle = -(p.yaw ?? 0) * (Math.PI / 180);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  ctx.shadowColor = color;
  ctx.shadowBlur = 6;

  // Pin shape: tip points RIGHT (+x). Circle head + two bezier curves to tip.
  const tipX = r * 2.2;
  const gapHalf = Math.PI * 0.42; // ~75° half-gap → ~210° arc for the head

  ctx.beginPath();
  // Round head: arc from bottom-right edge, around the back, to top-right edge
  ctx.arc(0, 0, r, gapHalf, -gapHalf, true);
  // Top curve to tip
  ctx.bezierCurveTo(r * 0.95, -r * 0.35, tipX * 0.55, -r * 0.1, tipX, 0);
  // Bottom curve back from tip
  ctx.bezierCurveTo(tipX * 0.55, r * 0.1, r * 0.95, r * 0.35, r * Math.cos(gapHalf), r * Math.sin(gapHalf));
  ctx.closePath();

  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.shadowBlur = 0;

  // Player number (upright text centered in the round head)
  ctx.rotate(-angle);
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(r * 1.1)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(p.number), 0, 0);

  ctx.restore();
}

// ── Utility drawing ──

export interface DrawableUtility {
  type: string;
  position: Position;
  opacity?: number;
  effectState?: 'flying' | 'landing' | 'active' | 'fading';
  effectProgress?: number;
  trail?: Position[] | null;
}

export function drawUtility(ctx: CanvasRenderingContext2D, u: DrawableUtility, size: number) {
  const x = u.position.x * size;
  const y = u.position.y * size;
  const colors = UTIL_COLORS[u.type] || UTIL_COLORS.smoke;
  const state = u.effectState || 'active';

  ctx.save();
  ctx.globalAlpha = u.opacity ?? 1;

  switch (state) {
    case 'flying':
      drawUtilityFlying(ctx, u, x, y, size, colors);
      break;
    case 'landing':
      drawUtilityLanding(ctx, u, x, y, size);
      break;
    case 'active':
    case 'fading':
      drawUtilityActive(ctx, u, x, y, size);
      break;
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawUtilityFlying(
  ctx: CanvasRenderingContext2D,
  u: DrawableUtility,
  x: number, y: number,
  size: number,
  colors: { fill: string; stroke: string; glow: string },
) {
  const dotRadius = size * 0.005;

  if (u.trail && u.trail.length > 1) {
    ctx.beginPath();
    ctx.moveTo(u.trail[0].x * size, u.trail[0].y * size);
    for (let i = 1; i < u.trail.length; i++) {
      ctx.lineTo(u.trail[i].x * size, u.trail[i].y * size);
    }
    ctx.strokeStyle = colors.stroke;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.beginPath();
  ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle = colors.stroke;
  ctx.fill();
}

const _landingDebugDone = new Set<string>();

function drawUtilityLanding(
  ctx: CanvasRenderingContext2D,
  u: DrawableUtility,
  x: number, y: number,
  size: number,
) {
  const progress = u.effectProgress ?? 0;
  if (progress < 0.01) return;

  const spriteSize = getSpriteSize(u.type, size) * progress;
  const raster = getRasterizedSprite(u.type);
  const sprite = raster || getUtilitySprite(u.type);

  // Debug: log once per type to help diagnose grey circle issue
  if (!_landingDebugDone.has(u.type)) {
    _landingDebugDone.add(u.type);
    const svgSprite = getUtilitySprite(u.type) as HTMLImageElement | null;
    console.log(`[SPRITE DEBUG] type=${u.type} raster=${!!raster} rasterSize=${raster?.width ?? 'N/A'}x${raster?.height ?? 'N/A'} svgComplete=${svgSprite?.complete} svgNatW=${svgSprite?.naturalWidth} spriteSize=${spriteSize.toFixed(1)} progress=${progress.toFixed(3)} usingRaster=${!!raster} fallback=${!sprite || (!raster && !(svgSprite?.complete && (svgSprite?.naturalWidth ?? 0) > 0))}`);
  }

  if (sprite && (raster || (sprite as HTMLImageElement).complete && (sprite as HTMLImageElement).naturalWidth > 0)) {
    ctx.save();
    ctx.globalAlpha = Math.min(progress * 2, 1) * (ctx.globalAlpha || 1);
    ctx.drawImage(sprite, x - spriteSize / 2, y - spriteSize / 2, spriteSize, spriteSize);
    ctx.restore();
  } else {
    ctx.beginPath();
    ctx.arc(x, y, spriteSize / 2, 0, Math.PI * 2);
    const colors: Record<string, string> = {
      smoke: `rgba(180,180,180,${progress * 0.5})`,
      flash: `rgba(255,255,200,${progress * 0.5})`,
      molotov: `rgba(255,120,20,${progress * 0.4})`,
      he: `rgba(255,240,100,${progress * 0.5})`,
    };
    ctx.fillStyle = colors[u.type] || `rgba(200,200,200,${progress * 0.5})`;
    ctx.fill();
  }
}

function drawUtilityActive(
  ctx: CanvasRenderingContext2D,
  u: DrawableUtility,
  x: number, y: number,
  size: number,
) {
  const spriteSize = getSpriteSize(u.type, size);
  const raster = getRasterizedSprite(u.type);
  const sprite = raster || getUtilitySprite(u.type);

  const scale = u.type === 'molotov'
    ? 0.9 + 0.1 * Math.sin(Date.now() * 0.008)
    : 1;
  const drawSize = spriteSize * scale;

  if (sprite && (raster || (sprite as HTMLImageElement).complete && (sprite as HTMLImageElement).naturalWidth > 0)) {
    ctx.drawImage(sprite, x - drawSize / 2, y - drawSize / 2, drawSize, drawSize);
  } else {
    // Fallback: type-colored circle while sprite loads
    ctx.beginPath();
    ctx.arc(x, y, drawSize / 2, 0, Math.PI * 2);
    const colors: Record<string, string> = {
      smoke: 'rgba(180,180,180,0.5)',
      flash: 'rgba(255,255,200,0.5)',
      molotov: 'rgba(255,120,20,0.4)',
      he: 'rgba(255,240,100,0.5)',
    };
    ctx.fillStyle = colors[u.type] || 'rgba(200,200,200,0.4)';
    ctx.fill();
  }
}

export function getSpriteSize(type: string, canvasSize: number): number {
  switch (type) {
    case 'smoke': return canvasSize * 0.07;
    case 'flash': return canvasSize * 0.05;
    case 'molotov': return canvasSize * 0.055;
    case 'he': return canvasSize * 0.05;
    default: return canvasSize * 0.04;
  }
}

// ── Drawing (arrows, freehand) ──

export interface DrawableDrawing {
  type: string;
  color: string;
  start?: Position;
  end?: Position;
  points?: Position[];
}

export function drawDrawings(ctx: CanvasRenderingContext2D, drawings: DrawableDrawing[], size: number) {
  for (const drawing of drawings) {
    if (drawing.type === 'arrow' && drawing.start && drawing.end) {
      const x1 = drawing.start.x * size;
      const y1 = drawing.start.y * size;
      const x2 = drawing.end.x * size;
      const y2 = drawing.end.y * size;
      const headLen = 14;
      const angle = Math.atan2(y2 - y1, x2 - x1);

      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - headLen * Math.cos(angle - Math.PI / 6),
        y2 - headLen * Math.sin(angle - Math.PI / 6),
      );
      ctx.moveTo(x2, y2);
      ctx.lineTo(
        x2 - headLen * Math.cos(angle + Math.PI / 6),
        y2 - headLen * Math.sin(angle + Math.PI / 6),
      );
      ctx.stroke();
    } else if (drawing.type === 'freehand' && drawing.points && drawing.points.length >= 2) {
      const points = drawing.points;

      ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(points[0].x * size, points[0].y * size);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * size, points[i].y * size);
      }
      ctx.stroke();

      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(points[0].x * size, points[0].y * size);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x * size, points[i].y * size);
      }
      ctx.stroke();
    }
  }
}
