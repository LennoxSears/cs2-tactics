import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

// ── Users ──

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  steamId: text('steam_id').notNull().unique(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  bio: text('bio').notNull().default(''),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

// ── Follows ──

export const follows = sqliteTable('follows', {
  followerId: text('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  followingId: text('following_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.followerId, t.followingId] }),
]);

// ── Teams ──

export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  logoUrl: text('logo_url'),
  ownerId: text('owner_id').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const teamMembers = sqliteTable('team_members', {
  teamId: text('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'coach', 'player', 'viewer'] }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.teamId, t.userId] }),
]);

// ── Strategies (= repos) ──

export const strategies = sqliteTable('strategies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  map: text('map').notNull(),
  side: text('side', { enum: ['ct', 't'] }).notNull(),
  situation: text('situation').notNull().default('default'),
  stratType: text('strat_type').notNull().default('execute'),
  tempo: text('tempo').notNull().default('mid-round'),
  tags: text('tags', { mode: 'json' }).notNull().$type<string[]>().default([]),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
  starCount: integer('star_count').notNull().default(0),
  forkCount: integer('fork_count').notNull().default(0),
  forkedFrom: text('forked_from'), // references strategies.id (self-ref, no FK constraint)
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

// ── Phases ──

export const phases = sqliteTable('phases', {
  id: text('id').primaryKey(),
  strategyId: text('strategy_id').notNull().references(() => strategies.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  boardState: text('board_state', { mode: 'json' }).notNull().$type<{
    players: Array<{
      id: string;
      side: string;
      number: number;
      role: string | null;
      position: { x: number; y: number };
      label?: string;
    }>;
    utilities: Array<{
      id: string;
      type: string;
      position: { x: number; y: number };
      thrownBy?: number | null;
      side?: string | null;
      label?: string;
    }>;
    drawings: Array<{
      id: string;
      type: string;
      color: string;
      start?: { x: number; y: number };
      end?: { x: number; y: number };
      points?: Array<{ x: number; y: number }>;
    }>;
  }>(),
  notes: text('notes').notNull().default(''),
});

// ── Stars ──

export const stars = sqliteTable('stars', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  strategyId: text('strategy_id').notNull().references(() => strategies.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.userId, t.strategyId] }),
]);

// ── Playbooks (= collections) ──

export const playbooks = sqliteTable('playbooks', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const playbookEntries = sqliteTable('playbook_entries', {
  playbookId: text('playbook_id').notNull().references(() => playbooks.id, { onDelete: 'cascade' }),
  strategyId: text('strategy_id').notNull().references(() => strategies.id, { onDelete: 'cascade' }),
  sortOrder: integer('sort_order').notNull().default(0),
  addedAt: integer('added_at', { mode: 'timestamp_ms' }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.playbookId, t.strategyId] }),
]);

// ── Discussions ──

export const discussions = sqliteTable('discussions', {
  id: text('id').primaryKey(),
  strategyId: text('strategy_id').notNull().references(() => strategies.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  body: text('body').notNull().default(''),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  commentCount: integer('comment_count').notNull().default(0),
});

export const comments = sqliteTable('comments', {
  id: text('id').primaryKey(),
  strategyId: text('strategy_id').notNull().references(() => strategies.id, { onDelete: 'cascade' }),
  targetType: text('target_type', { enum: ['discussion', 'phase', 'token'] }).notNull(),
  targetId: text('target_id').notNull(), // discussion.id, phase.id, or token.id
  parentId: text('parent_id'), // null = top-level, else reply-to comment.id
  body: text('body').notNull(),
  createdBy: text('created_by').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

// ── Shared links ──

export const sharedLinks = sqliteTable('shared_links', {
  id: text('id').primaryKey(),
  strategyId: text('strategy_id').notNull().references(() => strategies.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: integer('expires_at', { mode: 'timestamp_ms' }),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});
