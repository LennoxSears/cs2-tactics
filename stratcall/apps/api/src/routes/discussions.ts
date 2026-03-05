import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { discussions, comments, users } from '@stratcall/db';
import { db } from '../db';

const app = new Hono();

// ── Discussions (strategy-level threads) ──

// List discussions for a strategy
app.get('/strategies/:strategyId/discussions', async (c) => {
  const { strategyId } = c.req.param();
  const rows = await db
    .select()
    .from(discussions)
    .where(eq(discussions.strategyId, strategyId))
    .orderBy(desc(discussions.createdAt));
  return c.json(rows);
});

// Create a discussion
app.post('/strategies/:strategyId/discussions', async (c) => {
  const { strategyId } = c.req.param();
  const { title, body } = await c.req.json<{ title: string; body: string }>();
  const userId = c.req.header('X-User-Id') || 'anonymous';
  const now = new Date();
  const id = crypto.randomUUID();

  await db.insert(discussions).values({
    id,
    strategyId,
    title,
    body: body || '',
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    commentCount: 0,
  });

  const [row] = await db.select().from(discussions).where(eq(discussions.id, id));
  return c.json(row, 201);
});

// Delete a discussion (and its comments via cascade)
app.delete('/discussions/:id', async (c) => {
  const { id } = c.req.param();
  await db.delete(discussions).where(eq(discussions.id, id));
  return c.json({ ok: true });
});

// ── Comments (polymorphic: discussion / phase / token) ──

// List comments for a target
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

// Create a comment
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
    id,
    strategyId,
    targetType,
    targetId,
    parentId: parentId || null,
    body,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  // If this is a discussion comment, increment the count
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

// Delete a comment and all its replies (recursive)
app.delete('/comments/:id', async (c) => {
  const { id } = c.req.param();

  // Find the comment to get its target info
  const [comment] = await db.select().from(comments).where(eq(comments.id, id));
  if (!comment) return c.json({ error: 'Not found' }, 404);

  // Collect all descendant IDs
  const toDelete: string[] = [];
  const collect = async (parentId: string) => {
    toDelete.push(parentId);
    const children = await db.select({ id: comments.id })
      .from(comments)
      .where(eq(comments.parentId, parentId));
    for (const child of children) {
      await collect(child.id);
    }
  };
  await collect(id);

  // Delete all
  for (const delId of toDelete) {
    await db.delete(comments).where(eq(comments.id, delId));
  }

  // Decrement discussion comment count
  if (comment.targetType === 'discussion') {
    const [disc] = await db.select().from(discussions).where(eq(discussions.id, comment.targetId));
    if (disc) {
      const newCount = Math.max(0, disc.commentCount - toDelete.length);
      await db.update(discussions)
        .set({ commentCount: newCount, updatedAt: new Date() })
        .where(eq(discussions.id, comment.targetId));
    }
  }

  return c.json({ ok: true, deleted: toDelete.length });
});

export default app;
