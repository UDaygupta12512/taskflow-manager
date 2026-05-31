const jwt = require('jsonwebtoken');
const { jwt: jwtConfig } = require('../config');

function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const payload = jwt.verify(token, jwtConfig.accessSecret);
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = { authenticate };
