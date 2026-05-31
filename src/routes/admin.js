import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { requireAuth, requireAdmin } from '../middleware.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/users', async (_req, res) => {
  try {
    const result = await db.query('SELECT id, username, is_admin, display_name, created_at FROM users ORDER BY id');
    res.json({ users: result.rows.map(u => ({ ...u, is_admin: !!u.is_admin })) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/users', async (req, res) => {
  const { username, password, display_name, is_admin } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'password too short' });
  const hash = bcrypt.hashSync(password, 10);
  try {
    const insertRes = await db.query(
      'INSERT INTO users (username, password_hash, display_name, is_admin) VALUES ($1, $2, $3, $4) RETURNING id, username, is_admin, display_name, created_at',
      [username, hash, display_name || username, is_admin ? 1 : 0]
    );
    const row = insertRes.rows[0];
    res.status(201).json({ user: { ...row, is_admin: !!row.is_admin } });
  } catch (e) {
    if (String(e.message).includes('unique constraint') || String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Username already taken' });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const targetRes = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    const target = targetRes.rows[0];
    if (!target) return res.status(404).json({ error: 'Not found' });
    const { password, display_name, is_admin } = req.body || {};
    const updates = [];
    const values = [];
    let index = 1;
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'password too short' });
      updates.push(`password_hash = $${index++}`);
      values.push(bcrypt.hashSync(password, 10));
    }
    if (display_name !== undefined) { updates.push(`display_name = $${index++}`); values.push(display_name); }
    if (is_admin !== undefined) { updates.push(`is_admin = $${index++}`); values.push(is_admin ? 1 : 0); }
    if (updates.length === 0) return res.json({ user: { ...target, is_admin: !!target.is_admin } });
    values.push(id);
    
    await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = $${index}`, values);
    const rowRes = await db.query('SELECT id, username, is_admin, display_name, created_at FROM users WHERE id = $1', [id]);
    const row = rowRes.rows[0];
    res.json({ user: { ...row, is_admin: !!row.is_admin } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/users/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  try {
    const result = await db.query('DELETE FROM users WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
