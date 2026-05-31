import jwt from 'jsonwebtoken';
import { db } from './db.js';

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ')
    ? header.slice(7)
    : req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const result = await db.query('SELECT id, username, is_admin, display_name FROM users WHERE id = $1', [payload.uid]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'User not found' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user?.is_admin) {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
}

export async function ownsYear(req, res, next) {
  const yearId = Number(req.params.yearId);
  if (!yearId) return res.status(400).json({ error: 'Bad year id' });
  try {
    const result = await db.query('SELECT id FROM years WHERE id = $1 AND user_id = $2', [yearId, req.user.id]);
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Year not found' });
    req.yearId = yearId;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}
