const express = require('express');
const authService = require('../services/auth.service');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

function handle(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message || 'Internal server error.' });
    }
  };
}

router.post(
  '/register',
  handle(async (req, res) => {
    const user = await authService.register(req.body);
    res.status(201).json({ message: 'Registration successful.', user });
  })
);

router.post(
  '/login',
  handle(async (req, res) => {
    const session = await authService.login(req.body, req.headers['user-agent']);
    res.json({
      accessToken: session.accessToken,
      token: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      user: session.user
    });
  })
);

router.post(
  '/refresh',
  handle(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required.' });
    }
    const session = authService.refreshSession(refreshToken, req.headers['user-agent']);
    res.json({
      accessToken: session.accessToken,
      token: session.accessToken,
      refreshToken: session.refreshToken,
      expiresAt: session.expiresAt,
      user: session.user
    });
  })
);

router.post(
  '/logout',
  handle(async (req, res) => {
    authService.logout(req.body.refreshToken);
    res.json({ message: 'Logged out successfully.' });
  })
);

router.post(
  '/logout-all',
  authenticate,
  handle(async (req, res) => {
    authService.logoutAll(req.user.id);
    res.json({ message: 'All sessions revoked.' });
  })
);

router.get(
  '/me',
  authenticate,
  handle(async (req, res) => {
    const user = authService.getUserById(req.user.id);
    res.json({ user });
  })
);

module.exports = router;
