import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware.js';
import { destroyAsset } from '../cloudinary.js';

const router = Router();
router.use(requireAuth);

const DAILY_CAP = 8;

async function getYear(userId, yearId) {
  const res = await db.query('SELECT * FROM years WHERE id = $1 AND user_id = $2', [yearId, userId]);
  return res.rows[0];
}

async function getEntry(userId, entryId) {
  const res = await db.query(
    `SELECT v.* FROM volunteer_entries v
     JOIN years y ON y.id = v.year_id
     WHERE v.id = $1 AND y.user_id = $2`,
    [entryId, userId]
  );
  return res.rows[0];
}

router.get('/year/:yearId', async (req, res) => {
  try {
    const year = await getYear(req.user.id, Number(req.params.yearId));
    if (!year) return res.status(404).json({ error: 'Year not found' });
    const result = await db.query('SELECT * FROM volunteer_entries WHERE year_id = $1 ORDER BY entry_date DESC, id DESC', [year.id]);
    res.json({ entries: result.rows, daily_cap: DAILY_CAP, goal: 36 });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/year/:yearId', async (req, res) => {
  try {
    const year = await getYear(req.user.id, Number(req.params.yearId));
    if (!year) return res.status(404).json({ error: 'Year not found' });
    const { entry_date, hours, kind, title, notes, cert_url, cert_public_id, cert_type } = req.body || {};
    if (!entry_date || !/^\d{4}-\d{2}-\d{2}$/.test(entry_date)) {
      return res.status(400).json({ error: 'entry_date must be YYYY-MM-DD' });
    }
    const h = Number(hours);
    if (!Number.isFinite(h) || h <= 0 || h > 24) {
      return res.status(400).json({ error: 'hours must be a positive number ≤ 24' });
    }
    if (!['elearning', 'realworld'].includes(kind)) {
      return res.status(400).json({ error: 'kind must be elearning or realworld' });
    }
    if (!title) return res.status(400).json({ error: 'title required' });

    const sumRes = await db.query('SELECT COALESCE(SUM(hours), 0) AS s FROM volunteer_entries WHERE year_id = $1 AND entry_date = $2', [year.id, entry_date]);
    const dayTotal = parseFloat(sumRes.rows[0].s);
    const exceeds = dayTotal + h > DAILY_CAP;

    const insertRes = await db.query(
      `INSERT INTO volunteer_entries
       (year_id, entry_date, hours, kind, title, notes, cert_url, cert_public_id, cert_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [year.id, entry_date, h, kind, title, notes || null, cert_url || null, cert_public_id || null, cert_type || null]
    );
    
    res.status(201).json({ entry: insertRes.rows[0], warning_exceeds_daily_cap: exceeds, day_total_after: dayTotal + h });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:entryId', async (req, res) => {
  try {
    const entry = await getEntry(req.user.id, Number(req.params.entryId));
    if (!entry) return res.status(404).json({ error: 'Not found' });
    const patch = req.body || {};
    const fields = [
      'entry_date', 'hours', 'kind', 'title', 'notes',
      'cert_url', 'cert_public_id', 'cert_type',
    ];
    const updates = [];
    const values = [];
    let index = 1;
    for (const f of fields) {
      if (f in patch) {
        updates.push(`${f} = $${index++}`);
        values.push(patch[f]);
      }
    }
    if (updates.length === 0) return res.json({ entry });
    values.push(entry.id);
    
    await db.query(`UPDATE volunteer_entries SET ${updates.join(', ')} WHERE id = $${index}`, values);
    const updatedRes = await db.query('SELECT * FROM volunteer_entries WHERE id = $1', [entry.id]);
    res.json({ entry: updatedRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:entryId', async (req, res) => {
  try {
    const entry = await getEntry(req.user.id, Number(req.params.entryId));
    if (!entry) return res.status(404).json({ error: 'Not found' });
    if (entry.cert_public_id) await destroyAsset(entry.cert_public_id);
    await db.query('DELETE FROM volunteer_entries WHERE id = $1', [entry.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/year/:yearId/merge-pdfs', async (req, res) => {
  try {
    const year = await getYear(req.user.id, Number(req.params.yearId));
    if (!year) return res.status(404).json({ error: 'Year not found' });

    const entriesRes = await db.query(
      'SELECT cert_url, title FROM volunteer_entries WHERE year_id = $1 AND cert_url IS NOT NULL ORDER BY entry_date ASC',
      [year.id]
    );
    const entries = entriesRes.rows;

    if (entries.length === 0) {
      return res.status(400).json({ error: 'No certificates found to merge' });
    }

    const { PDFDocument } = await import('pdf-lib');
    const mergedPdf = await PDFDocument.create();

    for (const entry of entries) {
      if (!entry.cert_url.endsWith('.pdf')) continue;
      try {
        const response = await fetch(entry.cert_url);
        if (!response.ok) continue;
        const arrayBuffer = await response.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        copiedPages.forEach((page) => mergedPdf.addPage(page));
      } catch (err) {
        console.error(`Failed to merge PDF ${entry.cert_url}:`, err);
      }
    }

    const pdfBytes = await mergedPdf.save();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="certificates_${year.year}.pdf"`);
    res.setHeader('Content-Length', pdfBytes.length);
    res.end(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Merge PDF error:', error);
    res.status(500).json({ error: 'Failed to merge PDFs' });
  }
});

export default router;
