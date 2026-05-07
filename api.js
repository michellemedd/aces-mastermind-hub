/**
 * ACES Mastermind Hub — API Server
 * PostgreSQL backend via Railway built-in Postgres.
 *
 * Simplified:
 *  - One Plus group (never auto-creates a second — warns instead)
 *  - Coach portal uses one shared password from settings
 *  - Registration collects name + email only
 */

const express = require('express');
const { Pool }  = require('pg');
const path      = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) console.log(`${req.method} ${req.path}`);
  next();
});

// ══════════════════════════════════════════════════════════════
//  DATABASE INIT
// ══════════════════════════════════════════════════════════════
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      -- ── Core ──────────────────────────────────────────────
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
        id         SERIAL PRIMARY KEY,
        name       TEXT NOT NULL,
        email      TEXT UNIQUE NOT NULL,
        tier       TEXT DEFAULT 'regular',
        group_id   INTEGER DEFAULT NULL,
        room_s1    TEXT DEFAULT '',
        zoom_s1    TEXT DEFAULT '',
        room_s2    TEXT DEFAULT '',
        zoom_s2    TEXT DEFAULT '',
        room_s3    TEXT DEFAULT '',
        zoom_s3    TEXT DEFAULT '',
        room_s4    TEXT DEFAULT '',
        zoom_s4    TEXT DEFAULT ''
      );

      -- ── New ───────────────────────────────────────────────
      CREATE TABLE IF NOT EXISTS registrations (
        id          SERIAL PRIMARY KEY,
        name        TEXT NOT NULL,
        email       TEXT UNIQUE NOT NULL,
        tier        TEXT DEFAULT 'regular',
        status      TEXT DEFAULT 'pending',
        assigned    BOOLEAN DEFAULT FALSE,
        notes       TEXT DEFAULT '',
        created_at  TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS groups (
        id           SERIAL PRIMARY KEY,
        name         TEXT NOT NULL,
        type         TEXT DEFAULT 'regular',
        max_size     INTEGER DEFAULT 12,
        coach_s1_id  INTEGER DEFAULT NULL,
        coach_s2_id  INTEGER DEFAULT NULL,
        coach_s3_id  INTEGER DEFAULT NULL,
        coach_s4_id  INTEGER DEFAULT NULL,
        zoom_s1      TEXT DEFAULT '',
        zoom_s2      TEXT DEFAULT '',
        zoom_s3      TEXT DEFAULT '',
        zoom_s4      TEXT DEFAULT '',
        color        TEXT DEFAULT '#2233a8',
        sort_order   INTEGER DEFAULT 0
      );
    `);

    // ── Seed settings ─────────────────────────────────────────
    const { rowCount } = await client.query('SELECT 1 FROM settings LIMIT 1');
    if (rowCount === 0) {
      await client.query(`
        INSERT INTO settings (key, value) VALUES
          ('event_dates',             'May 7–8, 2026'),
          ('event_time',              '10:00am Eastern'),
          ('main_zoom',               ''),
          ('registration_link',       ''),
          ('registration_open',       'true'),
          ('registration_qualifier',  'This event is exclusively for active ACES coaching program members.'),
          ('contact_email',           'aces@learn.mirasee.com'),
          ('admin_password',          'ACESadmin2026'),
          ('coach_password',          'ACEScoach2026'),
          ('plus_group_cap',          '12'),
          ('regular_group_cap',       '12')
        ON CONFLICT (key) DO NOTHING;
      `);
    }

    // ── Seed schedule ─────────────────────────────────────────
    const { rowCount: sc } = await client.query('SELECT 1 FROM schedule LIMIT 1');
    if (sc === 0) {
      await client.query(`
        INSERT INTO schedule (sort_order, date_label, title, sub_label, type, topic, zoom_key) VALUES
          (1,  'MAY 7 AT 10:00 AM EASTERN', 'Opening Session',                          'Main Session Zoom Room', 'main',  'Welcome, orientation and kick-off for Day 1.', ''),
          (2,  'MAY 7 AT 11:00 AM EASTERN', '15 Minute Break',                          '', 'break', '', ''),
          (3,  'MAY 7 AT 11:15 AM EASTERN', 'Masterminding Session #1',                  'Breakout Rooms', 'mm', 'Morning hot-seat session in your assigned group.', 'session1'),
          (4,  'MAY 7 AT 1:15 PM EASTERN',  '15 Minute Break',                          '', 'break', '', ''),
          (5,  'MAY 7 AT 1:30 PM EASTERN',  'Breakfast/Lunch/Dinner with Peers',         'Main Session Zoom Room', 'main', 'Relaxed meal break to connect with peers.', ''),
          (6,  'MAY 7 AT 2:00 PM EASTERN',  '15 Minute Break',                          '', 'break', '', ''),
          (7,  'MAY 7 AT 2:15 PM EASTERN',  'Masterminding Session #2',                  'Breakout Rooms', 'mm', 'Afternoon hot-seat session — mixed groups.', 'session2'),
          (8,  'MAY 7 AT 4:15 PM EASTERN',  '15 Minute Break',                          '', 'break', '', ''),
          (9,  'MAY 7 AT 4:30 PM EASTERN',  'Day 1 Debrief and Wrap-Up',                'Main Session Zoom Room', 'main', 'Reflect and set intentions for Day 2.', ''),
          (10, 'MAY 7 AT 5:00 PM EASTERN',  '30 Minute Break',                          '', 'break', '', ''),
          (11, 'MAY 7 AT 5:30 PM EASTERN',  'Dinner',                                   'Main Session Zoom Room', 'main', 'Virtual dinner social.', ''),
          (12, 'MAY 8 AT 10:00 AM EASTERN', 'Day 2 — Guest Speaker Session',             'Main Session Zoom Room', 'main', 'Special guest speaker. Details shared closer to the event.', ''),
          (13, 'MAY 8 AT 11:00 AM EASTERN', '15 Minute Break',                          '', 'break', '', ''),
          (14, 'MAY 8 AT 11:15 AM EASTERN', 'Masterminding Session #3',                  'Breakout Rooms', 'mm', 'Morning hot-seat session in your assigned group.', 'session3'),
          (15, 'MAY 8 AT 1:15 PM EASTERN',  '15 Minute Break',                          '', 'break', '', ''),
          (16, 'MAY 8 AT 1:30 PM EASTERN',  'Breakfast/Lunch/Dinner with Peers',         'Main Session Zoom Room', 'main', 'Midday meal break with peers.', ''),
          (17, 'MAY 8 AT 2:15 PM EASTERN',  '15 Minute Break',                          '', 'break', '', ''),
          (18, 'MAY 8 AT 2:30 PM EASTERN',  'Masterminding Q&A Session with Danny',      'Breakout Rooms', 'mm', 'Live Q&A and masterminding led by Danny Iny.', 'session4'),
          (19, 'MAY 8 AT 3:45 PM EASTERN',  '15 Minute Break',                          '', 'break', '', ''),
          (20, 'MAY 8 AT 4:00 PM EASTERN',  'Final Debrief and Wrap-Up',                'Main Session Zoom Room', 'main', 'Close out, share commitments and celebrate progress.', ''),
          (21, 'MAY 8 AT 4:30 PM EASTERN',  'Close',                                    '', 'close', '', '');
      `);
    }

    // ── Seed coaches ──────────────────────────────────────────
    const { rowCount: cc } = await client.query('SELECT 1 FROM coaches LIMIT 1');
    if (cc === 0) {
      await client.query(`
        INSERT INTO coaches (name, role, email, sessions, color) VALUES
          ('Ari Iny',               'Director of Growth',  'ari@mirasee.com',      'session1,session3',          '#2233a8'),
          ('Jay Allyson',           'Director of ACES',    'jay@mirasee.com',      'session2',                   '#1a6b52'),
          ('Andrea Nino de Guzman', 'ACES Coach',          'andrea@mirasee.com',   'session1,session2,session3', '#7c3090'),
          ('Jason Muller',          'ACES Coach',          'jason@mirasee.com',    'session1,session2,session3', '#c0541a'),
          ('Kevin Urban',           'ACES Coach',          'kevin@mirasee.com',    'session2,session3',          '#8b1a1a'),
          ('Meredith Eisenberg',    'ACES Coach',          'meredith@mirasee.com', 'session3',                   '#1a5c8b'),
          ('Monica Badiu',          'ACES Coach',          'monica@mirasee.com',   'session1,session3',          '#5e3a1a');
      `);
    }

    // ── Seed default groups ───────────────────────────────────
    const { rowCount: gc } = await client.query('SELECT 1 FROM groups LIMIT 1');
    if (gc === 0) {
      await client.query(`
        INSERT INTO groups (name, type, max_size, color, sort_order) VALUES
          ('Plus Group',      'plus',    12, '#f5a623', 1),
          ('Regular Group A', 'regular', 12, '#2233a8', 2),
          ('Regular Group B', 'regular', 12, '#1a6b52', 3),
          ('Regular Group C', 'regular', 12, '#7c3090', 4);
      `);
    }

    console.log('✅ Database ready');
  } finally {
    client.release();
  }
}

// ══════════════════════════════════════════════════════════════
//  AUTO-ASSIGNMENT ENGINE
//
//  Plus members  → Plus group (sessions 1 & 3) + lowest regular group (sessions 2 & 4)
//  Regular members → lowest regular group by member count (all 4 sessions)
//
//  Only ONE Plus group exists. If it's full, return an error with a warning
//  so admin is notified rather than silently creating a second Plus group.
// ══════════════════════════════════════════════════════════════
async function autoAssign(registrationId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: [reg] } = await client.query(
      'SELECT * FROM registrations WHERE id = $1', [registrationId]
    );
    if (!reg)       throw new Error('Registration not found');
    if (reg.assigned) throw new Error('Already assigned');

    // ── Fetch group caps from settings ────────────────────────
    const { rows: capRows } = await client.query(
      "SELECT key, value FROM settings WHERE key IN ('plus_group_cap','regular_group_cap')"
    );
    const caps = {};
    capRows.forEach(r => { caps[r.key] = parseInt(r.value) || 12; });
    const plusCap    = caps['plus_group_cap']    || 12;
    const regularCap = caps['regular_group_cap'] || 12;

    // ── Fetch all groups with live member counts ──────────────
    const { rows: allGroups } = await client.query(`
      SELECT g.*, COUNT(a.id)::int AS member_count
      FROM groups g
      LEFT JOIN attendees a ON a.group_id = g.id
      GROUP BY g.id
      ORDER BY g.sort_order ASC, g.id ASC
    `);

    // ── Determine morning group (sessions 1 & 3) ─────────────
    let morningGroup;

    if (reg.tier === 'plus') {
      // Exactly one Plus group — find it
      const plusGroups = allGroups.filter(g => g.type === 'plus');
      if (!plusGroups.length) throw new Error('No Plus group configured. Create one in Admin → Groups first.');
      const pg = plusGroups[0]; // always use the first (and only) Plus group
      if (pg.member_count >= plusCap) {
        throw new Error(
          `The Plus group "${pg.name}" is full (${pg.member_count}/${plusCap}). ` +
          `Increase the cap in Admin → Settings, or manually assign this person.`
        );
      }
      morningGroup = pg;
    } else {
      // Regular member → pick the regular group with fewest members that isn't full
      const regularGroups = allGroups.filter(g => g.type === 'regular' && g.member_count < regularCap);
      if (!regularGroups.length) {
        throw new Error(
          'All regular groups are full. Increase the cap in Admin → Settings, or create a new regular group.'
        );
      }
      // Sort by member count ascending — fill smallest first
      regularGroups.sort((a, b) => a.member_count - b.member_count);
      morningGroup = regularGroups[0];
    }

    // ── Determine afternoon group (sessions 2 & 4) ────────────
    // Always round-robin across regular groups regardless of tier
    const regularGroupsForAfternoon = allGroups
      .filter(g => g.type === 'regular')
      .sort((a, b) => a.member_count - b.member_count);

    const afternoonGroup = regularGroupsForAfternoon.length
      ? regularGroupsForAfternoon[0]
      : morningGroup; // fallback if no regular groups exist yet

    // ── Build room labels + Zoom URLs from group settings ──────
    const mg = morningGroup;
    const ag = afternoonGroup;

    const room_s1 = mg.name;  const zoom_s1 = mg.zoom_s1 || '';
    const room_s2 = ag.name;  const zoom_s2 = ag.zoom_s2 || '';
    const room_s3 = mg.name;  const zoom_s3 = mg.zoom_s3 || '';
    const room_s4 = ag.name;  const zoom_s4 = ag.zoom_s4 || '';

    // ── Upsert attendee record ────────────────────────────────
    const { rows: [attendee] } = await client.query(`
      INSERT INTO attendees
        (name, email, tier, group_id, room_s1, zoom_s1, room_s2, zoom_s2, room_s3, zoom_s3, room_s4, zoom_s4)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (email) DO UPDATE SET
        name     = EXCLUDED.name,
        tier     = EXCLUDED.tier,
        group_id = EXCLUDED.group_id,
        room_s1  = EXCLUDED.room_s1, zoom_s1 = EXCLUDED.zoom_s1,
        room_s2  = EXCLUDED.room_s2, zoom_s2 = EXCLUDED.zoom_s2,
        room_s3  = EXCLUDED.room_s3, zoom_s3 = EXCLUDED.zoom_s3,
        room_s4  = EXCLUDED.room_s4, zoom_s4 = EXCLUDED.zoom_s4
      RETURNING *
    `, [reg.name, reg.email, reg.tier, morningGroup.id,
        room_s1, zoom_s1, room_s2, zoom_s2,
        room_s3, zoom_s3, room_s4, zoom_s4]);

    // ── Mark registration as assigned ─────────────────────────
    await client.query(
      "UPDATE registrations SET assigned = TRUE, status = 'assigned' WHERE id = $1",
      [registrationId]
    );

    await client.query('COMMIT');
    return {
      attendee,
      morning_group:   morningGroup.name,
      afternoon_group: afternoonGroup.name,
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ── Re-assign when tier changes ───────────────────────────────
async function reAssign(attendeeId, newTier) {
  await pool.query('UPDATE attendees SET tier = $1 WHERE id = $2', [newTier, attendeeId]);
  const { rows: [att] } = await pool.query('SELECT * FROM attendees WHERE id = $1', [attendeeId]);
  if (!att) throw new Error('Attendee not found');
  const { rows: existing } = await pool.query(
    'SELECT id FROM registrations WHERE email = $1', [att.email]
  );
  if (!existing.length) throw new Error('No registration found for re-assignment');
  await pool.query(
    'UPDATE registrations SET tier = $1, assigned = FALSE WHERE id = $2',
    [newTier, existing[0].id]
  );
  return autoAssign(existing[0].id);
}

// ══════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════
async function patchTable(table, id, body, res) {
  try {
    const fields = Object.keys(body);
    const values = Object.values(body);
    if (!fields.length) return res.json({ ok: true });
    const set = fields.map((f, i) => `${f}=$${i + 2}`).join(',');
    await pool.query(`UPDATE ${table} SET ${set} WHERE id=$1`, [id, ...values]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// ══════════════════════════════════════════════════════════════
//  ROUTES — SETTINGS
// ══════════════════════════════════════════════════════════════
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
    for (const [key, value] of Object.entries(req.body)) {
      await pool.query(
        'INSERT INTO settings (key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=$2',
        [key, value]
      );
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  ROUTES — SCHEDULE
// ══════════════════════════════════════════════════════════════
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
      'INSERT INTO schedule (date_label,title,sub_label,type,topic,zoom_url,zoom_key,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [date_label||'', title, sub_label||'', type||'main', topic||'', zoom_url||'', zoom_key||'', sort_order||99]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.patch('/api/schedule/:id',  async (req, res) => patchTable('schedule',  req.params.id, req.body, res));
app.delete('/api/schedule/:id', async (req, res) => {
  try { await pool.query('DELETE FROM schedule WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  ROUTES — COACHES
// ══════════════════════════════════════════════════════════════
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
      'INSERT INTO coaches (name,role,email,photo_url,zoom_url,about_url,sessions,color) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [name, role||'', email||'', photo_url||'', zoom_url||'', about_url||'', sessions||'', color||'#2233a8']
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.patch('/api/coaches/:id',  async (req, res) => patchTable('coaches',  req.params.id, req.body, res));
app.delete('/api/coaches/:id', async (req, res) => {
  try { await pool.query('DELETE FROM coaches WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  ROUTES — ATTENDEES
// ══════════════════════════════════════════════════════════════
app.get('/api/attendees', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM attendees ORDER BY name ASC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.post('/api/attendees', async (req, res) => {
  try {
    const { name, email, tier, group_id, room_s1, zoom_s1, room_s2, zoom_s2, room_s3, zoom_s3, room_s4, zoom_s4 } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO attendees (name,email,tier,group_id,room_s1,zoom_s1,room_s2,zoom_s2,room_s3,zoom_s3,room_s4,zoom_s4) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',
      [name, email, tier||'regular', group_id||null, room_s1||'', zoom_s1||'', room_s2||'', zoom_s2||'', room_s3||'', zoom_s3||'', room_s4||'', zoom_s4||'']
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.patch('/api/attendees/:id',  async (req, res) => patchTable('attendees', req.params.id, req.body, res));
app.delete('/api/attendees/:id', async (req, res) => {
  try { await pool.query('DELETE FROM attendees WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});
// Change tier + re-assign
app.post('/api/attendees/:id/change-tier', async (req, res) => {
  try {
    const result = await reAssign(parseInt(req.params.id), req.body.tier);
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  ROUTES — REGISTRATIONS
// ══════════════════════════════════════════════════════════════
app.get('/api/registrations', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM registrations ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Public form submit — name + email only
app.post('/api/register', async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email are required.' });
    const clean = { name: name.trim(), email: email.toLowerCase().trim() };

    // Check registration is open
    const { rows: openRows } = await pool.query(
      "SELECT value FROM settings WHERE key='registration_open'"
    );
    if (openRows[0]?.value === 'false') {
      return res.status(403).json({ error: 'Registration is currently closed.' });
    }

    const { rows } = await pool.query(
      'INSERT INTO registrations (name,email) VALUES ($1,$2) RETURNING *',
      [clean.name, clean.email]
    );
    res.json({ ok: true, id: rows[0].id });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'This email is already registered.' });
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/registrations/:id',  async (req, res) => patchTable('registrations', req.params.id, req.body, res));
app.delete('/api/registrations/:id', async (req, res) => {
  try { await pool.query('DELETE FROM registrations WHERE id=$1', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// Assign single registration
app.post('/api/registrations/:id/assign', async (req, res) => {
  try {
    const result = await autoAssign(parseInt(req.params.id));
    res.json(result);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bulk assign all unassigned
app.post('/api/registrations/assign-all', async (req, res) => {
  try {
    const { rows } = await pool.query(
      "SELECT id FROM registrations WHERE assigned=FALSE AND status!='cancelled' ORDER BY created_at ASC"
    );
    const results = [];
    for (const r of rows) {
      try {
        results.push({ id: r.id, ok: true, ...(await autoAssign(r.id)) });
      } catch (e) {
        results.push({ id: r.id, ok: false, error: e.message });
      }
    }
    res.json({
      assigned: results.filter(r => r.ok).length,
      failed:   results.filter(r => !r.ok).length,
      results,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  ROUTES — GROUPS
// ══════════════════════════════════════════════════════════════
app.get('/api/groups', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT g.*, COUNT(a.id)::int AS member_count
      FROM groups g
      LEFT JOIN attendees a ON a.group_id = g.id
      GROUP BY g.id
      ORDER BY g.sort_order ASC, g.id ASC
    `);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/groups', async (req, res) => {
  try {
    const { name, type, max_size, color, sort_order } = req.body;

    // Enforce single Plus group rule
    if (type === 'plus') {
      const { rows } = await pool.query("SELECT id FROM groups WHERE type='plus' LIMIT 1");
      if (rows.length) {
        return res.status(409).json({
          error: 'A Plus group already exists. There can only be one Plus group. Rename or adjust the existing one.'
        });
      }
    }

    const { rows } = await pool.query(
      'INSERT INTO groups (name,type,max_size,color,sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [name, type||'regular', max_size||12, color||'#2233a8', sort_order||99]
    );
    res.json({ ...rows[0], member_count: 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/groups/:id', async (req, res) => {
  try {
    const fields = Object.keys(req.body);
    const values = Object.values(req.body);
    if (!fields.length) return res.json({ ok: true });
    const set = fields.map((f, i) => `${f}=$${i + 2}`).join(',');
    await pool.query(`UPDATE groups SET ${set} WHERE id=$1`, [req.params.id, ...values]);

    // Cascade zoom URL changes to all attendees in this group
    const zoomMap = { zoom_s1:'zoom_s1', zoom_s2:'zoom_s2', zoom_s3:'zoom_s3', zoom_s4:'zoom_s4' };
    for (const [field, attField] of Object.entries(zoomMap)) {
      if (req.body[field] !== undefined) {
        await pool.query(
          `UPDATE attendees SET ${attField}=$1 WHERE group_id=$2`,
          [req.body[field], req.params.id]
        );
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/groups/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM groups WHERE id=$1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/groups/:id/attendees', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM attendees WHERE group_id=$1 ORDER BY name ASC', [req.params.id]
    );
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════
//  ROUTES — COACH PORTAL (shared password)
// ══════════════════════════════════════════════════════════════

// Coach login — validates against shared coach_password setting
app.post('/api/coach-login', async (req, res) => {
  try {
    const { password } = req.body;
    const { rows } = await pool.query(
      "SELECT value FROM settings WHERE key='coach_password'"
    );
    if (!rows.length || rows[0].value !== password) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get all groups + attendees for the coach dashboard
app.get('/api/coach-portal', async (req, res) => {
  try {
    const { rows: groups } = await pool.query(`
      SELECT g.*,
        COUNT(a.id)::int AS member_count,
        c1.name AS coach_s1_name, c2.name AS coach_s2_name,
        c3.name AS coach_s3_name, c4.name AS coach_s4_name
      FROM groups g
      LEFT JOIN coaches c1 ON g.coach_s1_id = c1.id
      LEFT JOIN coaches c2 ON g.coach_s2_id = c2.id
      LEFT JOIN coaches c3 ON g.coach_s3_id = c3.id
      LEFT JOIN coaches c4 ON g.coach_s4_id = c4.id
      LEFT JOIN attendees a ON a.group_id = g.id
      GROUP BY g.id, c1.name, c2.name, c3.name, c4.name
      ORDER BY g.sort_order ASC, g.id ASC
    `);
    const { rows: attendees } = await pool.query(
      'SELECT * FROM attendees ORDER BY name ASC'
    );
    res.json({ groups, attendees });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Coach updates zoom/topic for a group session — cascades to attendees
app.patch('/api/coach-portal/group/:groupId/session/:sessionKey', async (req, res) => {
  try {
    const { groupId, sessionKey } = req.params;
    const { zoom_url, topic } = req.body;

    const zoomFieldMap = { session1:'zoom_s1', session2:'zoom_s2', session3:'zoom_s3', session4:'zoom_s4' };
    const zoomField = zoomFieldMap[sessionKey];
    if (!zoomField) return res.status(400).json({ error: 'Invalid session key' });

    const updates = {};
    if (zoom_url !== undefined) updates[zoomField] = zoom_url;
    // Store topic in a notes column-style via group name approach — we'll put topic in zoom_key equivalent
    // For simplicity, store topic as part of the group record using a dedicated approach:
    // We add a topic_s1..s4 column lazily via ALTER TABLE
    if (topic !== undefined) {
      // Ensure topic columns exist
      await pool.query(`
        ALTER TABLE groups ADD COLUMN IF NOT EXISTS topic_s1 TEXT DEFAULT '';
        ALTER TABLE groups ADD COLUMN IF NOT EXISTS topic_s2 TEXT DEFAULT '';
        ALTER TABLE groups ADD COLUMN IF NOT EXISTS topic_s3 TEXT DEFAULT '';
        ALTER TABLE groups ADD COLUMN IF NOT EXISTS topic_s4 TEXT DEFAULT '';
      `).catch(() => {}); // ignore if already exist
      const topicField = sessionKey.replace('session', 'topic_s');
      updates[topicField] = topic;
    }

    if (Object.keys(updates).length) {
      const fields = Object.keys(updates);
      const values = Object.values(updates);
      const set = fields.map((f, i) => `${f}=$${i + 2}`).join(',');
      await pool.query(`UPDATE groups SET ${set} WHERE id=$1`, [groupId, ...values]);
    }

    // Cascade zoom to attendees
    if (zoom_url !== undefined) {
      await pool.query(
        `UPDATE attendees SET ${zoomField}=$1 WHERE group_id=$2`,
        [zoom_url, groupId]
      );
    }

    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── CATCH-ALL → serve index.html ─────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ── START ─────────────────────────────────────────────────────
initDB()
  .then(() => app.listen(PORT, () => console.log(`🚀 ACES Hub running on port ${PORT}`)))
  .catch(err => {
    console.error('DB init failed:', err.message);
    app.listen(PORT, () => console.log(`⚠️  Running (no DB) on port ${PORT}`));
  });
