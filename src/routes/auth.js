import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db.js';
import { requireAuth } from '../middleware.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }
  
  try {
    const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    
    const token = jwt.sign({ uid: user.id }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    });
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        is_admin: !!user.is_admin,
        display_name: user.display_name,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: { ...req.user, is_admin: !!req.user.is_admin },
    cloudinary_configured: !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    ),
  });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

router.patch('/me', requireAuth, async (req, res) => {
  const { username, display_name, password } = req.body || {};
  const updates = [];
  const values = [];
  let index = 1;

  if (username) {
    updates.push(`username = $${index++}`);
    values.push(username);
  }
  if (display_name !== undefined) {
    updates.push(`display_name = $${index++}`);
    values.push(display_name);
  }
  if (password) {
    updates.push(`password_hash = $${index++}`);
    values.push(bcrypt.hashSync(password, 10));
  }

  if (updates.length === 0) {
    return res.json({ user: { ...req.user, is_admin: !!req.user.is_admin } });
  }

  values.push(req.user.id);
  
  try {
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${index}`, values);
    const updatedUserRes = await db.query('SELECT id, username, is_admin, display_name FROM users WHERE id = $1', [req.user.id]);
    const updatedUser = updatedUserRes.rows[0];
    res.json({ user: { ...updatedUser, is_admin: !!updatedUser.is_admin } });
  } catch (e) {
    if (String(e.message).includes('unique constraint') || String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;
