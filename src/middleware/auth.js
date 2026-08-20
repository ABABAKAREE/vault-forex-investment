const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/env');

const authenticate = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    res.status(401).json({ ok: false, message: 'Missing or invalid authorization token' });
    return;
  }

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (error) {
    res.status(401).json({ ok: false, message: 'Invalid or expired token' });
  }
};

module.exports = {
  authenticate,
};
