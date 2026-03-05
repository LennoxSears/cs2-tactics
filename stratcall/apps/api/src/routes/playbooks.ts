import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { playbooks, playbookEntries, strategies, phases } from '@stratcall/db';
import type { Database } from '@stratcall/db';

type AuthEnv = { Variables: { db: Database; userId: string } };

const app = new Hono<AuthEnv>();

// ── Strategies CRUD ──

// List user's strategies
app.get('/strategies', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const results = await db.select().from(strategies).where(eq(strategies.createdBy, userId));
  return c.json(results);
});

// Create strategy
app.post('/strategies', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const body = await c.req.json();
  const now = new Date();
  const id = crypto.randomUUID();

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
  await db.insert(phases).values({
    id: crypto.randomUUID(),
    strategyId: id,
    name: 'Setup',
    sortOrder: 0,
    boardState: { players: [], utilities: [], drawings: [] },
    notes: '',
  });

  return c.json({ id }, 201);
});

// Get strategy with phases
app.get('/strategies/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const [strat] = await db.select().from(strategies).where(eq(strategies.id, id)).limit(1);
  if (!strat) return c.json({ error: 'Not found' }, 404);
  const stratPhases = await db.select().from(phases).where(eq(phases.strategyId, id));
  return c.json({ ...strat, phases: stratPhases.sort((a, b) => a.sortOrder - b.sortOrder) });
});

// Update strategy
app.patch('/strategies/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = await c.req.json();

  await db.update(strategies)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(strategies.id, id), eq(strategies.createdBy, userId)));

  return c.json({ ok: true });
});

// Delete strategy
app.delete('/strategies/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const id = c.req.param('id');
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
  return c.json(results);
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

  return c.json({ id }, 201);
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

// Get playbook with strategies
app.get('/playbooks/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const [pb] = await db.select().from(playbooks).where(eq(playbooks.id, id)).limit(1);
  if (!pb) return c.json({ error: 'Not found' }, 404);

  const entries = await db.select().from(playbookEntries).where(eq(playbookEntries.playbookId, id));
  const stratIds = entries.map(e => e.strategyId);
  const strats = stratIds.length > 0
    ? await db.select().from(strategies).where(eq(strategies.id, stratIds[0])) // TODO: use inArray for multiple
    : [];

  return c.json({ ...pb, strategies: strats });
});

export default app;
