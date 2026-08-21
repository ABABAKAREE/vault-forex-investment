const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');
const { jwtSecret, jwtExpiresIn, adminEmail } = require('../config/env');

const getRole = (user) => user.role === 'admin' || String(user.email).toLowerCase() === adminEmail ? 'admin' : 'user';
const signToken = (user) => jwt.sign({ email: user.email, role: getRole(user) }, jwtSecret, { subject: user.id, expiresIn: jwtExpiresIn });

const register = async ({ fullName, email, phone, password }) => {
  const passwordHash = await bcrypt.hash(password, 12);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const inserted = await client.query(
      `INSERT INTO users (full_name, email, phone, password_hash)
       VALUES ($1, $2, $3, $4)
      RETURNING id, full_name, email, phone, role, created_at`,
      [fullName, email.toLowerCase(), phone || null, passwordHash]
    );

    await client.query('INSERT INTO accounts (user_id, balance_usd) VALUES ($1, 0)', [inserted.rows[0].id]);
    await client.query('COMMIT');

    const user = inserted.rows[0];
    const token = signToken(user);
    return { user, token };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const login = async ({ email, password }) => {
  const result = await pool.query(
    'SELECT id, full_name, email, phone, role, password_hash, created_at FROM users WHERE email = $1',
    [email.toLowerCase()]
  );

  const user = result.rows[0];
  if (!user) {
    return null;
  }

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) {
    return null;
  }

  const token = signToken(user);
  return {
    user: {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      phone: user.phone,
      role: getRole(user),
      created_at: user.created_at,
    },
    token,
  };
};

module.exports = {
  register,
  login,
};
