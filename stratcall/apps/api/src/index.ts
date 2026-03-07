import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { db } from './db';
import auth from './routes/auth';
import playbooks from './routes/playbooks';
import share from './routes/share';
import community from './routes/community';
import discussions from './routes/discussions';
import notificationsRoute from './routes/notifications';
import phasesRoute from './routes/phases';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: (origin) => origin || '*',
  credentials: true,
}));

// Inject db and userId into context for all /api/* routes
app.use('/api/*', async (c, next) => {
  c.set('db', db);
  const userId = c.req.header('X-User-Id') || '';
  c.set('userId', userId);
  await next();
});

// Global error handler
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: err.message }, 500);
});

// Health check
app.get('/health', (c) => c.json({ status: 'ok', service: 'stratcall-api' }));

// Routes
app.route('/auth', auth);
app.route('/api/playbooks', playbooks);
app.route('/api', share);
app.route('/api/community', community);
app.route('/api', discussions);
app.route('/api', notificationsRoute);
app.route('/api/phases', phasesRoute);

const port = parseInt(process.env.PORT || '3000');
console.log(`StratCall API running on port ${port}`);

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' });

export default app;
