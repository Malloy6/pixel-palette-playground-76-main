import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Pool, PoolClient } from "pg";

type DbEnv = {
  DB_HOST?: string;
  DB_PORT?: string;
  DB_NAME?: string;
  DB_USER?: string;
  DB_PASSWORD?: string;
};

type UserRow = {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  password_hash: string;
};

type SessionRow = {
  id: number;
  user_id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
};

type ClassRow = {
  id: number;
  subject: string;
  grade: string;
  tutor_name: string;
  schedule_label: string;
  seats_taken: number;
  seats_total: number;
  price_kes: number;
  room_slug: string;
};

let pool: Pool | undefined;
let schemaReady: Promise<void> | undefined;
let localEnvLoaded = false;

const defaultClasses = [
  ["Mathematics", "Grade 7", "Mr. Kamau", "Mon & Wed · 6:00pm", 4, 8, 400, "math-grade-7"],
  [
    "Integrated Science",
    "Grade 8",
    "Ms. Wanjiru",
    "Tue & Thu · 5:00pm",
    6,
    10,
    350,
    "science-grade-8",
  ],
  ["English", "Grade 9", "Mr. Otieno", "Sat · 10:00am", 3, 8, 450, "english-grade-9"],
  ["Kiswahili", "Grade 7", "Ms. Mwende", "Fri · 4:30pm", 5, 10, 350, "kiswahili-grade-7"],
  [
    "Social Studies",
    "Grade 8",
    "Mr. Njoroge",
    "Wed · 6:30pm",
    7,
    12,
    300,
    "social-studies-grade-8",
  ],
  ["Pre-Technical", "Grade 9", "Ms. Achieng", "Sat · 2:00pm", 2, 8, 450, "pre-technical-grade-9"],
];

// Development accounts for exercising each supported role. These are inserted only
// when absent, so they never replace a real user's account or password.
const demoUsers = [
  ["Parent", "Demo", "parent.demo@tusomelive.test", "+254700000001", "parent"],
  ["Learner", "Demo", "learner.demo@tusomelive.test", "+254700000002", "learner"],
  ["Tutor", "Demo", "tutor.demo@tusomelive.test", "+254700000003", "tutor"],
  ["Admin", "Demo", "admin.demo@tusomelive.test", "+254700000004", "admin"],
] as const;

const demoPassword = "TusomeDemo2026!";

export type PublicUser = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
};

export type LiveClass = {
  id: number;
  subject: string;
  grade: string;
  tutorName: string;
  scheduleLabel: string;
  seatsTaken: number;
  seatsTotal: number;
  priceKes: number;
  roomSlug: string;
};

function loadLocalEnv() {
  if (localEnvLoaded || typeof process === "undefined") return;
  localEnvLoaded = true;

  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index === -1) continue;

    const key = trimmed.slice(0, index).trim();
    const value = trimmed
      .slice(index + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    process.env[key] = value;
  }
}

function readEnv(env?: unknown): Required<DbEnv> {
  loadLocalEnv();
  const runtimeEnv = (env && typeof env === "object" ? (env as DbEnv) : {}) ?? {};
  const processEnv = typeof process !== "undefined" ? process.env : {};

  return {
    DB_HOST: runtimeEnv.DB_HOST ?? processEnv.DB_HOST ?? "127.0.0.1",
    DB_PORT: runtimeEnv.DB_PORT ?? processEnv.DB_PORT ?? "5432",
    DB_NAME: runtimeEnv.DB_NAME ?? processEnv.DB_NAME ?? "tusomeonline",
    DB_USER: runtimeEnv.DB_USER ?? processEnv.DB_USER ?? "kif3",
    DB_PASSWORD: runtimeEnv.DB_PASSWORD ?? processEnv.DB_PASSWORD ?? "",
  };
}

export function getDbConfig(env?: unknown) {
  const config = readEnv(env);
  if (!config.DB_PASSWORD) {
    throw new Error("DB_PASSWORD is required for Tusome Live database access.");
  }

  return {
    host: config.DB_HOST,
    port: Number(config.DB_PORT ?? 5432),
    database: config.DB_NAME,
    user: config.DB_USER,
    password: config.DB_PASSWORD,
  };
}

async function ensureDatabase(env?: unknown) {
  const { Client } = await import("pg");
  const config = readEnv(env);
  const admin = new Client({
    host: config.DB_HOST,
    port: Number(config.DB_PORT ?? 5432),
    user: config.DB_USER,
    password: config.DB_PASSWORD,
    database: "postgres",
  });
  await admin.connect();
  const res = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [config.DB_NAME]);
  if (res.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${config.DB_NAME.replaceAll('"', '""')}"`);
  }
  await admin.end();
}

async function getPool(env?: unknown) {
  if (!pool) {
    await ensureDatabase(env);
    const { Pool: PgPool } = await import("pg");
    const cfg = getDbConfig(env);
    pool = new PgPool({
      host: cfg.host,
      port: cfg.port,
      database: cfg.database,
      user: cfg.user,
      password: cfg.password,
      max: 10,
    });
  }
  if (!schemaReady) {
    schemaReady = ensureSchema(pool).catch((error) => {
      schemaReady = undefined;
      // @ts-ignore
      pool?.end?.().catch(() => undefined);
      pool = undefined;
      throw error;
    });
  }
  await schemaReady;
  return pool;
}

async function ensureSchema(db: Pool) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(40),
        first_name VARCHAR(120) NOT NULL,
        last_name VARCHAR(120) NOT NULL,
        role VARCHAR(16) NOT NULL DEFAULT 'parent',
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

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
        ended_at TIMESTAMPTZ NULL
      )
    `);

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

    for (const item of defaultClasses) {
      await client.query(
        `
          INSERT INTO live_classes
            (subject, grade, tutor_name, schedule_label, seats_taken, seats_total, price_kes, room_slug)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (room_slug) DO UPDATE SET
            subject = EXCLUDED.subject,
            grade = EXCLUDED.grade,
            tutor_name = EXCLUDED.tutor_name,
            schedule_label = EXCLUDED.schedule_label,
            seats_taken = EXCLUDED.seats_taken,
            seats_total = EXCLUDED.seats_total,
            price_kes = EXCLUDED.price_kes,
            is_active = TRUE
        `,
        item as any,
      );
    }

    for (const [firstName, lastName, email, phone, role] of demoUsers) {
      await client.query(
        `
          INSERT INTO users (email, phone, first_name, last_name, role, password_hash)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (email) DO NOTHING
        `,
        [email, phone, firstName, lastName, role, await hashPassword(demoPassword)],
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function toPublicUser(row: SessionRow | UserRow): PublicUser {
  return {
    id: Number("user_id" in row ? row.user_id : row.id),
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
  };
}

function toLiveClass(row: ClassRow): LiveClass {
  return {
    id: Number(row.id),
    subject: row.subject,
    grade: row.grade,
    tutorName: row.tutor_name,
    scheduleLabel: row.schedule_label,
    seatsTaken: Number(row.seats_taken),
    seatsTotal: Number(row.seats_total),
    priceKes: Number(row.price_kes),
    roomSlug: row.room_slug,
  };
}

export async function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, salt, hash] = storedHash.split(":");
  if (algorithm !== "scrypt" || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && crypto.timingSafeEqual(candidate, expected);
}

export async function createUser(
  input: {
    email: string;
    phone?: string;
    firstName: string;
    lastName: string;
    role: string;
    password: string;
  },
  env?: unknown,
) {
  const db = await getPool(env);
  const passwordHash = await hashPassword(input.password);
  const res = await (db as any).query(
    `
      INSERT INTO users (email, phone, first_name, last_name, role, password_hash)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    [
      input.email.toLowerCase(),
      input.phone || null,
      input.firstName,
      input.lastName,
      input.role,
      passwordHash,
    ],
  );

  return {
    id: Number(res.rows[0].id),
    email: input.email.toLowerCase(),
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
  };
}

export async function findUserByEmail(email: string, env?: unknown) {
  const db = await getPool(env);
  const res = await (db as any).query<UserRow>("SELECT * FROM users WHERE email = $1 LIMIT 1", [
    email.toLowerCase(),
  ]);
  return res.rows[0];
}

export async function createAuthSession(
  input: {
    userId: number;
    userAgent?: string | null;
    ipAddress?: string | null;
  },
  env?: unknown,
) {
  const db = await getPool(env);
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  await (db as any).query(
    `
      INSERT INTO auth_sessions (user_id, token_hash, user_agent, ip_address, expires_at)
      VALUES ($1, $2, $3, $4, now() + INTERVAL '30 days')
    `,
    [input.userId, tokenHash, input.userAgent ?? null, input.ipAddress ?? null],
  );
  return token;
}

export async function getUserFromToken(token: string | undefined, env?: unknown) {
  if (!token) return null;
  const db = await getPool(env);
  const res = await (db as any).query<SessionRow>(
    `
      SELECT
        auth_sessions.id,
        users.id AS user_id,
        users.email,
        users.first_name,
        users.last_name,
        users.role
      FROM auth_sessions
      JOIN users ON users.id = auth_sessions.user_id
      WHERE auth_sessions.token_hash = $1
        AND auth_sessions.revoked_at IS NULL
        AND auth_sessions.expires_at > now()
      LIMIT 1
    `,
    [hashToken(token)],
  );

  const session = res.rows[0];
  if (!session) return null;

  await (db as any).query("UPDATE auth_sessions SET last_seen_at = now() WHERE id = $1", [
    session.id,
  ]);

  return { user: toPublicUser(session), sessionId: Number(session.id) };
}

export async function revokeAuthSession(token: string | undefined, env?: unknown) {
  if (!token) return;
  const db = await getPool(env);
  await (db as any).query(
    "UPDATE auth_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
    [hashToken(token)],
  );
}

export async function listLiveClasses(env?: unknown) {
  const db = await getPool(env);
  const res = await (db as any).query<ClassRow>(
    "SELECT * FROM live_classes WHERE is_active = TRUE ORDER BY id ASC",
  );
  return res.rows.map(toLiveClass);
}

export async function startConference(
  classId: number,
  userId: number,
  authSessionId: number,
  env?: unknown,
) {
  const db = await getPool(env);
  const classesRes = await (db as any).query<ClassRow>(
    "SELECT * FROM live_classes WHERE id = $1 AND is_active = TRUE LIMIT 1",
    [classId],
  );
  const liveClass = classesRes.rows[0];
  if (!liveClass) return null;

  const roomName = `TusomeOnline-${liveClass.room_slug}-${classId}`;
  await (db as any).query(
    `
      INSERT INTO conference_rooms (class_id, room_name)
      VALUES ($1, $2)
      ON CONFLICT (room_name) DO UPDATE SET ended_at = NULL
    `,
    [classId, roomName],
  );

  const roomsRes = await (db as any).query("SELECT id FROM conference_rooms WHERE room_name = $1 LIMIT 1", [
    roomName,
  ]);
  const roomId = Number(roomsRes.rows[0].id);

  const participantRes = await (db as any).query(
    `
      INSERT INTO conference_participants (room_id, user_id, auth_session_id)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [roomId, userId, authSessionId],
  );

  // fetch user's display name for Jitsi prefill
  const userRes = await (db as any).query("SELECT first_name, last_name FROM users WHERE id = $1 LIMIT 1", [
    userId,
  ]);
  const userRow = userRes.rows[0];
  const userDisplayName = userRow ? `${userRow.first_name} ${userRow.last_name}` : undefined;

  return {
    class: toLiveClass(liveClass),
    participantId: Number(participantRes.rows[0].id),
    roomId,
    roomName,
    jitsiDomain: "meet.jit.si",
    userDisplayName,
  };
}

export async function touchConferenceParticipant(
  participantId: number,
  userId: number,
  env?: unknown,
) {
  const db = await getPool(env);
  await (db as any).query(
    `
      UPDATE conference_participants
      SET
        last_seen_at = now(),
        duration_seconds = FLOOR(EXTRACT(EPOCH FROM (now() - joined_at)))::INT
      WHERE id = $1 AND user_id = $2 AND left_at IS NULL
    `,
    [participantId, userId],
  );
}

export async function leaveConferenceParticipant(
  participantId: number,
  userId: number,
  env?: unknown,
) {
  const db = await getPool(env);
  await (db as any).query(
    `
      UPDATE conference_participants
      SET
        left_at = COALESCE(left_at, now()),
        last_seen_at = now(),
        duration_seconds = FLOOR(EXTRACT(EPOCH FROM (now() - joined_at)))::INT
      WHERE id = $1 AND user_id = $2
    `,
    [participantId, userId],
  );
}
