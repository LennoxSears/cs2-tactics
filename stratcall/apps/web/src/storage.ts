import type { Strategy, Playbook, PlaybookEntry, Phase } from './types';

const STRATEGIES_KEY = 'stratcall-strategies-v2';
const PLAYBOOKS_KEY = 'stratcall-playbooks-v2';
const PLAYBOOK_ENTRIES_KEY = 'stratcall-playbook-entries-v2';
const STARS_KEY = 'stratcall-stars';
const MIGRATED_KEY = 'stratcall-migrated-v2';

// ── ID generation ──

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ── Strategies ──

export function loadStrategies(): Strategy[] {
  try {
    const data = localStorage.getItem(STRATEGIES_KEY);
    if (!data) return [];
    return (JSON.parse(data) as Record<string, unknown>[]).map(migrateStrategy);
  } catch {
    return [];
  }
}

export function saveStrategy(strategy: Strategy): void {
  const strategies = loadStrategies();
  const idx = strategies.findIndex(s => s.id === strategy.id);
  strategy.updatedAt = Date.now();
  if (idx >= 0) {
    strategies[idx] = strategy;
  } else {
    strategies.push(strategy);
  }
  localStorage.setItem(STRATEGIES_KEY, JSON.stringify(strategies));
}

export function deleteStrategy(id: string): void {
  const strategies = loadStrategies().filter(s => s.id !== id);
  localStorage.setItem(STRATEGIES_KEY, JSON.stringify(strategies));
  // Remove from all playbook entries
  const entries = loadPlaybookEntries().filter(e => e.strategyId !== id);
  localStorage.setItem(PLAYBOOK_ENTRIES_KEY, JSON.stringify(entries));
}

// ── Playbooks (collections) ──

export function loadPlaybooks(): Playbook[] {
  try {
    const data = localStorage.getItem(PLAYBOOKS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function savePlaybook(playbook: Playbook): void {
  const playbooks = loadPlaybooks();
  const idx = playbooks.findIndex(p => p.id === playbook.id);
  playbook.updatedAt = Date.now();
  if (idx >= 0) {
    playbooks[idx] = playbook;
  } else {
    playbooks.push(playbook);
  }
  localStorage.setItem(PLAYBOOKS_KEY, JSON.stringify(playbooks));
}

export function deletePlaybook(id: string): void {
  const playbooks = loadPlaybooks().filter(p => p.id !== id);
  localStorage.setItem(PLAYBOOKS_KEY, JSON.stringify(playbooks));
  // Remove entries for this playbook
  const entries = loadPlaybookEntries().filter(e => e.playbookId !== id);
  localStorage.setItem(PLAYBOOK_ENTRIES_KEY, JSON.stringify(entries));
}

// ── Playbook entries (many-to-many) ──

export function loadPlaybookEntries(): PlaybookEntry[] {
  try {
    const data = localStorage.getItem(PLAYBOOK_ENTRIES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function addToPlaybook(playbookId: string, strategyId: string): void {
  const entries = loadPlaybookEntries();
  if (entries.some(e => e.playbookId === playbookId && e.strategyId === strategyId)) return;
  const maxOrder = entries.filter(e => e.playbookId === playbookId).reduce((m, e) => Math.max(m, e.sortOrder), -1);
  entries.push({ playbookId, strategyId, sortOrder: maxOrder + 1, addedAt: Date.now() });
  localStorage.setItem(PLAYBOOK_ENTRIES_KEY, JSON.stringify(entries));
}

export function removeFromPlaybook(playbookId: string, strategyId: string): void {
  const entries = loadPlaybookEntries().filter(e => !(e.playbookId === playbookId && e.strategyId === strategyId));
  localStorage.setItem(PLAYBOOK_ENTRIES_KEY, JSON.stringify(entries));
}

export function getPlaybookStrategies(playbookId: string): Strategy[] {
  const entries = loadPlaybookEntries().filter(e => e.playbookId === playbookId).sort((a, b) => a.sortOrder - b.sortOrder);
  const strategies = loadStrategies();
  return entries.map(e => strategies.find(s => s.id === e.strategyId)).filter(Boolean) as Strategy[];
}

// ── Stars (local) ──

export function loadStarredIds(): Set<string> {
  try {
    const data = localStorage.getItem(STARS_KEY);
    return new Set(data ? JSON.parse(data) : []);
  } catch {
    return new Set();
  }
}

export function toggleStar(strategyId: string): boolean {
  const starred = loadStarredIds();
  const isStarred = starred.has(strategyId);
  if (isStarred) starred.delete(strategyId);
  else starred.add(strategyId);
  localStorage.setItem(STARS_KEY, JSON.stringify([...starred]));
  return !isStarred;
}

// ── Phase helpers ──

export function createEmptyPhase(name: string): Phase {
  return {
    id: generateId(),
    name,
    sortOrder: 0,
    boardState: { players: [], utilities: [], drawings: [] },
    notes: '',
  };
}

// ── Fork a strategy ──

export function forkStrategy(original: Strategy, userId: string): Strategy {
  const now = Date.now();
  const forked: Strategy = {
    ...original,
    id: generateId(),
    name: original.name,
    description: original.description,
    isPublic: false,
    starCount: 0,
    forkCount: 0,
    forkedFrom: original.id,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    phases: original.phases.map(p => ({
      ...p,
      id: generateId(),
      boardState: JSON.parse(JSON.stringify(p.boardState)),
    })),
  };
  saveStrategy(forked);
  return forked;
}

// ── Migration from v1 format ──

export function migrateFromLegacy(): void {
  if (localStorage.getItem(MIGRATED_KEY)) return;

  // Migrate from v1 strategies
  const oldData = localStorage.getItem('stratcall-strategies');
  if (oldData) {
    try {
      const oldStrategies = JSON.parse(oldData) as Record<string, unknown>[];
      const migrated = oldStrategies.map(migrateStrategy);
      localStorage.setItem(STRATEGIES_KEY, JSON.stringify(migrated));
    } catch { /* ignore */ }
  }

  // Migrate from very old format
  const veryOld = localStorage.getItem('cs2-tactics-strategies');
  if (veryOld && !oldData) {
    try {
      const oldStrategies = JSON.parse(veryOld) as Record<string, unknown>[];
      const migrated = oldStrategies.map(migrateStrategy);
      localStorage.setItem(STRATEGIES_KEY, JSON.stringify(migrated));
    } catch { /* ignore */ }
  }

  localStorage.setItem(MIGRATED_KEY, '1');
}

function migrateStrategy(raw: Record<string, unknown>): Strategy {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = raw as any;

  if (!s.side) s.side = 't';
  if (!s.tags) s.tags = [];
  if (!s.situation) s.situation = 'default';
  if (!s.stratType) s.stratType = 'execute';
  if (!s.tempo) s.tempo = 'mid-round';
  if (!s.description) s.description = s.notes || '';
  if (!s.phases || s.phases.length === 0) {
    s.phases = [{
      id: generateId(),
      name: 'Setup',
      sortOrder: 0,
      boardState: {
        players: s.players || [],
        utilities: s.utilities || [],
        drawings: s.drawings || [],
      },
      notes: '',
    }];
  }
  if (s.isPublic === undefined) s.isPublic = false;
  if (s.starCount === undefined) s.starCount = 0;
  if (s.forkCount === undefined) s.forkCount = 0;
  if (s.forkedFrom === undefined) s.forkedFrom = null;
  if (!s.createdBy) s.createdBy = 'local';
  if (!s.updatedAt) s.updatedAt = s.createdAt || Date.now();
  if (!s.createdAt) s.createdAt = Date.now();

  // Ensure utility markers have thrownBy/side fields
  for (const phase of s.phases) {
    if (phase.boardState?.utilities) {
      phase.boardState.utilities = phase.boardState.utilities.map((u: any) => ({
        ...u,
        thrownBy: u.thrownBy ?? null,
        side: u.side ?? null,
      }));
    }
  }

  // Remove legacy fields
  delete s.players;
  delete s.utilities;
  delete s.drawings;
  delete s.folderId;
  delete s.playbookId;
  delete s.isFavorite;
  delete s.notes;

  return s as Strategy;
}
