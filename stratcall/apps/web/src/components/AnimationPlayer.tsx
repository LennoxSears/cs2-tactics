import { useState, useEffect, useRef, useCallback } from 'react';
import type { Phase, MapName } from '../types';
import type { AnimationTimeline } from '../lib/animator';
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
import { drawPlayerDirectional, drawUtility, drawDrawings } from '../lib/canvasRenderer';

interface Props {
  mapName: MapName;
  phases: Phase[];
  onClose: () => void;
}

const SPEEDS = [0.5, 1, 1.5, 2];

export default function AnimationPlayer({ mapName, phases, onClose }: Props) {
  const { t } = useLocale();
  const mapInfo = getMapInfo(mapName);
  const [navMesh, setNavMesh] = useState<NavMesh | null>(null);
  const [navMeshReady, setNavMeshReady] = useState(false);
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
    setNavMeshReady(false);
    loadNavMesh(mapName).then(nm => {
      setNavMesh(nm);
      setNavMeshReady(true);
    });
  }, [mapName]);

  // Build timeline only after navmesh load completes
  useEffect(() => {
    if (!navMeshReady) return;
    const tl = buildTimeline(phases, navMesh, mapInfo);
    setTimeline(tl);
    setCurrentFrame(0);
    setPlaying(tl.totalFrames > 0);
  }, [phases, navMeshReady]);

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
    drawDrawings(ctx, frame.drawings as any, size);

    // Draw utilities
    for (const u of frame.utilities) {
      drawUtility(ctx, u, size);
    }

    // Draw players — always use pin-shaped directional tokens
    for (const p of frame.players) {
      drawPlayerDirectional(ctx, p, size);
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

