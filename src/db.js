import pg from 'pg';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function initDB() {
  if (!process.env.DATABASE_URL) {
    console.warn('[warn] DATABASE_URL not set. Database not initialized.');
    return;
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      display_name TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS years (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      year TEXT NOT NULL,
      note TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, year)
    );

    CREATE TABLE IF NOT EXISTS checklist_items (
      id SERIAL PRIMARY KEY,
      year_id INTEGER NOT NULL REFERENCES years(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      title_th TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      file_url TEXT,
      file_public_id TEXT,
      file_type TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS volunteer_entries (
      id SERIAL PRIMARY KEY,
      year_id INTEGER NOT NULL REFERENCES years(id) ON DELETE CASCADE,
      entry_date TEXT NOT NULL,
      hours REAL NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      notes TEXT,
      cert_url TEXT,
      cert_public_id TEXT,
      cert_type TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_checklist_year ON checklist_items(year_id);
    CREATE INDEX IF NOT EXISTS idx_volunteer_year ON volunteer_entries(year_id);
    CREATE INDEX IF NOT EXISTS idx_volunteer_date ON volunteer_entries(entry_date);
  `);

  const countRes = await db.query('SELECT COUNT(*) AS c FROM users');
  const count = parseInt(countRes.rows[0].c, 10);
  if (count === 0) {
    const username = process.env.SEED_ADMIN_USERNAME || 'freddyclean';
    const password = process.env.SEED_ADMIN_PASSWORD || 'bobozaza55';
    const hash = bcrypt.hashSync(password, 10);
    await db.query(
      'INSERT INTO users (username, password_hash, is_admin, display_name) VALUES ($1, $2, 1, $3)',
      [username, hash, username]
    );
    console.log(`[seed] admin user "${username}" created`);
  }
}
