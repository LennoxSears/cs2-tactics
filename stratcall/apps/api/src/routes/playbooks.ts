import { Hono } from 'hono';
import { eq, and, inArray } from 'drizzle-orm';
import { playbooks, playbookEntries, strategies, phases, tagUsage } from '@stratcall/db';
import type { Database } from '@stratcall/db';

type AuthEnv = { Variables: { db: Database; userId: string } };

const app = new Hono<AuthEnv>();

// Helper: convert DB Date timestamps to epoch ms for frontend compatibility
function toEpoch(d: Date | number): number {
  return d instanceof Date ? d.getTime() : d;
}

// Sync tag_usage counts when tags change
async function syncTagCounts(db: Database, oldTags: string[], newTags: string[]) {
  const oldSet = new Set(oldTags);
  const newSet = new Set(newTags);
  const added = newTags.filter(t => !oldSet.has(t));
  const removed = oldTags.filter(t => !newSet.has(t));

  for (const tag of added) {
    // Upsert: insert with count=1 or increment
    const [existing] = await db.select().from(tagUsage).where(eq(tagUsage.tag, tag)).limit(1);
    if (existing) {
      await db.update(tagUsage).set({ count: existing.count + 1 }).where(eq(tagUsage.tag, tag));
    } else {
      await db.insert(tagUsage).values({ tag, count: 1 });
    }
  }

  for (const tag of removed) {
    const [existing] = await db.select().from(tagUsage).where(eq(tagUsage.tag, tag)).limit(1);
    if (existing && existing.count > 1) {
      await db.update(tagUsage).set({ count: existing.count - 1 }).where(eq(tagUsage.tag, tag));
    } else if (existing) {
      await db.delete(tagUsage).where(eq(tagUsage.tag, tag));
    }
  }
}

// ── Strategies CRUD ──

// List user's strategies (with phases)
app.get('/strategies', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const strats = await db.select().from(strategies).where(eq(strategies.createdBy, userId));
  const stratIds = strats.map(s => s.id);
  const allPhases = stratIds.length > 0
    ? await db.select().from(phases).where(inArray(phases.strategyId, stratIds))
    : [];

  const result = strats.map(s => ({
    ...s,
    createdAt: toEpoch(s.createdAt),
    updatedAt: toEpoch(s.updatedAt),
    phases: allPhases
      .filter(p => p.strategyId === s.id)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }));
  return c.json(result);
});

// Create strategy
app.post('/strategies', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const body = await c.req.json();
  const now = new Date();
  const id = crypto.randomUUID();
  const phaseId = crypto.randomUUID();

  await db.insert(strategies).values({
    id,
    name: body.name || 'Untitled',
    description: body.description || '',
    map: body.map,
    side: body.side || 't',
    situation: body.situation || 'default',
    stratType: body.stratType || 'execute',
    tempo: body.tempo || 'mid-round',
    tags: body.tags || [],
    isPublic: false,
    starCount: 0,
    forkCount: 0,
    forkedFrom: null,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  // Create initial phase
  const initialPhase = {
    id: phaseId,
    strategyId: id,
    name: 'Setup',
    sortOrder: 0,
    boardState: { players: [], utilities: [], drawings: [] },
    notes: '',
  };
  await db.insert(phases).values(initialPhase);

  // Track tag usage
  const newTags = body.tags || [];
  if (newTags.length > 0) await syncTagCounts(db, [], newTags);

  return c.json({
    id,
    name: body.name || 'Untitled',
    description: body.description || '',
    map: body.map,
    side: body.side || 't',
    situation: body.situation || 'default',
    stratType: body.stratType || 'execute',
    tempo: body.tempo || 'mid-round',
    tags: body.tags || [],
    isPublic: false,
    starCount: 0,
    forkCount: 0,
    forkedFrom: null,
    createdBy: userId,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
    phases: [initialPhase],
  }, 201);
});

// Get strategy with phases
app.get('/strategies/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const [strat] = await db.select().from(strategies).where(eq(strategies.id, id)).limit(1);
  if (!strat) return c.json({ error: 'Not found' }, 404);
  const stratPhases = await db.select().from(phases).where(eq(phases.strategyId, id));
  return c.json({
    ...strat,
    createdAt: toEpoch(strat.createdAt),
    updatedAt: toEpoch(strat.updatedAt),
    phases: stratPhases.sort((a, b) => a.sortOrder - b.sortOrder),
  });
});

// Update strategy (only allow safe fields)
app.patch('/strategies/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = await c.req.json();

  const allowed: Record<string, unknown> = {};
  for (const key of ['name', 'description', 'map', 'side', 'situation', 'stratType', 'tempo', 'tags', 'isPublic'] as const) {
    if (body[key] !== undefined) allowed[key] = body[key];
  }

  // Sync tag counts if tags changed
  if (body.tags !== undefined) {
    const [existing] = await db.select({ tags: strategies.tags })
      .from(strategies)
      .where(and(eq(strategies.id, id), eq(strategies.createdBy, userId)))
      .limit(1);
    const oldTags = (existing?.tags as string[]) || [];
    await syncTagCounts(db, oldTags, body.tags);
  }

  await db.update(strategies)
    .set({ ...allowed, updatedAt: new Date() })
    .where(and(eq(strategies.id, id), eq(strategies.createdBy, userId)));

  return c.json({ ok: true });
});

// Delete strategy
app.delete('/strategies/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const id = c.req.param('id');

  // Decrement tag counts before deleting
  const [existing] = await db.select({ tags: strategies.tags })
    .from(strategies)
    .where(and(eq(strategies.id, id), eq(strategies.createdBy, userId)))
    .limit(1);
  if (existing) {
    const oldTags = (existing.tags as string[]) || [];
    if (oldTags.length > 0) await syncTagCounts(db, oldTags, []);
  }

  await db.delete(strategies).where(and(eq(strategies.id, id), eq(strategies.createdBy, userId)));
  return c.json({ ok: true });
});

// ── Phases CRUD ──

app.post('/strategies/:id/phases', async (c) => {
  const db = c.get('db');
  const stratId = c.req.param('id');
  const body = await c.req.json();
  const id = crypto.randomUUID();

  await db.insert(phases).values({
    id,
    strategyId: stratId,
    name: body.name || 'New Phase',
    sortOrder: body.sortOrder || 0,
    boardState: body.boardState || { players: [], utilities: [], drawings: [] },
    notes: body.notes || '',
  });

  return c.json({ id }, 201);
});

app.patch('/phases/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const body = await c.req.json();
  await db.update(phases).set(body).where(eq(phases.id, id));
  return c.json({ ok: true });
});

app.delete('/phases/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  await db.delete(phases).where(eq(phases.id, id));
  return c.json({ ok: true });
});

// ── Playbooks (collections) CRUD ──

app.get('/playbooks', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const results = await db.select().from(playbooks).where(eq(playbooks.createdBy, userId));
  return c.json(results.map(pb => ({
    ...pb,
    createdAt: toEpoch(pb.createdAt),
    updatedAt: toEpoch(pb.updatedAt),
  })));
});

app.post('/playbooks', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const body = await c.req.json();
  const now = new Date();
  const id = crypto.randomUUID();

  await db.insert(playbooks).values({
    id,
    name: body.name || 'Untitled',
    description: body.description || '',
    isPublic: false,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  return c.json({
    id,
    name: body.name || 'Untitled',
    description: body.description || '',
    isPublic: false,
    createdBy: userId,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
  }, 201);
});

app.delete('/playbooks/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const id = c.req.param('id');
  await db.delete(playbooks).where(and(eq(playbooks.id, id), eq(playbooks.createdBy, userId)));
  return c.json({ ok: true });
});

// Add strategy to playbook
app.post('/playbooks/:id/strategies', async (c) => {
  const db = c.get('db');
  const playbookId = c.req.param('id');
  const body = await c.req.json();

  await db.insert(playbookEntries).values({
    playbookId,
    strategyId: body.strategyId,
    sortOrder: body.sortOrder || 0,
    addedAt: new Date(),
  });

  return c.json({ ok: true }, 201);
});

// Remove strategy from playbook
app.delete('/playbooks/:pbId/strategies/:stratId', async (c) => {
  const db = c.get('db');
  const playbookId = c.req.param('pbId');
  const strategyId = c.req.param('stratId');
  await db.delete(playbookEntries)
    .where(and(eq(playbookEntries.playbookId, playbookId), eq(playbookEntries.strategyId, strategyId)));
  return c.json({ ok: true });
});

// Get playbook with strategies (including phases)
app.get('/playbooks/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const [pb] = await db.select().from(playbooks).where(eq(playbooks.id, id)).limit(1);
  if (!pb) return c.json({ error: 'Not found' }, 404);

  const entries = await db.select().from(playbookEntries).where(eq(playbookEntries.playbookId, id));
  const stratIds = entries.map(e => e.strategyId);
  const strats = stratIds.length > 0
    ? await db.select().from(strategies).where(inArray(strategies.id, stratIds))
    : [];

  // Load phases for all strategies
  const allPhases = stratIds.length > 0
    ? await db.select().from(phases).where(inArray(phases.strategyId, stratIds))
    : [];

  // Sort strategies by playbook entry order
  const sortedStrats = entries
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(e => {
      const s = strats.find(s => s.id === e.strategyId);
      if (!s) return null;
      return {
        ...s,
        createdAt: toEpoch(s.createdAt),
        updatedAt: toEpoch(s.updatedAt),
        phases: allPhases
          .filter(p => p.strategyId === s.id)
          .sort((a, b) => a.sortOrder - b.sortOrder),
      };
    })
    .filter(Boolean);

  return c.json({
    ...pb,
    createdAt: toEpoch(pb.createdAt),
    updatedAt: toEpoch(pb.updatedAt),
    strategies: sortedStrats,
  });
});

export default app;
