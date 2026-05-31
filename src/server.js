import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { initDB } from './db.js';
import authRouter from './routes/auth.js';
import yearsRouter from './routes/years.js';
import checklistRouter from './routes/checklist.js';
import volunteerRouter from './routes/volunteer.js';
import uploadRouter from './routes/upload.js';
import adminRouter from './routes/admin.js';

if (!process.env.JWT_SECRET) {
  console.warn('[warn] JWT_SECRET not set, using insecure default. Set one in .env');
}
if (!process.env.CLOUDINARY_CLOUD_NAME) {
  console.warn('[warn] CLOUDINARY_* not set — file uploads will return 503 until configured.');
}

const app = express();

const origins = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim());

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (origins.includes(origin)) return cb(null, true);
      return cb(new Error('CORS not allowed: ' + origin));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/auth', authRouter);
app.use('/years', yearsRouter);
app.use('/checklist', checklistRouter);
app.use('/volunteer', volunteerRouter);
app.use('/upload', uploadRouter);
app.use('/admin', adminRouter);

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ error: err.message || 'Server error' });
});

const port = Number(process.env.PORT) || 4000;

initDB().then(() => {
  app.listen(port, () => {
    console.log(`[backend] listening on http://localhost:${port}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
