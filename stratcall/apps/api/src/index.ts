import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import auth from './routes/auth';
import playbooks from './routes/playbooks';
import share from './routes/share';
import community from './routes/community';
import discussions from './routes/discussions';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: (origin) => origin || '*',
  credentials: true,
}));

// Health check
app.get('/health', (c) => c.json({ status: 'ok', service: 'stratcall-api' }));

// Routes
app.route('/auth', auth);
app.route('/api/playbooks', playbooks);
app.route('/api', share);
app.route('/api/community', community);
app.route('/api', discussions);

const port = parseInt(process.env.PORT || '3000');
console.log(`StratCall API running on port ${port}`);

serve({ fetch: app.fetch, port, hostname: '0.0.0.0' });

export default app;
