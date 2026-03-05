import { useState, useEffect, useRef, useCallback } from 'react';
import type { Phase, MapName } from '../types';
import type { AnimationTimeline, AnimationFrame } from '../lib/animator';
import type { NavMesh } from '../lib/navmesh';
import { buildTimeline } from '../lib/animator';
import { loadNavMesh } from '../lib/navmesh';
import { getMapInfo } from '../maps';
import { mapImages } from '../assets/mapImages';
import DrawingCanvas from './DrawingCanvas';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlay, faPause, faBackwardStep, faForwardStep,
  faRotateRight, faCloud, faBolt, faFire, faBomb, faXmark,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

interface Props {
  mapName: MapName;
  phases: Phase[];
  onClose: () => void;
}

const utilityFA: Record<string, IconDefinition> = {
  smoke: faCloud, flash: faBolt, molotov: faFire, he: faBomb,
};

const SPEEDS = [0.5, 1, 1.5, 2];

export default function AnimationPlayer({ mapName, phases, onClose }: Props) {
  const mapInfo = getMapInfo(mapName);
  const [navMesh, setNavMesh] = useState<NavMesh | null>(null);
  const [timeline, setTimeline] = useState<AnimationTimeline | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(1); // index into SPEEDS
  const [containerSize, setContainerSize] = useState(600);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Load nav mesh
  useEffect(() => {
    loadNavMesh(mapName).then(nm => setNavMesh(nm));
  }, [mapName]);

  // Build timeline when phases or navmesh change — auto-play from start
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

      // Advance by delta ms worth of frames (60fps base)
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

  const frame: AnimationFrame | null = timeline
    ? timeline.getFrame(Math.floor(currentFrame))
    : null;

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
    // Jump to previous phase boundary
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

  // Determine current phase index for display
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
          {phases[currentPhaseIdx]?.name || `Phase ${currentPhaseIdx + 1}`}
        </span>
        <button className="anim-close" onClick={onClose}>
          <FontAwesomeIcon icon={faXmark} />
        </button>
      </div>

      <div className="anim-canvas-area" ref={canvasAreaRef}>
        <div
          className="map-container"
          ref={containerRef}
          style={{ width: containerSize, height: containerSize }}
        >
          <img
            src={mapImages[mapName]}
            alt={mapInfo.displayName}
            className="map-image"
            draggable={false}
          />
          {frame && (
            <>
              <DrawingCanvas
                drawings={frame.drawings}
                width={containerSize}
                height={containerSize}
              />
              {frame.players.map(p => (
                <div
                  key={`${p.side}-${p.number}`}
                  className={`player-token ${p.side} anim-token`}
                  style={{
                    left: `${p.position.x * 100}%`,
                    top: `${p.position.y * 100}%`,
                  }}
                >
                  {p.number}
                </div>
              ))}
              {frame.utilities.map((u, i) => (
                <div
                  key={`util-${i}`}
                  className={`utility-marker ${u.type}`}
                  style={{
                    left: `${u.position.x * 100}%`,
                    top: `${u.position.y * 100}%`,
                    opacity: u.opacity,
                  }}
                >
                  <FontAwesomeIcon icon={utilityFA[u.type] || faCloud} />
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      <div className="anim-controls">
        <div className="anim-buttons">
          <button className="anim-btn" onClick={stepBack} title="Previous phase">
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
          <button className="anim-btn" onClick={stepForward} title="Next phase">
            <FontAwesomeIcon icon={faForwardStep} />
          </button>
          <button
            className={`anim-btn ${loop ? 'active' : ''}`}
            onClick={() => setLoop(!loop)}
            title="Loop"
          >
            <FontAwesomeIcon icon={faRotateRight} />
          </button>
          <button
            className="anim-btn speed-btn"
            onClick={() => setSpeedIdx((speedIdx + 1) % SPEEDS.length)}
            title="Speed"
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
