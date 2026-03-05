import { Hono } from 'hono';
import { eq, and, desc, sql } from 'drizzle-orm';
import { strategies, phases, stars, users } from '@stratcall/db';
import type { Database } from '@stratcall/db';

type Env = { Variables: { db: Database; userId: string } };

const community = new Hono<Env>();

// Browse public strategies
community.get('/strategies', async (c) => {
  const db = c.get('db');
  const map = c.req.query('map');
  const side = c.req.query('side');
  const situation = c.req.query('situation');
  const tag = c.req.query('tag');
  const limit = parseInt(c.req.query('limit') || '50', 10);

  const results = await db
    .select({
      strategy: strategies,
      author: {
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
      },
    })
    .from(strategies)
    .leftJoin(users, eq(strategies.createdBy, users.id))
    .where(eq(strategies.isPublic, true))
    .orderBy(desc(strategies.starCount), desc(strategies.updatedAt))
    .limit(limit);

  let filtered = results;
  if (map) filtered = filtered.filter(r => r.strategy.map === map);
  if (side) filtered = filtered.filter(r => r.strategy.side === side);
  if (situation) filtered = filtered.filter(r => r.strategy.situation === situation);
  if (tag) filtered = filtered.filter(r => {
    const tags = r.strategy.tags as string[];
    return tags && tags.includes(tag);
  });

  return c.json(filtered.map(r => ({
    strategy: r.strategy,
    author: r.author,
    voteCount: r.strategy.starCount,
  })));
});

// Star/unstar a strategy
community.post('/strategies/:id/star', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const stratId = c.req.param('id');

  const existing = await db.select().from(stars)
    .where(and(eq(stars.strategyId, stratId), eq(stars.userId, userId)))
    .limit(1);

  if (existing.length > 0) {
    // Unstar
    await db.delete(stars)
      .where(and(eq(stars.strategyId, stratId), eq(stars.userId, userId)));
    await db.update(strategies)
      .set({ starCount: sql`${strategies.starCount} - 1` })
      .where(eq(strategies.id, stratId));
    return c.json({ starred: false });
  } else {
    // Star
    await db.insert(stars).values({
      userId,
      strategyId: stratId,
      createdAt: new Date(),
    });
    await db.update(strategies)
      .set({ starCount: sql`${strategies.starCount} + 1` })
      .where(eq(strategies.id, stratId));
    return c.json({ starred: true });
  }
});

// Fork a strategy
community.post('/strategies/:id/fork', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const stratId = c.req.param('id');

  const [original] = await db.select().from(strategies).where(eq(strategies.id, stratId)).limit(1);
  if (!original) return c.json({ error: 'Strategy not found' }, 404);

  const originalPhases = await db.select().from(phases).where(eq(phases.strategyId, stratId));

  const newId = crypto.randomUUID();
  const now = new Date();

  await db.insert(strategies).values({
    ...original,
    id: newId,
    isPublic: false,
    starCount: 0,
    forkCount: 0,
    forkedFrom: stratId,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
  });

  // Increment fork count on original
  await db.update(strategies)
    .set({ forkCount: sql`${strategies.forkCount} + 1` })
    .where(eq(strategies.id, stratId));

  // Copy phases
  for (const phase of originalPhases) {
    await db.insert(phases).values({
      ...phase,
      id: crypto.randomUUID(),
      strategyId: newId,
    });
  }

  return c.json({ id: newId });
});

export default community;
