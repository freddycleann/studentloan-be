import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../middleware.js';
import { destroyAsset } from '../cloudinary.js';
import { TEMPLATES } from '../templates.js';

const router = Router();
router.use(requireAuth);

router.get('/templates', (_req, res) => {
  const list = Object.entries(TEMPLATES).map(([id, tpl]) => ({
    id,
    name: tpl.name,
    description: tpl.description,
    count: tpl.items.length,
  }));
  res.json({ templates: list });
});

async function getYear(userId, yearId) {
  const res = await db.query('SELECT * FROM years WHERE id = $1 AND user_id = $2', [yearId, userId]);
  return res.rows[0];
}

async function getItem(userId, itemId) {
  const res = await db.query(
    `SELECT c.* FROM checklist_items c
     JOIN years y ON y.id = c.year_id
     WHERE c.id = $1 AND y.user_id = $2`,
    [itemId, userId]
  );
  return res.rows[0];
}

router.get('/year/:yearId', async (req, res) => {
  try {
    const year = await getYear(req.user.id, Number(req.params.yearId));
    if (!year) return res.status(404).json({ error: 'Year not found' });
    const result = await db.query('SELECT * FROM checklist_items WHERE year_id = $1 ORDER BY sort_order, id', [year.id]);
    res.json({ items: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/year/:yearId/seed-template', async (req, res) => {
  try {
    const year = await getYear(req.user.id, Number(req.params.yearId));
    if (!year) return res.status(404).json({ error: 'Year not found' });
    const tpl = TEMPLATES[req.body?.template];
    if (!tpl) return res.status(400).json({ error: 'Unknown template' });
    
    const maxRes = await db.query('SELECT COALESCE(MAX(sort_order), 0) AS m FROM checklist_items WHERE year_id = $1', [year.id]);
    let order = parseInt(maxRes.rows[0].m, 10);
    
    await db.query('BEGIN');
    for (const it of tpl.items) {
      order += 1;
      await db.query(
        `INSERT INTO checklist_items
         (year_id, title, title_th, description, status, sort_order)
         VALUES ($1, $2, $3, $4, 'pending', $5)`,
        [year.id, it.title, it.title_th || null, it.description || null, order]
      );
    }
    await db.query('COMMIT');
    
    const result = await db.query('SELECT * FROM checklist_items WHERE year_id = $1 ORDER BY sort_order, id', [year.id]);
    res.status(201).json({ items: result.rows, added: tpl.items.length });
  } catch (err) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/year/:yearId', async (req, res) => {
  try {
    const year = await getYear(req.user.id, Number(req.params.yearId));
    if (!year) return res.status(404).json({ error: 'Year not found' });
    const { title, title_th, description, status, file_url, file_public_id, file_type } = req.body || {};
    if (!title) return res.status(400).json({ error: 'title required' });
    
    const maxRes = await db.query('SELECT COALESCE(MAX(sort_order), 0) AS m FROM checklist_items WHERE year_id = $1', [year.id]);
    const maxOrder = parseInt(maxRes.rows[0].m, 10);
    
    const insertRes = await db.query(
      `INSERT INTO checklist_items
       (year_id, title, title_th, description, status, file_url, file_public_id, file_type, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [
        year.id,
        title,
        title_th || null,
        description || null,
        status || 'pending',
        file_url || null,
        file_public_id || null,
        file_type || null,
        maxOrder + 1
      ]
    );
    res.status(201).json({ item: insertRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.patch('/:itemId', async (req, res) => {
  try {
    const item = await getItem(req.user.id, Number(req.params.itemId));
    if (!item) return res.status(404).json({ error: 'Not found' });
    const patch = req.body || {};
    const fields = [
      'title', 'title_th', 'description', 'status',
      'file_url', 'file_public_id', 'file_type', 'sort_order',
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
    if (updates.length === 0) return res.json({ item });
    updates.push("updated_at = CURRENT_TIMESTAMP");
    values.push(item.id);
    
    await db.query(`UPDATE checklist_items SET ${updates.join(', ')} WHERE id = $${index}`, values);
    const updatedRes = await db.query('SELECT * FROM checklist_items WHERE id = $1', [item.id]);
    res.json({ item: updatedRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:itemId', async (req, res) => {
  try {
    const item = await getItem(req.user.id, Number(req.params.itemId));
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (item.file_public_id) {
      await destroyAsset(item.file_public_id, item.file_type === 'pdf' ? 'image' : 'auto');
    }
    await db.query('DELETE FROM checklist_items WHERE id = $1', [item.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:itemId/detach-file', async (req, res) => {
  try {
    const item = await getItem(req.user.id, Number(req.params.itemId));
    if (!item) return res.status(404).json({ error: 'Not found' });
    if (item.file_public_id) await destroyAsset(item.file_public_id);
    await db.query(
      'UPDATE checklist_items SET file_url = NULL, file_public_id = NULL, file_type = NULL WHERE id = $1',
      [item.id]
    );
    const updatedRes = await db.query('SELECT * FROM checklist_items WHERE id = $1', [item.id]);
    res.json({ item: updatedRes.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/year/:yearId/merge-pdfs', async (req, res) => {
  try {
    const year = await getYear(req.user.id, Number(req.params.yearId));
    if (!year) return res.status(404).json({ error: 'Year not found' });

    const itemsRes = await db.query('SELECT * FROM checklist_items WHERE year_id = $1 AND file_url IS NOT NULL ORDER BY sort_order, id', [year.id]);
    const items = itemsRes.rows;

    if (items.length === 0) {
      return res.status(400).json({ error: 'No files found to merge in checklist' });
    }

    const { PDFDocument } = await import('pdf-lib');
    const mergedPdf = await PDFDocument.create();

    for (const item of items) {
      if (!item.file_url.endsWith('.pdf')) continue;
      try {
        const response = await fetch(item.file_url);
        if (!response.ok) continue;
        const arrayBuffer = await response.arrayBuffer();
        const pdf = await PDFDocument.load(arrayBuffer);
        const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
        
        let copies = 1;
        const textToSearch = `${item.title || ''} ${item.title_th || ''} ${item.description || ''}`.toLowerCase();
        if (
          textToSearch.includes('2 ฉบับ') || 
          textToSearch.includes('2 copies') || 
          textToSearch.includes('2 ชุด') ||
          textToSearch.includes('2 แผ่น') ||
          textToSearch.includes('2 sheets')
        ) {
          copies = 2;
        }

        for (let i = 0; i < copies; i++) {
          copiedPages.forEach((page) => mergedPdf.addPage(page));
        }
      } catch (err) {
        console.error(`Failed to merge PDF ${item.file_url}:`, err);
      }
    }

    const pdfBytes = await mergedPdf.save();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="checklist_${year.year}.pdf"`);
    res.setHeader('Content-Length', pdfBytes.length);
    res.end(Buffer.from(pdfBytes));
  } catch (error) {
    console.error('Merge PDF error:', error);
    res.status(500).json({ error: 'Failed to merge PDFs' });
  }
});

export default router;
