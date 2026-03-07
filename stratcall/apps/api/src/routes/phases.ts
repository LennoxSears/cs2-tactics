import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { phaseLibrary } from '@stratcall/db';
import type { Database } from '@stratcall/db';

type Env = { Variables: { db: Database; userId: string } };

const app = new Hono<Env>();

function toEpoch(d: Date | number): number {
  return d instanceof Date ? d.getTime() : d;
}

// GET /api/phases — list user's phases, optional ?map= filter
app.get('/', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const mapFilter = c.req.query('map');

  const conditions = [eq(phaseLibrary.userId, userId)];
  if (mapFilter) {
    conditions.push(eq(phaseLibrary.mapName, mapFilter));
  }

  const rows = await db
    .select()
    .from(phaseLibrary)
    .where(and(...conditions))
    .orderBy(desc(phaseLibrary.updatedAt));

  return c.json(rows.map(r => ({
    ...r,
    createdAt: toEpoch(r.createdAt),
    updatedAt: toEpoch(r.updatedAt),
  })));
});

// POST /api/phases — save a new phase
app.post('/', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const body = await c.req.json();

  const id = crypto.randomUUID();
  const now = new Date();

  await db.insert(phaseLibrary).values({
    id,
    userId,
    name: body.name || 'Untitled Phase',
    mapName: body.mapName,
    boardState: body.boardState,
    source: body.source || 'manual',
    tags: body.tags || [],
    createdAt: now,
    updatedAt: now,
  });

  return c.json({ id }, 201);
});

// GET /api/phases/:id — get one phase
app.get('/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const id = c.req.param('id');

  const [row] = await db
    .select()
    .from(phaseLibrary)
    .where(and(eq(phaseLibrary.id, id), eq(phaseLibrary.userId, userId)));

  if (!row) return c.json({ error: 'Not found' }, 404);

  return c.json({
    ...row,
    createdAt: toEpoch(row.createdAt),
    updatedAt: toEpoch(row.updatedAt),
  });
});

// PATCH /api/phases/:id — update name/tags
app.patch('/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = await c.req.json();

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.name !== undefined) updates.name = body.name;
  if (body.tags !== undefined) updates.tags = body.tags;

  await db
    .update(phaseLibrary)
    .set(updates)
    .where(and(eq(phaseLibrary.id, id), eq(phaseLibrary.userId, userId)));

  return c.json({ ok: true });
});

// DELETE /api/phases/:id — delete
app.delete('/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const id = c.req.param('id');

  await db
    .delete(phaseLibrary)
    .where(and(eq(phaseLibrary.id, id), eq(phaseLibrary.userId, userId)));

  return c.json({ ok: true });
});

export default app;
