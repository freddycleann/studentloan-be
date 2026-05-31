import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT y.*,
              (SELECT COUNT(*) FROM checklist_items c WHERE c.year_id = y.id) AS checklist_total,
              (SELECT COUNT(*) FROM checklist_items c WHERE c.year_id = y.id AND c.status = 'done') AS checklist_done,
              (SELECT COALESCE(SUM(hours), 0) FROM volunteer_entries v WHERE v.year_id = y.id) AS volunteer_hours
       FROM years y
       WHERE y.user_id = $1
       ORDER BY y.year DESC`,
      [req.user.id]
    );
    res.json({ years: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  const { year, note, checklist_url, checklist_public_id, checklist_type } = req.body || {};
  if (!year || !/^\d{3,4}$/.test(String(year))) {
    return res.status(400).json({ error: 'Year must be 3-4 digits, e.g. 2569' });
  }
  
  try {
    const insertRes = await db.query(
      'INSERT INTO years (user_id, year, note) VALUES ($1, $2, $3) RETURNING *',
      [req.user.id, String(year), note || null]
    );
    const newYear = insertRes.rows[0];
    
    if (checklist_url) {
      import('../templates.js').then(async ({ TEMPLATES }) => {
        const tpl = TEMPLATES.kmutnb;
        let order = 0;
        
        try {
          await db.query('BEGIN');
          for (let i = 0; i < tpl.items.length; i++) {
            const it = tpl.items[i];
            order += 1;
            const isLast = i === tpl.items.length - 1;
            await db.query(
              `INSERT INTO checklist_items
               (year_id, title, title_th, description, status, file_url, file_public_id, file_type, sort_order)
               VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7, $8)`,
              [
                newYear.id,
                it.title,
                it.title_th || null,
                it.description || null,
                isLast ? checklist_url : null,
                isLast ? checklist_public_id : null,
                isLast ? checklist_type : null,
                order
              ]
            );
          }
          await db.query('COMMIT');
        } catch (err) {
          await db.query('ROLLBACK');
          console.error('Failed to seed template', err);
        }
      });
    }
    
    res.status(201).json({ year: newYear });
  } catch (e) {
    if (String(e.message).includes('unique constraint') || String(e.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Year already exists' });
    }
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:yearId', async (req, res) => {
  const yearId = Number(req.params.yearId);
  try {
    const result = await db.query('SELECT * FROM years WHERE id = $1 AND user_id = $2', [yearId, req.user.id]);
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json({ year: row });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:yearId', async (req, res) => {
  const yearId = Number(req.params.yearId);
  try {
    const result = await db.query('SELECT * FROM years WHERE id = $1 AND user_id = $2', [yearId, req.user.id]);
    const year = result.rows[0];
    if (!year) return res.status(404).json({ error: 'Not found' });
    
    const note = req.body?.note ?? year.note;
    await db.query('UPDATE years SET note = $1 WHERE id = $2', [note, yearId]);
    res.json({ year: { ...year, note } });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:yearId', async (req, res) => {
  const yearId = Number(req.params.yearId);
  try {
    const result = await db.query('DELETE FROM years WHERE id = $1 AND user_id = $2', [yearId, req.user.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:yearId/summary', async (req, res) => {
  const yearId = Number(req.params.yearId);
  try {
    const yearRes = await db.query('SELECT * FROM years WHERE id = $1 AND user_id = $2', [yearId, req.user.id]);
    const year = yearRes.rows[0];
    if (!year) return res.status(404).json({ error: 'Not found' });
    
    const checklistRes = await db.query(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS done,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress
       FROM checklist_items WHERE year_id = $1`,
      [yearId]
    );
    
    const volunteerRes = await db.query(
      `SELECT
         COALESCE(SUM(hours), 0) AS total_hours,
         COALESCE(SUM(CASE WHEN kind = 'elearning' THEN hours ELSE 0 END), 0) AS elearning_hours,
         COALESCE(SUM(CASE WHEN kind = 'realworld' THEN hours ELSE 0 END), 0) AS realworld_hours,
         COUNT(*) AS entries
       FROM volunteer_entries WHERE year_id = $1`,
      [yearId]
    );
    
    const byDayRes = await db.query(
      `SELECT entry_date, SUM(hours) AS hours
       FROM volunteer_entries WHERE year_id = $1
       GROUP BY entry_date ORDER BY entry_date DESC`,
      [yearId]
    );
    
    res.json({ 
      year, 
      checklist: {
        total: parseInt(checklistRes.rows[0].total || 0, 10),
        done: parseInt(checklistRes.rows[0].done || 0, 10),
        in_progress: parseInt(checklistRes.rows[0].in_progress || 0, 10)
      }, 
      volunteer: {
        total_hours: parseFloat(volunteerRes.rows[0].total_hours || 0),
        elearning_hours: parseFloat(volunteerRes.rows[0].elearning_hours || 0),
        realworld_hours: parseFloat(volunteerRes.rows[0].realworld_hours || 0),
        entries: parseInt(volunteerRes.rows[0].entries || 0, 10)
      }, 
      byDay: byDayRes.rows.map(r => ({ ...r, hours: parseFloat(r.hours) })), 
      goal: 36, 
      daily_cap: 8 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
