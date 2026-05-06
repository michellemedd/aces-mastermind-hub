/**
 * ACES Mastermind Hub — API Server
 * Handles all database reads/writes using Railway's built-in PostgreSQL.
 * Runs on the same Railway service as the static frontend.
 */

const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── DATABASE CONNECTION ──────────────────────────────────────
// Railway automatically sets DATABASE_URL when you add a Postgres addon.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

// ── MIDDLEWARE ───────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Simple request logger
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    console.log(`${req.method} ${req.path}`);
  }
  next();
});

// ── DATABASE INIT ────────────────────────────────────────────
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        id    SERIAL PRIMARY KEY,
        key   TEXT UNIQUE NOT NULL,
        value TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS schedule (
        id          SERIAL PRIMARY KEY,
        sort_order  INTEGER DEFAULT 0,
        date_label  TEXT DEFAULT '',
        title       TEXT NOT NULL,
        sub_label   TEXT DEFAULT '',
        type        TEXT DEFAULT 'main',
        topic       TEXT DEFAULT '',
        zoom_url    TEXT DEFAULT '',
        zoom_key    TEXT DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS coaches (
        id        SERIAL PRIMARY KEY,
        name      TEXT NOT NULL,
        role      TEXT DEFAULT '',
        email     TEXT DEFAULT '',
        photo_url TEXT DEFAULT '',
        zoom_url  TEXT DEFAULT '',
        about_url TEXT DEFAULT '',
        sessions  TEXT DEFAULT '',
        color     TEXT DEFAULT '#2233a8'
      );

      CREATE TABLE IF NOT EXISTS attendees (
        id      SERIAL PRIMARY KEY,
        name    TEXT NOT NULL,
        email   TEXT UNIQUE NOT NULL,
        room_s1 TEXT DEFAULT '',
        zoom_s1 TEXT DEFAULT '',
        room_s2 TEXT DEFAULT '',
        zoom_s2 TEXT DEFAULT '',
        room_s3 TEXT DEFAULT '',
        zoom_s3 TEXT DEFAULT '',
        room_s4 TEXT DEFAULT '',
        zoom_s4 TEXT DEFAULT ''
      );
    `);

    // Seed default settings if empty
    const { rowCount } = await client.query('SELECT 1 FROM settings LIMIT 1');
    if (rowCount === 0) {
      await client.query(`
        INSERT INTO settings (key, value) VALUES
          ('event_dates',            'May 7–8, 2026'),
          ('event_time',             '10:00am Eastern'),
          ('main_zoom',              ''),
          ('registration_link',      ''),
          ('registration_qualifier', 'Active ACES coaching program members who are ready to bring their #1 business challenge and invest two focused days growing alongside peers.'),
          ('contact_email',          'aces@learn.mirasee.com'),
          ('admin_password',         'ACESadmin2026')
        ON CONFLICT (key) DO NOTHING;
      `);
    }

    // Seed schedule if empty
    const { rowCount: schedCount } = await client.query('SELECT 1 FROM schedule LIMIT 1');
    if (schedCount === 0) {
      await client.query(`
        INSERT INTO schedule (sort_order, date_label, title, sub_label, type, topic, zoom_key) VALUES
          (1,  'MAY 7 AT 10:00 AM EASTERN', 'Opening Session',                         'Main Session Zoom Room', 'main',  'Welcome, orientation and kick-off for Day 1.', ''),
          (2,  'MAY 7 AT 11:00 AM EASTERN', '15 Minute Break',                         '', 'break', '', ''),
          (3,  'MAY 7 AT 11:15 AM EASTERN', 'Masterminding Session #1',                 'Breakout Rooms', 'mm', 'Your first hot-seat mastermind session. Come prepared with your challenge!', 'session1'),
          (4,  'MAY 7 AT 1:15 PM EASTERN',  '15 Minute Break',                         '', 'break', '', ''),
          (5,  'MAY 7 AT 1:30 PM EASTERN',  'Breakfast/Lunch/Dinner with Peers',        'Main Session Zoom Room', 'main', 'A relaxed meal break to connect with fellow masterminders.', ''),
          (6,  'MAY 7 AT 2:00 PM EASTERN',  '15 Minute Break',                         '', 'break', '', ''),
          (7,  'MAY 7 AT 2:15 PM EASTERN',  'Masterminding Session #2',                 'Breakout Rooms', 'mm', 'Your second hot-seat mastermind session.', 'session2'),
          (8,  'MAY 7 AT 4:15 PM EASTERN',  '15 Minute Break',                         '', 'break', '', ''),
          (9,  'MAY 7 AT 4:30 PM EASTERN',  'Day 1 Debrief and Wrap-Up',               'Main Session Zoom Room', 'main', 'Reflect on the day''s insights and set intentions for Day 2.', ''),
          (10, 'MAY 7 AT 5:00 PM EASTERN',  '30 Minute Break',                         '', 'break', '', ''),
          (11, 'MAY 7 AT 5:30 PM EASTERN',  'Dinner',                                  'Main Session Zoom Room', 'main', 'Virtual dinner social.', ''),
          (12, 'MAY 8 AT 10:00 AM EASTERN', 'Day 2 — Group Session with Guest Speaker', 'Main Session Zoom Room', 'main', 'Special guest speaker session.', ''),
          (13, 'MAY 8 AT 11:00 AM EASTERN', '15 Minute Break',                         '', 'break', '', ''),
          (14, 'MAY 8 AT 11:15 AM EASTERN', 'Masterminding Session #3',                 'Breakout Rooms', 'mm', 'Your third mastermind session — often where the deepest breakthroughs happen.', 'session3'),
          (15, 'MAY 8 AT 1:15 PM EASTERN',  '15 Minute Break',                         '', 'break', '', ''),
          (16, 'MAY 8 AT 1:30 PM EASTERN',  'Breakfast/Lunch/Dinner with Peers',        'Main Session Zoom Room', 'main', 'Midday meal break with peers.', ''),
          (17, 'MAY 8 AT 2:15 PM EASTERN',  '15 Minute Break',                         '', 'break', '', ''),
          (18, 'MAY 8 AT 2:30 PM EASTERN',  'Masterminding Q&A Session with Danny',     'Breakout Rooms', 'mm', 'Live Q&A and masterminding session led by Danny Iny.', 'session4'),
          (19, 'MAY 8 AT 3:45 PM EASTERN',  '15 Minute Break',                         '', 'break', '', ''),
          (20, 'MAY 8 AT 4:00 PM EASTERN',  'Final Debrief and Wrap-Up',               'Main Session Zoom Room', 'main', 'Close out the mastermind and celebrate progress.', ''),
          (21, 'MAY 8 AT 4:30 PM EASTERN',  'Close',                                   '', 'close', '', '');
      `);
    }

    // Seed coaches if empty
    const { rowCount: coachCount } = await client.query('SELECT 1 FROM coaches LIMIT 1');
    if (coachCount === 0) {
      await client.query(`
        INSERT INTO coaches (name, role, email, sessions, color) VALUES
          ('Ari Iny',               'Director of Growth',  'ari@mirasee.com',      'session1,session3',            '#2233a8'),
          ('Jay Allyson',           'Director of ACES',    'jay@mirasee.com',      'session2',                     '#1a6b52'),
          ('Andrea Nino de Guzman', 'ACES Coach',          'andrea@mirasee.com',   'session1,session2,session3',   '#7c3090'),
          ('Jason Muller',          'ACES Coach',          'jason@mirasee.com',    'session1,session2,session3',   '#c0541a'),
          ('Kevin Urban',           'ACES Coach',          'kevin@mirasee.com',    'session2,session3',            '#8b1a1a'),
          ('Meredith Eisenberg',    'ACES Coach',          'meredith@mirasee.com', 'session3',                     '#1a5c8b'),
          ('Monica Badiu',          'ACES Coach',          'monica@mirasee.com',   'session1,session3',            '#5e3a1a');
      `);
    }

    console.log('✅ Database ready');
  } finally {
    client.release();
  }
}

// ══════════════════════════════════════════════════════════════
//  API ROUTES
// ══════════════════════════════════════════════════════════════

// ── SETTINGS ─────────────────────────────────────────────────
app.get('/api/settings', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM settings ORDER BY key');
    const obj = {};
    rows.forEach(r => { obj[r.key] = r.value; });
    res.json(obj);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/settings', async (req, res) => {
  try {
    const updates = req.body; // { key: value, ... }
    for (const [key, value] of Object.entries(updates)) {
      await pool.query(
        'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        [key, value]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── SCHEDULE ──────────────────────────────────────────────────
app.get('/api/schedule', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM schedule ORDER BY sort_order ASC, id ASC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/schedule', async (req, res) => {
  try {
    const { date_label, title, sub_label, type, topic, zoom_url, zoom_key, sort_order } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO schedule (date_label, title, sub_label, type, topic, zoom_url, zoom_key, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [date_label||'', title, sub_label||'', type||'main', topic||'', zoom_url||'', zoom_key||'', sort_order||99]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/schedule/:id', async (req, res) => {
  try {
    const updates = req.body;
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const set = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    await pool.query(`UPDATE schedule SET ${set} WHERE id = $1`, [req.params.id, ...values]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/schedule/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM schedule WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── COACHES ───────────────────────────────────────────────────
app.get('/api/coaches', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM coaches ORDER BY id ASC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/coaches', async (req, res) => {
  try {
    const { name, role, email, photo_url, zoom_url, about_url, sessions, color } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO coaches (name, role, email, photo_url, zoom_url, about_url, sessions, color) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [name, role||'', email||'', photo_url||'', zoom_url||'', about_url||'', sessions||'', color||'#2233a8']
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/coaches/:id', async (req, res) => {
  try {
    const updates = req.body;
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const set = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    await pool.query(`UPDATE coaches SET ${set} WHERE id = $1`, [req.params.id, ...values]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/coaches/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM coaches WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── ATTENDEES ─────────────────────────────────────────────────
app.get('/api/attendees', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM attendees ORDER BY name ASC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/attendees', async (req, res) => {
  try {
    const { name, email, room_s1, zoom_s1, room_s2, zoom_s2, room_s3, zoom_s3, room_s4, zoom_s4 } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO attendees (name, email, room_s1, zoom_s1, room_s2, zoom_s2, room_s3, zoom_s3, room_s4, zoom_s4) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
      [name, email, room_s1||'', zoom_s1||'', room_s2||'', zoom_s2||'', room_s3||'', zoom_s3||'', room_s4||'', zoom_s4||'']
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/attendees/:id', async (req, res) => {
  try {
    const updates = req.body;
    const fields = Object.keys(updates);
    const values = Object.values(updates);
    const set = fields.map((f, i) => `${f} = $${i + 2}`).join(', ');
    await pool.query(`UPDATE attendees SET ${set} WHERE id = $1`, [req.params.id, ...values]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/attendees/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM attendees WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CATCH-ALL → serve index.html (SPA routing) ───────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── START ─────────────────────────────────────────────────────
initDB()
  .then(() => {
    app.listen(PORT, () => console.log(`🚀 ACES Hub running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Database init failed:', err.message);
    // Start anyway so Railway doesn't mark as crashed
    app.listen(PORT, () => console.log(`⚠️  Running without DB on port ${PORT}`));
  });
