import { useState, useEffect, useRef, useCallback } from 'react';
import type { DemoData, DemoTick } from '../lib/demoParser';
import { pickAndParseDemoFile, demoTickToBoardState } from '../lib/demoParser';
import { drawPlayer, drawUtility } from '../lib/canvasRenderer';
import { getMapInfo } from '../maps';
import { mapImages } from '../assets/mapImages';
import { api } from '../lib/api';
import { exportPhasesToFile } from '../lib/phaseIO';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlay, faPause, faCamera, faDownload,
  faPlus, faTrash, faXmark,
} from '@fortawesome/free-solid-svg-icons';

const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4];

export default function DemoPlayer() {
  const [demoData, setDemoData] = useState<DemoData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState('');
  const [error, setError] = useState('');

  // Playback state
  const [currentTickIdx, setCurrentTickIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speedIdx, setSpeedIdx] = useState(2); // 1x
  const [selectedRound, setSelectedRound] = useState(0);

  // Captured phases
  const [captured, setCaptured] = useState<Array<{ name: string; tick: number; boardState: any }>>([]);

  // Canvas
  const [containerSize, setContainerSize] = useState(600);
  const canvasAreaRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mapImgRef = useRef<HTMLImageElement | null>(null);
  const [mapImgLoaded, setMapImgLoaded] = useState(false);
  const prevSizeRef = useRef(0);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  const mapName = demoData?.mapName;
  const mapInfo = mapName ? getMapInfo(mapName) : null;

  // Get ticks for current round
  const roundTicks = useCallback(() => {
    if (!demoData) return [];
    if (demoData.rounds.length === 0) return demoData.ticks;
    const round = demoData.rounds[selectedRound];
    if (!round) return demoData.ticks;
    return demoData.ticks.filter(t => t.tick >= round.startTick && t.tick <= round.endTick);
  }, [demoData, selectedRound]);

  const ticks = roundTicks();
  const currentTick: DemoTick | null = ticks[Math.floor(currentTickIdx)] || null;

  // Load map image when map detected
  useEffect(() => {
    if (!mapName) return;
    setMapImgLoaded(false);
    const img = new Image();
    img.src = mapImages[mapName];
    img.onload = () => { mapImgRef.current = img; setMapImgLoaded(true); };
  }, [mapName]);

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
    if (!playing || ticks.length === 0) return;

    const speed = SPEEDS[speedIdx];
    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;
      // Advance by speed * delta, scaled to ~32 ticks per second (sample rate)
      const advance = (delta / 1000) * 32 * speed;

      setCurrentTickIdx(prev => {
        let next = prev + advance;
        if (next >= ticks.length) {
          setPlaying(false);
          return ticks.length - 1;
        }
        return next;
      });

      animRef.current = requestAnimationFrame(tick);
    };

    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [playing, ticks.length, speedIdx]);

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentTick || !mapInfo) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = containerSize;
    if (prevSizeRef.current !== size) {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      prevSizeRef.current = size;
    }

    ctx.clearRect(0, 0, size, size);

    if (mapImgRef.current) {
      ctx.drawImage(mapImgRef.current, 0, 0, size, size);
    }

    // Draw grenades
    for (const g of currentTick.grenades) {
      drawUtility(ctx, {
        type: g.type,
        position: g.position,
        effectState: 'active',
      }, size);
    }

    // Draw players
    const ctPlayers = currentTick.players.filter(p => p.side === 'ct' && p.isAlive);
    const tPlayers = currentTick.players.filter(p => p.side === 't' && p.isAlive);

    ctPlayers.forEach((p, i) => {
      drawPlayer(ctx, { side: 'ct', number: i + 1, position: p.position }, size);
    });
    tPlayers.forEach((p, i) => {
      drawPlayer(ctx, { side: 't', number: i + 1, position: p.position }, size);
    });

    // Draw dead players as X marks
    const deadPlayers = currentTick.players.filter(p => !p.isAlive);
    for (const p of deadPlayers) {
      const x = p.position.x * size;
      const y = p.position.y * size;
      const s = size * 0.006;
      ctx.strokeStyle = p.side === 'ct' ? 'rgba(74,158,255,0.3)' : 'rgba(255,140,0,0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s);
      ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s);
      ctx.stroke();
    }
  }, [currentTickIdx, containerSize, mapImgLoaded, currentTick, mapInfo]);

  // ── File upload ──
  const handleOpenDemo = async () => {
    setError('');
    setLoading(true);
    setCaptured([]);
    setCurrentTickIdx(0);
    setSelectedRound(0);

    try {
      const data = await pickAndParseDemoFile(setLoadMsg);
      if (!data.mapName) {
        setError('Could not detect map from demo file');
        setLoading(false);
        return;
      }
      if (data.ticks.length === 0) {
        setError('No player position data found in demo');
        setLoading(false);
        return;
      }
      setDemoData(data);
      setPlaying(false);
    } catch (err: any) {
      if (err.message === 'No file selected') {
        // User cancelled — not an error
      } else {
        setError(err.message || 'Failed to parse demo file');
      }
    }
    setLoading(false);
  };

  // ── Phase capture ──
  const capturePhase = () => {
    if (!currentTick || !mapInfo) return;
    const boardState = demoTickToBoardState(currentTick, mapInfo);
    const roundLabel = demoData?.rounds[selectedRound]
      ? `R${demoData.rounds[selectedRound].roundNum}`
      : '';
    const name = `${roundLabel} Tick ${currentTick.tick}`;
    setCaptured(prev => [...prev, { name, tick: currentTick.tick, boardState }]);
  };

  const removeCapture = (idx: number) => {
    setCaptured(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Save captured phases to library ──
  const saveToLibrary = async () => {
    if (captured.length === 0 || !mapName) return;
    try {
      for (const phase of captured) {
        await api.post('/phases', {
          name: phase.name,
          mapName,
          boardState: phase.boardState,
          source: 'demo',
          tags: [],
        });
      }
      alert(`Saved ${captured.length} phases to library`);
    } catch (err: any) {
      alert(err.message || 'Failed to save');
    }
  };

  // ── Export captured phases ──
  const exportCaptured = () => {
    if (captured.length === 0 || !mapName) return;
    exportPhasesToFile(mapName, captured.map(c => ({
      name: c.name,
      boardState: c.boardState,
    })));
  };

  // ── Scrubber ──
  const progress = ticks.length > 0 ? Math.floor(currentTickIdx) / (ticks.length - 1) : 0;
  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTickIdx(Math.floor(val * (ticks.length - 1)));
  };

  // ── Upload screen ──
  if (!demoData) {
    return (
      <div className="demo-player">
        <div className="demo-upload-area">
          <h2>Demo 2D Player</h2>
          <p>Open a CS2 .dem file to replay it on the 2D tactical map</p>
          {loading && <p className="demo-loading">{loadMsg || 'Parsing...'}</p>}
          {error && <p className="demo-error">{error}</p>}
          {!loading && (
            <button className="demo-upload-btn" onClick={handleOpenDemo}>
              Open .dem file
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="demo-player">
      <div className="demo-sidebar">
        <div className="demo-sidebar-header">
          <h3>Demo Player</h3>
          <span className="demo-map-label">{mapName}</span>
        </div>

        {/* Round selector */}
        {demoData.rounds.length > 0 && (
          <div className="demo-rounds">
            <label>Round</label>
            <select
              value={selectedRound}
              onChange={(e) => {
                setSelectedRound(Number(e.target.value));
                setCurrentTickIdx(0);
                setPlaying(false);
              }}
            >
              {demoData.rounds.map((r, i) => (
                <option key={i} value={i}>Round {r.roundNum}</option>
              ))}
            </select>
          </div>
        )}

        {/* Captured phases */}
        <div className="demo-captured">
          <div className="demo-captured-header">
            <h4>Captured Phases ({captured.length})</h4>
            {captured.length > 0 && (
              <div className="demo-captured-actions">
                <button className="demo-small-btn" onClick={exportCaptured} title="Export to file">
                  <FontAwesomeIcon icon={faDownload} />
                </button>
                <button className="demo-small-btn primary" onClick={saveToLibrary} title="Save to library">
                  <FontAwesomeIcon icon={faPlus} /> Save All
                </button>
              </div>
            )}
          </div>
          <div className="demo-captured-list">
            {captured.length === 0 && (
              <p className="demo-empty">Pause and capture phases from the demo</p>
            )}
            {captured.map((c, i) => (
              <div key={i} className="demo-captured-item">
                <span>{c.name}</span>
                <button className="demo-remove-btn" onClick={() => removeCapture(i)}>
                  <FontAwesomeIcon icon={faTrash} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* New demo button */}
        <div className="demo-sidebar-footer">
          <button
            className="demo-small-btn"
            onClick={() => { setDemoData(null); setCaptured([]); setError(''); }}
          >
            <FontAwesomeIcon icon={faXmark} /> Load Different Demo
          </button>
        </div>
      </div>

      <div className="demo-main">
        <div className="demo-canvas-area" ref={canvasAreaRef}>
          <canvas
            ref={canvasRef}
            style={{ width: containerSize, height: containerSize, borderRadius: 8 }}
          />
        </div>

        <div className="demo-controls">
          <div className="demo-buttons">
            <button
              className="demo-btn play-btn"
              onClick={() => {
                if (!playing && currentTickIdx >= ticks.length - 1) {
                  setCurrentTickIdx(0);
                }
                setPlaying(!playing);
              }}
            >
              <FontAwesomeIcon icon={playing ? faPause : faPlay} />
            </button>
            <button
              className="demo-btn capture-btn"
              onClick={capturePhase}
              disabled={playing}
              title="Capture current frame as phase"
            >
              <FontAwesomeIcon icon={faCamera} /> Capture
            </button>
            <button
              className="demo-btn speed-btn"
              onClick={() => setSpeedIdx((speedIdx + 1) % SPEEDS.length)}
            >
              {SPEEDS[speedIdx]}x
            </button>
          </div>

          <div className="demo-scrubber">
            <input
              type="range"
              min="0"
              max="1"
              step="0.001"
              value={progress}
              onChange={handleScrub}
              className="demo-slider"
            />
          </div>

          <div className="demo-tick-info">
            {currentTick && (
              <span>Tick {currentTick.tick} | {currentTick.players.filter(p => p.isAlive).length} alive</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
