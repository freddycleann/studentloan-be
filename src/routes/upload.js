import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware.js';
import { uploadBuffer } from '../cloudinary.js';
import { extractPdfText, extractCertHours, extractCertDate } from '../pdfExtract.js';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file' });
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return res.status(503).json({
      error: 'Cloudinary not configured. Fill CLOUDINARY_* in backend/.env and restart the backend.',
      code: 'CLOUDINARY_NOT_CONFIGURED',
    });
  }
  const mime = req.file.mimetype || '';
  let resource_type = 'auto';
  let kind = 'file';
  if (mime.startsWith('image/')) { resource_type = 'image'; kind = 'image'; }
  // Use 'raw' for PDFs to bypass Cloudinary's default "allow PDF delivery" restriction.
  else if (mime === 'application/pdf') { resource_type = 'raw'; kind = 'pdf'; }
  // Keep the extension for raw uploads so Cloudinary serves with the right
  // Content-Type; strip it for image uploads (Cloudinary infers the format).
  const filename = resource_type === 'raw'
    ? req.file.originalname
    : req.file.originalname?.replace(/\.[^.]+$/, '');
  try {
    const result = await uploadBuffer(req.file.buffer, {
      folder: req.body.folder || 'uploads',
      resource_type,
      filename,
    });
    // Parse PDFs for the "total hours" line in SET e-Learning certs.
    let hours = null;
    let date = null;
    if (kind === 'pdf') {
      try {
        const text = await extractPdfText(req.file.buffer);
        hours = extractCertHours(text);
        date = extractCertDate(text);
      } catch (e) {
        console.warn('[upload] pdf text extract failed', e.message);
      }
    }
    res.json({
      url: result.secure_url,
      public_id: result.public_id,
      type: kind,
      bytes: result.bytes,
      width: result.width,
      height: result.height,
      pages: result.pages,
      original_name: req.file.originalname,
      hours,
      date,
    });
  } catch (e) {
    console.error('[upload] failed', e);
    res.status(500).json({ error: 'Upload failed', detail: e.message });
  }
});

export default router;
