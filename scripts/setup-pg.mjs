import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import crypto from 'node:crypto';
import { Client } from 'pg';

const root = path.resolve(import.meta.dirname, '..');
const envPath = path.join(root, '.env.local');

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    value = value.replace(/^['"]|['"]$/g, '');
    process.env[key] = value;
  }
}

const host = process.env.DB_HOST || '127.0.0.1';
const port = Number(process.env.DB_PORT || 5432);
const user = process.env.DB_USER || 'kif3';
const password = process.env.DB_PASSWORD;
const database = process.env.DB_NAME || 'tusomeonline';
const demoPassword = 'TusomeDemo2026!';
const demoUsers = [
  ['Learner', 'Demo', 'learner.demo@elimusphere.test', '+254700000002', 'learner'],
  ['Tutor', 'Demo', 'tutor.demo@elimusphere.test', '+254700000003', 'tutor'],
  ['Admin', 'Demo', 'admin.demo@elimusphere.test', '+254700000004', 'admin'],
];

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

if (!password) {
  console.error('DB_PASSWORD is required in environment or .env.local');
  process.exit(1);
}

async function ensureDatabase() {
  const admin = new Client({ host, port, user, password, database: 'postgres' });
  await admin.connect();
  const res = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [database]);
  if (res.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${database.replaceAll('"', '""')}"`);
    console.log('Created database', database);
  } else {
    console.log('Database exists:', database);
  }
  await admin.end();
}

async function setupSchema() {
  const client = new Client({ host, port, user, password, database });
  await client.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(40),
        first_name VARCHAR(120) NOT NULL,
        last_name VARCHAR(120) NOT NULL,
        role VARCHAR(16) NOT NULL DEFAULT 'learner',
        password_hash VARCHAR(255) NOT NULL,
        terms_version VARCHAR(32),
        terms_accepted_at TIMESTAMPTZ,
        role_agreement_version VARCHAR(32),
        role_agreement_accepted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version VARCHAR(32)");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role_agreement_version VARCHAR(32)");
    await client.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS role_agreement_accepted_at TIMESTAMPTZ",
    );

    await client.query('DELETE FROM users WHERE email = $1', ['parent.demo@elimusphere.test']);

    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_sessions (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash CHAR(64) NOT NULL UNIQUE,
        user_agent VARCHAR(512),
        ip_address VARCHAR(64),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS live_classes (
        id BIGSERIAL PRIMARY KEY,
        subject VARCHAR(160) NOT NULL,
        grade VARCHAR(80) NOT NULL,
        tutor_name VARCHAR(160) NOT NULL,
        schedule_label VARCHAR(160) NOT NULL,
        seats_taken INTEGER NOT NULL DEFAULT 0,
        seats_total INTEGER NOT NULL DEFAULT 1,
        price_kes INTEGER NOT NULL DEFAULT 0,
        room_slug VARCHAR(180) NOT NULL UNIQUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS conference_rooms (
        id BIGSERIAL PRIMARY KEY,
        class_id BIGINT NOT NULL REFERENCES live_classes(id) ON DELETE CASCADE,
        jitsi_domain VARCHAR(120) NOT NULL DEFAULT 'meet.jit.si',
        room_name VARCHAR(255) NOT NULL UNIQUE,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        ended_at TIMESTAMPTZ NULL,
        whiteboard_visible BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);
    await client.query(
      "ALTER TABLE conference_rooms ADD COLUMN IF NOT EXISTS whiteboard_visible BOOLEAN NOT NULL DEFAULT FALSE",
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS conference_participants (
        id BIGSERIAL PRIMARY KEY,
        room_id BIGINT NOT NULL REFERENCES conference_rooms(id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        auth_session_id BIGINT NULL REFERENCES auth_sessions(id) ON DELETE SET NULL,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        left_at TIMESTAMPTZ NULL,
        duration_seconds INTEGER NOT NULL DEFAULT 0
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS class_bookings (
        id BIGSERIAL PRIMARY KEY,
        class_id BIGINT NOT NULL REFERENCES live_classes(id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(16) NOT NULL DEFAULT 'booked',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (class_id, user_id)
      )
    `);

    // Insert default classes
    const defaultClasses = [
      ['Mathematics', 'Grade 7', 'Mr. Kamau', 'Mon & Wed · 6:00pm', 4, 8, 400, 'math-grade-7'],
      ['Integrated Science', 'Grade 8', 'Ms. Wanjiru', 'Tue & Thu · 5:00pm', 6, 10, 350, 'science-grade-8'],
      ['English', 'Grade 9', 'Mr. Otieno', 'Sat · 10:00am', 3, 8, 450, 'english-grade-9'],
      ['Kiswahili', 'Grade 7', 'Ms. Mwende', 'Fri · 4:30pm', 5, 10, 350, 'kiswahili-grade-7'],
      ['Social Studies', 'Grade 8', 'Mr. Njoroge', 'Wed · 6:30pm', 7, 12, 300, 'social-studies-grade-8'],
      ['Pre-Technical', 'Grade 9', 'Ms. Achieng', 'Sat · 2:00pm', 2, 8, 450, 'pre-technical-grade-9'],
    ];

    for (const item of defaultClasses) {
      await client.query(
        `INSERT INTO live_classes (subject, grade, tutor_name, schedule_label, seats_taken, seats_total, price_kes, room_slug)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (room_slug) DO UPDATE SET
           subject = EXCLUDED.subject,
           grade = EXCLUDED.grade,
           tutor_name = EXCLUDED.tutor_name,
           schedule_label = EXCLUDED.schedule_label,
           seats_taken = EXCLUDED.seats_taken,
           seats_total = EXCLUDED.seats_total,
           price_kes = EXCLUDED.price_kes,
           is_active = TRUE`,
        item,
      );
    }

    for (const [firstName, lastName, email, phone, role] of demoUsers) {
      await client.query(
        `INSERT INTO users (email, phone, first_name, last_name, role, password_hash)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO NOTHING`,
        [email, phone, firstName, lastName, role, hashPassword(demoPassword)],
      );
    }

    await client.query('COMMIT');
    console.log('Schema ready');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    throw err;
  } finally {
    await client.end();
  }
}

(async function main() {
  try {
    await ensureDatabase();
    await setupSchema();
    console.log('Postgres setup complete');
  } catch (err) {
    console.error('Setup failed:', err);
    process.exit(1);
  }
})();
