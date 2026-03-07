import { useState, useEffect, useRef, useCallback } from 'react';
import type { Phase, MapName } from '../types';
import type { AnimationTimeline, AnimationFrame, AnimFramePlayer, AnimFrameUtility } from '../lib/animator';
import type { NavMesh } from '../lib/navmesh';
import { buildTimeline } from '../lib/animator';
import { loadNavMesh } from '../lib/navmesh';
import { getMapInfo } from '../maps';
import { mapImages } from '../assets/mapImages';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlay, faPause, faBackwardStep, faForwardStep,
  faRotateRight, faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { useLocale } from '../lib/i18n';

interface Props {
  mapName: MapName;
  phases: Phase[];
  onClose: () => void;
}

// ── Color constants ──

const CT_COLOR = '#4a9eff';
const CT_FILL = 'rgba(10, 20, 40, 0.9)';
const T_COLOR = '#ff8c00';
const T_FILL = 'rgba(40, 20, 5, 0.9)';

const UTIL_COLORS: Record<string, { fill: string; stroke: string; glow: string }> = {
  smoke:   { fill: 'rgba(136,136,136,0.5)',  stroke: '#888888', glow: 'rgba(136,136,136,0.3)' },
  flash:   { fill: 'rgba(255,255,255,0.7)',  stroke: '#ffffff', glow: 'rgba(255,255,255,0.5)' },
  molotov: { fill: 'rgba(255,68,68,0.5)',    stroke: '#ff4444', glow: 'rgba(255,100,30,0.4)' },
  he:      { fill: 'rgba(68,204,68,0.5)',    stroke: '#44cc44', glow: 'rgba(68,204,68,0.3)' },
};

const SPEEDS = [0.5, 1, 1.5, 2];

export default function AnimationPlayer({ mapName, phases, onClose }: Props) {
  const { t } = useLocale();
  const mapInfo = getMapInfo(mapName);
  const [navMesh, setNavMesh] = useState<NavMesh | null>(null);
  const [timeline, setTimeline] = useState<AnimationTimeline | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [containerSize, setContainerSize] = useState(600);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapImgRef = useRef<HTMLImageElement | null>(null);
  const [mapImgLoaded, setMapImgLoaded] = useState(false);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const prevSizeRef = useRef(0);

  // Load map image
  useEffect(() => {
    setMapImgLoaded(false);
    const img = new Image();
    img.src = mapImages[mapName];
    img.onload = () => { mapImgRef.current = img; setMapImgLoaded(true); };
  }, [mapName]);

  // Load nav mesh
  useEffect(() => {
    loadNavMesh(mapName).then(nm => setNavMesh(nm));
  }, [mapName]);

  // Build timeline
  useEffect(() => {
    const tl = buildTimeline(phases, navMesh, mapInfo);
    setTimeline(tl);
    setCurrentFrame(0);
    setPlaying(tl.totalFrames > 0);
  }, [phases, navMesh]);

  // Measure container
  useEffect(() => {
    const measure = () => {
      if (canvasAreaRef.current) {
        const rect = canvasAreaRef.current.getBoundingClientRect();
        setContainerSize(Math.floor(Math.min(rect.width, rect.height)));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (canvasAreaRef.current) observer.observe(canvasAreaRef.current);
    return () => observer.disconnect();
  }, []);

  // Animation loop
  useEffect(() => {
    if (!playing || !timeline) return;

    const speed = SPEEDS[speedIdx];
    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;
      const framesToAdvance = (delta / 1000) * 60 * speed;

      setCurrentFrame(prev => {
        let next = prev + framesToAdvance;
        if (next >= timeline.totalFrames) {
          if (loop) {
            next = 0;
          } else {
            setPlaying(false);
            return timeline.totalFrames - 1;
          }
        }
        return next;
      });

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, timeline, speedIdx, loop]);

  // ── Canvas rendering ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !timeline) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = containerSize;

    // Only resize the canvas buffer when container size changes
    if (prevSizeRef.current !== size) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      prevSizeRef.current = size;
    }

    // Clear
    ctx.clearRect(0, 0, size, size);

    // Draw map image
    if (mapImgRef.current) {
      ctx.drawImage(mapImgRef.current, 0, 0, size, size);
    }

    // Get current frame (float — no Math.floor!)
    const frame = timeline.getFrame(currentFrame);
    if (!frame) return;

    // Draw drawings (arrows, freehand)
    drawDrawings(ctx, frame, size);

    // Draw utilities
    for (const u of frame.utilities) {
      drawUtility(ctx, u, size);
    }

    // Draw players
    for (const p of frame.players) {
      drawPlayer(ctx, p, size);
    }
  }, [currentFrame, containerSize, timeline, mapImgLoaded]);

  const progress = timeline && timeline.totalFrames > 0
    ? currentFrame / timeline.totalFrames
    : 0;

  const handleScrub = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (!timeline) return;
    const val = parseFloat(e.target.value);
    setCurrentFrame(val * timeline.totalFrames);
  }, [timeline]);

  const stepBack = () => {
    if (!timeline) return;
    const boundaries = [0, ...timeline.phaseBoundaries];
    for (let i = boundaries.length - 1; i >= 0; i--) {
      if (boundaries[i] < currentFrame - 1) {
        setCurrentFrame(boundaries[i]);
        return;
      }
    }
    setCurrentFrame(0);
  };

  const stepForward = () => {
    if (!timeline) return;
    const boundaries = timeline.phaseBoundaries;
    for (const b of boundaries) {
      if (b > currentFrame + 1) {
        setCurrentFrame(b);
        return;
      }
    }
    setCurrentFrame(timeline.totalFrames - 1);
  };

  // Determine current phase index
  let currentPhaseIdx = 0;
  if (timeline) {
    for (let i = 0; i < timeline.phaseBoundaries.length; i++) {
      if (currentFrame < timeline.phaseBoundaries[i]) {
        currentPhaseIdx = i;
        break;
      }
      currentPhaseIdx = i;
    }
  }

  return (
    <div className="anim-player">
      <div className="anim-header">
        <span className="anim-title">Animation Playback</span>
        <span className="anim-phase-label">
          {phases[currentPhaseIdx]?.name || t('anim.phase', { number: currentPhaseIdx + 1 })}
        </span>
        <button className="anim-close" onClick={onClose}>
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>

      <div className="anim-canvas-area" ref={canvasAreaRef}>
        <canvas
          ref={canvasRef}
          style={{ width: containerSize, height: containerSize, borderRadius: 8 }}
        />
      </div>

      <div className="anim-controls">
        <div className="anim-buttons">
          <button className="anim-btn" onClick={stepBack} title={t('anim.prevPhase')}>
            <FontAwesomeIcon icon={faBackwardStep} />
          </button>
          <button
            className="anim-btn play-btn"
            onClick={() => {
              if (!playing && timeline && currentFrame >= timeline.totalFrames - 1) {
                setCurrentFrame(0);
              }
              setPlaying(!playing);
            }}
          >
            <FontAwesomeIcon icon={playing ? faPause : faPlay} />
          </button>
          <button className="anim-btn" onClick={stepForward} title={t('anim.nextPhase')}>
            <FontAwesomeIcon icon={faForwardStep} />
          </button>
          <button
            className={`anim-btn ${loop ? 'active' : ''}`}
            onClick={() => setLoop(!loop)}
            title={t('anim.loop')}
          >
            <FontAwesomeIcon icon={faRotateRight} />
          </button>
          <button
            className="anim-btn speed-btn"
            onClick={() => setSpeedIdx((speedIdx + 1) % SPEEDS.length)}
            title={t('anim.speed')}
          >
            {SPEEDS[speedIdx]}x
          </button>
        </div>

        <div className="anim-scrubber">
          <input
            type="range"
            min="0"
            max="1"
            step="0.001"
            value={progress}
            onChange={handleScrub}
            className="anim-slider"
          />
          <div className="anim-phase-markers">
            {timeline && timeline.phaseBoundaries.map((b, i) => (
              <div
                key={i}
                className="anim-phase-marker"
                style={{ left: `${(b / timeline.totalFrames) * 100}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Drawing helpers ──

function drawPlayer(ctx: CanvasRenderingContext2D, p: AnimFramePlayer, size: number) {
  const x = p.position.x * size;
  const y = p.position.y * size;
  const radius = size * 0.012;
  const isCT = p.side === 'ct';
  const color = isCT ? CT_COLOR : T_COLOR;
  const fill = isCT ? CT_FILL : T_FILL;

  // Outer glow
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;

  // Filled circle
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.restore();

  // Player number
  ctx.fillStyle = color;
  ctx.font = `bold ${Math.round(radius * 1.1)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(p.number), x, y);
}

function drawUtility(ctx: CanvasRenderingContext2D, u: AnimFrameUtility, size: number) {
  const x = u.position.x * size;
  const y = u.position.y * size;
  const colors = UTIL_COLORS[u.type] || UTIL_COLORS.smoke;

  ctx.save();
  ctx.globalAlpha = u.opacity;

  switch (u.effectState) {
    case 'flying':
      drawUtilityFlying(ctx, u, x, y, size, colors);
      break;
    case 'landing':
      drawUtilityLanding(ctx, u, x, y, size, colors);
      break;
    case 'active':
      drawUtilityActive(ctx, u, x, y, size, colors);
      break;
    case 'fading':
      drawUtilityActive(ctx, u, x, y, size, colors);
      break;
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawUtilityFlying(
  ctx: CanvasRenderingContext2D,
  u: AnimFrameUtility,
  x: number, y: number,
  size: number,
  colors: { fill: string; stroke: string; glow: string },
) {
  const dotRadius = size * 0.005;

  // Trajectory trail
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

  // Flying dot
  ctx.beginPath();
  ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
  ctx.fillStyle = colors.stroke;
  ctx.fill();
}

function drawUtilityLanding(
  ctx: CanvasRenderingContext2D,
  u: AnimFrameUtility,
  x: number, y: number,
  size: number,
  colors: { fill: string; stroke: string; glow: string },
) {
  const progress = u.effectProgress; // 0-1

  switch (u.type) {
    case 'smoke': {
      // Expanding smoke cloud
      const maxRadius = size * 0.035;
      const radius = maxRadius * progress;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = colors.fill;
      ctx.fill();
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      break;
    }
    case 'flash': {
      // White burst expanding then fading
      const maxRadius = size * 0.04;
      const radius = maxRadius * progress;
      const alpha = 1 - progress * 0.5;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha * 0.7})`;
      ctx.fill();
      // Bright glow
      ctx.save();
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 15 * (1 - progress);
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'he': {
      // Orange burst expanding
      const maxRadius = size * 0.03;
      const radius = maxRadius * progress;
      const alpha = 1 - progress * 0.6;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,140,0,${alpha * 0.6})`;
      ctx.fill();
      ctx.save();
      ctx.shadowColor = '#ff8c00';
      ctx.shadowBlur = 12 * (1 - progress);
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,100,0,${alpha})`;
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'molotov': {
      // Fire spreading
      const maxRadius = size * 0.025;
      const radius = maxRadius * progress;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,68,68,${0.4 + progress * 0.2})`;
      ctx.fill();
      ctx.strokeStyle = colors.stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }
  }
}

function drawUtilityActive(
  ctx: CanvasRenderingContext2D,
  u: AnimFrameUtility,
  x: number, y: number,
  size: number,
  _colors: { fill: string; stroke: string; glow: string },
) {
  switch (u.type) {
    case 'smoke': {
      const baseRadius = size * 0.035;
      ctx.beginPath();
      ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(136,136,136,0.45)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(136,136,136,0.7)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Inner haze gradient
      const grad = ctx.createRadialGradient(x, y, 0, x, y, baseRadius);
      grad.addColorStop(0, 'rgba(180,180,180,0.3)');
      grad.addColorStop(1, 'rgba(136,136,136,0)');
      ctx.beginPath();
      ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      break;
    }
    case 'flash': {
      const radius = size * 0.015;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }
    case 'he': {
      const radius = size * 0.012;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,140,0,0.25)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,100,0,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }
    case 'molotov': {
      const baseRadius = size * 0.025;
      const pulse = 0.85 + 0.15 * Math.sin(Date.now() * 0.008);
      const radius = baseRadius * pulse;

      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, 'rgba(255,200,50,0.6)');
      grad.addColorStop(0.5, 'rgba(255,100,30,0.4)');
      grad.addColorStop(1, 'rgba(255,50,10,0.15)');
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,68,68,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    }
  }
}

function drawDrawings(ctx: CanvasRenderingContext2D, frame: AnimationFrame, size: number) {
  for (const drawing of frame.drawings) {
    if (drawing.type === 'arrow') {
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
    } else if (drawing.type === 'freehand') {
      const points = drawing.points;
      if (points.length < 2) continue;

      // Dark outline
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

      // Bright line
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
