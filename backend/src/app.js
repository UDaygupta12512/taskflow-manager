const express = require('express');
const cors = require('cors');
const { corsOrigin } = require('./config');
const authRoutes = require('./routes/auth.routes');
const tasksRoutes = require('./routes/tasks.routes');

require('./db/database');

const app = express();

app.use(
  cors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '2.0.0', database: 'sqlite' });
});

app.get('/api', (_req, res) => {
  res.json({
    name: 'TaskFlow API',
    version: '2.0.0',
    endpoints: {
      auth: [
        'POST /api/auth/register',
        'POST /api/auth/login',
        'POST /api/auth/refresh',
        'POST /api/auth/logout',
        'GET /api/auth/me'
      ],
      tasks: [
        'GET /api/tasks',
        'GET /api/tasks/stats/summary',
        'GET /api/tasks/:id',
        'POST /api/tasks',
        'PUT /api/tasks/:id',
        'PATCH /api/tasks/:id/stage',
        'DELETE /api/tasks/:id'
      ]
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);

const path = require('path');

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../../frontend')));

// Serve index.html for unknown routes (SPA fallback, though this is a simple app)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found.' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error.' });
});

module.exports = app;
