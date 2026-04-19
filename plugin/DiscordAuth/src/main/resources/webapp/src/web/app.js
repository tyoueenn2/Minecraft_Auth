const express = require('express');
const session = require('express-session');
const path = require('path');
const authRoutes = require('./routes/auth');
const apiRoutes = require('./routes/api');

function createWebServer() {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  // Suppress express-session MemoryStore production warning
  // (intentional for single-process Minecraft plugin use)
  const MemoryStore = session.MemoryStore;
  const store = new MemoryStore();
  store.on = () => {}; // silence internal event warnings

  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
      resave: false,
      saveUninitialized: false,
      store,
      cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: false,
      },
    })
  );

  // Static files
  app.use(express.static(path.join(__dirname, '..', '..', 'public')));

  // Routes
  app.use('/auth', authRoutes);
  app.use('/api', apiRoutes);

  // SPA fallback
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', '..', 'public', 'index.html'));
  });

  return app;
}

function startWebServer() {
  const app = createWebServer();
  const port = process.env.PORT || 3000;

  return new Promise((resolve) => {
    const server = app.listen(port, () => {
      console.log(`[Web] Server running at http://localhost:${port}`);
      resolve(server);
    });
  });
}

module.exports = { createWebServer, startWebServer };
