import { useState, useRef, useCallback, useEffect } from 'react';
import type {
  ToolType,
  PlayerToken,
  UtilityMarker,
  Drawing,
  Position,
  Strategy,
  Phase,
  FreehandDrawing,
} from '../types';
import { ROUND_SITUATIONS, STRAT_TYPES, STRAT_TEMPOS, SEED_TAGS } from '../types';
import { api } from '../lib/api';
import { useLocale } from '../lib/i18n';
import { getMapInfo } from '../maps';
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
import { mapImages } from '../assets/mapImages';
import Toolbar from './Toolbar';
import DrawingCanvas from './DrawingCanvas';
import PhaseBar from './PhaseBar';
import AnimationPlayer from './AnimationPlayer';
import TokenNotePopover from './TokenNotePopover';
import RichEditor from './RichEditor';
import CommentThread from './CommentThread';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCloud, faBolt, faFire, faBomb,
  faRotateLeft, faRotateRight, faArrowLeft, faPlay,
} from '@fortawesome/free-solid-svg-icons';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';

interface Props {
  strategy: Strategy;
  onBack: () => void;
  onSave: (strategy: Strategy) => void;
}

interface Snapshot {
  players: PlayerToken[];
  utilities: UtilityMarker[];
  drawings: Drawing[];
}

function getRelativePos(clientX: number, clientY: number, container: HTMLElement): Position {
  const rect = container.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / rect.width,
    y: (clientY - rect.top) / rect.height,
  };
}

function clampPos(pos: Position): Position {
  return {
    x: Math.max(0, Math.min(1, pos.x)),
    y: Math.max(0, Math.min(1, pos.y)),
  };
}

function isOutOfBounds(pos: Position): boolean {
  return pos.x < -0.02 || pos.x > 1.02 || pos.y < -0.02 || pos.y > 1.02;
}

const MAX_HISTORY = 50;

const utilityFA: Record<string, IconDefinition> = {
  smoke: faCloud, flash: faBolt, molotov: faFire, he: faBomb,
};

export default function TacticalBoard({ strategy, onBack, onSave }: Props) {
  const { t } = useLocale();
  const mapInfo = getMapInfo(strategy.map);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasAreaRef = useRef<HTMLDivElement>(null);

  // Phase state
  const [phases, setPhases] = useState<Phase[]>(strategy.phases);
  const [activePhaseIdx, setActivePhaseIdx] = useState(0);
  const activePhase = phases[activePhaseIdx] || phases[0];

  // Board state from active phase
  const [players, setPlayers] = useState<PlayerToken[]>(activePhase?.boardState.players || []);
  const [utilities, setUtilities] = useState<UtilityMarker[]>(activePhase?.boardState.utilities || []);
  const [drawings, setDrawings] = useState<Drawing[]>(activePhase?.boardState.drawings || []);

  // Strategy metadata
  const [stratName, setStratName] = useState(strategy.name);
  const [side, setSide] = useState(strategy.side);
  const [situation, setSituation] = useState(strategy.situation);
  const [stratType, setStratType] = useState(strategy.stratType);
  const [tempo, setTempo] = useState(strategy.tempo);
  const [tags, setTags] = useState<string[]>(strategy.tags);
  const [description, setDescription] = useState(strategy.description);
  const [phaseNotes, setPhaseNotes] = useState(activePhase?.notes || '');

  // Popular tags from community usage
  const [popularTags, setPopularTags] = useState<string[]>(SEED_TAGS);
  useEffect(() => {
    api.get<{ tag: string; count: number }[]>('/community/tags/popular')
      .then(rows => {
        if (rows.length > 0) setPopularTags(rows.map(r => r.tag));
      })
      .catch(() => {}); // fallback to SEED_TAGS
  }, []);

  // UI state
  const [activeTool, setActiveTool] = useState<ToolType | null>(null);
  const [containerSize, setContainerSize] = useState({ w: 700, h: 700 });
  const [mapSquareSize, setMapSquareSize] = useState(700);
  const [saveFlash, setSaveFlash] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [currentFreehand, setCurrentFreehand] = useState<Position[]>([]);
  const [dragTarget, setDragTarget] = useState<{ type: 'player' | 'utility'; id: string } | null>(null);
  const [dragOutOfBounds, setDragOutOfBounds] = useState(false);

  // Token note popover
  const [noteTarget, setNoteTarget] = useState<{ type: 'player' | 'utility'; id: string } | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  // Utility drag-to-assign: tracks the dashed line from utility origin to cursor
  const [utilDragLink, setUtilDragLink] = useState<{ utilityId: string; originPos: Position; cursorPos: Position } | null>(null);

  // Undo/Redo
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);

  // Refs
  const playersRef = useRef(players);
  const utilitiesRef = useRef(utilities);
  const drawingsRef = useRef(drawings);
  playersRef.current = players;
  utilitiesRef.current = utilities;
  drawingsRef.current = drawings;
  const activeToolRef = useRef(activeTool);
  activeToolRef.current = activeTool;

  const ctCount = players.filter(p => p.side === 'ct').length;
  const tCount = players.filter(p => p.side === 't').length;

  // Sync board state when switching phases
  const switchToPhase = useCallback((idx: number) => {
    // Save current phase board state
    setPhases(prev => prev.map((p, i) =>
      i === activePhaseIdx ? {
        ...p,
        boardState: { players: playersRef.current, utilities: utilitiesRef.current, drawings: drawingsRef.current },
        notes: phaseNotes,
      } : p
    ));
    setActivePhaseIdx(idx);
    setUndoStack([]);
    setRedoStack([]);
  }, [activePhaseIdx, phaseNotes]);

  // Load phase data when activePhaseIdx changes
  useEffect(() => {
    const phase = phases[activePhaseIdx];
    if (phase) {
      setPlayers(phase.boardState.players);
      setUtilities(phase.boardState.utilities);
      setDrawings(phase.boardState.drawings);
      setPhaseNotes(phase.notes);
    }
  }, [activePhaseIdx]);

  // Undo/Redo
  const pushUndo = useCallback(() => {
    const snapshot: Snapshot = {
      players: playersRef.current,
      utilities: utilitiesRef.current,
      drawings: drawingsRef.current,
    };
    setUndoStack(prev => {
      const next = [...prev, snapshot];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setRedoStack([]);
  }, []);

  const handleUndo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const snapshot = next.pop()!;
      setRedoStack(r => [...r, {
        players: playersRef.current,
        utilities: utilitiesRef.current,
        drawings: drawingsRef.current,
      }]);
      setPlayers(snapshot.players);
      setUtilities(snapshot.utilities);
      setDrawings(snapshot.drawings);
      return next;
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const snapshot = next.pop()!;
      setUndoStack(u => [...u, {
        players: playersRef.current,
        utilities: utilitiesRef.current,
        drawings: drawingsRef.current,
      }]);
      setPlayers(snapshot.players);
      setUtilities(snapshot.utilities);
      setDrawings(snapshot.drawings);
      return next;
    });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault(); handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault(); handleRedo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  // Measure canvas
  useEffect(() => {
    const measure = () => {
      if (canvasAreaRef.current) {
        const rect = canvasAreaRef.current.getBoundingClientRect();
        const s = Math.floor(Math.min(rect.width, rect.height));
        setMapSquareSize(s);
        setContainerSize({ w: s, h: s });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (canvasAreaRef.current) observer.observe(canvasAreaRef.current);
    return () => observer.disconnect();
  }, []);

  // Place items + drawing
  const handleMapPointerDown = useCallback(
    (clientX: number, clientY: number, target: EventTarget) => {
      const container = containerRef.current;
      if (!container) return;
      if ((target as HTMLElement).closest('.player-token, .utility-marker')) return;
      const tool = activeToolRef.current;
      if (!tool) return;
      const pos = clampPos(getRelativePos(clientX, clientY, container));

      if (tool === 'player-ct' && ctCount < 5) {
        pushUndo();
        setPlayers(prev => [...prev, { id: generateId(), side: 'ct', number: ctCount + 1, role: null, position: pos }]);
        return;
      }
      if (tool === 'player-t' && tCount < 5) {
        pushUndo();
        setPlayers(prev => [...prev, { id: generateId(), side: 't', number: tCount + 1, role: null, position: pos }]);
        return;
      }
      if (['smoke', 'flash', 'molotov', 'he'].includes(tool)) {
        pushUndo();
        setUtilities(prev => [...prev, { id: generateId(), type: tool as UtilityMarker['type'], position: pos, thrownBy: null, side: null }]);
        return;
      }

      if (tool === 'eraser') {
        let undoPushed = false;
        const RADIUS = 0.02;
        const eraseAt = (p: Position) => {
          setDrawings(prev => {
            let changed = false;
            const next: Drawing[] = [];
            for (const d of prev) {
              if (d.type === 'freehand') {
                const hasHit = d.points.some(pt => Math.hypot(pt.x - p.x, pt.y - p.y) < RADIUS);
                if (!hasHit) { next.push(d); continue; }
                if (!undoPushed) { pushUndo(); undoPushed = true; }
                changed = true;
                let segment: Position[] = [];
                for (const pt of d.points) {
                  if (Math.hypot(pt.x - p.x, pt.y - p.y) < RADIUS) {
                    if (segment.length >= 2) next.push({ id: generateId(), type: 'freehand', points: segment, color: d.color } as FreehandDrawing);
                    segment = [];
                  } else { segment.push(pt); }
                }
                if (segment.length >= 2) next.push({ id: generateId(), type: 'freehand', points: segment, color: d.color } as FreehandDrawing);
              } else { next.push(d); }
            }
            return changed ? next : prev;
          });
        };
        const onMove = (ev: MouseEvent) => eraseAt(clampPos(getRelativePos(ev.clientX, ev.clientY, container)));
        const onTouchMove = (ev: TouchEvent) => { ev.preventDefault(); const t = ev.touches[0]; if (t) eraseAt(clampPos(getRelativePos(t.clientX, t.clientY, container))); };
        const cleanup = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', cleanup); window.removeEventListener('touchmove', onTouchMove); window.removeEventListener('touchend', cleanup); };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', cleanup);
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', cleanup);
        return;
      }

      if (tool === 'freehand') {
        const points = [pos];
        setCurrentFreehand(points);
        const onMove = (ev: MouseEvent) => { const p = clampPos(getRelativePos(ev.clientX, ev.clientY, container)); points.push(p); setCurrentFreehand([...points]); };
        const onTouchMove = (ev: TouchEvent) => { ev.preventDefault(); const t = ev.touches[0]; if (!t) return; const p = clampPos(getRelativePos(t.clientX, t.clientY, container)); points.push(p); setCurrentFreehand([...points]); };
        const onUp = (ev: MouseEvent) => { const p = clampPos(getRelativePos(ev.clientX, ev.clientY, container)); points.push(p); finishFreehand(points); cleanup(); };
        const onTouchEnd = (ev: TouchEvent) => { const t = ev.changedTouches[0]; if (t) { const p = clampPos(getRelativePos(t.clientX, t.clientY, container)); points.push(p); finishFreehand(points); } cleanup(); };
        const cleanup = () => { setCurrentFreehand([]); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); window.removeEventListener('touchmove', onTouchMove); window.removeEventListener('touchend', onTouchEnd); };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('touchend', onTouchEnd);
      }
    },
    [ctCount, tCount, pushUndo],
  );

  const finishFreehand = useCallback((points: Position[]) => {
    if (points.length > 2) {
      pushUndo();
      setDrawings(prev => [...prev, { id: generateId(), type: 'freehand', points, color: '#ffcc00' } as FreehandDrawing]);
    }
  }, [pushUndo]);

  const onMouseDown = useCallback((e: React.MouseEvent) => handleMapPointerDown(e.clientX, e.clientY, e.target), [handleMapPointerDown]);
  const onTouchStart = useCallback((e: React.TouchEvent) => { const t = e.touches[0]; if (t) handleMapPointerDown(t.clientX, t.clientY, e.target); }, [handleMapPointerDown]);

  // Drag player tokens
  const startPlayerDrag = useCallback((id: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation(); if ('button' in e) e.preventDefault();
    setDragTarget({ type: 'player', id }); setDragOutOfBounds(false); pushUndo();
    const container = containerRef.current;
    if (!container) return;
    const moveGeneric = (clientX: number, clientY: number) => {
      const pos = getRelativePos(clientX, clientY, container);
      setDragOutOfBounds(isOutOfBounds(pos));
      setPlayers(prev => prev.map(p => p.id === id ? { ...p, position: clampPos(pos) } : p));
    };
    const endGeneric = (clientX: number, clientY: number) => {
      const pos = getRelativePos(clientX, clientY, container);
      if (isOutOfBounds(pos)) {
        setPlayers(prev => { const next = prev.filter(p => p.id !== id); let ctN = 0, tN = 0; return next.map(p => ({ ...p, number: p.side === 'ct' ? ++ctN : ++tN })); });
      }
      setDragTarget(null); setDragOutOfBounds(false);
    };
    const onMM = (ev: MouseEvent) => moveGeneric(ev.clientX, ev.clientY);
    const onMU = (ev: MouseEvent) => { endGeneric(ev.clientX, ev.clientY); cleanup(); };
    const onTM = (ev: TouchEvent) => { ev.preventDefault(); const t = ev.touches[0]; if (t) moveGeneric(t.clientX, t.clientY); };
    const onTE = (ev: TouchEvent) => { const t = ev.changedTouches[0]; if (t) endGeneric(t.clientX, t.clientY); cleanup(); };
    const cleanup = () => { window.removeEventListener('mousemove', onMM); window.removeEventListener('mouseup', onMU); window.removeEventListener('touchmove', onTM); window.removeEventListener('touchend', onTE); };
    window.addEventListener('mousemove', onMM); window.addEventListener('mouseup', onMU);
    window.addEventListener('touchmove', onTM, { passive: false }); window.addEventListener('touchend', onTE);
  }, [pushUndo]);

  // Drag utility tokens — drop on player to assign thrower, drop off-map to delete, else reposition
  const startUtilityDrag = useCallback((id: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation(); if ('button' in e) e.preventDefault();
    setDragTarget({ type: 'utility', id }); setDragOutOfBounds(false); pushUndo();
    const container = containerRef.current;
    if (!container) return;
    const originPos = utilitiesRef.current.find(u => u.id === id)?.position;
    if (!originPos) return;
    let hasMoved = false;

    const moveGeneric = (clientX: number, clientY: number) => {
      const pos = getRelativePos(clientX, clientY, container);
      setDragOutOfBounds(isOutOfBounds(pos));
      const clamped = clampPos(pos);
      setUtilities(prev => prev.map(u => u.id === id ? { ...u, position: clamped } : u));
      // Show link line while dragging
      setUtilDragLink({ utilityId: id, originPos, cursorPos: clamped });
      hasMoved = true;
    };
    const endGeneric = (clientX: number, clientY: number) => {
      const pos = getRelativePos(clientX, clientY, container);
      // Check if dropped on a player token
      const dropEl = document.elementFromPoint(clientX, clientY);
      const playerEl = dropEl?.closest('.player-token') as HTMLElement | null;
      if (playerEl && hasMoved) {
        // Find which player was dropped on
        const playerSide = playerEl.classList.contains('ct') ? 'ct' : 't';
        const playerNum = parseInt(playerEl.textContent || '0', 10);
        if (playerNum >= 1 && playerNum <= 5) {
          // Assign thrower and restore utility to original position
          setUtilities(prev => prev.map(u =>
            u.id === id ? { ...u, position: originPos, thrownBy: playerNum, side: playerSide as 'ct' | 't' } : u
          ));
        }
      } else if (isOutOfBounds(pos)) {
        setUtilities(prev => prev.filter(u => u.id !== id));
      }
      // else: utility stays at new position (repositioned)
      setDragTarget(null); setDragOutOfBounds(false); setUtilDragLink(null);
    };
    const onMM = (ev: MouseEvent) => moveGeneric(ev.clientX, ev.clientY);
    const onMU = (ev: MouseEvent) => { endGeneric(ev.clientX, ev.clientY); cleanup(); };
    const onTM = (ev: TouchEvent) => { ev.preventDefault(); const t = ev.touches[0]; if (t) moveGeneric(t.clientX, t.clientY); };
    const onTE = (ev: TouchEvent) => { const t = ev.changedTouches[0]; if (t) endGeneric(t.clientX, t.clientY); cleanup(); };
    const cleanup = () => { window.removeEventListener('mousemove', onMM); window.removeEventListener('mouseup', onMU); window.removeEventListener('touchmove', onTM); window.removeEventListener('touchend', onTE); };
    window.addEventListener('mousemove', onMM); window.addEventListener('mouseup', onMU);
    window.addEventListener('touchmove', onTM, { passive: false }); window.addEventListener('touchend', onTE);
  }, [pushUndo]);

  // Save
  const handleSave = useCallback(() => {
    const updatedPhases = phases.map((p, i) =>
      i === activePhaseIdx ? {
        ...p,
        boardState: { players, utilities, drawings },
        notes: phaseNotes,
      } : p
    );
    const updated: Strategy = {
      ...strategy,
      name: stratName || 'Untitled',
      side,
      situation,
      stratType,
      tempo,
      tags,
      description,
      phases: updatedPhases,
      updatedAt: Date.now(),
    };
    onSave(updated);
    setPhases(updatedPhases);
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 600);
  }, [strategy, stratName, side, situation, stratType, tempo, tags, description, phases, activePhaseIdx, players, utilities, drawings, phaseNotes, onSave]);

  // Phase management — new phase clones entire board state from current phase
  const addPhase = () => {
    // Deep clone current board state so new phase is independent
    const clonedPlayers = players.map(p => ({ ...p, position: { ...p.position } }));
    const clonedUtilities = utilities.map(u => ({ ...u, position: { ...u.position } }));
    const clonedDrawings = drawings.map(d =>
      d.type === 'freehand'
        ? { ...d, points: d.points.map(pt => ({ ...pt })) }
        : { ...d, start: { ...d.start }, end: { ...d.end } }
    );
    const newPhase: Phase = {
      id: generateId(),
      name: `Phase ${phases.length + 1}`,
      sortOrder: phases.length,
      boardState: { players: clonedPlayers, utilities: clonedUtilities, drawings: clonedDrawings },
      notes: phaseNotes,
    };
    const updated = phases.map((p, i) =>
      i === activePhaseIdx ? { ...p, boardState: { players, utilities, drawings }, notes: phaseNotes } : p
    );
    setPhases([...updated, newPhase]);
    setActivePhaseIdx(updated.length);
  };

  const deletePhase = (idx: number) => {
    if (phases.length <= 1) return;
    const updated = phases.filter((_, i) => i !== idx).map((p, i) => ({ ...p, sortOrder: i }));
    setPhases(updated);
    const newIdx = Math.min(activePhaseIdx, updated.length - 1);
    setActivePhaseIdx(newIdx);
  };

  const renamePhase = (idx: number, name: string) => {
    setPhases(prev => prev.map((p, i) => i === idx ? { ...p, name } : p));
  };

  const handleClear = useCallback(() => {
    pushUndo();
    setPlayers([]); setUtilities([]); setDrawings([]);
  }, [pushUndo]);

  // Tag toggle
  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const addCustomTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
    }
  };

  const removeTag = (tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  };

  const allDrawings: Drawing[] = [
    ...drawings,
    ...(currentFreehand.length > 1
      ? [{ id: '_freehand', type: 'freehand' as const, points: currentFreehand, color: 'rgba(255,204,0,0.5)' } as FreehandDrawing]
      : []),
  ];

  const getCursor = () => {
    if (!activeTool) return 'default';
    if (activeTool === 'freehand' || activeTool === 'eraser') return 'crosshair';
    return 'copy';
  };

  return (
    <div className="tactical-board">
      <div className="board-header">
        <div className="header-row-1">
          <button className="back-btn" onClick={onBack}>
            <FontAwesomeIcon icon={faArrowLeft} /> {t('back')}
          </button>
          <span className="header-map-name">{mapInfo.displayName}</span>
          <input
            className="strat-name-input"
            placeholder={t('board.stratNamePlaceholder')}
            value={stratName}
            onChange={e => setStratName(e.target.value)}
          />
          <div className="header-actions">
            <button className="header-btn icon-btn" onClick={handleUndo} disabled={undoStack.length === 0} title={t('board.undo')}>
              <FontAwesomeIcon icon={faRotateLeft} />
            </button>
            <button className="header-btn icon-btn" onClick={handleRedo} disabled={redoStack.length === 0} title={t('board.redo')}>
              <FontAwesomeIcon icon={faRotateRight} />
            </button>
            {phases.length > 1 && (
              <button className="header-btn animate-btn" onClick={() => setShowAnimation(true)} title="Play animation">
                <FontAwesomeIcon icon={faPlay} /> {t('board.animate')}
              </button>
            )}
            <button className="header-btn" onClick={() => setShowMeta(!showMeta)}>
              {showMeta ? t('board.hideInfo') : t('board.info')}
            </button>
            <button className={`header-btn save${saveFlash ? ' saved-flash' : ''}`} onClick={handleSave}>
              {saveFlash ? t('saved') : t('save')}
            </button>
            <button className="header-btn danger" onClick={handleClear}>{t('board.clear')}</button>
          </div>
        </div>
        <div className="header-row-2">
          <div className="axis-item">
            <label className="axis-label" data-help={t('axis.sideHelp')}>{t('axis.side')}</label>
            <select value={side} onChange={e => setSide(e.target.value as 'ct' | 't')}>
              <option value="t">{t('filter.tSide')}</option>
              <option value="ct">{t('filter.ctSide')}</option>
            </select>
          </div>
          <div className="axis-item">
            <label className="axis-label" data-help={t('axis.situationHelp')}>{t('axis.situation')}</label>
            <select value={situation} onChange={e => setSituation(e.target.value as Strategy['situation'])}>
              {ROUND_SITUATIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="axis-item">
            <label className="axis-label" data-help={t('axis.typeHelp')}>{t('axis.type')}</label>
            <select value={stratType} onChange={e => setStratType(e.target.value as Strategy['stratType'])}>
              {STRAT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div className="axis-item">
            <label className="axis-label" data-help={t('axis.tempoHelp')}>{t('axis.tempo')}</label>
            <select value={tempo} onChange={e => setTempo(e.target.value as Strategy['tempo'])}>
              {STRAT_TEMPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Phase bar */}
      <PhaseBar
        phases={phases}
        activeIndex={activePhaseIdx}
        mapName={strategy.map}
        onSelect={switchToPhase}
        onAdd={addPhase}
        onDelete={deletePhase}
        onRename={renamePhase}
        onImportPhases={(imported) => {
          const newPhases: Phase[] = imported.map((p, i) => ({
            id: generateId(),
            name: p.name,
            sortOrder: phases.length + i,
            boardState: p.boardState,
            notes: '',
          }));
          setPhases(prev => [...prev, ...newPhases]);
        }}
      />

      {/* Metadata panel */}
      {showMeta && (
        <div className="meta-panel">
          <div className="meta-section">
            <label className="meta-label">{t('meta.tags')}</label>
            <div className="tag-grid">
              {popularTags.map(t => (
                <button key={t} className={`tag-btn ${tags.includes(t) ? 'active' : ''}`} onClick={() => toggleTag(t)}>
                  {t}
                </button>
              ))}
            </div>
            {tags.filter(t => !popularTags.includes(t)).length > 0 && (
              <div className="custom-tags">
                {tags.filter(t => !popularTags.includes(t)).map(t => (
                  <span key={t} className="custom-tag">
                    {t}
                    <button className="custom-tag-remove" onClick={() => removeTag(t)}>&times;</button>
                  </span>
                ))}
              </div>
            )}
            <input
              className="tag-input"
              placeholder={t('meta.addCustomTag')}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  addCustomTag((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />
          </div>
          <div className="meta-section">
            <label className="meta-label">{t('meta.description')}</label>
            <RichEditor content={description} onChange={setDescription} placeholder={t('meta.descPlaceholder')} compact />
          </div>
          <div className="meta-section">
            <label className="meta-label">{t('meta.phaseNotes', { name: activePhase?.name || '' })}</label>
            <RichEditor content={phaseNotes} onChange={setPhaseNotes} placeholder={t('meta.phaseNotesPlaceholder')} compact />

          </div>
        </div>
      )}

      <div className="board-body">
        <Toolbar activeTool={activeTool} onToolChange={setActiveTool} />
        <div className="canvas-area" ref={canvasAreaRef}>
          {dragOutOfBounds && <div className="delete-hint">{t('board.dropToDelete')}</div>}
          {utilDragLink && <div className="link-hint">{t('board.dropToAssign')}</div>}
          <div
            className="map-container"
            ref={containerRef}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
            onContextMenu={e => e.preventDefault()}
            style={{ width: mapSquareSize, height: mapSquareSize, cursor: getCursor() }}
          >
            <img src={mapImages[strategy.map]} alt={mapInfo.displayName} className="map-image" draggable={false} />
            <DrawingCanvas drawings={allDrawings} width={containerSize.w} height={containerSize.h} />
            {players.map(p => (
              <div
                key={p.id}
                className={`player-token ${p.side}${dragTarget?.id === p.id ? ' dragging' : ''}${dragTarget?.id === p.id && dragOutOfBounds ? ' deleting' : ''}${utilDragLink ? ' link-target' : ''}`}
                style={{ left: `${p.position.x * 100}%`, top: `${p.position.y * 100}%` }}
                onMouseDown={e => { if (e.button === 2) return; startPlayerDrag(p.id, e); }}
                onTouchStart={e => {
                  longPressFired.current = false;
                  longPressTimer.current = setTimeout(() => {
                    longPressFired.current = true;
                    setNoteTarget({ type: 'player', id: p.id });
                  }, 500);
                  startPlayerDrag(p.id, e);
                }}
                onTouchMove={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
                onTouchEnd={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setNoteTarget({ type: 'player', id: p.id }); }}
              >
                {p.number}
                {p.label && <span className="token-has-note" />}
              </div>
            ))}
            {utilities.map(u => (
              <div
                key={u.id}
                className={`utility-marker ${u.type}${dragTarget?.id === u.id ? ' dragging' : ''}${dragTarget?.id === u.id && dragOutOfBounds ? ' deleting' : ''}${u.thrownBy != null ? ' assigned' : ''}`}
                style={{ left: `${u.position.x * 100}%`, top: `${u.position.y * 100}%` }}
                onMouseDown={e => { if (e.button === 2) return; startUtilityDrag(u.id, e); }}
                onTouchStart={e => {
                  longPressFired.current = false;
                  longPressTimer.current = setTimeout(() => {
                    longPressFired.current = true;
                    setNoteTarget({ type: 'utility', id: u.id });
                  }, 500);
                  startUtilityDrag(u.id, e);
                }}
                onTouchMove={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
                onTouchEnd={() => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } }}
                onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setNoteTarget({ type: 'utility', id: u.id }); }}
              >
                <FontAwesomeIcon icon={utilityFA[u.type]} />
                {u.thrownBy != null && (
                  <span className={`thrower-badge ${u.side}`}>{u.thrownBy}</span>
                )}
                {u.label && <span className="token-has-note" />}
              </div>
            ))}
            {/* Dashed line from utility origin to current drag position */}
            {utilDragLink && (() => {
              return (
                <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 50 }}>
                  <line
                    x1={`${utilDragLink.originPos.x * 100}%`} y1={`${utilDragLink.originPos.y * 100}%`}
                    x2={`${utilDragLink.cursorPos.x * 100}%`} y2={`${utilDragLink.cursorPos.y * 100}%`}
                    stroke="#ffcc00" strokeWidth="2" strokeDasharray="6 4" opacity="0.8"
                  />
                </svg>
              );
            })()}
            {/* Static lines from assigned utilities to their throwers */}
            {utilities.filter(u => u.thrownBy != null && dragTarget?.id !== u.id).map(u => {
              const thrower = players.find(p => p.number === u.thrownBy && p.side === u.side);
              if (!thrower) return null;
              return (
                <svg key={`link-${u.id}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}>
                  <line
                    x1={`${thrower.position.x * 100}%`} y1={`${thrower.position.y * 100}%`}
                    x2={`${u.position.x * 100}%`} y2={`${u.position.y * 100}%`}
                    stroke="rgba(255,204,0,0.4)" strokeWidth="1.5" strokeDasharray="4 3"
                  />
                </svg>
              );
            })}
            {/* Token note popover */}
            {noteTarget && (() => {
              if (noteTarget.type === 'player') {
                const p = players.find(t => t.id === noteTarget.id);
                if (!p) return null;
                return (
                  <TokenNotePopover
                    title={`Player ${p.number} (${p.side.toUpperCase()})`}
                    content={p.label || ''}
                    onChange={html => setPlayers(prev => prev.map(t => t.id === p.id ? { ...t, label: html } : t))}
                    onDelete={() => setPlayers(prev => prev.map(t => t.id === p.id ? { ...t, label: '' } : t))}
                    onClose={() => setNoteTarget(null)}
                    position={p.position}
                    containerSize={mapSquareSize}
                    strategyId={strategy.id}
                    tokenId={p.id}
                  />
                );
              } else {
                const u = utilities.find(t => t.id === noteTarget.id);
                if (!u) return null;
                return (
                  <TokenNotePopover
                    title={`${u.type.charAt(0).toUpperCase() + u.type.slice(1)}${u.side ? ` (${u.side.toUpperCase()})` : ''}`}
                    content={u.label || ''}
                    onChange={html => setUtilities(prev => prev.map(t => t.id === u.id ? { ...t, label: html } : t))}
                    onDelete={() => setUtilities(prev => prev.map(t => t.id === u.id ? { ...t, label: '' } : t))}
                    onClose={() => setNoteTarget(null)}
                    position={u.position}
                    containerSize={mapSquareSize}
                    strategyId={strategy.id}
                    tokenId={u.id}
                  />
                );
              }
            })()}
          </div>
        </div>
      </div>

      <div className="phase-comments-section">
        <h4 className="phase-comments-heading">Phase Comments — {activePhase?.name}</h4>
        <CommentThread strategyId={strategy.id} targetType="phase" targetId={activePhase.id} />
      </div>

      {showAnimation && (
        <AnimationPlayer
          mapName={strategy.map}
          phases={phases.map((p, i) =>
            i === activePhaseIdx
              ? { ...p, boardState: { players, utilities, drawings }, notes: phaseNotes }
              : p
          )}
          onClose={() => setShowAnimation(false)}
        />
      )}
    </div>
  );
}
