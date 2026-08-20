const express = require('express');
const { register, login } = require('../services/authService');

const router = express.Router();

router.post('/register', async (req, res, next) => {
  try {
    const { fullName, email, phone, password } = req.body || {};
    if (!fullName || !email || !password || String(password).length < 8) {
      res.status(400).json({ ok: false, message: 'Invalid registration payload' });
      return;
    }

    const result = await register({ fullName, email, phone, password });
    res.status(201).json({ ok: true, ...result });
  } catch (error) {
    if (String(error?.message || '').includes('duplicate key')) {
      res.status(409).json({ ok: false, message: 'Email already registered' });
      return;
    }
    next(error);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ ok: false, message: 'Email and password are required' });
      return;
    }

    const result = await login({ email, password });
    if (!result) {
      res.status(401).json({ ok: false, message: 'Invalid credentials' });
      return;
    }

    res.json({ ok: true, ...result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
