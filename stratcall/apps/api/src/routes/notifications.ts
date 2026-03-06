import { Hono } from 'hono';
import { eq, and, desc, count } from 'drizzle-orm';
import { notifications, users } from '@stratcall/db';
import type { Database } from '@stratcall/db';

type Env = { Variables: { db: Database; userId: string } };

const app = new Hono<Env>();

// List notifications for current user
app.get('/notifications', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const limit = parseInt(c.req.query('limit') || '30', 10);

  const rows = await db.select({
    notification: notifications,
    actor: {
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    },
  })
    .from(notifications)
    .innerJoin(users, eq(notifications.actorId, users.id))
    .where(eq(notifications.recipientId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);

  return c.json(rows.map(r => ({
    ...r.notification,
    createdAt: r.notification.createdAt instanceof Date ? r.notification.createdAt.getTime() : r.notification.createdAt,
    actor: r.actor,
  })));
});

// Unread count
app.get('/notifications/unread-count', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');

  const [result] = await db.select({ count: count() })
    .from(notifications)
    .where(and(eq(notifications.recipientId, userId), eq(notifications.isRead, false)));

  return c.json({ count: result.count });
});

// Mark one notification as read
app.patch('/notifications/:id/read', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const id = c.req.param('id');

  await db.update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.id, id), eq(notifications.recipientId, userId)));

  return c.json({ ok: true });
});

// Mark all as read
app.patch('/notifications/read-all', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');

  await db.update(notifications)
    .set({ isRead: true })
    .where(and(eq(notifications.recipientId, userId), eq(notifications.isRead, false)));

  return c.json({ ok: true });
});

export default app;
