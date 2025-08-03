import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { notesRoutes } from './routes/notes.ts';
import { NOTES_DIR, PORT } from './config/constants.ts';
import { logger } from 'hono/logger';

const app = new Hono();

app.use("*", logger());
// CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Routes
app.route('/api/notes', notesRoutes);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
Bun.serve({
  fetch: app.fetch,
  port: PORT,
});


console.log(`🧠 Second Brain Server starting with Bun + Hono + Markdown...`);
console.log(`📁 Notes directory: ${NOTES_DIR}`);
console.log(`🌐 Server running on: http://localhost:${PORT}`);
