import { useState, useEffect, useRef, useCallback } from 'react';
import type { DemoData, DemoTick, DemoBombEvent } from '../lib/demoParser';
import type { Position } from '../types';
import { pickAndParseDemoFile, demoTickToBoardState, getActiveUtilities } from '../lib/demoParser';
import { drawPlayerDirectional, drawUtility } from '../lib/canvasRenderer';
import { getMapInfo } from '../maps';
import { mapImages } from '../assets/mapImages';
import { api } from '../lib/api';
import { exportPhasesToFile } from '../lib/phaseIO';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faPlay, faPause, faCamera, faDownload,
  faPlus, faTrash, faXmark,
} from '@fortawesome/free-solid-svg-icons';
import { useLocale } from '../lib/i18n';

const SPEEDS = [0.25, 0.5, 1, 1.5, 2, 4];

export default function DemoPlayer() {
  const { t } = useLocale();
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

  // Get ticks for current round — skip freeze time
  const roundTicks = useCallback(() => {
    if (!demoData) return [];
    if (demoData.rounds.length === 0) return demoData.ticks;
    const round = demoData.rounds[selectedRound];
    if (!round) return demoData.ticks;
    // Start from freeze end (when players can move), end at round end
    const freezeEnd = round.freezeEndTick || round.startTick;
    return demoData.ticks.filter(t => t.tick >= freezeEnd && t.tick <= round.endTick);
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

    // Samples per second = tickRate / sampleInterval (e.g. 64/16 = 4 samples/sec)
    const tickRate = demoData?.tickRate || 64;
    const samplesPerSec = tickRate / 16;

    const tick = (now: number) => {
      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;
      // Advance index by real-time samples per second * speed
      const advance = (delta / 1000) * samplesPerSec * speed;

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

    // Interpolation variables (shared by utilities, players, and bomb events)
    const floorIdx = Math.floor(currentTickIdx);
    const frac = currentTickIdx - floorIdx;
    const nextTick = ticks[Math.min(floorIdx + 1, ticks.length - 1)];
    const interpTick = nextTick
      ? currentTick.tick + (nextTick.tick - currentTick.tick) * frac
      : currentTick.tick;

    // Draw utilities (flying, landing, active)
    if (demoData) {
      const activeUtils = getActiveUtilities(demoData.utilityEvents, interpTick);
      for (const au of activeUtils) {
        const u = au.event;
        if (au.state === 'flying') {
          // Build multi-point trail for smooth arc
          const origin = u.throwOrigin || u.position;
          const steps = Math.max(2, Math.ceil(au.progress * 20));
          const trail: { x: number; y: number }[] = [];
          for (let s = 0; s <= steps; s++) {
            const t = (s / steps) * au.progress;
            trail.push({
              x: origin.x + (u.position.x - origin.x) * t,
              y: origin.y + (u.position.y - origin.y) * t,
            });
          }
          drawUtility(ctx, {
            type: u.type,
            position: au.currentPos,
            effectState: 'flying',
            effectProgress: au.progress,
            trail: u.throwOrigin ? trail : undefined,
          }, size);
        } else if (au.state === 'landing') {
          drawUtility(ctx, {
            type: u.type,
            position: u.position,
            effectState: 'landing',
            effectProgress: au.progress,
          }, size);
        } else {
          // Fade out near end of duration
          const opacity = au.progress > 0.85 ? 1 - ((au.progress - 0.85) / 0.15) : 1;
          drawUtility(ctx, {
            type: u.type,
            position: u.position,
            effectState: 'active',
            opacity: Math.max(0.1, opacity),
          }, size);
        }
      }
    }

    // Interpolate player positions between current and next tick for smooth movement
    function lerpPos(player: DemoTick['players'][0]) {
      if (!nextTick || frac === 0) return player.position;
      const match = nextTick.players.find(p => p.steamId === player.steamId);
      if (!match || !match.isAlive) return player.position;
      return {
        x: player.position.x + (match.position.x - player.position.x) * frac,
        y: player.position.y + (match.position.y - player.position.y) * frac,
      };
    }

    // Draw players
    const ctPlayers = currentTick.players.filter(p => p.side === 'ct' && p.isAlive);
    const tPlayers = currentTick.players.filter(p => p.side === 't' && p.isAlive);

    const nameFont = `bold ${Math.max(9, Math.round(size * 0.014))}px sans-serif`;
    const hpFont = `${Math.max(8, Math.round(size * 0.011))}px sans-serif`;
    const allAlive = [...ctPlayers, ...tPlayers];

    // Interpolate yaw between ticks for smooth rotation
    function lerpYaw(player: DemoTick['players'][0]): number {
      if (!nextTick || frac === 0) return player.yaw;
      const match = nextTick.players.find(p => p.steamId === player.steamId);
      if (!match || !match.isAlive) return player.yaw;
      // Shortest-path angle interpolation (handle 180/-180 wrap)
      let diff = match.yaw - player.yaw;
      if (diff > 180) diff -= 360;
      if (diff < -180) diff += 360;
      return player.yaw + diff * frac;
    }

    ctPlayers.forEach((p, i) => {
      drawPlayerDirectional(ctx, { side: 'ct', number: i + 1, position: lerpPos(p), yaw: lerpYaw(p) }, size);
    });
    tPlayers.forEach((p, i) => {
      drawPlayerDirectional(ctx, { side: 't', number: i + 1, position: lerpPos(p), yaw: lerpYaw(p) }, size);
    });

    // Draw player names + HP above tokens
    const tokenR = size * 0.014;
    const hpGap = Math.max(4, size * 0.005);
    for (const p of allAlive) {
      const pos = lerpPos(p);
      const px = pos.x * size;
      const py = pos.y * size;
      const labelY = py - tokenR - 2;

      // Measure name width with name font
      ctx.font = nameFont;
      const nameW = ctx.measureText(p.name).width;

      // Name
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(p.name, px + 1, labelY + 1);
      ctx.fillStyle = '#fff';
      ctx.fillText(p.name, px, labelY);

      // HP (always shown, to the right of name with gap)
      ctx.font = hpFont;
      const hpText = `${p.health}`;
      const hpColor = p.health > 50 ? 'rgba(100,255,100,0.85)'
        : p.health > 25 ? 'rgba(255,200,50,0.85)'
        : 'rgba(255,80,80,0.85)';
      const hpX = px + nameW / 2 + hpGap;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillText(hpText, hpX + 1, labelY + 1);
      ctx.fillStyle = hpColor;
      ctx.fillText(hpText, hpX, labelY);
    }

    // Only show dead X for players who were alive earlier this round
    // Track when each player died to fade out the X mark
    const seenAlive = new Set<string>();
    const deathIdx = new Map<string, number>(); // steamId → tick index where they first appear dead
    for (let i = 0; i <= floorIdx && i < ticks.length; i++) {
      for (const p of ticks[i].players) {
        if (p.isAlive) {
          seenAlive.add(p.steamId);
          deathIdx.delete(p.steamId); // reset if they respawn
        } else if (seenAlive.has(p.steamId) && !deathIdx.has(p.steamId)) {
          deathIdx.set(p.steamId, i);
        }
      }
    }
    const FADE_TICKS = 200; // fade over ~200 tick indices (~3.2s at 64tick/16sample)
    const deadPlayers = currentTick.players.filter(p => !p.isAlive && seenAlive.has(p.steamId));
    for (const p of deadPlayers) {
      const dIdx = deathIdx.get(p.steamId) ?? floorIdx;
      const ticksSinceDeath = floorIdx - dIdx;
      const alpha = Math.max(0, 1 - ticksSinceDeath / FADE_TICKS);
      if (alpha <= 0) continue;

      const pos = lerpPos(p);
      const x = pos.x * size;
      const y = pos.y * size;
      const s = size * 0.008;

      // Team-colored X with fade
      const ctColor = `rgba(74,158,255,${(0.85 * alpha).toFixed(2)})`;
      const tColor = `rgba(255,140,0,${(0.85 * alpha).toFixed(2)})`;
      ctx.strokeStyle = p.side === 'ct' ? ctColor : tColor;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s);
      ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s);
      ctx.stroke();
      ctx.lineCap = 'butt';
    }

    // Draw bomb events
    if (demoData?.bombEvents) {
      const round = demoData.rounds[selectedRound];
      if (round) {
        const roundBombs = demoData.bombEvents.filter(
          b => b.tick >= round.startTick && b.tick <= round.endTick
        );

        // Track bomb state: carrier, ground position, planted, etc.
        let bombCarrierSteamId: string | null = null;
        let bombGroundPos: Position | null = null; // pixel coords where bomb was dropped
        let bombPlanted: DemoBombEvent | null = null;
        let bombPlanting: DemoBombEvent | null = null;
        let bombDefusing: DemoBombEvent | null = null;
        let bombExploded = false;
        let bombDefused = false;
        let fakePlant: DemoBombEvent | null = null;
        let fakeDefuse: DemoBombEvent | null = null;

        for (const b of roundBombs) {
          if (b.tick > interpTick) break;
          switch (b.type) {
            case 'pickup':
              bombCarrierSteamId = b.playerSteamId;
              bombGroundPos = null;
              break;
            case 'dropped':
              bombCarrierSteamId = null;
              bombGroundPos = b.position || null;
              break;
            case 'plant_begin':
              bombPlanting = b;
              break;
            case 'plant_fake':
              fakePlant = b;
              bombPlanting = null;
              break;
            case 'planted':
              bombPlanted = b;
              bombPlanting = null;
              bombCarrierSteamId = null;
              bombGroundPos = null;
              break;
            case 'defuse_begin':
              bombDefusing = b;
              break;
            case 'defuse_fake':
              fakeDefuse = b;
              bombDefusing = null;
              break;
            case 'defused':
              bombDefused = true;
              bombDefusing = null;
              break;
            case 'exploded':
              bombExploded = true;
              break;
          }
        }

        const bombRadius = size * 0.018;
        const bombIconSize = bombRadius * 0.8;

        // Draw bomb on ground (not yet planted)
        if (!bombPlanted && bombGroundPos) {
          const bx = bombGroundPos.x * size;
          const by = bombGroundPos.y * size;
          ctx.fillStyle = 'rgba(255,50,50,0.9)';
          ctx.fillRect(bx - bombRadius * 0.5, by - bombRadius * 0.5, bombRadius, bombRadius);
          ctx.fillStyle = '#fff';
          ctx.font = `bold ${Math.max(8, size * 0.011)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('C4', bx, by);
        }

        // Draw bomb carried by player (small red square next to carrier)
        if (!bombPlanted && bombCarrierSteamId) {
          const carrier = currentTick.players.find(p => p.steamId === bombCarrierSteamId && p.isAlive);
          if (carrier) {
            const pos = lerpPos(carrier);
            const cx = pos.x * size;
            const cy = pos.y * size;
            const offset = size * 0.012;
            const sq = bombIconSize * 0.55;
            ctx.fillStyle = 'rgba(255,50,50,0.9)';
            ctx.fillRect(cx + offset - sq, cy - offset - sq, sq * 2, sq * 2);
            ctx.strokeStyle = 'rgba(180,30,30,0.9)';
            ctx.lineWidth = 1;
            ctx.strokeRect(cx + offset - sq, cy - offset - sq, sq * 2, sq * 2);
          }
        }

        // Draw planting progress
        if (bombPlanting && !bombPlanted && bombPlanting.position) {
          const bx = bombPlanting.position.x * size;
          const by = bombPlanting.position.y * size;
          const plantDuration = 200; // ~3.1s at 64 tick
          const progress = Math.min(1, (interpTick - bombPlanting.tick) / plantDuration);

          // Pulsing circle
          ctx.beginPath();
          ctx.arc(bx, by, bombRadius * 1.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
          ctx.strokeStyle = 'rgba(255,80,80,0.8)';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Bomb icon (small square)
          ctx.fillStyle = 'rgba(255,80,80,0.6)';
          ctx.fillRect(bx - bombRadius * 0.4, by - bombRadius * 0.4, bombRadius * 0.8, bombRadius * 0.8);
        }

        // Draw fake plant indicator (brief flash)
        if (fakePlant && fakePlant.position && interpTick - fakePlant.tick < 64) {
          const bx = fakePlant.position.x * size;
          const by = fakePlant.position.y * size;
          const alpha = Math.max(0, 1 - (interpTick - fakePlant.tick) / 64);
          ctx.strokeStyle = `rgba(255,80,80,${(alpha * 0.6).toFixed(2)})`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(bx, by, bombRadius * 1.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Draw planted bomb
        if (bombPlanted && bombPlanted.position && !bombExploded && !bombDefused) {
          const bx = bombPlanted.position.x * size;
          const by = bombPlanted.position.y * size;

          // Pulsing glow
          const pulse = 0.7 + 0.3 * Math.sin(Date.now() * 0.005);
          ctx.beginPath();
          ctx.arc(bx, by, bombRadius * 1.2 * pulse, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,50,50,${(0.15 * pulse).toFixed(2)})`;
          ctx.fill();

          // Bomb square with C4 inside
          ctx.fillStyle = 'rgba(255,50,50,0.9)';
          ctx.fillRect(bx - bombRadius * 0.5, by - bombRadius * 0.5, bombRadius, bombRadius);
          ctx.fillStyle = '#fff';
          ctx.font = `bold ${Math.max(8, size * 0.011)}px sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('C4', bx, by);
        }

        // Draw defusing progress
        if (bombDefusing && bombPlanted && bombPlanted.position && !bombDefused) {
          const bx = bombPlanted.position.x * size;
          const by = bombPlanted.position.y * size;
          const defuseTime = bombDefusing.hasKit ? 320 : 640;
          const progress = Math.min(1, (interpTick - bombDefusing.tick) / defuseTime);

          // Blue arc for defuse progress
          ctx.beginPath();
          ctx.arc(bx, by, bombRadius * 1.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
          ctx.strokeStyle = 'rgba(74,158,255,0.9)';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        // Draw fake defuse indicator
        if (fakeDefuse && bombPlanted && bombPlanted.position && interpTick - fakeDefuse.tick < 64) {
          const bx = bombPlanted.position.x * size;
          const by = bombPlanted.position.y * size;
          const alpha = Math.max(0, 1 - (interpTick - fakeDefuse.tick) / 64);
          ctx.strokeStyle = `rgba(74,158,255,${(alpha * 0.6).toFixed(2)})`;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(bx, by, bombRadius * 1.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        // Draw explosion
        if (bombExploded && bombPlanted && bombPlanted.position) {
          const bx = bombPlanted.position.x * size;
          const by = bombPlanted.position.y * size;
          const explodedEvt = roundBombs.find(b => b.type === 'exploded');
          if (explodedEvt) {
            const elapsed = interpTick - explodedEvt.tick;
            if (elapsed < 128) {
              const progress = elapsed / 128;
              const radius = bombRadius * 3 * progress;
              const alpha = 1 - progress;
              ctx.beginPath();
              ctx.arc(bx, by, radius, 0, Math.PI * 2);
              ctx.fillStyle = `rgba(255,100,0,${(alpha * 0.5).toFixed(2)})`;
              ctx.fill();
              ctx.strokeStyle = `rgba(255,200,0,${(alpha * 0.8).toFixed(2)})`;
              ctx.lineWidth = 2;
              ctx.stroke();
            }
          }
        }

        // Draw defused indicator
        if (bombDefused && bombPlanted && bombPlanted.position) {
          const bx = bombPlanted.position.x * size;
          const by = bombPlanted.position.y * size;
          const defusedEvt = roundBombs.find(b => b.type === 'defused');
          if (defusedEvt) {
            const elapsed = interpTick - defusedEvt.tick;
            if (elapsed < 128) {
              const alpha = Math.max(0.3, 1 - elapsed / 128);
              ctx.fillStyle = `rgba(74,158,255,${(alpha * 0.3).toFixed(2)})`;
              ctx.beginPath();
              ctx.arc(bx, by, bombRadius * 1.5, 0, Math.PI * 2);
              ctx.fill();
            }
            // Defused bomb (dimmed)
            ctx.fillStyle = 'rgba(100,100,100,0.5)';
            ctx.fillRect(bx - bombRadius * 0.5, by - bombRadius * 0.5, bombRadius, bombRadius);
          }
        }
      }
    }

    // Draw gun fire muzzle flash — animated fire burst
    if (demoData?.gunFireEvents) {
      const round = demoData.rounds[selectedRound];
      if (round) {
        const FLASH_DURATION = 18; // ~0.28s at 64 tick
        for (const f of demoData.gunFireEvents) {
          if (f.tick > interpTick) break;
          if (f.tick < interpTick - FLASH_DURATION) continue;
          if (f.tick < round.freezeEndTick || f.tick > round.endTick) continue;

          const t = (interpTick - f.tick) / FLASH_DURATION; // 0→1 progress
          const alpha = t < 0.3 ? 1 : 1 - (t - 0.3) / 0.7; // hold then fade

          const fx = f.position.x * size;
          const fy = f.position.y * size;
          const angle = -f.yaw * (Math.PI / 180);
          const baseLen = size * 0.016;

          // Expanding fire cone — 3 layers from bright core to dim outer
          ctx.save();
          ctx.translate(fx, fy);
          ctx.rotate(angle);

          // Outer glow cone (orange-red, wide spread)
          const outerLen = baseLen * (0.6 + t * 1.2);
          const outerSpread = size * 0.006 * (0.5 + t);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(outerLen, -outerSpread);
          ctx.lineTo(outerLen * 1.1, 0);
          ctx.lineTo(outerLen, outerSpread);
          ctx.closePath();
          ctx.fillStyle = `rgba(255,80,20,${(alpha * 0.35).toFixed(2)})`;
          ctx.fill();

          // Mid cone (orange, medium)
          const midLen = baseLen * (0.5 + t * 0.8);
          const midSpread = size * 0.004 * (0.4 + t * 0.6);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(midLen, -midSpread);
          ctx.lineTo(midLen * 1.05, 0);
          ctx.lineTo(midLen, midSpread);
          ctx.closePath();
          ctx.fillStyle = `rgba(255,160,40,${(alpha * 0.5).toFixed(2)})`;
          ctx.fill();

          // Bright core (yellow-white, narrow)
          const coreLen = baseLen * (0.4 + t * 0.5);
          const coreSpread = size * 0.002 * (0.3 + t * 0.4);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(coreLen, -coreSpread);
          ctx.lineTo(coreLen * 1.05, 0);
          ctx.lineTo(coreLen, coreSpread);
          ctx.closePath();
          ctx.fillStyle = `rgba(255,240,150,${(alpha * 0.7).toFixed(2)})`;
          ctx.fill();

          // Spark particles — 3 sparks flying outward
          const sparkBase = baseLen * 0.8;
          for (let i = 0; i < 3; i++) {
            // Deterministic pseudo-random offset per spark using tick+index
            const seed = (f.tick * 7 + i * 31) % 100 / 100;
            const sparkAngle = (seed - 0.5) * 0.6; // spread ±0.3 rad from center
            const sparkDist = sparkBase * (0.3 + t * (1.0 + seed * 0.5));
            const sparkSize = size * 0.002 * (1 - t * 0.7);
            const sx = Math.cos(sparkAngle) * sparkDist;
            const sy = Math.sin(sparkAngle) * sparkDist;
            ctx.beginPath();
            ctx.arc(sx, sy, Math.max(0.5, sparkSize), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,${180 + Math.round(seed * 60)},50,${(alpha * 0.8 * (1 - t * 0.5)).toFixed(2)})`;
            ctx.fill();
          }

          // Central flash glow at muzzle (bright, shrinks quickly)
          const glowR = size * 0.005 * (1 - t * 0.8);
          if (glowR > 0.5) {
            ctx.beginPath();
            ctx.arc(0, 0, glowR, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,255,200,${(alpha * 0.4).toFixed(2)})`;
            ctx.fill();
          }

          ctx.restore();
        }
      }
    }

    // Draw kill events: red line from attacker to victim + kill feed
    if (demoData?.killEvents) {
      const round = demoData.rounds[selectedRound];
      if (round) {
        const KILL_LINE_FADE = 96;  // kill line on map fades in ~1.5s
        const KILL_FEED_HOLD = 320; // feed stays solid ~5s
        const KILL_FEED_FADE = 128; // then fades over ~2s
        const KILL_FEED_TOTAL = KILL_FEED_HOLD + KILL_FEED_FADE;
        const KILL_FEED_MAX = 8;
        const roundKills = demoData.killEvents.filter(
          k => k.tick >= round.freezeEndTick && k.tick <= round.endTick
        );

        // Draw kill lines (attacker → victim)
        for (const k of roundKills) {
          const elapsed = interpTick - k.tick;
          if (elapsed < 0 || elapsed > KILL_LINE_FADE) continue;
          const alpha = 1 - elapsed / KILL_LINE_FADE;
          const isSelfKill = k.attackerSteamId === k.victimSteamId;

          const ax = k.attackerPos.x * size;
          const ay = k.attackerPos.y * size;
          const vx = k.victimPos.x * size;
          const vy = k.victimPos.y * size;

          // Kill line (skip for self-kills)
          if (!isSelfKill) {
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(vx, vy);
          ctx.strokeStyle = k.headshot
            ? `rgba(255,50,50,${(alpha * 0.7).toFixed(2)})`
            : `rgba(255,100,100,${(alpha * 0.5).toFixed(2)})`;
          ctx.lineWidth = k.headshot ? 2 : 1.5;
          ctx.setLineDash([4, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
          }

          // Skull marker at victim position
          if (elapsed < 32) {
            const burstAlpha = 1 - elapsed / 32;
            const burstR = size * 0.008 * (1 + elapsed / 32);
            ctx.beginPath();
            ctx.arc(vx, vy, burstR, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255,50,50,${(burstAlpha * 0.4).toFixed(2)})`;
            ctx.fill();
          }


        }

        // Kill feed overlay (top-right corner)
        const recentKills = roundKills.filter(
          k => interpTick - k.tick >= 0 && interpTick - k.tick < KILL_FEED_TOTAL
        ).slice(-KILL_FEED_MAX);

        if (recentKills.length > 0) {
          const feedX = size - 10;
          const lineH = Math.max(14, size * 0.018);
          const feedFont = `${Math.max(9, Math.round(size * 0.012))}px sans-serif`;
          ctx.font = feedFont;
          ctx.textBaseline = 'middle';

          for (let i = 0; i < recentKills.length; i++) {
            const k = recentKills[i];
            const elapsed = interpTick - k.tick;
            // Solid during hold period, then fade
            const alpha = elapsed < KILL_FEED_HOLD
              ? 1
              : Math.max(0, 1 - (elapsed - KILL_FEED_HOLD) / KILL_FEED_FADE);
            const fy = 10 + i * lineH + lineH / 2;

            // Background
            ctx.fillStyle = `rgba(0,0,0,${(alpha * 0.55).toFixed(2)})`;
            const assist = k.assisterName ? ` + ${k.assisterName}` : '';
            const text = `${k.attackerName}${assist} [${k.weapon}${k.headshot ? ' HS' : ''}] ${k.victimName}`;
            const tw = ctx.measureText(text).width;
            ctx.fillRect(feedX - tw - 12, fy - lineH / 2, tw + 12, lineH);

            // Text
            ctx.textAlign = 'right';
            ctx.fillStyle = `rgba(255,255,255,${(alpha * 0.9).toFixed(2)})`;
            ctx.fillText(text, feedX - 6, fy);
          }
        }
      }
    }
  }, [currentTickIdx, containerSize, mapImgLoaded, currentTick, mapInfo, demoData, selectedRound]);

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
        setError(t('demo.errorNoMap'));
        setLoading(false);
        return;
      }
      if (data.ticks.length === 0) {
        setError(t('demo.errorNoData'));
        setLoading(false);
        return;
      }
      // Ensure utility sprites are decoded before first render
      const { preloadSprites } = await import('../assets/utilitySprites');
      await preloadSprites();
      setDemoData(data);
      setPlaying(false);
    } catch (err: any) {
      if (err.message === 'No file selected') {
        // User cancelled — not an error
      } else {
        setError(err.message || t('demo.errorParse'));
      }
    }
    setLoading(false);
  };

  // ── Phase capture ──
  const capturePhase = () => {
    if (!currentTick || !mapInfo) return;
    const activeUtils = demoData ? getActiveUtilities(demoData.utilityEvents, currentTick.tick) : [];
    const boardState = demoTickToBoardState(currentTick, mapInfo, activeUtils.map(a => a.event));
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
      alert(t('demo.savedCount', { count: captured.length }));
    } catch (err: any) {
      alert(err.message || t('demo.saveFailed'));
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

  // ── Round timer ──
  const roundTimer = (() => {
    if (!demoData || !currentTick) return '';
    const round = demoData.rounds[selectedRound];
    if (!round) return '';
    const tickRate = demoData.tickRate || 64;
    const freezeEnd = round.freezeEndTick || round.startTick;
    const timelimit = round.timelimit || 115; // default competitive 1:55
    const elapsed = (currentTick.tick - freezeEnd) / tickRate;
    const remaining = Math.max(0, timelimit - elapsed);
    const mins = Math.floor(remaining / 60);
    const secs = Math.floor(remaining % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  })();

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
          <h2>{t('demo.title')}</h2>
          <p>{t('demo.openDesc')}</p>
          {loading && <p className="demo-loading">{loadMsg || t('demo.parsing')}</p>}
          {error && <p className="demo-error">{error}</p>}
          {!loading && (
            <button className="demo-upload-btn" onClick={handleOpenDemo}>
              {t('demo.openFile')}
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
          <h3>{t('demo.sidebarTitle')}</h3>
          <span className="demo-map-label">{mapName}</span>
        </div>

        {/* Round selector */}
        {demoData.rounds.length > 0 && (
          <div className="demo-rounds">
            <label>{t('demo.round')}</label>
            <select
              value={selectedRound}
              onChange={(e) => {
                setSelectedRound(Number(e.target.value));
                setCurrentTickIdx(0);
                setPlaying(false);
              }}
            >
              {demoData.rounds.map((r, i) => (
                <option key={i} value={i}>{t('demo.roundN', { num: r.roundNum })}</option>
              ))}
            </select>
          </div>
        )}

        {/* Captured phases */}
        <div className="demo-captured">
          <div className="demo-captured-header">
            <h4>{t('demo.capturedPhases', { count: captured.length })}</h4>
            {captured.length > 0 && (
              <div className="demo-captured-actions">
                <button className="demo-small-btn" onClick={exportCaptured} title={t('demo.exportToFile')}>
                  <FontAwesomeIcon icon={faDownload} />
                </button>
                <button className="demo-small-btn primary" onClick={saveToLibrary} title={t('demo.saveToLibrary')}>
                  <FontAwesomeIcon icon={faPlus} /> {t('demo.saveAll')}
                </button>
              </div>
            )}
          </div>
          <div className="demo-captured-list">
            {captured.length === 0 && (
              <p className="demo-empty">{t('demo.captureEmpty')}</p>
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
            <FontAwesomeIcon icon={faXmark} /> {t('demo.loadDifferent')}
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
              title={t('demo.captureTooltip')}
            >
              <FontAwesomeIcon icon={faCamera} /> {t('demo.capture')}
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
            {roundTimer && <span className="demo-round-timer">{roundTimer}</span>}
            {currentTick && (
              <span>{t('demo.tickInfo', { tick: currentTick.tick, alive: currentTick.players.filter(p => p.isAlive).length })}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
