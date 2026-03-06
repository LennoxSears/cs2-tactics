import { Hono } from 'hono';
import { eq, and, desc, sql, count } from 'drizzle-orm';
import { strategies, phases, stars, users, tagUsage, follows, notifications } from '@stratcall/db';
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

    // Notify strategy owner
    const [strat] = await db.select({ createdBy: strategies.createdBy, name: strategies.name })
      .from(strategies).where(eq(strategies.id, stratId)).limit(1);
    if (strat && strat.createdBy !== userId) {
      await db.insert(notifications).values({
        id: crypto.randomUUID(),
        recipientId: strat.createdBy,
        actorId: userId,
        type: 'star',
        targetId: stratId,
        targetName: strat.name,
        isRead: false,
        createdAt: new Date(),
      });
    }

    return c.json({ starred: true });
  }
});

// Fork a strategy — returns the full forked strategy with phases
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

  // Notify original strategy owner
  if (original.createdBy !== userId) {
    await db.insert(notifications).values({
      id: crypto.randomUUID(),
      recipientId: original.createdBy,
      actorId: userId,
      type: 'fork',
      targetId: stratId,
      targetName: original.name,
      isRead: false,
      createdAt: new Date(),
    });
  }

  // Copy phases
  const newPhases = [];
  for (const phase of originalPhases) {
    const newPhase = { ...phase, id: crypto.randomUUID(), strategyId: newId };
    await db.insert(phases).values(newPhase);
    newPhases.push(newPhase);
  }

  return c.json({
    ...original,
    id: newId,
    isPublic: false,
    starCount: 0,
    forkCount: 0,
    forkedFrom: stratId,
    createdBy: userId,
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
    phases: newPhases.sort((a, b) => a.sortOrder - b.sortOrder),
  });
});

// Popular tags — from pre-aggregated tag_usage table
community.get('/tags/popular', async (c) => {
  const db = c.get('db');
  const limit = parseInt(c.req.query('limit') || '30', 10);
  const rows = await db.select()
    .from(tagUsage)
    .orderBy(desc(tagUsage.count))
    .limit(limit);
  return c.json(rows);
});

// Get user's starred strategy IDs
community.get('/starred', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const results = await db.select({ strategyId: stars.strategyId }).from(stars).where(eq(stars.userId, userId));
  return c.json(results.map(r => r.strategyId));
});

// ── User profiles ──

// Get user profile with follower/following counts and public strategies
community.get('/users/:id', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const targetId = c.req.param('id');

  const [user] = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
  if (!user) return c.json({ error: 'User not found' }, 404);

  const [followerCount] = await db.select({ count: count() }).from(follows).where(eq(follows.followingId, targetId));
  const [followingCount] = await db.select({ count: count() }).from(follows).where(eq(follows.followerId, targetId));

  // Check if current user follows this user
  const [isFollowing] = userId
    ? await db.select().from(follows).where(and(eq(follows.followerId, userId), eq(follows.followingId, targetId))).limit(1)
    : [undefined];

  const publicStrats = await db.select().from(strategies)
    .where(and(eq(strategies.createdBy, targetId), eq(strategies.isPublic, true)))
    .orderBy(desc(strategies.updatedAt))
    .limit(20);

  return c.json({
    user: {
      id: user.id,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
    },
    followerCount: followerCount.count,
    followingCount: followingCount.count,
    isFollowing: !!isFollowing,
    strategies: publicStrats,
  });
});

// Follow a user
community.post('/users/:id/follow', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const targetId = c.req.param('id');

  if (userId === targetId) return c.json({ error: 'Cannot follow yourself' }, 400);

  const [existing] = await db.select().from(follows)
    .where(and(eq(follows.followerId, userId), eq(follows.followingId, targetId)))
    .limit(1);

  if (existing) return c.json({ following: true });

  await db.insert(follows).values({
    followerId: userId,
    followingId: targetId,
    createdAt: new Date(),
  });

  // Notify the followed user
  const [actor] = await db.select({ displayName: users.displayName }).from(users).where(eq(users.id, userId)).limit(1);
  await db.insert(notifications).values({
    id: crypto.randomUUID(),
    recipientId: targetId,
    actorId: userId,
    type: 'follow',
    targetId: userId,
    targetName: actor?.displayName || 'Someone',
    isRead: false,
    createdAt: new Date(),
  });

  return c.json({ following: true });
});

// Unfollow a user
community.delete('/users/:id/follow', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const targetId = c.req.param('id');

  await db.delete(follows)
    .where(and(eq(follows.followerId, userId), eq(follows.followingId, targetId)));

  return c.json({ following: false });
});

// Get followers of a user
community.get('/users/:id/followers', async (c) => {
  const db = c.get('db');
  const targetId = c.req.param('id');

  const rows = await db.select({
    id: users.id,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
  })
    .from(follows)
    .innerJoin(users, eq(follows.followerId, users.id))
    .where(eq(follows.followingId, targetId));

  return c.json(rows);
});

// Get users that a user is following
community.get('/users/:id/following', async (c) => {
  const db = c.get('db');
  const targetId = c.req.param('id');

  const rows = await db.select({
    id: users.id,
    displayName: users.displayName,
    avatarUrl: users.avatarUrl,
  })
    .from(follows)
    .innerJoin(users, eq(follows.followingId, users.id))
    .where(eq(follows.followerId, targetId));

  return c.json(rows);
});

export default community;
