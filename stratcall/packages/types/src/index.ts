// ── Maps ──

export type MapName =
  | 'mirage' | 'inferno' | 'dust2' | 'train' | 'nuke'
  | 'overpass' | 'ancient' | 'cache' | 'vertigo' | 'anubis'
  | 'cobblestone';

export type Side = 'ct' | 't';

// ── Board primitives ──

export interface Position {
  x: number; // 0-1 normalized
  y: number;
}

export interface PlayerToken {
  id: string;
  side: Side;
  number: number; // 1-5
  role: PlayerRole | null;
  position: Position;
  label?: string;
}

export interface UtilityMarker {
  id: string;
  type: UtilityType;
  position: Position;       // landing position
  thrownBy: number | null;  // player number (1-5), null = no throw info
  side: Side | null;        // which side's player throws it, null when thrownBy is null
  label?: string;
}

export type UtilityType = 'smoke' | 'flash' | 'molotov' | 'he';

export interface ArrowDrawing {
  id: string;
  type: 'arrow';
  start: Position;
  end: Position;
  color: string;
}

export interface FreehandDrawing {
  id: string;
  type: 'freehand';
  points: Position[];
  color: string;
}

export type Drawing = ArrowDrawing | FreehandDrawing;

export interface BoardState {
  players: PlayerToken[];
  utilities: UtilityMarker[];
  drawings: Drawing[];
}

// ── Core types ──

export type PlayerRole = 'entry' | 'awp' | 'support' | 'lurk' | 'igl';

export type RoundSituation =
  | 'pistol' | 'eco' | 'force-buy' | 'full-buy'
  | 'save' | 'anti-eco' | 'default' | 'retake';

export type StratType = 'execute' | 'default' | 'rush' | 'fake' | 'split' | 'retake' | 'stack' | 'rotate';

export type StratTempo = 'fast' | 'slow' | 'mid-round';

export interface Phase {
  id: string;
  name: string;
  sortOrder: number;
  boardState: BoardState;
  notes: string;
}

// ── Strategy (= repo) ──

export interface Strategy {
  id: string;
  name: string;
  description: string;
  map: MapName;
  // Four axes
  side: Side;
  situation: RoundSituation;
  stratType: StratType;
  tempo: StratTempo;
  // Freeform tags
  tags: string[];
  phases: Phase[];
  // Social
  isPublic: boolean;
  starCount: number;
  forkCount: number;
  forkedFrom: string | null; // strategy ID this was forked from
  // Ownership
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

// ── Playbook (= collection) ──

export interface Playbook {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface PlaybookEntry {
  playbookId: string;
  strategyId: string;
  sortOrder: number;
  addedAt: number;
}

// ── Users & Profiles ──

export interface User {
  id: string;
  steamId: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
  createdAt: number;
}

export interface Follow {
  followerId: string;
  followingId: string;
  createdAt: number;
}

// ── Stars ──

export interface Star {
  userId: string;
  strategyId: string;
  createdAt: number;
}

// ── Discussions ──

export interface Discussion {
  id: string;
  strategyId: string;
  title: string;
  body: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
  commentCount: number;
}

export interface Comment {
  id: string;
  discussionId: string;
  parentId: string | null; // null = top-level, otherwise reply
  body: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

// ── Teams ──

export type TeamRole = 'owner' | 'coach' | 'player' | 'viewer';

export interface Team {
  id: string;
  name: string;
  logoUrl: string | null;
  ownerId: string;
  createdAt: number;
}

export interface TeamMember {
  teamId: string;
  userId: string;
  role: TeamRole;
}

// ── Sharing ──

export interface SharedLink {
  id: string;
  strategyId: string;
  token: string;
  expiresAt: number | null;
  createdAt: number;
}

// ── .strat file format ──

export interface StratFile {
  format: 'stratcall';
  version: number;
  type: 'strategy';
  data: StratFileData;
}

export interface StratFileData {
  name: string;
  description: string;
  map: MapName;
  side: Side;
  situation: RoundSituation;
  stratType: StratType;
  tempo: StratTempo;
  tags: string[];
  phases: Phase[];
}

export interface StratBookFile {
  format: 'stratcall';
  version: number;
  type: 'playbook';
  data: {
    name: string;
    description: string;
    strategies: StratFileData[];
  };
}

export const STRAT_FILE_VERSION = 2;

// ── UI constants ──

export type ToolType =
  | 'player-ct' | 'player-t'
  | 'freehand' | 'eraser'
  | 'smoke' | 'flash' | 'molotov' | 'he';

export const ROUND_SITUATIONS: { value: RoundSituation; label: string }[] = [
  { value: 'pistol', label: 'Pistol' },
  { value: 'eco', label: 'Eco' },
  { value: 'force-buy', label: 'Force Buy' },
  { value: 'full-buy', label: 'Full Buy' },
  { value: 'save', label: 'Save' },
  { value: 'anti-eco', label: 'Anti-Eco' },
  { value: 'default', label: 'Default' },
  { value: 'retake', label: 'Retake' },
];

export const STRAT_TYPES: { value: StratType; label: string }[] = [
  { value: 'execute', label: 'Execute' },
  { value: 'default', label: 'Default' },
  { value: 'rush', label: 'Rush' },
  { value: 'fake', label: 'Fake' },
  { value: 'split', label: 'Split' },
  { value: 'retake', label: 'Retake' },
  { value: 'stack', label: 'Stack' },
  { value: 'rotate', label: 'Rotate' },
];

export const STRAT_TEMPOS: { value: StratTempo; label: string }[] = [
  { value: 'fast', label: 'Fast' },
  { value: 'slow', label: 'Slow' },
  { value: 'mid-round', label: 'Mid-Round' },
];

export const SEED_TAGS = [
  'A Site', 'B Site', 'Mid', 'Connector', 'Banana', 'Apartments',
  'Ramp', 'Long', 'Short', 'Palace', 'Jungle', 'Window',
  'Catwalk', 'Tunnels', 'Ivy', 'Squeaky', 'Heaven', 'Hell',
];

export const PLAYER_ROLES: { value: PlayerRole; label: string }[] = [
  { value: 'entry', label: 'Entry' },
  { value: 'awp', label: 'AWP' },
  { value: 'support', label: 'Support' },
  { value: 'lurk', label: 'Lurk' },
  { value: 'igl', label: 'IGL' },
];
