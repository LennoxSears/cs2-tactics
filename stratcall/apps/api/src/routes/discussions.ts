import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { discussions, comments } from '@stratcall/db';
import { db } from '../db';

const app = new Hono();

// ── Discussions ──

app.get('/strategies/:strategyId/discussions', async (c) => {
  const { strategyId } = c.req.param();
  const rows = await db
    .select()
    .from(discussions)
    .where(eq(discussions.strategyId, strategyId))
    .orderBy(desc(discussions.createdAt));
  return c.json(rows);
});

app.post('/strategies/:strategyId/discussions', async (c) => {
  const { strategyId } = c.req.param();
  const { title, body } = await c.req.json<{ title: string; body: string }>();
  const userId = c.req.header('X-User-Id') || 'anonymous';
  const now = new Date();
  const id = crypto.randomUUID();

  await db.insert(discussions).values({
    id, strategyId, title, body: body || '',
    createdBy: userId, createdAt: now, updatedAt: now, commentCount: 0,
  });

  const [row] = await db.select().from(discussions).where(eq(discussions.id, id));
  return c.json(row, 201);
});

app.delete('/discussions/:id', async (c) => {
  const { id } = c.req.param();
  // Delete child comments first
  const disc = await db.select().from(discussions).where(eq(discussions.id, id));
  if (disc.length) {
    await db.delete(comments).where(
      and(eq(comments.targetType, 'discussion'), eq(comments.targetId, id))
    );
  }
  await db.delete(discussions).where(eq(discussions.id, id));
  return c.json({ ok: true });
});

// ── Comments ──

app.get('/comments', async (c) => {
  const strategyId = c.req.query('strategyId');
  const targetType = c.req.query('targetType');
  const targetId = c.req.query('targetId');

  if (!strategyId || !targetType || !targetId) {
    return c.json({ error: 'strategyId, targetType, and targetId are required' }, 400);
  }

  const rows = await db
    .select()
    .from(comments)
    .where(
      and(
        eq(comments.strategyId, strategyId),
        eq(comments.targetType, targetType),
        eq(comments.targetId, targetId),
      )
    )
    .orderBy(comments.createdAt);

  return c.json(rows);
});

app.post('/comments', async (c) => {
  const { strategyId, targetType, targetId, parentId, body } = await c.req.json<{
    strategyId: string;
    targetType: string;
    targetId: string;
    parentId?: string | null;
    body: string;
  }>();

  if (!strategyId || !targetType || !targetId || !body) {
    return c.json({ error: 'strategyId, targetType, targetId, and body are required' }, 400);
  }

  const userId = c.req.header('X-User-Id') || 'anonymous';
  const now = new Date();
  const id = crypto.randomUUID();

  await db.insert(comments).values({
    id, strategyId, targetType, targetId,
    parentId: parentId || null, body,
    createdBy: userId, createdAt: now, updatedAt: now,
  });

  if (targetType === 'discussion') {
    const [disc] = await db.select().from(discussions).where(eq(discussions.id, targetId));
    if (disc) {
      await db.update(discussions)
        .set({ commentCount: disc.commentCount + 1, updatedAt: now })
        .where(eq(discussions.id, targetId));
    }
  }

  const [row] = await db.select().from(comments).where(eq(comments.id, id));
  return c.json(row, 201);
});

app.delete('/comments/:id', async (c) => {
  const { id } = c.req.param();

  const [comment] = await db.select().from(comments).where(eq(comments.id, id));
  if (!comment) return c.json({ error: 'Not found' }, 404);

  // Collect all descendants recursively
  const toDelete: string[] = [];
  const collect = async (pid: string) => {
    toDelete.push(pid);
    const children = await db.select({ id: comments.id })
      .from(comments)
      .where(eq(comments.parentId, pid));
    for (const child of children) {
      await collect(child.id);
    }
  };
  await collect(id);

  for (const delId of toDelete) {
    await db.delete(comments).where(eq(comments.id, delId));
  }

  if (comment.targetType === 'discussion') {
    const [disc] = await db.select().from(discussions).where(eq(discussions.id, comment.targetId));
    if (disc) {
      await db.update(discussions)
        .set({ commentCount: Math.max(0, disc.commentCount - toDelete.length), updatedAt: new Date() })
        .where(eq(discussions.id, comment.targetId));
    }
  }

  return c.json({ ok: true, deleted: toDelete.length });
});

export default app;
