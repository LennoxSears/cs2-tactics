import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { sharedLinks, strategies, phases } from '@stratcall/db';
import type { Database } from '@stratcall/db';
import type { StratFile, StratFileData, Phase as PhaseType } from '@stratcall/types';
import { STRAT_FILE_VERSION } from '@stratcall/types';

type Env = { Variables: { db: Database; userId: string } };

const app = new Hono<Env>();

// Create share link
app.post('/strategies/:stratId/share', async (c) => {
  const db = c.get('db');
  const stratId = c.req.param('stratId');
  const body = await c.req.json<{ expiresInHours?: number }>().catch(() => ({ expiresInHours: undefined }));

  const token = nanoid(12);
  const expiresAt = body.expiresInHours
    ? new Date(Date.now() + body.expiresInHours * 60 * 60 * 1000)
    : null;

  await db.insert(sharedLinks).values({
    id: nanoid(),
    strategyId: stratId,
    token,
    expiresAt,
    createdAt: new Date(),
  });

  return c.json({ token, url: `/s/${token}` }, 201);
});

// View shared strategy (public)
app.get('/s/:token', async (c) => {
  const db = c.get('db');
  const token = c.req.param('token');
  const [link] = await db.select().from(sharedLinks).where(eq(sharedLinks.token, token)).limit(1);

  if (!link) return c.json({ error: 'Link not found' }, 404);
  if (link.expiresAt && link.expiresAt < new Date()) {
    return c.json({ error: 'Link expired' }, 410);
  }

  const [strategy] = await db.select().from(strategies).where(eq(strategies.id, link.strategyId)).limit(1);
  if (!strategy) return c.json({ error: 'Strategy not found' }, 404);

  const stratPhases = await db.select().from(phases).where(eq(phases.strategyId, strategy.id));

  return c.json({ ...strategy, phases: stratPhases.sort((a, b) => a.sortOrder - b.sortOrder) });
});

// Export as .strat file
app.get('/strategies/:stratId/export', async (c) => {
  const db = c.get('db');
  const stratId = c.req.param('stratId');
  const [strategy] = await db.select().from(strategies).where(eq(strategies.id, stratId)).limit(1);
  if (!strategy) return c.json({ error: 'Not found' }, 404);

  const stratPhases = await db.select().from(phases).where(eq(phases.strategyId, stratId));

  const file: StratFile = {
    format: 'stratcall',
    version: STRAT_FILE_VERSION,
    type: 'strategy',
    data: {
      name: strategy.name,
      description: strategy.description,
      map: strategy.map as StratFileData['map'],
      side: strategy.side as StratFileData['side'],
      situation: strategy.situation as StratFileData['situation'],
      stratType: (strategy.stratType || 'execute') as StratFileData['stratType'],
      tempo: (strategy.tempo || 'mid-round') as StratFileData['tempo'],
      tags: strategy.tags as string[],
      phases: stratPhases
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(p => ({
          id: p.id,
          name: p.name,
          sortOrder: p.sortOrder,
          boardState: p.boardState as PhaseType['boardState'],
          notes: p.notes,
        })),
    },
  };

  c.header('Content-Type', 'application/json');
  c.header('Content-Disposition', `attachment; filename="${strategy.name.replace(/[^a-zA-Z0-9-_ ]/g, '')}.strat"`);
  return c.json(file);
});

export default app;
