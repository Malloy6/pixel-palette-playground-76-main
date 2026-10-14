import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { Pool, PoolClient, QueryConfig, QueryResult } from "pg";

import {
  emailDetails,
  emailList,
  emailParagraph,
  escapeEmailHtml,
  renderBrandedEmail,
} from "./email-templates.ts";
import {
  DEFAULT_CUSTOM_SERVICE_PRICES,
  type CustomServicePrices,
} from "./custom-service-pricing.ts";
import { formatRecurringSchedule, parseLegacySchedule } from "./class-schedule.ts";
import { CBE_GRADES, CBE_SUBJECTS } from "./subjects.ts";

type DbEnv = {
  DB_HOST?: string;
  DB_PORT?: string;
  DB_NAME?: string;
  DB_USER?: string;
  DB_PASSWORD?: string;
  JITSI_DOMAIN?: string;
  JITSI_WHITEBOARD_URL?: string;
  JITSI_JWT?: string;
  // Self-hosted JWT configuration (optional, for additional security)
  JITSI_JWT_ISSUER?: string;
  JITSI_JWT_SECRET?: string;
  // Deprecated: JaaS (8x8) configuration - use self-hosted instead
  JITSI_APP_ID?: string;
  JITSI_KEY_ID?: string;
  JITSI_PRIVATE_KEY?: string;
  JITSI_PRIVATE_KEY_FILE?: string;
  NODE_ENV?: string;
};

type UserRow = {
  id: number;
  email: string;
  phone?: string | null;
  first_name: string;
  last_name: string;
  role: string;
  is_active?: boolean;
  suspension_reason?: string | null;
  password_hash: string;
  parent_id?: number | null;
  created_at?: string;
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
  schedule_days?: number[] | null;
  start_time?: string | null;
  seats_taken: number;
  seats_total: number;
  price_kes: number;
  room_slug: string;
  tutor_user_id?: number | null;
  is_live?: boolean;
};

export type LearningTimelineEvent = {
  id: number;
  userId: number;
  eventType: string;
  title: string;
  description: string | null;
  subject: string | null;
  course: string | null;
  eventDate: string;
  highlighted: boolean;
  metadata: Record<string, unknown> | null;
};

export type LearningTimelineView = {
  events: LearningTimelineEvent[];
  summary: {
    totalEvents: number;
    highlightedEvents: number;
    latestEventTitle: string | null;
    subjects: string[];
  };
};

let poolInitialization: Promise<Pool> | undefined;
let localEnvLoaded = false;
const currentSchemaVersion = 17;

// Development accounts for exercising each supported role. These are inserted only
// when absent, so they never replace a real user's account or password.
const demoUsers = [
  ["Learner", "Demo", "learner.demo@elimusphere.test", "+254700000002", "learner"],
  ["Tutor", "Demo", "tutor.demo@elimusphere.test", "+254700000003", "tutor"],
  ["Admin", "Demo", "admin.demo@elimusphere.test", "+254700000004", "admin"],
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
  scheduleDays: number[];
  startTime: string | null;
  upcomingSessions?: ClassSession[];
  seatsTaken: number;
  seatsTotal: number;
  priceKes: number;
  roomSlug: string;
  tutorUserId: number | null;
  isLive: boolean;
};

export type ClassSession = {
  id: number;
  classId: number;
  scheduledAt: string;
  bookingCount: number;
  isBooked: boolean;
  isPaid: boolean;
  roomId: number | null;
  isLive: boolean;
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

    // VPS/service-manager secrets take precedence over local development values.
    // In particular, never replace an injected JITSI_PRIVATE_KEY with an empty
    // placeholder from .env.local.
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

type DatabaseConfig = Required<
  Pick<DbEnv, "DB_HOST" | "DB_PORT" | "DB_NAME" | "DB_USER" | "DB_PASSWORD">
>;

function readEnv(env?: unknown): DatabaseConfig {
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
    throw new Error("DB_PASSWORD is required for Elimusphere database access.");
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
  if (!poolInitialization) {
    poolInitialization = (async () => {
      if (process.env.NODE_ENV !== "production") {
        await ensureDatabase(env);
      }
      const { Pool: PgPool } = await import("pg");
      const cfg = getDbConfig(env);
      const initializedPool = new PgPool({
        host: cfg.host,
        port: cfg.port,
        database: cfg.database,
        user: cfg.user,
        password: cfg.password,
        max: 10,
        connectionTimeoutMillis: 5_000,
      });
      try {
        await ensureSchema(initializedPool);
        return initializedPool;
      } catch (error) {
        await initializedPool.end();
        throw error;
      }
    })().catch((error) => {
      poolInitialization = undefined;
      throw error;
    });
  }
  return poolInitialization;
}

async function ensureSchema(db: Pool) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1)", [8_642_031]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_schema_versions (
        version INTEGER PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    const schemaVersion = await client.query<{ version: number }>(
      "SELECT MAX(version) AS version FROM app_schema_versions",
    );
    if (Number(schemaVersion.rows[0]?.version ?? 0) >= currentSchemaVersion) {
      await client.query("COMMIT");
      return;
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGSERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(40),
        first_name VARCHAR(120) NOT NULL,
        last_name VARCHAR(120) NOT NULL,
        role VARCHAR(16) NOT NULL DEFAULT 'learner',
        password_hash VARCHAR(255) NOT NULL,
        parent_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version VARCHAR(32)");
    await client.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE",
    );
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS suspension_reason TEXT");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ");
    await client.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS role_agreement_version VARCHAR(32)",
    );
    await client.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS role_agreement_accepted_at TIMESTAMPTZ",
    );

    await client.query("DELETE FROM users WHERE email = $1", ["parent.demo@elimusphere.test"]);

    await client.query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL",
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_conference_permissions (
        user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        can_use_whiteboard BOOLEAN NOT NULL DEFAULT TRUE,
        can_share_screen BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(
      "ALTER TABLE user_conference_permissions ALTER COLUMN can_share_screen SET DEFAULT TRUE",
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS applications (
        id BIGSERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(40),
        first_name VARCHAR(120) NOT NULL,
        last_name VARCHAR(120) NOT NULL,
        requested_role VARCHAR(16) NOT NULL CHECK (requested_role IN ('learner', 'tutor')),
        subject VARCHAR(160),
        password_hash VARCHAR(255) NOT NULL,
        documents JSONB NOT NULL DEFAULT '[]'::jsonb,
        status VARCHAR(16) NOT NULL DEFAULT 'under_review' CHECK (status IN ('under_review', 'approved', 'rejected')),
        reviewed_at TIMESTAMPTZ,
        reviewed_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(
      "ALTER TABLE applications ADD COLUMN IF NOT EXISTS terms_version VARCHAR(32)",
    );
    await client.query(
      "ALTER TABLE applications ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ",
    );
    await client.query(
      "ALTER TABLE applications ADD COLUMN IF NOT EXISTS role_agreement_version VARCHAR(32)",
    );
    await client.query(
      "ALTER TABLE applications ADD COLUMN IF NOT EXISTS role_agreement_accepted_at TIMESTAMPTZ",
    );
    await client.query("ALTER TABLE applications ADD COLUMN IF NOT EXISTS subject VARCHAR(160)");

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
        tutor_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
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
    await client.query(
      "ALTER TABLE live_classes ADD COLUMN IF NOT EXISTS schedule_days SMALLINT[] NOT NULL DEFAULT '{}'",
    );
    await client.query("ALTER TABLE live_classes ADD COLUMN IF NOT EXISTS start_time TIME NULL");
    await client.query(
      "ALTER TABLE live_classes ADD COLUMN IF NOT EXISTS schedule_timezone VARCHAR(64) NOT NULL DEFAULT 'Africa/Nairobi'",
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS class_sessions (
        id BIGSERIAL PRIMARY KEY,
        class_id BIGINT NOT NULL REFERENCES live_classes(id) ON DELETE CASCADE,
        scheduled_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (class_id, scheduled_at)
      )
    `);
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_class_sessions_scheduled_at ON class_sessions(scheduled_at, class_id)",
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS class_session_bookings (
        id BIGSERIAL PRIMARY KEY,
        class_session_id BIGINT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status VARCHAR(16) NOT NULL DEFAULT 'booked',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (class_session_id, user_id)
      )
    `);
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_class_session_bookings_user ON class_session_bookings(user_id, status)",
    );
    const legacySchedules = await client.query<{
      id: number;
      schedule_label: string;
    }>(
      "SELECT id, schedule_label FROM live_classes WHERE cardinality(schedule_days) = 0 OR start_time IS NULL",
    );
    for (const legacy of legacySchedules.rows) {
      const parsed = parseLegacySchedule(legacy.schedule_label);
      if (parsed) {
        await client.query(
          "UPDATE live_classes SET schedule_days = $2::SMALLINT[], start_time = $3::TIME WHERE id = $1",
          [legacy.id, parsed.days, parsed.startTime],
        );
      }
    }
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        class_id BIGINT NULL REFERENCES live_classes(id) ON DELETE SET NULL,
        amount_kes INTEGER NOT NULL,
        provider VARCHAR(40) NOT NULL DEFAULT 'M-Pesa',
        status VARCHAR(32) NOT NULL DEFAULT 'completed',
        reference VARCHAR(120),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(
      "ALTER TABLE payments ADD COLUMN IF NOT EXISTS class_session_id BIGINT NULL REFERENCES class_sessions(id) ON DELETE SET NULL",
    );
    await client.query(
      "ALTER TABLE payments ADD COLUMN IF NOT EXISTS checkout_request_id VARCHAR(120)",
    );
    await client.query(
      "ALTER TABLE payments ADD COLUMN IF NOT EXISTS merchant_request_id VARCHAR(120)",
    );
    await client.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS mpesa_receipt VARCHAR(40)");
    await client.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS mpesa_result_code INTEGER");
    await client.query(
      "ALTER TABLE payments ADD COLUMN IF NOT EXISTS mpesa_result_description VARCHAR(255)",
    );
    await client.query("ALTER TABLE payments ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20)");
    await client.query(
      "CREATE INDEX IF NOT EXISTS payments_checkout_request_id_idx ON payments(checkout_request_id)",
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_class_sessions (
        payment_id BIGINT NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
        class_session_id BIGINT NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
        PRIMARY KEY (payment_id, class_session_id)
      )
    `);
    await client.query(
      "CREATE INDEX IF NOT EXISTS payment_class_sessions_session_idx ON payment_class_sessions(class_session_id, payment_id)",
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_service_requests (
        id BIGSERIAL PRIMARY KEY,
        learner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        service_type VARCHAR(32) NOT NULL CHECK (service_type IN ('one_on_one', 'homework_help')),
        package_type VARCHAR(32) NOT NULL,
        grade VARCHAR(32) NOT NULL DEFAULT 'Grade 7',
        subjects TEXT[] NOT NULL,
        lesson_count SMALLINT NOT NULL CHECK (lesson_count BETWEEN 1 AND 12),
        amount_kes INTEGER NOT NULL CHECK (amount_kes > 0),
        payment_id BIGINT NOT NULL UNIQUE REFERENCES payments(id) ON DELETE CASCADE,
        status VARCHAR(32) NOT NULL DEFAULT 'pending_payment'
          CHECK (status IN ('pending_payment', 'pending_schedule', 'scheduled', 'failed', 'cancelled')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(
      "ALTER TABLE custom_service_requests ADD COLUMN IF NOT EXISTS grade VARCHAR(32) NOT NULL DEFAULT 'Grade 7'",
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_service_sessions (
        id BIGSERIAL PRIMARY KEY,
        request_id BIGINT NOT NULL REFERENCES custom_service_requests(id) ON DELETE CASCADE,
        subject VARCHAR(160) NOT NULL,
        tutor_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        scheduled_at TIMESTAMPTZ NOT NULL,
        created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(
      "CREATE INDEX IF NOT EXISTS custom_service_requests_learner_idx ON custom_service_requests(learner_user_id, created_at DESC)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS custom_service_sessions_tutor_schedule_idx ON custom_service_sessions(tutor_user_id, scheduled_at)",
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS custom_service_pricing (
        service_type VARCHAR(32) NOT NULL CHECK (service_type IN ('one_on_one', 'homework_help')),
        package_type VARCHAR(32) NOT NULL,
        price_kes INTEGER NOT NULL CHECK (price_kes BETWEEN 1 AND 1000000),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (service_type, package_type)
      )
    `);
    await client.query(`
      INSERT INTO custom_service_pricing (service_type, package_type, price_kes) VALUES
        ('one_on_one', 'single', 600),
        ('one_on_one', 'weekly', 2000),
        ('one_on_one', 'monthly', 4800),
        ('homework_help', 'live_discussion', 500),
        ('homework_help', 'chat_support', 200)
      ON CONFLICT (service_type, package_type) DO NOTHING
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS conference_rooms (
        id BIGSERIAL PRIMARY KEY,
        class_id BIGINT NOT NULL REFERENCES live_classes(id) ON DELETE CASCADE,
        jitsi_domain VARCHAR(120) NOT NULL DEFAULT 'meet.jit.si',
        room_name VARCHAR(255) NOT NULL UNIQUE,
        tutor_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
        started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        ended_at TIMESTAMPTZ NULL,
        whiteboard_visible BOOLEAN NOT NULL DEFAULT FALSE
      )
    `);
    await client.query(
      "ALTER TABLE conference_rooms ADD COLUMN IF NOT EXISTS class_session_id BIGINT NULL REFERENCES class_sessions(id) ON DELETE SET NULL",
    );
    await client.query(
      "ALTER TABLE payments ADD COLUMN IF NOT EXISTS conference_room_id BIGINT REFERENCES conference_rooms(id) ON DELETE SET NULL",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS payments_conference_room_user_idx ON payments(conference_room_id, user_id, status)",
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS conference_participants (
        id BIGSERIAL PRIMARY KEY,
        room_id BIGINT NOT NULL REFERENCES conference_rooms(id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        auth_session_id BIGINT NULL REFERENCES auth_sessions(id) ON DELETE SET NULL,
        participant_role VARCHAR(16) NOT NULL DEFAULT 'learner',
        joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        left_at TIMESTAMPTZ NULL,
        duration_seconds INTEGER NOT NULL DEFAULT 0
      )
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS conference_logs (
          id BIGSERIAL PRIMARY KEY,
          room_id BIGINT NULL REFERENCES conference_rooms(id) ON DELETE CASCADE,
          participant_id BIGINT NULL REFERENCES conference_participants(id) ON DELETE SET NULL,
          event_type VARCHAR(120) NOT NULL,
          payload JSONB NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS conference_whiteboard_strokes (
        id BIGSERIAL PRIMARY KEY,
        room_id BIGINT NOT NULL REFERENCES conference_rooms(id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        points JSONB NOT NULL,
        color VARCHAR(32) NOT NULL DEFAULT '#123b6d',
        line_width INTEGER NOT NULL DEFAULT 3,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_conference_whiteboard_room_id ON conference_whiteboard_strokes (room_id, id)",
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS conference_room_permissions (
        room_id BIGINT NOT NULL REFERENCES conference_rooms(id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        can_use_whiteboard BOOLEAN NOT NULL DEFAULT FALSE,
        can_share_screen BOOLEAN NOT NULL DEFAULT TRUE,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (room_id, user_id)
      )
    `);
    await client.query(
      "ALTER TABLE conference_room_permissions ALTER COLUMN can_share_screen SET DEFAULT TRUE",
    );

    // Safe migrations for installations created before live-session reporting.
    await client.query(
      "ALTER TABLE live_classes ADD COLUMN IF NOT EXISTS tutor_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL",
    );
    await client.query(
      "ALTER TABLE conference_rooms ADD COLUMN IF NOT EXISTS tutor_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL",
    );
    await client.query(
      "ALTER TABLE conference_rooms ADD COLUMN IF NOT EXISTS whiteboard_visible BOOLEAN NOT NULL DEFAULT FALSE",
    );
    await client.query(
      "ALTER TABLE conference_participants ADD COLUMN IF NOT EXISTS participant_role VARCHAR(16) NOT NULL DEFAULT 'learner'",
    );

    // A browser crash or network loss can leave a room open indefinitely. Close
    // those sessions so health metrics describe current activity, not stale rows.
    await client.query(`
      UPDATE conference_rooms cr
      SET ended_at = now()
      WHERE cr.ended_at IS NULL
        AND NOT EXISTS (
          SELECT 1
          FROM conference_participants cp
          WHERE cp.room_id = cr.id
            AND cp.left_at IS NULL
            AND cp.last_seen_at > now() - interval '2 minutes'
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash CHAR(64) NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        expires_at TIMESTAMPTZ NOT NULL,
        used_at TIMESTAMPTZ NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS learning_timeline_events (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_type VARCHAR(64) NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        subject VARCHAR(120),
        course VARCHAR(160),
        event_date TIMESTAMPTZ NOT NULL DEFAULT now(),
        highlighted BOOLEAN NOT NULL DEFAULT FALSE,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_learning_timeline_events_user_date ON learning_timeline_events (user_id, event_date DESC)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_learning_timeline_events_type ON learning_timeline_events (event_type)",
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS assignment_requests (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        class_id BIGINT NULL REFERENCES live_classes(id) ON DELETE SET NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NOT NULL,
        file_name VARCHAR(255),
        status VARCHAR(24) NOT NULL DEFAULT 'submitted',
        grade INTEGER NULL,
        feedback TEXT,
        reviewed_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    await client.query(
      "ALTER TABLE live_classes ADD COLUMN IF NOT EXISTS recurrence_rule VARCHAR(24) NULL",
    );
    await client.query(
      "ALTER TABLE assignment_requests ADD COLUMN IF NOT EXISTS status VARCHAR(24) NOT NULL DEFAULT 'submitted'",
    );
    await client.query(
      "ALTER TABLE assignment_requests ADD COLUMN IF NOT EXISTS grade INTEGER NULL",
    );
    await client.query("ALTER TABLE assignment_requests ADD COLUMN IF NOT EXISTS feedback TEXT");
    await client.query(
      "ALTER TABLE assignment_requests ADD COLUMN IF NOT EXISTS reviewed_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL",
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS resources (
        id BIGSERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        grade VARCHAR(80) NULL,
        subject VARCHAR(120) NULL,
        price_kes INTEGER NOT NULL DEFAULT 0,
        file_path VARCHAR(1024) NOT NULL,
        uploader_user_id BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query("ALTER TABLE resources ADD COLUMN IF NOT EXISTS grade VARCHAR(80)");
    await client.query("ALTER TABLE resources ADD COLUMN IF NOT EXISTS subject VARCHAR(120)");

    await client.query(`
      CREATE TABLE IF NOT EXISTS resource_purchases (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        resource_id BIGINT NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
        amount_kes INTEGER NOT NULL,
        provider VARCHAR(40) NOT NULL DEFAULT 'manual',
        status VARCHAR(32) NOT NULL DEFAULT 'completed',
        reference VARCHAR(120),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(
      "ALTER TABLE resource_purchases ADD COLUMN IF NOT EXISTS checkout_request_id VARCHAR(120)",
    );
    await client.query(
      "ALTER TABLE resource_purchases ADD COLUMN IF NOT EXISTS merchant_request_id VARCHAR(120)",
    );
    await client.query(
      "ALTER TABLE resource_purchases ADD COLUMN IF NOT EXISTS mpesa_receipt VARCHAR(40)",
    );
    await client.query(
      "ALTER TABLE resource_purchases ADD COLUMN IF NOT EXISTS mpesa_result_code INTEGER",
    );
    await client.query(
      "ALTER TABLE resource_purchases ADD COLUMN IF NOT EXISTS mpesa_result_description VARCHAR(255)",
    );
    await client.query(
      "ALTER TABLE resource_purchases ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS resource_purchases_checkout_request_id_idx ON resource_purchases(checkout_request_id)",
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS assignments (
        id BIGSERIAL PRIMARY KEY,
        class_id BIGINT NOT NULL REFERENCES live_classes(id) ON DELETE CASCADE,
        tutor_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_learner_id BIGINT NULL REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        instructions TEXT NOT NULL,
        due_at TIMESTAMPTZ NULL,
        attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
        withdrawn_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(
      "ALTER TABLE assignments ADD COLUMN IF NOT EXISTS target_learner_id BIGINT NULL REFERENCES users(id) ON DELETE CASCADE",
    );
    await client.query(
      "ALTER TABLE assignments ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ NULL",
    );
    await client.query(`
      CREATE TABLE IF NOT EXISTS assignment_submissions (
        id BIGSERIAL PRIMARY KEY,
        assignment_id BIGINT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
        learner_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        response TEXT NOT NULL DEFAULT '',
        attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
        submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        grade NUMERIC(5,2) NULL CHECK (grade >= 0 AND grade <= 100),
        feedback TEXT NULL,
        graded_at TIMESTAMPTZ NULL,
        graded_by BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE (assignment_id, learner_user_id)
      )
    `);
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_assignments_class_created ON assignments (class_id, created_at DESC)",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_assignment_submissions_learner ON assignment_submissions (learner_user_id, submitted_at DESC)",
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id BIGSERIAL PRIMARY KEY,
        sender_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        recipient_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body TEXT NOT NULL DEFAULT '',
        attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
        read_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        CHECK (sender_id <> recipient_id),
        CHECK (char_length(body) <= 4000)
      )
    `);
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_chat_messages_participants_created ON chat_messages (sender_id, recipient_id, created_at DESC)",
    );
    await client.query(
      "ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ NULL",
    );
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_chat_messages_unread ON chat_messages (recipient_id, created_at DESC) WHERE read_at IS NULL",
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS class_start_notifications (
        id BIGSERIAL PRIMARY KEY,
        class_id BIGINT NOT NULL REFERENCES live_classes(id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sent_at TIMESTAMPTZ NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        last_error TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (class_id, user_id)
      )
    `);
    await client.query(
      "CREATE INDEX IF NOT EXISTS idx_class_start_notifications_pending ON class_start_notifications (next_attempt_at) WHERE sent_at IS NULL",
    );

    // Remove only legacy seeded demo classes. Admin-created classes use random room
    // slugs and are never affected by this targeted cleanup.
    await client.query(
      "DELETE FROM live_classes WHERE tutor_user_id IS NULL AND room_slug = ANY($1::text[])",
      [
        [
          "math-grade-7",
          "science-grade-8",
          "english-grade-9",
          "kiswahili-grade-7",
          "social-studies-grade-8",
          "pre-technical-grade-9",
        ],
      ],
    );

    // Demo identities are strictly for local/test workflows. Production accounts
    // must always be provisioned through the normal signup/admin workflow.
    if (process.env.NODE_ENV !== "production" || process.env.TEST_MODE === "true")
      for (const userItem of demoUsers) {
        const [firstName, lastName, email, phone, role, password] = userItem as readonly [
          string,
          string,
          string,
          string,
          string,
          string?,
        ];
        await client.query(
          `
          INSERT INTO users (email, phone, first_name, last_name, role, password_hash)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (email) DO NOTHING
        `,
          [email, phone, firstName, lastName, role, await hashPassword(password ?? demoPassword)],
        );
      }

    await client.query(
      `
      INSERT INTO learning_timeline_events (user_id, event_type, title, description, subject, course, event_date, highlighted)
      SELECT u.id, 'account_created', 'Account created', 'Your learner account was activated and is ready to use.', 'Platform', 'Welcome', now() - interval '18 days', TRUE
      FROM users u
      WHERE u.email = $1
        AND NOT EXISTS (
          SELECT 1 FROM learning_timeline_events e WHERE e.user_id = u.id AND e.title = 'Account created'
        )
      `,
      ["learner.demo@elimusphere.test"],
    );

    await client.query(
      `
      INSERT INTO learning_timeline_events (user_id, event_type, title, description, subject, course, event_date, highlighted)
      SELECT u.id, 'course_enrolled', 'Course enrolled', 'The learner joined the Mathematics booster course for Grade 8.', 'Mathematics', 'Grade 8 Booster', now() - interval '14 days', TRUE
      FROM users u
      WHERE u.email = $1
        AND NOT EXISTS (
          SELECT 1 FROM learning_timeline_events e WHERE e.user_id = u.id AND e.title = 'Course enrolled'
        )
      `,
      ["learner.demo@elimusphere.test"],
    );

    await client.query(
      `
      INSERT INTO learning_timeline_events (user_id, event_type, title, description, subject, course, event_date, highlighted)
      SELECT u.id, 'class_booked', 'Class booked', 'A live session was scheduled for this week with a tutor.', 'Mathematics', 'Live Session', now() - interval '6 days', FALSE
      FROM users u
      WHERE u.email = $1
        AND NOT EXISTS (
          SELECT 1 FROM learning_timeline_events e WHERE e.user_id = u.id AND e.title = 'Class booked'
        )
      `,
      ["learner.demo@elimusphere.test"],
    );

    await client.query(
      `
      INSERT INTO learning_timeline_events (user_id, event_type, title, description, subject, course, event_date, highlighted)
      SELECT u.id, 'assignment_submitted', 'Assignment submitted', 'The learner submitted a practice worksheet and requested feedback.', 'English', 'Writing Practice', now() - interval '2 days', FALSE
      FROM users u
      WHERE u.email = $1
        AND NOT EXISTS (
          SELECT 1 FROM learning_timeline_events e WHERE e.user_id = u.id AND e.title = 'Assignment submitted'
        )
      `,
      ["learner.demo@elimusphere.test"],
    );

    await client.query(
      `
      INSERT INTO learning_timeline_events (user_id, event_type, title, description, subject, course, event_date, highlighted)
      SELECT u.id, 'certificate_earned', 'Certificate earned', 'The learner earned a milestone certificate for consistent attendance.', 'Science', 'Attendance Milestone', now() - interval '1 day', TRUE
      FROM users u
      WHERE u.email = $1
        AND NOT EXISTS (
          SELECT 1 FROM learning_timeline_events e WHERE e.user_id = u.id AND e.title = 'Certificate earned'
        )
      `,
      ["learner.demo@elimusphere.test"],
    );

    await client.query("INSERT INTO app_schema_versions (version) VALUES ($1)", [
      currentSchemaVersion,
    ]);
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
  const scheduleDays = row.schedule_days?.map(Number) ?? [];
  const startTime = row.start_time?.slice(0, 5) ?? null;
  return {
    id: Number(row.id),
    subject: row.subject,
    grade: row.grade,
    tutorName: row.tutor_name,
    scheduleLabel:
      scheduleDays.length && startTime
        ? formatRecurringSchedule(scheduleDays, startTime)
        : row.schedule_label,
    scheduleDays,
    startTime,
    seatsTaken: Number(row.seats_taken),
    seatsTotal: Number(row.seats_total),
    priceKes: Number(row.price_kes),
    roomSlug: row.room_slug,
    tutorUserId: row.tutor_user_id ? Number(row.tutor_user_id) : null,
    isLive: Boolean(row.is_live),
  };
}

export async function createUserNotification(
  userId: number,
  input: {
    eventType: string;
    title: string;
    description: string;
    subject?: string | null;
    course?: string | null;
    metadata?: Record<string, unknown> | null;
  },
  env?: unknown,
) {
  const db = await getPool(env);
  await db.query(
    `INSERT INTO learning_timeline_events (user_id, event_type, title, description, subject, course, highlighted, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)`,
    [
      userId,
      input.eventType,
      input.title,
      input.description,
      input.subject ?? null,
      input.course ?? null,
      input.metadata ?? null,
    ],
  );
}

async function notifyAdmins(input: Parameters<typeof createUserNotification>[1], env?: unknown) {
  const db = await getPool(env);
  const admins = await db.query<{ id: number }>("SELECT id FROM users WHERE role = 'admin'");
  await Promise.all(
    admins.rows.map((admin) => createUserNotification(Number(admin.id), input, env)),
  );
}

function toResource(row: any) {
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    grade: row.grade ?? null,
    subject: row.subject ?? null,
    priceKes: Number(row.price_kes),
    filePath: row.file_path,
    uploaderUserId: row.uploader_user_id ? Number(row.uploader_user_id) : null,
    createdAt: row.created_at,
  };
}

export async function createResource(
  input: {
    title: string;
    description?: string | null;
    grade?: string | null;
    subject?: string | null;
    priceKes: number;
    filePath: string;
    uploaderUserId: number;
  },
  env?: unknown,
) {
  const db = await getPool(env);
  const res = await db.query(
    `INSERT INTO resources (title, description, grade, subject, price_kes, file_path, uploader_user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [
      input.title,
      input.description ?? null,
      input.grade?.trim() || null,
      input.subject?.trim() || null,
      input.priceKes,
      input.filePath,
      input.uploaderUserId,
    ],
  );
  return toResource(res.rows[0]);
}

export async function updateResource(
  id: number,
  input: {
    title: string;
    description?: string | null;
    grade?: string | null;
    subject?: string | null;
    priceKes: number;
  },
  env?: unknown,
) {
  const db = await getPool(env);
  const res = await db.query(
    `UPDATE resources
     SET title = $2, description = $3, price_kes = $4,
         grade = $5, subject = $6
     WHERE id = $1
     RETURNING *`,
    [
      id,
      input.title,
      input.description ?? null,
      input.priceKes,
      input.grade ?? null,
      input.subject ?? null,
    ],
  );
  return res.rows[0] ? toResource(res.rows[0]) : null;
}

export async function deleteResource(id: number, env?: unknown) {
  const db = await getPool(env);
  const res = await db.query(`DELETE FROM resources WHERE id = $1 RETURNING *`, [id]);
  return res.rows[0] ? toResource(res.rows[0]) : null;
}

export async function listPublishedResources(env?: unknown) {
  const db = await getPool(env);
  const res = await db.query(`SELECT * FROM resources ORDER BY created_at DESC LIMIT 200`);
  return res.rows.map(toResource);
}

export async function listPurchasedResources(userId: number, env?: unknown) {
  const db = await getPool(env);
  const res = await db.query<{
    id: number | string;
    title: string;
    description: string | null;
    price_kes: number | string;
    file_path: string;
    purchasedAt: string | Date;
  }>(
    `SELECT r.id, r.title, r.description, r.price_kes, r.file_path,
            COALESCE(MAX(rp.created_at), r.created_at) AS "purchasedAt"
     FROM resources r
     LEFT JOIN resource_purchases rp
       ON rp.resource_id = r.id AND rp.user_id = $1
       AND rp.status = 'completed'
     WHERE r.price_kes = 0 OR rp.id IS NOT NULL
     GROUP BY r.id
     ORDER BY "purchasedAt" DESC`,
    [userId],
  );
  return res.rows.map((row) => ({
    id: Number(row.id),
    title: row.title,
    description: row.description,
    priceKes: Number(row.price_kes),
    fileType: row.file_path.startsWith("data:")
      ? row.file_path.slice(5, row.file_path.indexOf(",")).split(";")[0].toLowerCase()
      : path.extname(row.file_path).slice(1).toLowerCase(),
    purchasedAt: row.purchasedAt,
  }));
}

export async function findResourceById(id: number, env?: unknown) {
  const db = await getPool(env);
  const res = await db.query(`SELECT * FROM resources WHERE id = $1 LIMIT 1`, [id]);
  if (!res.rows[0]) return null;
  return toResource(res.rows[0]);
}

export async function recordResourcePurchase(
  input: {
    userId: number;
    resourceId: number;
    amountKes: number;
    provider?: string;
    reference?: string;
  },
  env?: unknown,
) {
  const db = await getPool(env);
  const res = await db.query(
    `INSERT INTO resource_purchases (user_id, resource_id, amount_kes, provider, reference) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [
      input.userId,
      input.resourceId,
      input.amountKes,
      input.provider ?? "manual",
      input.reference ?? null,
    ],
  );
  return res.rows[0];
}

export async function hasPurchasedResource(userId: number, resourceId: number, env?: unknown) {
  const db = await getPool(env);
  const res = await db.query(
    `SELECT 1 FROM resource_purchases
     WHERE user_id = $1 AND resource_id = $2 AND status = 'completed' LIMIT 1`,
    [userId, resourceId],
  );
  return Boolean(res.rowCount);
}

// Safaricom normally completes or rejects an STK request within a minute. Give
// callbacks a small grace period, then release the purchase for a new request.
// A checkout ID alone must not keep a customer permanently locked out when the
// handset never receives the prompt or Safaricom does not deliver a callback.
const MPESA_STK_SUBMISSION_WINDOW_MS = 2 * 60_000;

function isMpesaCheckoutActive(checkoutRequestId: string | null, createdAt: string) {
  void checkoutRequestId;
  const ageMs = Date.now() - new Date(createdAt).getTime();
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs < MPESA_STK_SUBMISSION_WINDOW_MS;
}

export async function purchaseResourceWithMpesa(
  userId: number,
  resourceId: number,
  phone: string,
  env?: unknown,
) {
  const db = (await getPool(env))!;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const resourceResult = await client.query("SELECT * FROM resources WHERE id = $1 FOR UPDATE", [
      resourceId,
    ]);
    const resource = resourceResult.rows[0];
    if (!resource) {
      await client.query("COMMIT");
      return null;
    }
    const existing = await client.query(
      `SELECT status, reference, created_at, checkout_request_id, phone_number FROM resource_purchases
       WHERE user_id = $1 AND resource_id = $2 AND status IN ('completed', 'pending')
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [userId, resourceId],
    );
    if (existing.rows[0]?.status === "completed") {
      await client.query("COMMIT");
      return { alreadyPurchased: true, resource: toResource(resource) };
    }
    if (
      existing.rows[0]?.status === "pending" &&
      isMpesaCheckoutActive(existing.rows[0].checkout_request_id, existing.rows[0].created_at)
    ) {
      await client.query("COMMIT");
      return {
        alreadyPending: true,
        reference: existing.rows[0].reference,
        phone: existing.rows[0].phone_number,
        resource: toResource(resource),
      };
    }
    if (existing.rows[0]?.status === "pending") {
      await client.query(
        "UPDATE resource_purchases SET status = 'failed' WHERE reference = $1 AND status = 'pending'",
        [existing.rows[0].reference],
      );
    }
    const reference = `MPESA-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    await client.query(
      `INSERT INTO resource_purchases
       (user_id, resource_id, amount_kes, provider, status, reference, phone_number)
       VALUES ($1, $2, $3, 'M-Pesa', 'pending', $4, $5)`,
      [userId, resourceId, resource.price_kes, reference, phone],
    );
    await client.query("COMMIT");
    return {
      alreadyPending: false,
      reference,
      amountKes: Number(resource.price_kes),
      phone,
      resource: toResource(resource),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateMpesaRequestIds(
  reference: string,
  checkoutRequestId: string,
  merchantRequestId: string,
  env?: unknown,
) {
  const db = (await getPool(env))!;
  const result = await db.query(
    `UPDATE payments SET checkout_request_id = $2, merchant_request_id = $3
     WHERE reference = $1 AND status = 'pending'`,
    [reference, checkoutRequestId, merchantRequestId],
  );
  if (result.rowCount === 0) {
    const resourceResult = await db.query(
      `UPDATE resource_purchases SET checkout_request_id = $2, merchant_request_id = $3
       WHERE reference = $1 AND status = 'pending'`,
      [reference, checkoutRequestId, merchantRequestId],
    );
    if (resourceResult.rowCount === 0) {
      const serviceResult = await db.query(
        `UPDATE payments SET checkout_request_id = $2, merchant_request_id = $3
         WHERE reference = $1 AND status = 'pending'`,
        [reference, checkoutRequestId, merchantRequestId],
      );
      if (serviceResult.rowCount === 0) {
        throw new Error("Could not attach the Safaricom request to its pending payment.");
      }
    }
  }
}

export async function failMpesaCheckout(reference: string, env?: unknown) {
  const db = (await getPool(env))!;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const payment = await client.query<{ class_id: number; user_id: number }>(
      `UPDATE payments SET status = 'failed' WHERE reference = $1 AND status = 'pending'
       RETURNING class_id, user_id`,
      [reference],
    );
    if (payment.rows[0]?.class_id) {
      const booking = await client.query(
        `UPDATE class_bookings SET status = 'cancelled', updated_at = now()
         WHERE class_id = $1 AND user_id = $2 AND status = 'pending_payment' RETURNING class_id`,
        [payment.rows[0].class_id, payment.rows[0].user_id],
      );
      if (booking.rowCount) {
        await client.query(
          "UPDATE live_classes SET seats_taken = GREATEST(0, seats_taken - 1), updated_at = now() WHERE id = $1",
          [payment.rows[0].class_id],
        );
      }
    }
    await client.query(
      "UPDATE resource_purchases SET status = 'failed' WHERE reference = $1 AND status = 'pending'",
      [reference],
    );
    await client.query(
      `UPDATE custom_service_requests SET status = 'failed', updated_at = now()
       WHERE payment_id = (SELECT id FROM payments WHERE reference = $1)
         AND status = 'pending_payment'`,
      [reference],
    );
    await client.query(
      `UPDATE class_session_bookings
       SET status = 'cancelled', updated_at = now()
       WHERE status = 'pending_payment' AND class_session_id IN (
         SELECT pcs.class_session_id FROM payment_class_sessions pcs
         JOIN payments p ON p.id = pcs.payment_id
         WHERE p.reference = $1
       )`,
      [reference],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

const customServicePricing = {
  one_on_one: {
    single: { amountKes: 600, lessonCount: 1, subjectLimit: 1 },
    weekly: { amountKes: 2000, lessonCount: 4, subjectLimit: 4 },
    monthly: { amountKes: 4800, lessonCount: 12, subjectLimit: 12 },
  },
  homework_help: {
    live_discussion: { amountKes: 500, lessonCount: 1, subjectLimit: 1 },
    chat_support: { amountKes: 200, lessonCount: 1, subjectLimit: 1 },
  },
} as const;

const customServicePackageKeys = {
  one_on_one: ["single", "weekly", "monthly"],
  homework_help: ["live_discussion", "chat_support"],
} as const;

export async function getCustomServicePricing(env?: unknown): Promise<CustomServicePrices> {
  const db = await getPool(env);
  const result = await db.query<{
    service_type: string;
    package_type: string;
    price_kes: number;
  }>("SELECT service_type, package_type, price_kes FROM custom_service_pricing");
  const prices: CustomServicePrices = structuredClone(DEFAULT_CUSTOM_SERVICE_PRICES);
  for (const row of result.rows) {
    if (row.service_type === "one_on_one" && row.package_type in prices.one_on_one) {
      prices.one_on_one[row.package_type as keyof CustomServicePrices["one_on_one"]] = Number(
        row.price_kes,
      );
    } else if (row.service_type === "homework_help" && row.package_type in prices.homework_help) {
      prices.homework_help[row.package_type as keyof CustomServicePrices["homework_help"]] = Number(
        row.price_kes,
      );
    }
  }
  return prices;
}

export async function updateCustomServicePricing(input: unknown, env?: unknown) {
  if (!input || typeof input !== "object") {
    throw new Error("Provide valid prices for every custom lesson package.");
  }
  const prices = input as Partial<CustomServicePrices>;
  const db = await getPool(env);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    for (const serviceType of Object.keys(customServicePackageKeys) as Array<
      keyof typeof customServicePackageKeys
    >) {
      const servicePrices = prices[serviceType];
      for (const packageType of customServicePackageKeys[serviceType]) {
        const price = servicePrices?.[packageType];
        if (!Number.isSafeInteger(price) || Number(price) < 1 || Number(price) > 1_000_000) {
          throw new Error("Package prices must be whole KES amounts between 1 and 1,000,000.");
        }
        await client.query(
          `INSERT INTO custom_service_pricing (service_type, package_type, price_kes)
           VALUES ($1, $2, $3)
           ON CONFLICT (service_type, package_type)
           DO UPDATE SET price_kes = EXCLUDED.price_kes, updated_at = now()`,
          [serviceType, packageType, Number(price)],
        );
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
  return getCustomServicePricing(env);
}

export async function purchaseCustomServiceWithMpesa(
  learnerUserId: number,
  serviceType: "one_on_one" | "homework_help",
  packageType: string,
  grade: string,
  subjects: string[],
  phone: string,
  env?: unknown,
) {
  const packagePricing =
    serviceType === "one_on_one"
      ? customServicePricing.one_on_one[packageType as keyof typeof customServicePricing.one_on_one]
      : customServicePricing.homework_help[
          packageType as keyof typeof customServicePricing.homework_help
        ];
  if (!packagePricing) {
    throw new Error("Choose a valid package and eligible CBE subject selection.");
  }
  const prices = await getCustomServicePricing(env);
  const amountKes =
    serviceType === "one_on_one"
      ? prices.one_on_one[packageType as keyof CustomServicePrices["one_on_one"]]
      : prices.homework_help[packageType as keyof CustomServicePrices["homework_help"]];
  const uniqueSubjects = [...new Set(subjects)];
  if (
    !(CBE_GRADES as readonly string[]).includes(grade) ||
    !uniqueSubjects.length ||
    uniqueSubjects.length > packagePricing.subjectLimit ||
    uniqueSubjects.some((subject) => !(CBE_SUBJECTS as readonly string[]).includes(subject))
  ) {
    throw new Error("Choose a valid package and eligible CBE subject selection.");
  }
  const db = await getPool(env);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const reference = `MPESA-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const payment = await client.query<{ id: number }>(
      `INSERT INTO payments
         (user_id, amount_kes, provider, status, reference, phone_number)
         VALUES ($1, $2, 'M-Pesa', 'pending', $3, $4)
         RETURNING id`,
      [learnerUserId, amountKes, reference, phone],
    );
    const request = await client.query<{ id: number }>(
      `INSERT INTO custom_service_requests
         (learner_user_id, service_type, package_type, grade, subjects, lesson_count, amount_kes, payment_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
      [
        learnerUserId,
        serviceType,
        packageType,
        grade,
        uniqueSubjects,
        packagePricing.lessonCount,
        amountKes,
        payment.rows[0].id,
      ],
    );
    await client.query("COMMIT");
    return {
      reference,
      amountKes,
      requestId: Number(request.rows[0].id),
      itemName: serviceType === "one_on_one" ? "One-on-one classes" : "Homework help",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type CustomServiceSchedule = {
  subject: string;
  tutorUserId: number;
  scheduledAt: string;
};

export async function scheduleCustomServiceRequest(
  requestId: number,
  adminUserId: number,
  schedules: CustomServiceSchedule[],
  env?: unknown,
) {
  const db = await getPool(env);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const requestResult = await client.query<{
      id: number;
      learner_user_id: number;
      subjects: string[];
      lesson_count: number;
      status: string;
      service_type: string;
      package_type: string;
      grade: string;
      learner_email: string;
      learner_first_name: string;
      learner_last_name: string;
    }>(
      `SELECT csr.id, csr.learner_user_id, csr.subjects, csr.lesson_count, csr.status,
                csr.service_type, csr.package_type, csr.grade, u.email AS learner_email,
                u.first_name AS learner_first_name, u.last_name AS learner_last_name
         FROM custom_service_requests csr
         JOIN users u ON u.id = csr.learner_user_id
         WHERE csr.id = $1
         FOR UPDATE OF csr`,
      [requestId],
    );
    const request = requestResult.rows[0];
    if (!request || request.status === "pending_payment" || request.status === "failed") {
      await client.query("ROLLBACK");
      return null;
    }
    if (schedules.length !== Number(request.lesson_count)) {
      await client.query("ROLLBACK");
      throw new Error(`Provide exactly ${request.lesson_count} scheduled lesson times.`);
    }
    if (schedules.some((schedule) => !request.subjects.includes(schedule.subject))) {
      await client.query("ROLLBACK");
      throw new Error("Every scheduled lesson must use a subject selected by the learner.");
    }
    const tutorIds = [...new Set(schedules.map((schedule) => schedule.tutorUserId))];
    const tutorsResult = await client.query<{
      id: number;
      email: string;
      first_name: string;
      last_name: string;
    }>(
      `SELECT id, email, first_name, last_name FROM users
         WHERE id = ANY($1::BIGINT[]) AND role = 'tutor' AND is_active = TRUE`,
      [tutorIds],
    );
    if (tutorsResult.rows.length !== tutorIds.length) {
      await client.query("ROLLBACK");
      throw new Error("Choose active tutors for every scheduled lesson.");
    }
    const validSchedule = schedules.every(
      (schedule) =>
        Number.isSafeInteger(schedule.tutorUserId) &&
        Number.isFinite(Date.parse(schedule.scheduledAt)) &&
        Date.parse(schedule.scheduledAt) > Date.now(),
    );
    if (!validSchedule) {
      await client.query("ROLLBACK");
      throw new Error("Every class time must be a valid future date and time.");
    }

    await client.query("DELETE FROM custom_service_sessions WHERE request_id = $1", [requestId]);
    for (const schedule of schedules) {
      await client.query(
        `INSERT INTO custom_service_sessions
           (request_id, subject, tutor_user_id, scheduled_at, created_by)
           VALUES ($1, $2, $3, $4, $5)`,
        [requestId, schedule.subject, schedule.tutorUserId, schedule.scheduledAt, adminUserId],
      );
    }
    await client.query(
      `UPDATE custom_service_requests SET status = 'scheduled', updated_at = now() WHERE id = $1`,
      [requestId],
    );
    await client.query("COMMIT");
    const schedulesWithTutors = schedules.map((schedule) => {
      const tutor = tutorsResult.rows.find((candidate) => candidate.id === schedule.tutorUserId);
      return {
        ...schedule,
        scheduledAt: new Date(schedule.scheduledAt).toISOString(),
        tutorFirstName: tutor?.first_name ?? "Tutor",
        tutorName: `${tutor?.first_name ?? ""} ${tutor?.last_name ?? ""}`.trim(),
        tutorEmail: tutor?.email ?? "",
      };
    });
    return {
      learnerUserId: Number(request.learner_user_id),
      learnerName: `${request.learner_first_name} ${request.learner_last_name}`,
      learnerFirstName: request.learner_first_name,
      learnerEmail: request.learner_email,
      serviceType: request.service_type,
      packageType: request.package_type,
      grade: request.grade,
      subjects: request.subjects,
      schedules: schedulesWithTutors,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listCustomServiceRequests(
  viewerUserId: number,
  viewerRole: string,
  env?: unknown,
) {
  const db = await getPool(env);
  const result = await db.query<{
    id: number | string;
    learner_user_id: number | string;
    learner_name: string;
    learner_email: string;
    service_type: string;
    package_type: string;
    grade: string;
    subjects: string[];
    lesson_count: number;
    amount_kes: number;
    status: string;
    created_at: Date | string;
    schedules:
      | Array<{
          id: number | string;
          subject: string;
          scheduledAt: Date | string;
          tutorUserId: number | string;
          tutorName: string;
          tutorEmail: string;
        }>
      | string;
  }>(
    `SELECT csr.id, csr.learner_user_id,
              concat_ws(' ', learner.first_name, learner.last_name) AS learner_name,
              learner.email AS learner_email, csr.service_type, csr.package_type,
              csr.grade, csr.subjects, csr.lesson_count, csr.amount_kes, csr.status, csr.created_at,
              COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'id', css.id, 'subject', css.subject, 'scheduledAt', css.scheduled_at,
                  'tutorUserId', tutor.id,
                  'tutorName', concat_ws(' ', tutor.first_name, tutor.last_name),
                  'tutorEmail', tutor.email
                ) ORDER BY css.scheduled_at)
                FROM custom_service_sessions css
                JOIN users tutor ON tutor.id = css.tutor_user_id
                WHERE css.request_id = csr.id
              ), '[]'::jsonb) AS schedules
       FROM custom_service_requests csr
       JOIN users learner ON learner.id = csr.learner_user_id
       WHERE ($2 = 'admin')
          OR ($2 = 'learner' AND csr.learner_user_id = $1)
          OR ($2 = 'tutor' AND EXISTS (
            SELECT 1 FROM custom_service_sessions css
            WHERE css.request_id = csr.id AND css.tutor_user_id = $1
          ))
       ORDER BY csr.created_at DESC`,
    [viewerUserId, viewerRole],
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    learnerUserId: Number(row.learner_user_id),
    learnerName: row.learner_name,
    learnerEmail: row.learner_email,
    serviceType: row.service_type,
    packageType: row.package_type,
    grade: row.grade,
    subjects: row.subjects,
    lessonCount: Number(row.lesson_count),
    amountKes: Number(row.amount_kes),
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    schedules: (typeof row.schedules === "string" ? JSON.parse(row.schedules) : row.schedules).map(
      (schedule: Record<string, unknown>) => ({
        id: Number(schedule.id),
        subject: String(schedule.subject),
        scheduledAt: new Date(String(schedule.scheduledAt)).toISOString(),
        tutorUserId: Number(schedule.tutorUserId),
        tutorName: String(schedule.tutorName),
        tutorEmail: String(schedule.tutorEmail),
      }),
    ),
  }));
}

export async function getMpesaPaymentStatus(userId: number, reference: string, env?: unknown) {
  const db = (await getPool(env))!;
  const result = await db.query<{
    status: string;
    result_description: string | null;
  }>(
    `SELECT status, mpesa_result_description AS result_description
     FROM payments WHERE user_id = $1 AND reference = $2
     UNION ALL
     SELECT status, mpesa_result_description AS result_description
     FROM resource_purchases WHERE user_id = $1 AND reference = $2 LIMIT 1`,
    [userId, reference],
  );
  const payment = result.rows[0];
  return payment
    ? {
        status: payment.status,
        failureReason: payment.result_description ?? undefined,
      }
    : null;
}

type SettledMpesaPayment = {
  status: string;
  completedNow: boolean;
  reference: string;
  kind: "class" | "resource" | "service";
  userId: number;
  amountKes: number;
  itemName: string;
  email: string;
  firstName: string;
  sessions: string[];
  grade: string;
};

export async function settleMpesaCallback(
  checkoutRequestId: string,
  resultCode: number,
  amount: number | null,
  receipt: string | null,
  resultDescription?: string,
  env?: unknown,
) {
  const db = (await getPool(env))!;
  const client = await db.connect();
  let settled: SettledMpesaPayment | null = null;
  try {
    await client.query("BEGIN");
    const classPayment = await client.query<{
      id: number;
      user_id: number;
      class_id: number;
      sessions: Array<Date | string>;
      amount_kes: number;
      status: string;
      reference: string;
      subject: string;
      grade: string;
      email: string;
      first_name: string;
    }>(
      `SELECT p.id, p.user_id, p.class_id, p.amount_kes, p.status, p.reference,
              lc.subject, lc.grade, u.email, u.first_name,
              ARRAY(
                SELECT cs.scheduled_at FROM class_sessions cs
                WHERE cs.id = p.class_session_id OR EXISTS (
                  SELECT 1 FROM payment_class_sessions pcs
                  WHERE pcs.payment_id = p.id AND pcs.class_session_id = cs.id
                )
                ORDER BY cs.scheduled_at
              ) AS sessions
       FROM payments p JOIN live_classes lc ON lc.id = p.class_id
       JOIN users u ON u.id = p.user_id
       WHERE p.checkout_request_id = $1 FOR UPDATE OF p`,
      [checkoutRequestId],
    );
    if (classPayment.rows[0]) {
      const payment = classPayment.rows[0];
      const valid = resultCode === 0 && amount === Number(payment.amount_kes) && Boolean(receipt);
      if (payment.status !== "pending") {
        settled = {
          status: payment.status,
          completedNow: false,
          reference: payment.reference,
          kind: "class",
          userId: Number(payment.user_id),
          amountKes: Number(payment.amount_kes),
          itemName: `${payment.subject} (${payment.grade})`,
          email: payment.email,
          firstName: payment.first_name,
          sessions: payment.sessions.map((scheduledAt) => new Date(scheduledAt).toISOString()),
          grade: payment.grade,
        };
      } else {
        await client.query(
          `UPDATE payments
           SET status = $2, mpesa_receipt = $3, mpesa_result_code = $4, mpesa_result_description = $5
           WHERE id = $1`,
          [
            payment.id,
            valid ? "completed" : "failed",
            valid ? receipt : null,
            resultCode,
            resultDescription?.slice(0, 255) ?? null,
          ],
        );
        const booking = await client.query(
          `UPDATE class_bookings SET status = $3, updated_at = now()
           WHERE class_id = $1 AND user_id = $2 AND status = 'pending_payment'`,
          [payment.class_id, payment.user_id, valid ? "booked" : "cancelled"],
        );
        if (!valid && booking.rowCount) {
          await client.query(
            "UPDATE live_classes SET seats_taken = GREATEST(0, seats_taken - 1), updated_at = now() WHERE id = $1",
            [payment.class_id],
          );
        }
        await client.query(
          `UPDATE class_session_bookings
           SET status = $3, updated_at = now()
           WHERE user_id = $1 AND status = 'pending_payment'
             AND class_session_id IN (
               SELECT class_session_id FROM payment_class_sessions WHERE payment_id = $2
               UNION
               SELECT class_session_id FROM payments WHERE id = $2 AND class_session_id IS NOT NULL
             )`,
          [payment.user_id, payment.id, valid ? "booked" : "cancelled"],
        );
        settled = {
          status: valid ? "completed" : "failed",
          completedNow: valid,
          reference: payment.reference,
          kind: "class",
          userId: Number(payment.user_id),
          amountKes: Number(payment.amount_kes),
          itemName: `${payment.subject} (${payment.grade})`,
          email: payment.email,
          firstName: payment.first_name,
          sessions: payment.sessions.map((scheduledAt) => new Date(scheduledAt).toISOString()),
          grade: payment.grade,
        };
      }
    } else {
      const resourcePayment = await client.query<{
        id: number;
        user_id: number;
        amount_kes: number;
        status: string;
        reference: string;
        title: string;
        email: string;
        first_name: string;
      }>(
        `SELECT p.id, p.user_id, p.amount_kes, p.status, p.reference,
                r.title, u.email, u.first_name
         FROM resource_purchases p JOIN resources r ON r.id = p.resource_id
         JOIN users u ON u.id = p.user_id
         WHERE p.checkout_request_id = $1 FOR UPDATE OF p`,
        [checkoutRequestId],
      );
      if (resourcePayment.rows[0]) {
        const payment = resourcePayment.rows[0];
        const valid = resultCode === 0 && amount === Number(payment.amount_kes) && Boolean(receipt);
        if (payment.status === "pending") {
          await client.query(
            `UPDATE resource_purchases
             SET status = $2, mpesa_receipt = $3, mpesa_result_code = $4, mpesa_result_description = $5
             WHERE id = $1`,
            [
              payment.id,
              valid ? "completed" : "failed",
              valid ? receipt : null,
              resultCode,
              resultDescription?.slice(0, 255) ?? null,
            ],
          );
        }
        settled = {
          status: payment.status === "pending" ? (valid ? "completed" : "failed") : payment.status,
          completedNow: payment.status === "pending" && valid,
          reference: payment.reference,
          kind: "resource",
          userId: Number(payment.user_id),
          amountKes: Number(payment.amount_kes),
          itemName: payment.title,
          email: payment.email,
          firstName: payment.first_name,
          sessions: [],
          grade: "",
        };
      } else {
        const servicePayment = await client.query<{
          id: number;
          user_id: number;
          amount_kes: number;
          status: string;
          reference: string;
          service_type: string;
          package_type: string;
          subjects: string[];
          grade: string;
          email: string;
          first_name: string;
        }>(
          `SELECT p.id, p.user_id, p.amount_kes, p.status, p.reference,
                  csr.service_type, csr.package_type, csr.grade, csr.subjects, u.email, u.first_name
           FROM payments p
           JOIN custom_service_requests csr ON csr.payment_id = p.id
           JOIN users u ON u.id = p.user_id
           WHERE p.checkout_request_id = $1
           FOR UPDATE OF p, csr`,
          [checkoutRequestId],
        );
        if (servicePayment.rows[0]) {
          const payment = servicePayment.rows[0];
          const valid =
            resultCode === 0 && amount === Number(payment.amount_kes) && Boolean(receipt);
          if (payment.status === "pending") {
            await client.query(
              `UPDATE payments
               SET status = $2, mpesa_receipt = $3, mpesa_result_code = $4,
                   mpesa_result_description = $5
               WHERE id = $1`,
              [
                payment.id,
                valid ? "completed" : "failed",
                valid ? receipt : null,
                resultCode,
                resultDescription?.slice(0, 255) ?? null,
              ],
            );
            await client.query(
              `UPDATE custom_service_requests
               SET status = $2, updated_at = now()
               WHERE payment_id = $1 AND status = 'pending_payment'`,
              [payment.id, valid ? "pending_schedule" : "failed"],
            );
          }
          settled = {
            status:
              payment.status === "pending" ? (valid ? "completed" : "failed") : payment.status,
            completedNow: payment.status === "pending" && valid,
            reference: payment.reference,
            kind: "service",
            userId: Number(payment.user_id),
            amountKes: Number(payment.amount_kes),
            itemName: `${payment.service_type === "one_on_one" ? "One-on-one classes" : "Homework help"} — ${payment.package_type.replaceAll("_", " ")} (${payment.subjects.join(", ")})`,
            email: payment.email,
            firstName: payment.first_name,
            sessions: [],
            grade: "",
          };
        }
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (settled?.completedNow) {
    await createUserNotification(
      settled.userId,
      {
        eventType: "payment_completed",
        title:
          settled.kind === "class"
            ? "Class payment confirmed"
            : settled.kind === "service"
              ? "Custom lesson request paid"
              : "Resource payment confirmed",
        description:
          settled.kind === "service"
            ? `Your payment was confirmed. An administrator will schedule ${settled.itemName} and contact you.`
            : `Your payment for ${settled.itemName} was confirmed.`,
        subject: "Payments",
        course: settled.itemName,
        metadata: { reference: settled.reference, amountKes: settled.amountKes },
      },
      env,
    );
    if (settled.kind === "class" && settled.sessions.length) {
      const sessionList = settled.sessions
        .map((scheduledAt) =>
          new Date(scheduledAt).toLocaleString("en-KE", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Africa/Nairobi",
          }),
        )
        .join(", ");
      await createUserNotification(
        settled.userId,
        {
          eventType: "upcoming_class",
          title: "Upcoming class sessions confirmed",
          description: `${settled.sessions.length} ${settled.itemName} session${settled.sessions.length === 1 ? "" : "s"} confirmed for: ${sessionList}.`,
          subject: "Classes",
          course: settled.itemName,
          metadata: { reference: settled.reference, sessions: settled.sessions },
        },
        env,
      );
    }
    await notifyAdmins(
      {
        eventType: "payment_received",
        title: "M-Pesa payment received",
        description: `A learner paid for ${settled.itemName}.`,
        subject: "Payments",
        course: settled.itemName,
        metadata: {
          reference: settled.reference,
          amountKes: settled.amountKes,
          userId: settled.userId,
        },
      },
      env,
    );
  }
  return settled;
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

function toTimelineEvent(row: any): LearningTimelineEvent {
  return {
    id: Number(row.id),
    userId: Number(row.user_id),
    eventType: row.event_type,
    title: row.title,
    description: row.description,
    subject: row.subject,
    course: row.course,
    eventDate: row.event_date,
    highlighted: Boolean(row.highlighted),
    metadata: row.metadata ? tryParseJson(row.metadata) : null,
  };
}

export async function listLearningTimelineEventsForViewer(
  viewerUserId: number,
  viewerRole: string,
  targetUserId?: number | null,
  env?: unknown,
): Promise<LearningTimelineView> {
  const db = await getPool(env);

  let userIds: number[] = [];
  if (viewerRole === "admin" && targetUserId != null) {
    userIds = [targetUserId];
  } else {
    userIds = [viewerUserId];
  }

  if (!userIds.length) {
    return {
      events: [],
      summary: { totalEvents: 0, highlightedEvents: 0, latestEventTitle: null, subjects: [] },
    };
  }

  const res = await db.query<any>(
    `
      SELECT id, user_id, event_type, title, description, subject, course, event_date, highlighted, metadata
      FROM learning_timeline_events
      WHERE user_id = ANY($1::bigint[])
      ORDER BY event_date DESC, created_at DESC
      LIMIT 100
    `,
    [userIds],
  );

  const events = res.rows.map(toTimelineEvent);
  const subjects = Array.from(
    new Set(events.map((event) => event.subject).filter(Boolean) as string[]),
  );

  return {
    events,
    summary: {
      totalEvents: events.length,
      highlightedEvents: events.filter((event) => event.highlighted).length,
      latestEventTitle: events[0]?.title ?? null,
      subjects,
    },
  };
}

export async function createUser(
  input: {
    email: string;
    phone?: string;
    firstName: string;
    lastName: string;
    role: string;
    password: string;
    termsVersion: string;
    roleAgreementVersion: string;
  },
  env?: unknown,
) {
  const db = await getPool(env);
  const passwordHash = await hashPassword(input.password);
  const res = await db.query<{ id: number }>(
    `
      INSERT INTO users (
        email, phone, first_name, last_name, role, password_hash,
        terms_version, terms_accepted_at, role_agreement_version, role_agreement_accepted_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8, now())
      RETURNING id
    `,
    [
      input.email.toLowerCase(),
      input.phone || null,
      input.firstName,
      input.lastName,
      input.role,
      passwordHash,
      input.termsVersion,
      input.roleAgreementVersion,
    ],
  );

  const user = {
    id: Number(res.rows[0].id),
    email: input.email.toLowerCase(),
    firstName: input.firstName,
    lastName: input.lastName,
    role: input.role,
  };
  await createUserNotification(
    user.id,
    {
      eventType: "account_created",
      title: "Welcome to Elimusphere",
      description: "Your learner account is ready. Explore your classes and start learning.",
      subject: "Account",
      course: "Getting started",
    },
    env,
  );
  return user;
}

export type ApplicationDocument = {
  name: string;
  documentType?: string;
  mimeType: string;
  content?: string;
};

function normalizeApplicationDocuments(documents: unknown): ApplicationDocument[] {
  if (!Array.isArray(documents)) return [];

  const normalized: ApplicationDocument[] = [];
  for (const doc of documents) {
    if (typeof doc === "string") {
      normalized.push({ name: doc, mimeType: "application/octet-stream", content: "" });
      continue;
    }

    if (doc && typeof doc === "object" && typeof (doc as any).name === "string") {
      normalized.push({
        name: (doc as any).name,
        documentType:
          typeof (doc as any).documentType === "string" ? (doc as any).documentType : undefined,
        mimeType:
          typeof (doc as any).mimeType === "string" && (doc as any).mimeType
            ? (doc as any).mimeType
            : "application/octet-stream",
        content: typeof (doc as any).content === "string" ? (doc as any).content : "",
      });
    }
  }

  return normalized;
}

export type Application = {
  id: number;
  email: string;
  phone: string | null;
  firstName: string;
  lastName: string;
  requestedRole: "learner" | "tutor";
  subject: string | null;
  documents: ApplicationDocument[];
  status: string;
  createdAt: string;
};

function toApplication(row: any): Application {
  return {
    id: Number(row.id),
    email: row.email,
    phone: row.phone,
    firstName: row.first_name,
    lastName: row.last_name,
    requestedRole: row.requested_role,
    subject: row.subject ?? null,
    documents: normalizeApplicationDocuments(row.documents),
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function createApplication(
  input: {
    email: string;
    phone?: string;
    firstName: string;
    lastName: string;
    role: "learner" | "tutor";
    subject?: string;
    password: string;
    documents: ApplicationDocument[];
    termsVersion: string;
    roleAgreementVersion: string;
  },
  env?: unknown,
) {
  const db = await getPool(env);
  const passwordHash = await hashPassword(input.password);
  const result = await db.query(
    `INSERT INTO applications (
      email, phone, first_name, last_name, requested_role, subject, password_hash, documents,
      terms_version, terms_accepted_at, role_agreement_version, role_agreement_accepted_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), $10, now()) RETURNING *`,
    [
      input.email.toLowerCase(),
      input.phone || null,
      input.firstName,
      input.lastName,
      input.role,
      input.subject || null,
      passwordHash,
      JSON.stringify(input.documents),
      input.termsVersion,
      input.roleAgreementVersion,
    ],
  );
  const application = toApplication(result.rows[0]);
  if (input.role === "tutor") {
    await notifyAdmins(
      {
        eventType: "approval_request",
        title: "Tutor approval request",
        description: `${input.firstName} ${input.lastName} submitted a tutor application for ${input.subject ?? "a teaching role"}.`,
        subject: input.subject ?? "Tutor application",
        course: "Approvals",
        metadata: { applicationId: application.id },
      },
      env,
    );
  }
  return application;
}

export async function listApplications(env?: unknown) {
  const db = await getPool(env);
  const result = await db.query(
    "SELECT * FROM applications ORDER BY CASE status WHEN 'under_review' THEN 0 ELSE 1 END, created_at DESC",
  );
  return result.rows.map(toApplication);
}

export async function findApplicationById(id: number, env?: unknown) {
  const db = await getPool(env);
  const result = await db.query("SELECT * FROM applications WHERE id = $1", [id]);
  if (!result.rows.length) return null;
  return toApplication(result.rows[0]);
}

export async function reviewApplication(
  id: number,
  action: "approve" | "reject",
  reviewerId: number,
  env?: unknown,
) {
  const db = await getPool(env);
  const applicationResult = await db.query<any>(
    "SELECT * FROM applications WHERE id = $1 AND status = 'under_review' FOR UPDATE",
    [id],
  );
  const application = applicationResult.rows[0];
  if (!application) return null;
  if (
    action === "approve" &&
    (!application.terms_version ||
      !application.terms_accepted_at ||
      !application.role_agreement_version ||
      !application.role_agreement_accepted_at)
  ) {
    return { consentRequired: true as const };
  }
  if (action === "reject") {
    const result = await db.query(
      "UPDATE applications SET status = 'rejected', reviewed_at = now(), reviewed_by = $2 WHERE id = $1 RETURNING *",
      [id, reviewerId],
    );
    return { application: toApplication(result.rows[0]), user: null };
  }
  const userResult = await db.query<any>(
    `INSERT INTO users (
      email, phone, first_name, last_name, role, password_hash,
      terms_version, terms_accepted_at, role_agreement_version, role_agreement_accepted_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      application.email,
      application.phone,
      application.first_name,
      application.last_name,
      application.requested_role,
      application.password_hash,
      application.terms_version,
      application.terms_accepted_at,
      application.role_agreement_version,
      application.role_agreement_accepted_at,
    ],
  );
  const updated = await db.query(
    "UPDATE applications SET status = 'approved', reviewed_at = now(), reviewed_by = $2 WHERE id = $1 RETURNING *",
    [id, reviewerId],
  );
  const user = toPublicUser(userResult.rows[0]);
  await createUserNotification(
    user.id,
    {
      eventType: "application_approved",
      title: "Application approved",
      description: "Your application was approved. Your Elimusphere account is now ready.",
      subject: application.subject ?? "Application",
      course: "Approvals",
    },
    env,
  );
  return { application: toApplication(updated.rows[0]), user };
}

export async function findUserByEmail(email: string, env?: unknown) {
  const db = await getPool(env);
  const res = await db.query<UserRow>("SELECT * FROM users WHERE email = $1 LIMIT 1", [
    email.toLowerCase(),
  ]);
  return res.rows[0];
}

function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:4173").replace(/\/+$|^\s+|\s+$/g, "");
}

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
  category?: "onboarding" | "updates";
  replyTo?: string;
};

async function sendEmail(message: EmailMessage) {
  const category = message.category ?? "updates";
  const emailFrom =
    category === "onboarding" ? "onboarding@elimusphere.co.ke" : "info@elimusphere.co.ke";
  const resendKey = process.env.RESEND_API_KEY;

  if (resendKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [message.to],
        reply_to: message.replyTo ?? process.env.RESEND_REPLY_TO ?? "info@elimusphere.co.ke",
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!response.ok) throw new Error(`Email provider rejected the message (${response.status}).`);
    return;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Email delivery is not configured. Set RESEND_API_KEY for production.");
  }

  console.info(`
----- Elimusphere email -----
To: ${message.to}
Subject: ${message.subject}

${message.text}
----------------------------
`);
}

async function sendWelcomeEmail(user: { email: string; firstName: string; role: string }) {
  const url = appUrl();
  const isLearner = user.role === "learner";
  const roleLabel = isLearner ? "learner" : "tutor applicant";
  const subject = isLearner ? "Welcome to Elimusphere" : "We received your Elimusphere application";
  await sendEmail({
    to: user.email,
    subject,
    category: "onboarding",
    text: isLearner
      ? `Hi ${user.firstName},\n\nWelcome to Elimusphere. Your learner account is ready, and you can sign in now at ${url}/login.\n\nWe are glad to have you learning with us.\n\nElimusphere`
      : `Hi ${user.firstName},\n\nThank you for applying to Elimusphere as a ${roleLabel}. We have received your application and will email you once it has been reviewed.\n\nIf you have any questions, reply to this email.\n\nElimusphere`,
    html: renderBrandedEmail({
      title: isLearner ? "Welcome to Elimusphere" : "Application received",
      eyebrow: isLearner ? "Your learning journey starts here" : "Tutor application",
      preheader: isLearner
        ? "Your learner account is ready."
        : "We have received your tutor application.",
      body: isLearner
        ? `${emailParagraph(`Hi ${escapeEmailHtml(user.firstName)},`)}${emailParagraph("Welcome to Elimusphere. Your learner account is ready, and you can sign in now to begin learning with live, structured CBE classes.")}${emailParagraph("Inside your account, you can explore your classes, keep track of your learning, and connect with the support you need to make steady progress.")}${emailList(["Sign in with the email and password you used during signup.", "Explore available classes and learning resources.", "Keep this email for your account reference."])}`
        : `${emailParagraph(`Hi ${escapeEmailHtml(user.firstName)},`)}${emailParagraph(`Thank you for applying to Elimusphere as a <strong>${escapeEmailHtml(roleLabel)}</strong>. We have received your application and will email you once it has been reviewed.`)}${emailParagraph("Our team will review the information and documents you submitted. We may contact you if any additional details are needed.")}${emailList(["Application review is handled by the Elimusphere team.", "Please keep your contact details available.", "You will receive a separate email when a decision is made."])}`,
      button: { label: isLearner ? "Start learning" : "Visit Elimusphere", href: `${url}/login` },
    }),
  });
}

export async function createPasswordResetTokenForEmail(email: string, env?: unknown) {
  const db = await getPool(env);
  const user = await findUserByEmail(email, env);
  if (!user) return null;

  const token = crypto.randomBytes(24).toString("base64url");
  await db.query(
    `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
      VALUES ($1, $2, now() + INTERVAL '1 hour')
      ON CONFLICT (token_hash) DO UPDATE SET created_at = now(), expires_at = now() + INTERVAL '1 hour', used_at = NULL`,
    [user.id, hashToken(token)],
  );

  return {
    token,
    user: toPublicUser(user),
  };
}

export async function resetPasswordWithToken(token: string, password: string, env?: unknown) {
  const db = await getPool(env);
  const tokenHash = hashToken(token);
  const res = await db.query<{ user_id: number }>(
    `SELECT user_id FROM password_reset_tokens WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() LIMIT 1`,
    [tokenHash],
  );
  const row = res.rows[0];
  if (!row) return null;

  const passwordHash = await hashPassword(password);
  await db.query("UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2", [
    passwordHash,
    row.user_id,
  ]);
  await db.query("UPDATE password_reset_tokens SET used_at = now() WHERE token_hash = $1", [
    tokenHash,
  ]);
  return true;
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = appUrl();
  const resetLink = `${url}/login?token=${encodeURIComponent(token)}`;

  await sendEmail({
    to: email,
    subject: "Reset your Elimusphere password",
    category: "onboarding",
    text: `You requested a password reset for your Elimusphere account. Use the link below to create a new password.\n\n${resetLink}\n\nIf you didn't request this, ignore this message.\n\nElimusphere`,
    html: renderBrandedEmail({
      title: "Reset your password",
      eyebrow: "Account security",
      preheader: "Use this secure link to create a new Elimusphere password.",
      body: `${emailParagraph("You requested a password reset for your Elimusphere account. This link expires in one hour.")}${emailParagraph("If you did not request this, you can safely ignore this email.")}`,
      button: { label: "Reset password", href: resetLink },
      footerNote: "For your security, never share this link with anyone.",
    }),
  });
}

export async function sendWelcomeEmailToUser(user: {
  email: string;
  firstName: string;
  role: string;
}) {
  await sendWelcomeEmail(user);
}

export async function sendApplicationApprovedEmail(user: {
  email: string;
  firstName: string;
  role: string;
  subject?: string | null;
}) {
  const url = appUrl();
  await sendEmail({
    to: user.email,
    subject: "Your Elimusphere application is approved",
    category: "onboarding",
    text: `Hi ${user.firstName},\n\nYour ${user.role} application has been approved. Sign in at ${url}/login using the password you chose during signup.\n\nIf you forgot your password, use the reset link on the login page.\n\nElimusphere`,
    html: renderBrandedEmail({
      title: "Your application is approved",
      eyebrow: "You are ready to begin",
      preheader: "Your Elimusphere account is ready.",
      body: `${emailParagraph(`Hi ${escapeEmailHtml(user.firstName)},`)}${emailParagraph(`Good news. Your <strong>${escapeEmailHtml(user.role)}</strong> application${user.subject ? ` to teach <strong>${escapeEmailHtml(user.subject)}</strong>` : ""} has been approved.`)}${emailParagraph("Your Elimusphere access is now active. Sign in with the email you registered with and the password you chose during signup.")}${emailList(["Complete your profile and review your dashboard.", "Use the support contact below if you need help accessing your account.", "Keep your login details private and secure."])}`,
      button: { label: "Sign in to Elimusphere", href: `${url}/login` },
      footerNote: "If you forgot your password, use the password reset link on the sign-in page.",
    }),
  });
}

export async function sendApplicationRejectedEmail(application: {
  email: string;
  firstName: string;
  requestedRole: string;
  subject?: string | null;
}) {
  await sendEmail({
    to: application.email,
    subject: "Update on your Elimusphere application",
    category: "onboarding",
    text: `Hi ${application.firstName},\n\nThank you for applying to Elimusphere as a ${application.requestedRole}${application.subject ? ` to teach ${application.subject}` : ""}. We are unable to approve your application at this time. Please contact us at info@elimusphere.co.ke if you would like feedback or to discuss next steps.\n\nElimusphere`,
    html: renderBrandedEmail({
      title: "Update on your application",
      eyebrow: "Application review",
      preheader: "There is an update regarding your Elimusphere application.",
      body: `${emailParagraph(`Hi ${escapeEmailHtml(application.firstName)},`)}${emailParagraph(`Thank you for applying to Elimusphere as a <strong>${escapeEmailHtml(application.requestedRole)}</strong>${application.subject ? ` to teach <strong>${escapeEmailHtml(application.subject)}</strong>` : ""}.`)}${emailParagraph("After reviewing your application, we are unable to approve it at this time. This does not prevent you from contacting our team to discuss feedback or possible next steps.")}${emailParagraph('Please contact <a href="mailto:info@elimusphere.co.ke">info@elimusphere.co.ke</a> and include the email address used in your application.')}`,
    }),
  });
}

export async function sendGeneralUpdateEmail(input: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  await sendEmail({ ...input, category: "updates" });
}

export async function sendContactFormEmail(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  const safeMessage = escapeEmailHtml(input.message).replace(/\r?\n/g, "<br>");
  await sendEmail({
    to: "admin@elimusphere.co.ke",
    subject: `Website contact form: ${input.subject.replace(/[\r\n]+/g, " ").slice(0, 160)}`,
    category: "updates",
    replyTo: input.email,
    text: `A message was submitted through the Elimusphere contact form.\n\nName: ${input.name}\nEmail: ${input.email}\nSubject: ${input.subject}\n\nMessage:\n${input.message}`,
    html: renderBrandedEmail({
      title: "New website contact message",
      eyebrow: "Contact form",
      preheader: `New message from ${input.name}`,
      body: `${emailDetails([
        ["Name", input.name],
        ["Email", input.email],
        ["Subject", input.subject],
      ])}${emailParagraph(safeMessage)}`,
      footerNote: "Reply to this email to respond directly to the person who submitted the form.",
    }),
  });
}

export async function sendPaymentReceiptEmail(input: {
  to: string;
  firstName: string;
  itemName: string;
  amountKes: number;
  reference: string;
  kind: "class" | "resource" | "service";
}) {
  const url = appUrl();
  const itemLabel =
    input.kind === "class"
      ? "Class enrollment"
      : input.kind === "service"
        ? "Custom lesson request"
        : "Resource purchase";
  const amount = `KES ${input.amountKes.toLocaleString("en-KE")}`;
  await sendEmail({
    to: input.to,
    subject: `Payment confirmed for ${input.itemName}`,
    category: "updates",
    text: `Hi ${input.firstName},\n\nYour payment for ${input.itemName} was confirmed.\n\n${itemLabel}: ${input.itemName}\nAmount: ${amount}\nReference: ${input.reference}\n\nThank you for learning with Elimusphere.\n\nElimusphere`,
    html: renderBrandedEmail({
      title: "Payment confirmed",
      eyebrow: "Payment receipt",
      preheader: `Your payment for ${input.itemName} was successful.`,
      body: `${emailParagraph(`Hi ${escapeEmailHtml(input.firstName)},`)}${emailParagraph(`Thank you. Your payment was successfully confirmed and ${input.kind === "class" ? "your class enrollment is now active" : input.kind === "service" ? "your custom lesson request is now being scheduled" : "your resource is now available"}.`)}${emailDetails(
        [
          [itemLabel, input.itemName],
          ["Amount paid", amount],
          ["Payment reference", input.reference],
          ["Payment method", "M-Pesa"],
        ],
      )}${emailParagraph("You can sign in at any time to access your dashboard and continue with your learning.")}`,
      button: { label: "Open Elimusphere", href: `${url}/dashboard` },
      footerNote:
        "Keep this email for your records. If you have questions about this payment, reply to this email.",
    }),
  });
}

type CustomServiceScheduleEmailEntry = {
  subject: string;
  scheduledAt: string;
  tutorName?: string;
};

export async function sendCustomServiceLearnerScheduleEmail(input: {
  to: string;
  firstName: string;
  serviceName: string;
  schedules: CustomServiceScheduleEmailEntry[];
}) {
  const url = appUrl();
  const rows = input.schedules.map((schedule) => {
    const date = new Date(schedule.scheduledAt).toLocaleString("en-KE", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Africa/Nairobi",
    });
    return `${schedule.subject} — ${date}${schedule.tutorName ? ` · Tutor: ${schedule.tutorName}` : ""}`;
  });
  await sendEmail({
    to: input.to,
    subject: `Your ${input.serviceName} schedule is ready`,
    category: "updates",
    text: `Hi ${input.firstName},\n\nYour ${input.serviceName} request has been scheduled:\n\n${rows.map((row, index) => `${index + 1}. ${row}`).join("\n")}\n\nYou can review these times in your dashboard: ${url}/dashboard/classes\n\nElimusphere`,
    html: renderBrandedEmail({
      title: "Your custom lesson schedule is ready",
      eyebrow: "Custom lesson schedule",
      preheader: `Your ${input.serviceName} schedule is ready.`,
      body: `${emailParagraph(`Hi ${escapeEmailHtml(input.firstName)},`)}${emailParagraph(`Your <strong>${escapeEmailHtml(input.serviceName)}</strong> request has been scheduled. Please review your lesson times below.`)}${emailList(rows.map(escapeEmailHtml))}`,
      button: { label: "View your dashboard schedule", href: `${url}/dashboard/classes` },
    }),
  });
}

export async function sendCustomServiceTutorAssignmentEmail(input: {
  to: string;
  firstName: string;
  learnerName: string;
  learnerEmail: string;
  serviceName: string;
  schedules: CustomServiceScheduleEmailEntry[];
}) {
  const url = appUrl();
  const rows = input.schedules.map((schedule) => {
    const date = new Date(schedule.scheduledAt).toLocaleString("en-KE", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Africa/Nairobi",
    });
    return `${schedule.subject} — ${date}`;
  });
  await sendEmail({
    to: input.to,
    subject: `Custom lessons assigned: ${input.learnerName}`,
    category: "updates",
    text: `Hi ${input.firstName},\n\nYou have been assigned custom lessons with ${input.learnerName} (${input.learnerEmail}).\n\n${rows.map((row, index) => `${index + 1}. ${row}`).join("\n")}\n\nReview your schedule in the tutor dashboard: ${url}/dashboard/classes\n\nElimusphere`,
    html: renderBrandedEmail({
      title: "A learner has been assigned to you",
      eyebrow: "Tutor custom lesson assignment",
      preheader: `${input.learnerName} has been scheduled for your lessons.`,
      body: `${emailParagraph(`Hi ${escapeEmailHtml(input.firstName)},`)}${emailParagraph(`You have been assigned to teach <strong>${escapeEmailHtml(input.learnerName)}</strong> (${escapeEmailHtml(input.learnerEmail)}).`)}${emailList(rows.map(escapeEmailHtml))}`,
      button: { label: "View your tutor dashboard", href: `${url}/dashboard/classes` },
    }),
  });
}

export async function sendUpcomingClassSessionsEmail(input: {
  to: string;
  firstName: string;
  subject: string;
  grade: string;
  scheduledSessions: string[];
  amountKes: number;
}) {
  const url = appUrl();
  const schedule = input.scheduledSessions.map((scheduledAt) =>
    new Date(scheduledAt).toLocaleString("en-KE", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Africa/Nairobi",
    }),
  );
  await sendEmail({
    to: input.to,
    subject: `Your ${input.subject} class sessions are confirmed`,
    category: "updates",
    text: `Hi ${input.firstName},\n\nYour ${input.subject} class sessions for ${input.grade} are confirmed.\n\n${schedule.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\nTotal paid: KES ${input.amountKes.toLocaleString("en-KE")}\nYou can review your schedule in your dashboard: ${url}/dashboard/classes\n\nElimusphere`,
    html: renderBrandedEmail({
      title: "Your upcoming class sessions are confirmed",
      eyebrow: "Class booking confirmed",
      preheader: `${schedule.length} ${input.subject} session${schedule.length === 1 ? "" : "s"} confirmed.`,
      body: `${emailParagraph(`Hi ${escapeEmailHtml(input.firstName)},`)}${emailParagraph(`Your <strong>${escapeEmailHtml(input.subject)}</strong> sessions for <strong>${escapeEmailHtml(input.grade)}</strong> are confirmed.`)}${emailList(schedule)}${emailDetails(
        [
          ["Sessions", String(schedule.length)],
          ["Total paid", `KES ${input.amountKes.toLocaleString("en-KE")}`],
        ],
      )}${emailParagraph("Please keep these dates in your calendar and join each class on time.")}`,
      button: { label: "View your class schedule", href: `${url}/dashboard/classes` },
    }),
  });
}

export async function sendClassAssignmentEmail(input: {
  email: string;
  firstName: string;
  subject: string;
  grade: string;
  scheduleLabel: string;
}) {
  const url = appUrl();
  await sendEmail({
    to: input.email,
    subject: `You have been assigned a ${input.subject} class`,
    category: "updates",
    text: `Hi ${input.firstName},\n\nYou have been assigned to teach ${input.subject} for ${input.grade}.\n\nSchedule: ${input.scheduleLabel}\n\nSign in to your dashboard to review your class details: ${url}/dashboard/classes\n\nElimusphere`,
    html: renderBrandedEmail({
      title: "A new class has been assigned to you",
      eyebrow: "Tutor class assignment",
      preheader: `You have been assigned to teach ${input.subject} for ${input.grade}.`,
      body: `${emailParagraph(`Hi ${escapeEmailHtml(input.firstName)},`)}${emailParagraph(`You have been assigned to teach <strong>${escapeEmailHtml(input.subject)}</strong> for <strong>${escapeEmailHtml(input.grade)}</strong>.`)}${emailDetails(
        [
          ["Subject", input.subject],
          ["Grade", input.grade],
          ["Schedule", input.scheduleLabel],
        ],
      )}${emailParagraph("Please sign in to your tutor dashboard to review the class and prepare for your learners.")}`,
      button: { label: "View your classes", href: `${url}/dashboard/classes` },
    }),
  });
}

export async function createLiveClass(
  input: {
    subject: string;
    grade: string;
    scheduleDays: number[];
    startTime: string;
    seatsTotal: number;
    priceKes: number;
    tutorName: string;
    tutorUserId: number;
    recurrenceRule?: string | null;
  },
  env?: unknown,
) {
  const db = await getPool(env);
  const baseSlug = `${input.subject}-${input.grade}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const roomSlug = `${baseSlug}-${crypto.randomBytes(4).toString("hex")}`;
  const scheduleLabel = formatRecurringSchedule(input.scheduleDays, input.startTime);
  const res = await db.query<ClassRow>(
    `INSERT INTO live_classes (
       subject, grade, tutor_name, tutor_user_id, schedule_label, schedule_days, start_time,
       seats_taken, seats_total, price_kes, room_slug
     )
     VALUES ($1, $2, $3, $4, $5, $6::SMALLINT[], $7::TIME, 0, $8, $9, $10)
      RETURNING *`,
    [
      input.subject,
      input.grade,
      input.tutorName,
      input.tutorUserId,
      scheduleLabel,
      input.scheduleDays,
      input.startTime,
      input.seatsTotal,
      input.priceKes,
      roomSlug,
    ],
  );
  await ensureUpcomingClassSessions(db, Number(res.rows[0].id));
  return toLiveClass(res.rows[0]);
}

export async function updateLiveClass(
  classId: number,
  input: {
    subject: string;
    grade: string;
    scheduleDays: number[];
    startTime: string;
    seatsTotal: number;
    priceKes: number;
    tutorUserId: number;
  },
  env?: unknown,
) {
  const db = await getPool(env);
  const tutor = await db.query<UserRow>(
    "SELECT first_name, last_name FROM users WHERE id = $1 AND role = 'tutor'",
    [input.tutorUserId],
  );
  if (!tutor.rows[0]) return null;
  const tutorName = `${tutor.rows[0].first_name} ${tutor.rows[0].last_name}`;
  const scheduleLabel = formatRecurringSchedule(input.scheduleDays, input.startTime);
  const result = await db.query<ClassRow>(
    `UPDATE live_classes SET subject = $1, grade = $2, schedule_label = $3,
      schedule_days = $4::SMALLINT[], start_time = $5::TIME, seats_total = $6,
      price_kes = $7, tutor_user_id = $8, tutor_name = $9, updated_at = now()
     WHERE id = $10 RETURNING *`,
    [
      input.subject,
      input.grade,
      scheduleLabel,
      input.scheduleDays,
      input.startTime,
      input.seatsTotal,
      input.priceKes,
      input.tutorUserId,
      tutorName,
      classId,
    ],
  );
  if (result.rows[0]) {
    await db.query(
      `DELETE FROM class_sessions cs
       WHERE cs.class_id = $1 AND cs.scheduled_at > now()
         AND NOT EXISTS (SELECT 1 FROM conference_rooms cr WHERE cr.class_session_id = cs.id)
         AND NOT EXISTS (SELECT 1 FROM class_session_bookings b WHERE b.class_session_id = cs.id)`,
      [classId],
    );
    await ensureUpcomingClassSessions(db, classId);
  }
  return result.rows[0] ? toLiveClass(result.rows[0]) : null;
}

export async function patchLiveClass(
  classId: number,
  updates: {
    subject?: string;
    grade?: string;
    scheduleDays?: number[];
    startTime?: string;
    seatsTotal?: number;
    priceKes?: number;
    tutorUserId?: number;
    isActive?: boolean;
  },
  env?: unknown,
) {
  const db = await getPool(env);
  const fields: [string, unknown][] = [];

  if (updates.subject !== undefined) fields.push(["subject", updates.subject]);
  if (updates.grade !== undefined) fields.push(["grade", updates.grade]);
  if (updates.scheduleDays !== undefined || updates.startTime !== undefined) {
    const currentSchedule = await db.query<{
      schedule_days: number[];
      start_time: string | null;
    }>("SELECT schedule_days, start_time FROM live_classes WHERE id = $1", [classId]);
    const scheduleDays = updates.scheduleDays ?? currentSchedule.rows[0]?.schedule_days ?? [];
    const startTime = updates.startTime ?? currentSchedule.rows[0]?.start_time ?? null;
    fields.push(["schedule_days", scheduleDays]);
    fields.push(["start_time", startTime]);
    fields.push(["schedule_label", formatRecurringSchedule(scheduleDays, startTime)]);
  }
  if (updates.seatsTotal !== undefined) fields.push(["seats_total", updates.seatsTotal]);
  if (updates.priceKes !== undefined) fields.push(["price_kes", updates.priceKes]);
  if (updates.isActive !== undefined) fields.push(["is_active", updates.isActive]);

  if (updates.tutorUserId !== undefined) {
    const tutor = await db.query<UserRow>(
      "SELECT first_name, last_name FROM users WHERE id = $1 AND role = 'tutor'",
      [updates.tutorUserId],
    );
    if (!tutor.rows[0]) return null;
    fields.push(
      ["tutor_user_id", updates.tutorUserId],
      ["tutor_name", `${tutor.rows[0].first_name} ${tutor.rows[0].last_name}`],
    );
  }

  if (!fields.length) return null;
  const assignments = fields.map(([column], index) => `${column} = $${index + 2}`);
  const values = fields.map(([, value]) => value);
  const result = await db.query<ClassRow>(
    `UPDATE live_classes SET ${assignments.join(", ")}, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [classId, ...values],
  );
  if (result.rows[0] && (updates.scheduleDays !== undefined || updates.startTime !== undefined)) {
    await db.query(
      `DELETE FROM class_sessions cs
       WHERE cs.class_id = $1 AND cs.scheduled_at > now()
         AND NOT EXISTS (SELECT 1 FROM conference_rooms cr WHERE cr.class_session_id = cs.id)
         AND NOT EXISTS (SELECT 1 FROM class_session_bookings b WHERE b.class_session_id = cs.id)`,
      [classId],
    );
    await ensureUpcomingClassSessions(db, classId);
  }
  return result.rows[0] ? toLiveClass(result.rows[0]) : null;
}

export async function getClassTutorUserId(classId: number, env?: unknown) {
  const db = await getPool(env);
  const result = await db.query<{ tutor_user_id: number | null }>(
    "SELECT tutor_user_id FROM live_classes WHERE id = $1",
    [classId],
  );
  return result.rows[0]?.tutor_user_id ? Number(result.rows[0].tutor_user_id) : null;
}

export async function deleteLiveClass(classId: number, env?: unknown) {
  const db = await getPool(env);
  const result = await db.query("DELETE FROM live_classes WHERE id = $1 RETURNING id", [classId]);
  return Boolean(result.rowCount);
}

export async function canTutorStartClass(classId: number, tutorUserId: number, env?: unknown) {
  const db = await getPool(env);
  const result = await db.query("SELECT 1 FROM live_classes WHERE id = $1 AND tutor_user_id = $2", [
    classId,
    tutorUserId,
  ]);
  return Boolean(result.rowCount);
}

export async function createAssignmentRequest(
  input: {
    userId: number;
    classId?: number | null;
    title: string;
    description: string;
    fileName?: string | null;
  },
  env?: unknown,
) {
  const db = await getPool(env);
  const res = await db.query<{
    id: number;
    title: string;
    description: string;
    file_name: string | null;
    created_at: string;
  }>(
    `INSERT INTO assignment_requests (user_id, class_id, title, description, file_name)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, title, description, file_name, created_at`,
    [input.userId, input.classId ?? null, input.title, input.description, input.fileName ?? null],
  );

  const row = res.rows[0];
  const tutor = await db.query<{ tutor_user_id: number | null }>(
    `SELECT lc.tutor_user_id FROM live_classes lc WHERE lc.id = $1`,
    [input.classId ?? null],
  );
  if (tutor.rows[0]?.tutor_user_id) {
    await createUserNotification(
      Number(tutor.rows[0].tutor_user_id),
      {
        eventType: "assignment_submitted",
        title: "New assignment request",
        description: `A learner submitted “${input.title}” for your review.`,
        subject: "Assignments",
        course: "Student work",
        metadata: { assignmentId: Number(row.id) },
      },
      env,
    );
  }
  return {
    id: Number(row.id),
    title: row.title,
    description: row.description,
    fileName: row.file_name,
    createdAt: row.created_at,
  };
}

export async function listAssignmentRequestsForUser(userId: number, env?: unknown) {
  const db = await getPool(env);
  const res = await db.query<{
    id: number;
    title: string;
    description: string;
    file_name: string | null;
    status: string;
    grade: number | null;
    feedback: string | null;
    created_at: string;
  }>(
    `SELECT id, title, description, file_name, status, grade, feedback, created_at
     FROM assignment_requests
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId],
  );

  return res.rows.map((row) => ({
    id: Number(row.id),
    title: row.title,
    description: row.description,
    fileName: row.file_name,
    status: row.status,
    grade: row.grade,
    feedback: row.feedback,
    createdAt: row.created_at,
  }));
}

export async function listAssignmentRequestsForTutor(userId: number, env?: unknown) {
  const db = await getPool(env);
  const res = await db.query<{
    id: number;
    title: string;
    description: string;
    file_name: string | null;
    status: string;
    grade: number | null;
    feedback: string | null;
    created_at: string;
    student_first_name: string | null;
    student_last_name: string | null;
    subject: string;
    class_grade: string;
    class_id: number | null;
  }>(
    `SELECT
       ar.id,
       ar.title,
       ar.description,
       ar.file_name,
       ar.status,
       ar.grade,
       ar.feedback,
       ar.created_at,
       u.first_name AS student_first_name,
       u.last_name AS student_last_name,
       lc.subject,
       lc.grade AS class_grade,
       ar.class_id
     FROM assignment_requests ar
     JOIN live_classes lc ON lc.id = ar.class_id
     LEFT JOIN users u ON u.id = ar.user_id
     WHERE lc.tutor_user_id = $1
     ORDER BY ar.created_at DESC
     LIMIT 100`,
    [userId],
  );

  return res.rows.map((row) => ({
    id: Number(row.id),
    title: row.title,
    description: row.description,
    fileName: row.file_name,
    status: row.status,
    grade: row.grade,
    feedback: row.feedback,
    createdAt: row.created_at,
    studentName:
      row.student_first_name && row.student_last_name
        ? `${row.student_first_name} ${row.student_last_name}`
        : "Learner",
    subject: row.subject,
    classGrade: row.class_grade,
    classId: row.class_id ? Number(row.class_id) : null,
  }));
}

export async function reviewAssignmentRequest(
  assignmentId: number,
  tutorId: number,
  status: string,
  grade: number | null,
  feedback: string | null,
  env?: unknown,
) {
  const db = await getPool(env);
  const res = await db.query<{
    id: number;
    title: string;
    description: string;
    file_name: string | null;
    status: string;
    grade: number | null;
    feedback: string | null;
    reviewed_by: number | null;
    created_at: string;
  }>(
    `UPDATE assignment_requests
     SET status = $1,
         grade = $2,
         feedback = $3,
         reviewed_by = $4
     WHERE id = $5
       AND class_id IN (
         SELECT id
         FROM live_classes
         WHERE tutor_user_id = $4
       )
     RETURNING id, title, description, file_name, status, grade, feedback, reviewed_by, created_at`,
    [status, grade, feedback, tutorId, assignmentId],
  );

  if (res.rows[0]) {
    const assignment = await db.query<{ user_id: number }>(
      "SELECT user_id FROM assignment_requests WHERE id = $1",
      [assignmentId],
    );
    if (assignment.rows[0]) {
      await db.query(
        `INSERT INTO learning_timeline_events (user_id, event_type, title, description, subject, course, highlighted)
         VALUES ($1, 'assignment_reviewed', 'Assignment reviewed', $2, 'Assignments', 'Feedback', TRUE)`,
        [
          assignment.rows[0].user_id,
          `Your assignment request was marked ${status}${feedback ? `: ${feedback}` : "."}`,
        ],
      );
    }
  }

  return res.rows[0] ?? null;
}

type AssignmentAttachment = { name: string; mimeType: string; content: string };

function normalizeAssignmentAttachments(value: unknown): AssignmentAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 3).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const file = item as Record<string, unknown>;
    const name = typeof file.name === "string" ? file.name.trim().slice(0, 255) : "";
    const mimeType = typeof file.mimeType === "string" ? file.mimeType.trim().slice(0, 120) : "";
    const content = typeof file.content === "string" ? file.content : "";
    return name &&
      mimeType &&
      content.startsWith(`data:${mimeType};base64,`) &&
      content.length <= 5_600_000
      ? [{ name, mimeType, content }]
      : [];
  });
}

export async function createTutorAssignment(
  input: {
    tutorId: number;
    classId: number;
    targetLearnerId?: number | null;
    title: string;
    instructions: string;
    dueAt?: string | null;
    attachments?: unknown;
  },
  env?: unknown,
) {
  const db = await getPool(env);
  const allowed = await db.query(
    "SELECT 1 FROM live_classes WHERE id = $1 AND tutor_user_id = $2",
    [input.classId, input.tutorId],
  );
  if (!allowed.rowCount) return null;
  if (input.targetLearnerId) {
    const enrolled = await db.query(
      `SELECT 1 FROM class_bookings
       WHERE class_id = $1 AND user_id = $2 AND status = 'booked'`,
      [input.classId, input.targetLearnerId],
    );
    if (!enrolled.rowCount) return null;
  }
  const attachments = normalizeAssignmentAttachments(input.attachments);
  const result = await db.query<{ id: number; created_at: string }>(
    `INSERT INTO assignments
       (class_id, tutor_user_id, target_learner_id, title, instructions, due_at, attachments)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, created_at`,
    [
      input.classId,
      input.tutorId,
      input.targetLearnerId ?? null,
      input.title.trim().slice(0, 255),
      input.instructions.trim().slice(0, 8000),
      input.dueAt || null,
      JSON.stringify(attachments),
    ],
  );
  const classInfo = await db.query<{ subject: string; grade: string }>(
    "SELECT subject, grade FROM live_classes WHERE id = $1",
    [input.classId],
  );
  const learners = input.targetLearnerId
    ? { rows: [{ user_id: input.targetLearnerId }] }
    : await db.query<{ user_id: number }>(
        "SELECT user_id FROM class_bookings WHERE class_id = $1 AND status = 'booked'",
        [input.classId],
      );
  await Promise.all(
    learners.rows.map((learner) =>
      createUserNotification(
        Number(learner.user_id),
        {
          eventType: "assignment_published",
          title: "New assignment published",
          description: `Your tutor published “${input.title}”. Open assignments to review the instructions.`,
          subject: classInfo.rows[0]?.subject ?? "Assignments",
          course: classInfo.rows[0]?.grade ?? "Class work",
          metadata: { assignmentId: Number(result.rows[0].id) },
        },
        env,
      ),
    ),
  );
  return { id: Number(result.rows[0].id), createdAt: result.rows[0].created_at };
}

export async function updateTutorAssignment(
  input: {
    assignmentId: number;
    tutorId: number;
    title: string;
    instructions: string;
    dueAt?: string | null;
    attachments?: unknown;
  },
  env?: unknown,
) {
  const db = await getPool(env);
  const replaceAttachments = input.attachments !== undefined;
  const result = await db.query<{ id: number }>(
    `UPDATE assignments
     SET title = $3,
         instructions = $4,
         due_at = $5,
         attachments = CASE WHEN $7 THEN $6::jsonb ELSE attachments END
     WHERE id = $1 AND tutor_user_id = $2
     RETURNING id`,
    [
      input.assignmentId,
      input.tutorId,
      input.title.trim().slice(0, 255),
      input.instructions.trim().slice(0, 8000),
      input.dueAt || null,
      JSON.stringify(normalizeAssignmentAttachments(input.attachments)),
      replaceAttachments,
    ],
  );
  return result.rows[0] ? Number(result.rows[0].id) : null;
}

export async function setTutorAssignmentWithdrawn(
  assignmentId: number,
  tutorId: number,
  withdrawn: boolean,
  env?: unknown,
) {
  const db = await getPool(env);
  const result = await db.query<{ id: number }>(
    `UPDATE assignments
     SET withdrawn_at = CASE
       WHEN $3 THEN COALESCE(withdrawn_at, now())
       ELSE NULL
     END
     WHERE id = $1 AND tutor_user_id = $2
     RETURNING id`,
    [assignmentId, tutorId, withdrawn],
  );
  return result.rows[0] ? Number(result.rows[0].id) : null;
}

export async function listAssignmentsForLearner(learnerId: number, env?: unknown) {
  const db = await getPool(env);
  const result = await db.query<{
    id: number;
    title: string;
    instructions: string;
    due_at: string | null;
    attachments: AssignmentAttachment[] | string;
    created_at: string;
    subject: string;
    class_grade: string;
    class_id: number;
    submission_id: number | null;
    response: string | null;
    submission_attachments: AssignmentAttachment[] | string | null;
    submitted_at: string | null;
    grade: number | null;
    feedback: string | null;
  }>(
    `SELECT a.id, a.title, a.instructions, a.due_at, a.attachments, a.created_at, lc.subject, lc.grade AS class_grade, lc.id AS class_id,
      s.id AS submission_id, s.response, s.attachments AS submission_attachments, s.submitted_at, s.grade, s.feedback
    FROM assignments a JOIN live_classes lc ON lc.id = a.class_id
    JOIN class_bookings cb ON cb.class_id = a.class_id AND cb.user_id = $1 AND cb.status = 'booked'
    LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.learner_user_id = $1
    WHERE a.withdrawn_at IS NULL
      AND (a.target_learner_id IS NULL OR a.target_learner_id = $1)
    ORDER BY a.created_at DESC`,
    [learnerId],
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    title: row.title,
    instructions: row.instructions,
    dueAt: row.due_at,
    attachments: normalizeAssignmentAttachments(
      typeof row.attachments === "string" ? tryParseJson(row.attachments) : row.attachments,
    ),
    createdAt: row.created_at,
    subject: row.subject,
    classGrade: row.class_grade,
    classId: Number(row.class_id),
    submissionId: row.submission_id ? Number(row.submission_id) : null,
    response: row.response ?? "",
    submissionAttachments: normalizeAssignmentAttachments(
      typeof row.submission_attachments === "string"
        ? tryParseJson(row.submission_attachments)
        : row.submission_attachments,
    ),
    submittedAt: row.submitted_at,
    grade: row.grade === null ? null : Number(row.grade),
    feedback: row.feedback,
  }));
}

export async function listAssignmentsForTutor(tutorId: number, env?: unknown) {
  const db = await getPool(env);
  const result = await db.query<{
    id: number;
    title: string;
    instructions: string;
    attachments: AssignmentAttachment[] | string;
    due_at: string | null;
    created_at: string;
    subject: string;
    class_grade: string;
    class_id: number;
    is_withdrawn: boolean;
    target_learner_name: string | null;
    subscriber_count: string;
    submitted_count: string;
    graded_count: string;
    submissions:
      | {
          id: number;
          studentName: string;
          response: string;
          attachments: AssignmentAttachment[];
          submittedAt: string;
          grade: number | null;
          feedback: string | null;
        }[]
      | string;
  }>(
    `SELECT a.id, a.title, a.instructions, a.attachments, a.due_at, a.created_at,
      (a.withdrawn_at IS NOT NULL) AS is_withdrawn,
      lc.subject, lc.grade AS class_grade, lc.id AS class_id,
      concat_ws(' ', target.first_name, target.last_name) AS target_learner_name,
      COUNT(DISTINCT cb.user_id) FILTER (WHERE cb.status = 'booked' AND (a.target_learner_id IS NULL OR cb.user_id = a.target_learner_id))::text AS subscriber_count,
      COUNT(DISTINCT s.id)::text AS submitted_count, COUNT(DISTINCT s.id) FILTER (WHERE s.grade IS NOT NULL)::text AS graded_count,
      COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', s.id, 'studentName', concat_ws(' ', u.first_name, u.last_name), 'response', s.response, 'attachments', s.attachments, 'submittedAt', s.submitted_at, 'grade', s.grade, 'feedback', s.feedback)) FILTER (WHERE s.id IS NOT NULL), '[]'::jsonb) AS submissions
    FROM assignments a JOIN live_classes lc ON lc.id = a.class_id
    LEFT JOIN class_bookings cb ON cb.class_id = a.class_id AND (a.target_learner_id IS NULL OR cb.user_id = a.target_learner_id)
    LEFT JOIN assignment_submissions s ON s.assignment_id = a.id
    LEFT JOIN users u ON u.id = s.learner_user_id
    LEFT JOIN users target ON target.id = a.target_learner_id
    WHERE a.tutor_user_id = $1
    GROUP BY a.id, lc.id, target.first_name, target.last_name
    ORDER BY a.created_at DESC`,
    [tutorId],
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    title: row.title,
    instructions: row.instructions,
    attachments: normalizeAssignmentAttachments(
      typeof row.attachments === "string" ? tryParseJson(row.attachments) : row.attachments,
    ),
    dueAt: row.due_at,
    createdAt: row.created_at,
    subject: row.subject,
    classGrade: row.class_grade,
    classId: Number(row.class_id),
    isWithdrawn: row.is_withdrawn,
    targetLearnerName: row.target_learner_name,
    subscriberCount: Number(row.subscriber_count),
    submittedCount: Number(row.submitted_count),
    gradedCount: Number(row.graded_count),
    submissions: (typeof row.submissions === "string"
      ? tryParseJson(row.submissions)
      : row.submissions
    ).map((submission: Record<string, unknown>) => ({
      ...submission,
      attachments: normalizeAssignmentAttachments(submission.attachments),
    })),
  }));
}

export async function submitAssignment(
  learnerId: number,
  assignmentId: number,
  response: string,
  attachments: unknown,
  env?: unknown,
) {
  const db = await getPool(env);
  const permitted = await db.query(
    `SELECT 1 FROM assignments a JOIN class_bookings cb ON cb.class_id = a.class_id
     WHERE a.id = $1 AND a.withdrawn_at IS NULL AND cb.user_id = $2 AND cb.status = 'booked'
       AND (a.target_learner_id IS NULL OR a.target_learner_id = $2)`,
    [assignmentId, learnerId],
  );
  if (!permitted.rowCount) return null;
  const result = await db.query<{ id: number; submitted_at: string }>(
    `INSERT INTO assignment_submissions (assignment_id, learner_user_id, response, attachments)
    VALUES ($1, $2, $3, $4) ON CONFLICT (assignment_id, learner_user_id) DO UPDATE SET response = EXCLUDED.response, attachments = EXCLUDED.attachments, submitted_at = now(), grade = NULL, feedback = NULL, graded_at = NULL, graded_by = NULL
    RETURNING id, submitted_at`,
    [
      assignmentId,
      learnerId,
      response.trim().slice(0, 8000),
      JSON.stringify(normalizeAssignmentAttachments(attachments)),
    ],
  );
  const tutor = await db.query<{ tutor_user_id: number; title: string }>(
    `SELECT a.tutor_user_id, a.title FROM assignments a WHERE a.id = $1`,
    [assignmentId],
  );
  if (tutor.rows[0]) {
    await createUserNotification(
      Number(tutor.rows[0].tutor_user_id),
      {
        eventType: "assignment_submitted",
        title: "Assignment submitted",
        description: `A learner submitted “${tutor.rows[0].title}” for your review.`,
        subject: "Assignments",
        course: "Student work",
        metadata: { assignmentId, submissionId: Number(result.rows[0].id) },
      },
      env,
    );
  }
  return { id: Number(result.rows[0].id), submittedAt: result.rows[0].submitted_at };
}

export async function gradeAssignmentSubmission(
  tutorId: number,
  submissionId: number,
  grade: number,
  feedback: string,
  env?: unknown,
) {
  const db = await getPool(env);
  const result = await db.query<{ id: number }>(
    `UPDATE assignment_submissions s SET grade = $1, feedback = $2, graded_at = now(), graded_by = $3
    FROM assignments a WHERE s.assignment_id = a.id AND s.id = $4 AND a.tutor_user_id = $3 RETURNING s.id`,
    [grade, feedback.trim().slice(0, 8000), tutorId, submissionId],
  );
  if (result.rows[0]) {
    const learner = await db.query<{ learner_user_id: number; title: string }>(
      `SELECT s.learner_user_id, a.title
       FROM assignment_submissions s JOIN assignments a ON a.id = s.assignment_id
       WHERE s.id = $1`,
      [submissionId],
    );
    if (learner.rows[0]) {
      await createUserNotification(
        Number(learner.rows[0].learner_user_id),
        {
          eventType: "assignment_graded",
          title: "Assignment graded",
          description: `Your tutor graded “${learner.rows[0].title}” and left feedback.`,
          subject: "Assignments",
          course: "Graded work",
          metadata: { submissionId },
        },
        env,
      );
    }
  }
  return result.rows[0] ? Number(result.rows[0].id) : null;
}

export async function getLearningProgress(userId: number, role: string, env?: unknown) {
  const db = await getPool(env);
  if (role === "learner") {
    const result = await db.query<{
      assigned: string;
      submitted: string;
      graded: string;
      average: string | null;
    }>(
      `SELECT COUNT(a.id)::text AS assigned, COUNT(s.id)::text AS submitted, COUNT(s.id) FILTER (WHERE s.grade IS NOT NULL)::text AS graded, AVG(s.grade) AS average
       FROM assignments a
       JOIN class_bookings cb ON cb.class_id = a.class_id AND cb.user_id = $1 AND cb.status = 'booked'
       LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.learner_user_id = $1
       WHERE a.withdrawn_at IS NULL
         AND (a.target_learner_id IS NULL OR a.target_learner_id = $1)`,
      [userId],
    );
    const row = result.rows[0];
    return {
      assigned: Number(row.assigned),
      submitted: Number(row.submitted),
      graded: Number(row.graded),
      average: row.average === null ? null : Number(row.average),
    };
  }
  const where =
    role === "tutor"
      ? "WHERE a.tutor_user_id = $1 AND a.withdrawn_at IS NULL"
      : "WHERE a.withdrawn_at IS NULL";
  const params = role === "tutor" ? [userId] : [];
  const result = await db.query<{
    assigned: string;
    submitted: string;
    graded: string;
    average: string | null;
  }>(
    `SELECT COUNT(DISTINCT a.id)::text AS assigned, COUNT(s.id)::text AS submitted, COUNT(s.id) FILTER (WHERE s.grade IS NOT NULL)::text AS graded, AVG(s.grade) AS average FROM assignments a LEFT JOIN assignment_submissions s ON s.assignment_id = a.id ${where}`,
    params,
  );
  const row = result.rows[0];
  return {
    assigned: Number(row.assigned),
    submitted: Number(row.submitted),
    graded: Number(row.graded),
    average: row.average === null ? null : Number(row.average),
  };
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
  await db.query(
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
  const res = await db.query<SessionRow>(
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
        AND users.is_active = TRUE
      LIMIT 1
    `,
    [hashToken(token)],
  );

  const session = res.rows[0];
  if (!session) return null;

  await db.query("UPDATE auth_sessions SET last_seen_at = now() WHERE id = $1", [session.id]);

  return { user: toPublicUser(session), sessionId: Number(session.id) };
}

export async function revokeAuthSession(token: string | undefined, env?: unknown) {
  if (!token) return;
  const db = await getPool(env);
  await db.query(
    "UPDATE auth_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL",
    [hashToken(token)],
  );
}

export async function listLiveClasses(env?: unknown, userId: number | null = null) {
  const db = await getPool(env);
  await ensureUpcomingClassSessions(db);
  const res = await db.query<ClassRow>(
    `SELECT live_classes.*, EXISTS (
       SELECT 1 FROM conference_rooms
       WHERE conference_rooms.class_id = live_classes.id
         AND conference_rooms.ended_at IS NULL
         AND EXISTS (
           SELECT 1 FROM conference_participants cp
           WHERE cp.room_id = conference_rooms.id
             AND cp.left_at IS NULL
             AND cp.last_seen_at > now() - interval '2 minutes'
         )
     ) AS is_live
     FROM live_classes WHERE is_active = TRUE ORDER BY id ASC`,
  );
  const sessions = await db.query<{
    id: number | string;
    class_id: number | string;
    scheduled_at: Date | string;
    booking_count: number | string;
    room_id: number | string | null;
    is_live: boolean;
    is_booked: boolean;
    is_paid: boolean;
  }>(
    `SELECT cs.id, cs.class_id, cs.scheduled_at,
       COUNT(DISTINCT b.user_id) FILTER (WHERE b.status IN ('booked', 'pending_payment')) AS booking_count,
       cr.id AS room_id,
       COALESCE(cr.ended_at IS NULL AND EXISTS (
         SELECT 1 FROM conference_participants cp
         WHERE cp.room_id = cr.id AND cp.left_at IS NULL
           AND cp.last_seen_at > now() - interval '2 minutes'
       ), FALSE) AS is_live,
       COALESCE(BOOL_OR(b.user_id = $1 AND b.status = 'booked'), FALSE) AS is_booked,
       COALESCE(BOOL_OR(
         b.user_id = $1 AND EXISTS (
           SELECT 1 FROM payments p
           WHERE p.user_id = $1 AND p.provider = 'M-Pesa' AND p.status = 'completed'
             AND p.mpesa_receipt IS NOT NULL
             AND (p.class_session_id = cs.id OR EXISTS (
               SELECT 1 FROM payment_class_sessions pcs
               WHERE pcs.payment_id = p.id AND pcs.class_session_id = cs.id
             ))
         )
       ), FALSE) AS is_paid
     FROM class_sessions cs
     LEFT JOIN class_session_bookings b ON b.class_session_id = cs.id
     LEFT JOIN conference_rooms cr ON cr.class_session_id = cs.id
     WHERE cs.scheduled_at > now() AND cs.scheduled_at <= now() + interval '56 days'
     GROUP BY cs.id, cr.id
     ORDER BY cs.scheduled_at`,
    [userId],
  );
  const sessionsByClass = new Map<number, ClassSession[]>();
  for (const row of sessions.rows) {
    const classId = Number(row.class_id);
    const classSessions = sessionsByClass.get(classId) ?? [];
    classSessions.push({
      id: Number(row.id),
      classId,
      scheduledAt: new Date(row.scheduled_at).toISOString(),
      bookingCount: Number(row.booking_count),
      isBooked: Boolean(row.is_booked),
      isPaid: Boolean(row.is_paid),
      roomId: row.room_id === null ? null : Number(row.room_id),
      isLive: Boolean(row.is_live),
    });
    sessionsByClass.set(classId, classSessions);
  }
  return res.rows.map((row) => ({
    ...toLiveClass(row),
    upcomingSessions: sessionsByClass.get(Number(row.id)) ?? [],
  }));
}

async function ensureUpcomingClassSessions(db: Pool | PoolClient, classId?: number) {
  await db.query(
    `INSERT INTO class_sessions (class_id, scheduled_at)
     SELECT c.id, ((dates.slot_date::DATE + c.start_time) AT TIME ZONE c.schedule_timezone)
     FROM live_classes c
     CROSS JOIN generate_series(
       date_trunc('day', now() AT TIME ZONE c.schedule_timezone),
       date_trunc('day', now() AT TIME ZONE c.schedule_timezone) + interval '55 days',
       interval '1 day'
     ) AS dates(slot_date)
     CROSS JOIN LATERAL unnest(c.schedule_days) AS schedule_day(day)
     WHERE c.is_active = TRUE AND c.start_time IS NOT NULL
       AND cardinality(c.schedule_days) > 0
       AND ($1::BIGINT IS NULL OR c.id = $1)
       AND EXTRACT(DOW FROM dates.slot_date)::SMALLINT = schedule_day.day
       AND ((dates.slot_date::DATE + c.start_time) AT TIME ZONE c.schedule_timezone) > now()
     ON CONFLICT (class_id, scheduled_at) DO NOTHING`,
    [classId ?? null],
  );
}

export async function listClassSessions(classId: number, userId: number | null, env?: unknown) {
  const db = await getPool(env);
  await ensureUpcomingClassSessions(db, classId);
  const result = await db.query<{
    id: number | string;
    class_id: number | string;
    scheduled_at: Date | string;
    booking_count: number | string;
    room_id: number | string | null;
    is_live: boolean;
    is_booked: boolean;
    is_paid: boolean;
  }>(
    `SELECT cs.id, cs.class_id, cs.scheduled_at,
       COUNT(DISTINCT b.user_id) FILTER (WHERE b.status IN ('booked', 'pending_payment')) AS booking_count,
       cr.id AS room_id,
       COALESCE(cr.ended_at IS NULL AND EXISTS (
         SELECT 1 FROM conference_participants cp
         WHERE cp.room_id = cr.id AND cp.left_at IS NULL
           AND cp.last_seen_at > now() - interval '2 minutes'
       ), FALSE) AS is_live,
       COALESCE(BOOL_OR(b.user_id = $2 AND b.status = 'booked'), FALSE) AS is_booked,
       COALESCE(BOOL_OR(
         b.user_id = $2 AND EXISTS (
           SELECT 1 FROM payments p
           WHERE p.user_id = $2 AND p.provider = 'M-Pesa' AND p.status = 'completed'
             AND p.mpesa_receipt IS NOT NULL
             AND (p.class_session_id = cs.id OR EXISTS (
               SELECT 1 FROM payment_class_sessions pcs
               WHERE pcs.payment_id = p.id AND pcs.class_session_id = cs.id
             ))
         )
       ), FALSE) AS is_paid
     FROM class_sessions cs
     JOIN live_classes lc ON lc.id = cs.class_id AND lc.is_active = TRUE
     LEFT JOIN class_session_bookings b ON b.class_session_id = cs.id
     LEFT JOIN conference_rooms cr ON cr.class_session_id = cs.id
     WHERE cs.class_id = $1 AND cs.scheduled_at > now()
       AND cs.scheduled_at <= now() + interval '56 days'
     GROUP BY cs.id, cr.id
     ORDER BY cs.scheduled_at`,
    [classId, userId],
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    classId: Number(row.class_id),
    scheduledAt: new Date(row.scheduled_at).toISOString(),
    bookingCount: Number(row.booking_count),
    isBooked: Boolean(row.is_booked),
    isPaid: Boolean(row.is_paid),
    roomId: row.room_id === null ? null : Number(row.room_id),
    isLive: Boolean(row.is_live),
  }));
}

export async function bookClassSession(
  userId: number,
  classId: number,
  classSessionId: number,
  env?: unknown,
) {
  const db = await getPool(env);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const session = await client.query<{
      id: number;
      seats_total: number;
      price_kes: number;
    }>(
      `SELECT cs.id, lc.seats_total, lc.price_kes
       FROM class_sessions cs
       JOIN live_classes lc ON lc.id = cs.class_id AND lc.is_active = TRUE
       WHERE cs.id = $2 AND cs.class_id = $1 AND cs.scheduled_at > now()
       FOR UPDATE OF cs`,
      [classId, classSessionId],
    );
    const row = session.rows[0];
    if (!row) {
      await client.query("COMMIT");
      return { notFound: true as const };
    }
    if (Number(row.price_kes) > 0) {
      await client.query("COMMIT");
      return { paymentRequired: true as const };
    }
    const existingBooking = await client.query<{ status: string }>(
      "SELECT status FROM class_session_bookings WHERE class_session_id = $1 AND user_id = $2 FOR UPDATE",
      [classSessionId, userId],
    );
    if (existingBooking.rows[0]?.status === "booked") {
      await client.query("COMMIT");
      return { alreadyBooked: true as const };
    }
    const bookingCount = await client.query<{ count: string }>(
      "SELECT COUNT(*)::TEXT AS count FROM class_session_bookings WHERE class_session_id = $1 AND status IN ('booked', 'pending_payment')",
      [classSessionId],
    );
    if (Number(bookingCount.rows[0]?.count ?? 0) >= Number(row.seats_total)) {
      await client.query("COMMIT");
      return { full: true as const };
    }
    await client.query(
      `INSERT INTO class_session_bookings (class_session_id, user_id, status)
       VALUES ($1, $2, 'booked')
       ON CONFLICT (class_session_id, user_id)
       DO UPDATE SET status = 'booked', updated_at = now()`,
      [classSessionId, userId],
    );
    await client.query("COMMIT");
    return { alreadyBooked: false as const };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function purchaseClassSessionsWithMpesa(
  userId: number,
  classId: number,
  sessionIds: number[],
  phone: string,
  env?: unknown,
) {
  const db = await getPool(env);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const classResult = await client.query<ClassRow>(
      "SELECT * FROM live_classes WHERE id = $1 AND is_active = TRUE FOR UPDATE",
      [classId],
    );
    const liveClass = classResult.rows[0];
    if (!liveClass) {
      await client.query("COMMIT");
      return null;
    }
    const sessions = await client.query<{
      id: number;
      scheduled_at: Date | string;
      seats_total: number;
    }>(
      `SELECT cs.id, cs.scheduled_at, lc.seats_total
       FROM class_sessions cs
       JOIN live_classes lc ON lc.id = cs.class_id AND lc.is_active = TRUE
       WHERE cs.class_id = $1 AND cs.id = ANY($2::BIGINT[]) AND cs.scheduled_at > now()
       ORDER BY cs.id FOR UPDATE OF cs`,
      [classId, sessionIds],
    );
    if (sessions.rows.length !== sessionIds.length) {
      await client.query("ROLLBACK");
      return { invalidSession: true as const };
    }

    const paid = await client.query<{ class_session_id: number }>(
      `SELECT DISTINCT chosen.session_id AS class_session_id
       FROM unnest($2::BIGINT[]) AS chosen(session_id)
       JOIN payments p ON p.user_id = $1 AND p.provider = 'M-Pesa'
         AND p.status = 'completed' AND p.mpesa_receipt IS NOT NULL
         AND (p.class_session_id = chosen.session_id OR EXISTS (
           SELECT 1 FROM payment_class_sessions pcs
           WHERE pcs.payment_id = p.id AND pcs.class_session_id = chosen.session_id
         ))`,
      [userId, sessionIds],
    );
    if (paid.rows.length) {
      await client.query("ROLLBACK");
      return { alreadyPaid: true as const };
    }
    const pendingPayment = await client.query<{
      reference: string;
      created_at: Date | string;
      checkout_request_id: string | null;
      phone_number: string | null;
      amount_kes: number;
      session_ids: Array<number | string>;
    }>(
      `SELECT p.reference, p.created_at, p.checkout_request_id, p.phone_number, p.amount_kes,
              ARRAY(
                SELECT pcs_all.class_session_id
                FROM payment_class_sessions pcs_all
                WHERE pcs_all.payment_id = p.id
                ORDER BY pcs_all.class_session_id
              ) AS session_ids
       FROM payments p
       JOIN payment_class_sessions pcs ON pcs.payment_id = p.id
       WHERE p.user_id = $1 AND p.provider = 'M-Pesa' AND p.status = 'pending'
         AND pcs.class_session_id = ANY($2::BIGINT[])
       ORDER BY p.created_at DESC LIMIT 1 FOR UPDATE OF p`,
      [userId, sessionIds],
    );
    if (
      pendingPayment.rows[0] &&
      isMpesaCheckoutActive(
        pendingPayment.rows[0].checkout_request_id,
        new Date(pendingPayment.rows[0].created_at).toISOString(),
      )
    ) {
      const pending = pendingPayment.rows[0];
      const pendingSessionIds = pending.session_ids.map(Number);
      if (
        pendingSessionIds.length !== sessionIds.length ||
        sessionIds.some((id) => !pendingSessionIds.includes(id))
      ) {
        await client.query("ROLLBACK");
        return { sessionPending: true as const };
      }
      await client.query("COMMIT");
      return {
        alreadyPending: true as const,
        reference: pending.reference,
        phone: pending.phone_number,
        amountKes: Number(pending.amount_kes),
        liveClass: toLiveClass(liveClass),
      };
    }
    if (pendingPayment.rows[0]) {
      await client.query(
        "UPDATE payments SET status = 'failed' WHERE reference = $1 AND status = 'pending'",
        [pendingPayment.rows[0].reference],
      );
      await client.query(
        `UPDATE class_session_bookings SET status = 'cancelled', updated_at = now()
         WHERE user_id = $1 AND class_session_id IN (
           SELECT class_session_id FROM payment_class_sessions WHERE payment_id = (
             SELECT id FROM payments WHERE reference = $2
           )
         ) AND status = 'pending_payment'`,
        [userId, pendingPayment.rows[0].reference],
      );
    }

    for (const selected of sessions.rows) {
      const booking = await client.query<{ status: string }>(
        "SELECT status FROM class_session_bookings WHERE class_session_id = $1 AND user_id = $2 FOR UPDATE",
        [selected.id, userId],
      );
      if (booking.rows[0]?.status === "pending_payment") {
        await client.query("ROLLBACK");
        return { sessionPending: true as const };
      }
      if (booking.rows[0]?.status !== "booked") {
        const count = await client.query<{ count: string }>(
          `SELECT COUNT(*)::TEXT AS count FROM class_session_bookings
           WHERE class_session_id = $1 AND status IN ('booked', 'pending_payment')`,
          [selected.id],
        );
        if (Number(count.rows[0]?.count ?? 0) >= Number(selected.seats_total)) {
          await client.query("ROLLBACK");
          return { full: true as const };
        }
      }
    }

    if (Number(liveClass.price_kes) === 0) {
      for (const selected of sessions.rows) {
        await client.query(
          `INSERT INTO class_session_bookings (class_session_id, user_id, status)
           VALUES ($1, $2, 'booked')
           ON CONFLICT (class_session_id, user_id)
           DO UPDATE SET status = 'booked', updated_at = now()`,
          [selected.id, userId],
        );
      }
      await client.query("COMMIT");
      return {
        free: true as const,
        liveClass: toLiveClass(liveClass),
        sessions: sessions.rows.map((row) => new Date(row.scheduled_at).toISOString()),
      };
    }

    const amountKes = Number(liveClass.price_kes) * sessionIds.length;
    if (!Number.isSafeInteger(amountKes) || amountKes <= 0) {
      await client.query("ROLLBACK");
      throw new Error("The selected class session total is invalid.");
    }
    const reference = `MPESA-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const payment = await client.query<{ id: number }>(
      `INSERT INTO payments
       (user_id, class_id, class_session_id, amount_kes, provider, status, reference, phone_number)
       VALUES ($1, $2, $3, $4, 'M-Pesa', 'pending', $5, $6)
       RETURNING id`,
      [userId, classId, sessionIds[0], amountKes, reference, phone],
    );
    for (const selected of sessions.rows) {
      await client.query(
        `INSERT INTO payment_class_sessions (payment_id, class_session_id)
         VALUES ($1, $2)`,
        [payment.rows[0].id, selected.id],
      );
      await client.query(
        `INSERT INTO class_session_bookings (class_session_id, user_id, status)
         VALUES ($1, $2, 'pending_payment')
         ON CONFLICT (class_session_id, user_id)
         DO UPDATE SET status = 'pending_payment', updated_at = now()`,
        [selected.id, userId],
      );
    }
    await client.query("COMMIT");
    return {
      alreadyPending: false as const,
      reference,
      amountKes,
      phone,
      liveClass: toLiveClass(liveClass),
      sessions: sessions.rows.map((row) => new Date(row.scheduled_at).toISOString()),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function hasClassSessionBooking(
  userId: number,
  classSessionId: number,
  env?: unknown,
) {
  const db = await getPool(env);
  const result = await db.query(
    `SELECT 1 FROM class_session_bookings
     WHERE class_session_id = $1 AND user_id = $2 AND status = 'booked'`,
    [classSessionId, userId],
  );
  return Boolean(result.rowCount);
}

export async function getActiveRoomIdForSession(classSessionId: number, env?: unknown) {
  const db = await getPool(env);
  const result = await db.query<{ id: number }>(
    `SELECT id FROM conference_rooms
     WHERE class_session_id = $1 AND ended_at IS NULL
       AND EXISTS (
         SELECT 1 FROM conference_participants cp
         WHERE cp.room_id = conference_rooms.id AND cp.left_at IS NULL
           AND cp.last_seen_at > now() - interval '2 minutes'
       )
     ORDER BY started_at DESC, id DESC LIMIT 1`,
    [classSessionId],
  );
  return result.rows[0] ? Number(result.rows[0].id) : null;
}

export async function getClassSessionStartStatus(
  classId: number,
  classSessionId: number,
  env?: unknown,
) {
  const db = await getPool(env);
  const result = await db.query<{
    scheduled_at: Date | string;
    is_active: boolean;
  }>(
    `SELECT cs.scheduled_at,
       EXISTS (
         SELECT 1 FROM conference_rooms cr
         JOIN conference_participants cp ON cp.room_id = cr.id
         WHERE cr.class_session_id = cs.id AND cr.ended_at IS NULL
           AND cp.left_at IS NULL AND cp.last_seen_at > now() - interval '2 minutes'
       ) AS is_active
     FROM class_sessions cs
     WHERE cs.id = $1 AND cs.class_id = $2`,
    [classSessionId, classId],
  );
  const session = result.rows[0];
  return session
    ? { scheduledAt: new Date(session.scheduled_at).toISOString(), isActive: session.is_active }
    : null;
}

export async function purchaseClassWithMpesa(
  userId: number,
  classId: number,
  roomId: number,
  phone: string,
  env?: unknown,
  classSessionId: number | null = null,
) {
  const db = (await getPool(env))!;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const classResult = await client.query<ClassRow>(
      "SELECT * FROM live_classes WHERE id = $1 AND is_active = TRUE FOR UPDATE",
      [classId],
    );
    const liveClass = classResult.rows[0];
    if (!liveClass) {
      await client.query("COMMIT");
      return null;
    }
    const activeRoom = await client.query<{ id: number }>(
      `SELECT id FROM conference_rooms
       WHERE id = $1 AND class_id = $2 AND ended_at IS NULL
         AND ($3::BIGINT IS NULL OR class_session_id = $3)
       FOR UPDATE`,
      [roomId, classId, classSessionId],
    );
    if (!activeRoom.rows[0]) {
      await client.query("COMMIT");
      return { sessionUnavailable: true, liveClass: toLiveClass(liveClass) };
    }
    const existingBooking =
      classSessionId === null
        ? await client.query<{ status: string }>(
            "SELECT status FROM class_bookings WHERE class_id = $1 AND user_id = $2 FOR UPDATE",
            [classId, userId],
          )
        : await client.query<{ status: string }>(
            "SELECT status FROM class_session_bookings WHERE class_session_id = $1 AND user_id = $2 FOR UPDATE",
            [classSessionId, userId],
          );
    if (existingBooking.rows[0]?.status !== "booked") {
      await client.query("COMMIT");
      return { notRegistered: true, liveClass: toLiveClass(liveClass) };
    }
    const existingPayment = await client.query<{
      reference: string;
      created_at: string;
      checkout_request_id: string | null;
      phone_number: string | null;
      status: string;
    }>(
      `SELECT reference, created_at, checkout_request_id, phone_number, status
       FROM payments
       WHERE user_id = $1 AND class_id = $2 AND conference_room_id = $3
         AND provider = 'M-Pesa'
         AND (status = 'pending' OR (status = 'completed' AND mpesa_receipt IS NOT NULL))
       ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [userId, classId, roomId],
    );
    if (existingPayment.rows[0]) {
      if (existingPayment.rows[0].status === "completed") {
        await client.query("COMMIT");
        return {
          alreadyPaid: true,
          liveClass: toLiveClass(liveClass),
        };
      }
      if (
        isMpesaCheckoutActive(
          existingPayment.rows[0].checkout_request_id,
          existingPayment.rows[0].created_at,
        )
      ) {
        await client.query("COMMIT");
        return {
          alreadyPending: true,
          reference: existingPayment.rows[0].reference,
          phone: existingPayment.rows[0].phone_number,
          liveClass: toLiveClass(liveClass),
        };
      }
      await client.query(
        "UPDATE payments SET status = 'failed' WHERE reference = $1 AND status = 'pending'",
        [existingPayment.rows[0].reference],
      );
    }
    const reference = `MPESA-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    await client.query(
      `INSERT INTO payments
       (user_id, class_id, conference_room_id, class_session_id, amount_kes, provider, status, reference, phone_number)
       VALUES ($1, $2, $3, $4, $5, 'M-Pesa', 'pending', $6, $7)`,
      [userId, classId, roomId, classSessionId, liveClass.price_kes, reference, phone],
    );
    await client.query("COMMIT");
    return {
      alreadyPending: false,
      reference,
      amountKes: Number(liveClass.price_kes),
      phone,
      roomId,
      liveClass: toLiveClass(liveClass),
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listSubscribedClasses(userId: number, env?: unknown) {
  const db = await getPool(env);
  await ensureUpcomingClassSessions(db);
  const result = await db.query<ClassRow>(
    `SELECT live_classes.*, EXISTS (
       SELECT 1 FROM conference_rooms
       WHERE conference_rooms.class_id = live_classes.id
         AND conference_rooms.ended_at IS NULL
         AND EXISTS (
           SELECT 1 FROM conference_participants cp
           WHERE cp.room_id = conference_rooms.id
             AND cp.left_at IS NULL
             AND cp.last_seen_at > now() - interval '2 minutes'
         )
     ) AS is_live
     FROM live_classes
     WHERE live_classes.is_active = TRUE AND (
       EXISTS (
         SELECT 1 FROM class_bookings
         WHERE class_bookings.class_id = live_classes.id
           AND class_bookings.user_id = $1 AND class_bookings.status = 'booked'
       ) OR EXISTS (
         SELECT 1 FROM class_sessions cs
         JOIN class_session_bookings booking ON booking.class_session_id = cs.id
         WHERE cs.class_id = live_classes.id
           AND booking.user_id = $1 AND booking.status = 'booked'
       )
     )
     ORDER BY live_classes.subject, live_classes.grade`,
    [userId],
  );
  const sessionsByClass = new Map<number, ClassSession[]>();
  if (result.rows.length) {
    const sessions = await db.query<{
      id: number | string;
      class_id: number | string;
      scheduled_at: Date | string;
      booking_count: number | string;
      room_id: number | string | null;
      is_live: boolean;
      is_booked: boolean;
      is_paid: boolean;
    }>(
      `SELECT cs.id, cs.class_id, cs.scheduled_at,
         COUNT(DISTINCT booking.user_id) FILTER (WHERE booking.status = 'booked') AS booking_count,
         cr.id AS room_id,
         COALESCE(cr.ended_at IS NULL AND EXISTS (
           SELECT 1 FROM conference_participants cp
           WHERE cp.room_id = cr.id AND cp.left_at IS NULL
             AND cp.last_seen_at > now() - interval '2 minutes'
         ), FALSE) AS is_live,
         COALESCE(BOOL_OR(booking.user_id = $1 AND booking.status = 'booked'), FALSE) AS is_booked,
         COALESCE(BOOL_OR(
           booking.user_id = $1 AND EXISTS (
             SELECT 1 FROM payments p
             WHERE p.user_id = $1 AND p.provider = 'M-Pesa' AND p.status = 'completed'
               AND p.mpesa_receipt IS NOT NULL
               AND (p.class_session_id = cs.id OR EXISTS (
                 SELECT 1 FROM payment_class_sessions pcs
                 WHERE pcs.payment_id = p.id AND pcs.class_session_id = cs.id
               ))
           )
         ), FALSE) AS is_paid,
       FROM class_sessions cs
       JOIN class_session_bookings booking ON booking.class_session_id = cs.id
       LEFT JOIN conference_rooms cr ON cr.class_session_id = cs.id
       WHERE cs.class_id = ANY($2::BIGINT[]) AND cs.scheduled_at > now()
       GROUP BY cs.id, cr.id
       ORDER BY cs.scheduled_at`,
      [userId, result.rows.map((row) => row.id)],
    );
    for (const row of sessions.rows) {
      const classId = Number(row.class_id);
      const classSessions = sessionsByClass.get(classId) ?? [];
      classSessions.push({
        id: Number(row.id),
        classId,
        scheduledAt: new Date(row.scheduled_at).toISOString(),
        bookingCount: Number(row.booking_count),
        isBooked: Boolean(row.is_booked),
        isPaid: Boolean(row.is_paid),
        roomId: row.room_id === null ? null : Number(row.room_id),
        isLive: Boolean(row.is_live),
      });
      sessionsByClass.set(classId, classSessions);
    }
  }
  return result.rows.map((row) => ({
    ...toLiveClass(row),
    upcomingSessions: sessionsByClass.get(Number(row.id)) ?? [],
  }));
}

export async function getPlatformHealth(env?: unknown) {
  const db = await getPool(env);
  const result = await db.query<{
    total_users: string;
    active_classes: string;
    resources: string;
    active_conferences: string;
    online_participants: string;
    pending_payments: string;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM users)::TEXT AS total_users,
      (SELECT COUNT(*) FROM live_classes WHERE is_active = TRUE)::TEXT AS active_classes,
      (SELECT COUNT(*) FROM resources)::TEXT AS resources,
      (SELECT COUNT(DISTINCT cr.id)
       FROM conference_rooms cr
       JOIN live_classes lc ON lc.id = cr.class_id AND lc.is_active = TRUE
       WHERE cr.ended_at IS NULL AND EXISTS (
         SELECT 1 FROM conference_participants cp
         WHERE cp.room_id = cr.id AND cp.left_at IS NULL
           AND cp.last_seen_at > now() - interval '2 minutes'
       ))::TEXT AS active_conferences,
      (SELECT COUNT(DISTINCT cp.user_id)
       FROM conference_participants cp
       JOIN conference_rooms cr ON cr.id = cp.room_id AND cr.ended_at IS NULL
       JOIN live_classes lc ON lc.id = cr.class_id AND lc.is_active = TRUE
       WHERE cp.left_at IS NULL AND cp.last_seen_at > now() - interval '2 minutes'
      )::TEXT AS online_participants,
      ((SELECT COUNT(*) FROM payments WHERE status = 'pending') +
       (SELECT COUNT(*) FROM resource_purchases WHERE status = 'pending'))::TEXT AS pending_payments
  `);
  const row = result.rows[0];
  return {
    database: "connected" as const,
    totalUsers: Number(row.total_users),
    activeClasses: Number(row.active_classes),
    resources: Number(row.resources),
    activeConferences: Number(row.active_conferences),
    onlineParticipants: Number(row.online_participants),
    pendingPayments: Number(row.pending_payments),
    checkedAt: new Date().toISOString(),
  };
}

export async function listClassSubscribers(classId: number, env?: unknown) {
  const db = await getPool(env);
  const res = await db.query<{
    id: number;
    email: string;
    first_name: string;
    last_name: string;
    phone: string | null;
    created_at: string;
  }>(
    `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, cb.created_at
     FROM class_bookings cb
     JOIN users u ON u.id = cb.user_id
     WHERE cb.class_id = $1 AND cb.status = 'booked'
     ORDER BY cb.created_at DESC`,
    [classId],
  );
  return res.rows.map((r) => ({
    id: Number(r.id),
    email: r.email,
    firstName: r.first_name,
    lastName: r.last_name,
    phone: r.phone ?? null,
    bookedAt: r.created_at ?? new Date().toISOString(),
  }));
}

export type ChatAttachment = { name: string; mimeType: string; content: string };

const chatAttachmentMimeTypes = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const chatImageMimeTypes = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function normalizeChatAttachments(value: unknown): ChatAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 3).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const valueItem = item as Record<string, unknown>;
    const name = typeof valueItem.name === "string" ? valueItem.name.trim().slice(0, 255) : "";
    const mimeType =
      typeof valueItem.mimeType === "string" ? valueItem.mimeType.trim().slice(0, 120) : "";
    const content = typeof valueItem.content === "string" ? valueItem.content : "";
    const allowedType = chatImageMimeTypes.has(mimeType) || chatAttachmentMimeTypes.has(mimeType);
    const expectedDataUrl = `data:${mimeType};base64,`;
    return name && allowedType && content.startsWith(expectedDataUrl) && content.length <= 5_600_000
      ? [{ name, mimeType, content }]
      : [];
  });
}

async function usersCanChat(firstUserId: number, secondUserId: number, env?: unknown) {
  const db = await getPool(env);
  const result = await db.query(
    `SELECT 1 FROM class_bookings cb JOIN live_classes lc ON lc.id = cb.class_id WHERE cb.status = 'booked' AND ((lc.tutor_user_id = $1 AND cb.user_id = $2) OR (lc.tutor_user_id = $2 AND cb.user_id = $1)) LIMIT 1`,
    [firstUserId, secondUserId],
  );
  return Boolean(result.rowCount);
}

export async function listTutorStudents(tutorUserId: number, env?: unknown) {
  const db = await getPool(env);
  const result = await db.query<{
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    first_booked_at: string;
    classes: { id: number; subject: string; grade: string; scheduleLabel: string }[] | string;
  }>(
    `SELECT u.id, u.first_name, u.last_name, u.email, u.phone, MIN(cb.created_at) AS first_booked_at, jsonb_agg(DISTINCT jsonb_build_object('id', lc.id, 'subject', lc.subject, 'grade', lc.grade, 'scheduleLabel', lc.schedule_label)) AS classes FROM class_bookings cb JOIN live_classes lc ON lc.id = cb.class_id JOIN users u ON u.id = cb.user_id WHERE cb.status = 'booked' AND lc.tutor_user_id = $1 GROUP BY u.id, u.first_name, u.last_name, u.email, u.phone ORDER BY u.last_name, u.first_name`,
    [tutorUserId],
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    bookedAt: row.first_booked_at,
    classes: typeof row.classes === "string" ? tryParseJson(row.classes) : row.classes,
  }));
}

export async function getTutorStudent(tutorUserId: number, studentUserId: number, env?: unknown) {
  return (
    (await listTutorStudents(tutorUserId, env)).find((student) => student.id === studentUserId) ??
    null
  );
}

export async function listChatContacts(userId: number, role: string, env?: unknown) {
  const db = await getPool(env);
  if (role !== "tutor" && role !== "learner") return [];
  const tutor = role === "tutor";
  const sql = tutor
    ? `SELECT u.id, u.first_name, u.last_name, u.role, jsonb_agg(DISTINCT jsonb_build_object('subject', lc.subject, 'grade', lc.grade)) AS classes FROM class_bookings cb JOIN live_classes lc ON lc.id = cb.class_id JOIN users u ON u.id = cb.user_id WHERE cb.status = 'booked' AND lc.tutor_user_id = $1 GROUP BY u.id, u.first_name, u.last_name, u.role ORDER BY u.last_name, u.first_name`
    : `SELECT u.id, u.first_name, u.last_name, u.role, jsonb_agg(DISTINCT jsonb_build_object('subject', lc.subject, 'grade', lc.grade)) AS classes FROM class_bookings cb JOIN live_classes lc ON lc.id = cb.class_id JOIN users u ON u.id = lc.tutor_user_id WHERE cb.status = 'booked' AND cb.user_id = $1 AND lc.tutor_user_id IS NOT NULL GROUP BY u.id, u.first_name, u.last_name, u.role ORDER BY u.last_name, u.first_name`;
  const result = await db.query<{
    id: number;
    first_name: string;
    last_name: string;
    role: string;
    classes: { subject: string; grade: string }[] | string;
  }>(sql, [userId]);
  return result.rows.map((row) => ({
    id: Number(row.id),
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    classes: typeof row.classes === "string" ? tryParseJson(row.classes) : row.classes,
  }));
}

export async function listChatMessages(userId: number, contactUserId: number, env?: unknown) {
  const db = await getPool(env);
  if (!(await usersCanChat(userId, contactUserId, env))) return null;
  await db.query(
    "UPDATE chat_messages SET read_at = now() WHERE sender_id = $1 AND recipient_id = $2 AND read_at IS NULL",
    [contactUserId, userId],
  );
  const result = await db.query<{
    id: number;
    sender_id: number;
    recipient_id: number;
    body: string;
    attachments: ChatAttachment[] | string;
    created_at: string;
  }>(
    `SELECT id, sender_id, recipient_id, body, attachments, created_at FROM chat_messages WHERE (sender_id = $1 AND recipient_id = $2) OR (sender_id = $2 AND recipient_id = $1) ORDER BY created_at ASC LIMIT 200`,
    [userId, contactUserId],
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    senderId: Number(row.sender_id),
    recipientId: Number(row.recipient_id),
    body: row.body,
    attachments: normalizeChatAttachments(
      typeof row.attachments === "string" ? tryParseJson(row.attachments) : row.attachments,
    ),
    createdAt: row.created_at,
  }));
}

export async function getUnreadMessageCount(userId: number, env?: unknown) {
  const db = await getPool(env);
  const result = await db.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM chat_messages WHERE recipient_id = $1 AND read_at IS NULL",
    [userId],
  );
  return Number(result.rows[0]?.count ?? 0);
}
export async function createChatMessage(
  input: { senderId: number; recipientId: number; body: string; attachments: unknown },
  env?: unknown,
) {
  const body = input.body.trim().slice(0, 4000);
  const attachments = normalizeChatAttachments(input.attachments);
  if (!body && !attachments.length) return null;
  if (!(await usersCanChat(input.senderId, input.recipientId, env))) return undefined;
  const db = await getPool(env);
  const result = await db.query<{
    id: number;
    sender_id: number;
    recipient_id: number;
    body: string;
    attachments: ChatAttachment[] | string;
    created_at: string;
  }>(
    `INSERT INTO chat_messages (sender_id, recipient_id, body, attachments) VALUES ($1, $2, $3, $4) RETURNING *`,
    [input.senderId, input.recipientId, body, JSON.stringify(attachments)],
  );
  const row = result.rows[0];
  return {
    id: Number(row.id),
    senderId: Number(row.sender_id),
    recipientId: Number(row.recipient_id),
    body: row.body,
    attachments: normalizeChatAttachments(
      typeof row.attachments === "string" ? tryParseJson(row.attachments) : row.attachments,
    ),
    createdAt: row.created_at,
  };
}

export async function hasClassBooking(userId: number, classId: number, env?: unknown) {
  const db = await getPool(env);
  const result = await db.query(
    `SELECT 1 FROM class_bookings cb
     WHERE cb.user_id = $1 AND cb.class_id = $2 AND cb.status = 'booked'
    `,
    [userId, classId],
  );
  return Boolean(result.rowCount);
}

export async function getClassSessionPaymentStatus(
  userId: number,
  classId: number,
  roomId: number,
  env?: unknown,
) {
  const db = await getPool(env);
  await ensureUpcomingClassSessions(db);
  const result = await db.query<{
    price_kes: number;
    is_paid: boolean;
  }>(
    `SELECT lc.price_kes,
       EXISTS (
         SELECT 1 FROM payments p
         WHERE p.user_id = $1 AND p.class_id = lc.id
           AND p.provider = 'M-Pesa' AND p.status = 'completed'
           AND p.mpesa_receipt IS NOT NULL
           AND (
             p.conference_room_id = $3
             OR p.class_session_id = cr.class_session_id
             OR EXISTS (
               SELECT 1 FROM payment_class_sessions pcs
               WHERE pcs.payment_id = p.id AND pcs.class_session_id = cr.class_session_id
             )
           )
       ) AS is_paid
     FROM live_classes lc
     JOIN conference_rooms cr ON cr.class_id = lc.id AND cr.id = $3 AND cr.ended_at IS NULL
     WHERE lc.id = $2 AND lc.is_active = TRUE`,
    [userId, classId, roomId],
  );
  const row = result.rows[0];
  return row
    ? {
        amountKes: Number(row.price_kes),
        requiresPayment: Number(row.price_kes) > 0,
        paid: row.is_paid,
      }
    : null;
}

export async function registerLearnerForClass(userId: number, classId: number, env?: unknown) {
  const db = await getPool(env);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const classResult = await client.query<ClassRow>(
      "SELECT * FROM live_classes WHERE id = $1 AND is_active = TRUE FOR UPDATE",
      [classId],
    );
    const liveClass = classResult.rows[0];
    if (!liveClass) {
      await client.query("COMMIT");
      return null;
    }
    const booking = await client.query<{ status: string }>(
      "SELECT status FROM class_bookings WHERE class_id = $1 AND user_id = $2 FOR UPDATE",
      [classId, userId],
    );
    if (booking.rows[0]?.status === "booked") {
      await client.query("COMMIT");
      return { alreadyRegistered: true, liveClass: toLiveClass(liveClass) };
    }
    if (Number(liveClass.seats_taken) >= Number(liveClass.seats_total)) {
      await client.query("COMMIT");
      return { full: true, liveClass: toLiveClass(liveClass) };
    }
    await client.query(
      `INSERT INTO class_bookings (class_id, user_id, status)
       VALUES ($1, $2, 'booked')
       ON CONFLICT (class_id, user_id)
       DO UPDATE SET status = 'booked', updated_at = now()`,
      [classId, userId],
    );
    await client.query(
      "UPDATE live_classes SET seats_taken = seats_taken + 1, updated_at = now() WHERE id = $1",
      [classId],
    );
    await client.query("COMMIT");
    return { alreadyRegistered: false, liveClass: toLiveClass(liveClass) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function enrollInFreeClass(userId: number, classId: number, env?: unknown) {
  const db = await getPool(env);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const classResult = await client.query<ClassRow>(
      "SELECT * FROM live_classes WHERE id = $1 AND is_active = TRUE FOR UPDATE",
      [classId],
    );
    const liveClass = classResult.rows[0];
    if (!liveClass) {
      await client.query("COMMIT");
      return null;
    }
    if (Number(liveClass.price_kes) > 0) {
      await client.query("COMMIT");
      return { requiresPayment: true, liveClass: toLiveClass(liveClass) };
    }

    const existing = await client.query<{ status: string }>(
      "SELECT status FROM class_bookings WHERE class_id = $1 AND user_id = $2 FOR UPDATE",
      [classId, userId],
    );
    if (existing.rows[0]?.status === "booked") {
      await client.query("COMMIT");
      return { alreadyBooked: true, liveClass: toLiveClass(liveClass) };
    }
    if (
      existing.rows[0]?.status !== "pending_payment" &&
      Number(liveClass.seats_taken) >= Number(liveClass.seats_total)
    ) {
      await client.query("COMMIT");
      return { full: true, liveClass: toLiveClass(liveClass) };
    }

    await client.query(
      `INSERT INTO class_bookings (class_id, user_id, status)
       VALUES ($1, $2, 'booked')
       ON CONFLICT (class_id, user_id)
       DO UPDATE SET status = 'booked', updated_at = now()`,
      [classId, userId],
    );
    if (existing.rows[0]?.status !== "pending_payment") {
      await client.query(
        "UPDATE live_classes SET seats_taken = seats_taken + 1, updated_at = now() WHERE id = $1",
        [classId],
      );
    }
    await client.query("COMMIT");
    return { alreadyBooked: false, liveClass: toLiveClass(liveClass) };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type PaymentRecord = {
  id: string;
  userId: number;
  classId: number | null;
  amountKes: number;
  provider: string;
  status: string;
  reference: string | null;
  type: "class" | "resource" | "service";
  itemName: string;
  phoneNumber: string | null;
  checkoutRequestId: string | null;
  merchantRequestId: string | null;
  receipt: string | null;
  learnerName: string;
  createdAt: string;
};

export async function listUsers(env?: unknown) {
  const db = await getPool(env);
  const res = await db.query<UserRow>(
    `SELECT u.id, u.email, u.phone, u.first_name, u.last_name, u.role, u.created_at, u.parent_id,
            u.is_active, u.suspension_reason,
            COALESCE(p.can_use_whiteboard, TRUE) AS can_use_whiteboard,
            COALESCE(p.can_share_screen, u.role IN ('learner', 'tutor')) AS can_share_screen
     FROM users u
     LEFT JOIN user_conference_permissions p ON p.user_id = u.id
     ORDER BY u.role ASC, u.last_name ASC, u.first_name ASC`,
  );
  return res.rows.map((row) => ({
    id: Number(row.id),
    email: row.email,
    phone: row.phone ?? null,
    firstName: row.first_name,
    lastName: row.last_name,
    role: row.role,
    isActive: row.is_active !== false,
    suspensionReason: row.suspension_reason ?? null,
    createdAt: row.created_at ?? new Date().toISOString(),
    parentId: row.parent_id ? Number(row.parent_id) : null,
    canUseWhiteboard: Boolean((row as any).can_use_whiteboard),
    canShareScreen: Boolean((row as any).can_share_screen),
  }));
}

export async function updateConferencePermissions(
  userId: number,
  permissions: { canUseWhiteboard: boolean; canShareScreen: boolean },
  env?: unknown,
) {
  const db = await getPool(env);
  const result = await db.query(
    `INSERT INTO user_conference_permissions (user_id, can_use_whiteboard, can_share_screen)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id) DO UPDATE SET
       can_use_whiteboard = EXCLUDED.can_use_whiteboard,
       can_share_screen = EXCLUDED.can_share_screen,
       updated_at = now()
     WHERE EXISTS (SELECT 1 FROM users WHERE id = $1)
     RETURNING user_id, can_use_whiteboard, can_share_screen`,
    [userId, permissions.canUseWhiteboard, permissions.canShareScreen],
  );
  const row = result.rows[0];
  return row
    ? {
        userId: Number(row.user_id),
        canUseWhiteboard: Boolean(row.can_use_whiteboard),
        canShareScreen: Boolean(row.can_share_screen),
      }
    : null;
}

export async function getConferencePermissions(userId: number, role: string, env?: unknown) {
  const db = await getPool(env);
  const result = await db.query(
    `SELECT
       COALESCE(p.can_use_whiteboard, TRUE) AS can_use_whiteboard,
       COALESCE(p.can_share_screen, $2 IN ('learner', 'tutor')) AS can_share_screen
     FROM users u
     LEFT JOIN user_conference_permissions p ON p.user_id = u.id
     WHERE u.id = $1
     LIMIT 1`,
    [userId, role],
  );
  const row = result.rows[0];
  return {
    canUseWhiteboard: Boolean(row?.can_use_whiteboard),
    canShareScreen: Boolean(row?.can_share_screen),
  };
}

export async function listConferenceParticipants(roomId: number, env?: unknown) {
  const db = await getPool(env);
  const result = await db.query(
    `SELECT cp.user_id, u.first_name, u.last_name, u.role,
            COALESCE(rp.can_use_whiteboard, up.can_use_whiteboard, TRUE) AS can_use_whiteboard,
            COALESCE(rp.can_share_screen, up.can_share_screen, u.role IN ('learner', 'tutor')) AS can_share_screen
     FROM conference_participants cp
     JOIN users u ON u.id = cp.user_id
     LEFT JOIN user_conference_permissions up ON up.user_id = u.id
     LEFT JOIN conference_room_permissions rp ON rp.room_id = cp.room_id AND rp.user_id = cp.user_id
     WHERE cp.room_id = $1 AND cp.left_at IS NULL
     GROUP BY cp.user_id, u.id, rp.can_use_whiteboard, rp.can_share_screen, up.can_use_whiteboard, up.can_share_screen
     ORDER BY u.last_name, u.first_name`,
    [roomId],
  );
  return result.rows.map((row: any) => ({
    userId: Number(row.user_id),
    name: `${row.first_name} ${row.last_name}`,
    role: row.role,
    canUseWhiteboard: Boolean(row.can_use_whiteboard),
    canShareScreen: Boolean(row.can_share_screen),
  }));
}

export async function updateRoomConferencePermissions(
  roomId: number,
  userId: number,
  permissions: { canUseWhiteboard: boolean; canShareScreen: boolean },
  env?: unknown,
) {
  const db = await getPool(env);
  const result = await db.query(
    `INSERT INTO conference_room_permissions (room_id, user_id, can_use_whiteboard, can_share_screen)
     SELECT $1, $2, $3, $4
     WHERE EXISTS (SELECT 1 FROM conference_participants WHERE room_id = $1 AND user_id = $2)
     ON CONFLICT (room_id, user_id) DO UPDATE SET
       can_use_whiteboard = EXCLUDED.can_use_whiteboard,
       can_share_screen = EXCLUDED.can_share_screen,
       updated_at = now()
     RETURNING user_id, can_use_whiteboard, can_share_screen`,
    [roomId, userId, permissions.canUseWhiteboard, permissions.canShareScreen],
  );
  const row = result.rows[0];
  return row
    ? {
        userId: Number(row.user_id),
        canUseWhiteboard: Boolean(row.can_use_whiteboard),
        canShareScreen: Boolean(row.can_share_screen),
      }
    : null;
}

export async function getRoomConferencePermissions(roomId: number, userId: number, env?: unknown) {
  const db = await getPool(env);
  const result = await db.query(
    `SELECT
       COALESCE(rp.can_use_whiteboard, up.can_use_whiteboard, TRUE) AS can_use_whiteboard,
       COALESCE(rp.can_share_screen, up.can_share_screen, u.role IN ('learner', 'tutor')) AS can_share_screen
     FROM users u
     LEFT JOIN user_conference_permissions up ON up.user_id = u.id
     LEFT JOIN conference_room_permissions rp ON rp.room_id = $1 AND rp.user_id = u.id
     WHERE u.id = $2
       AND EXISTS (
         SELECT 1 FROM conference_participants cp
         WHERE cp.room_id = $1 AND cp.user_id = u.id AND cp.left_at IS NULL
       )
     LIMIT 1`,
    [roomId, userId],
  );
  const row = result.rows[0];
  return row
    ? {
        canUseWhiteboard: Boolean(row.can_use_whiteboard),
        canShareScreen: Boolean(row.can_share_screen),
      }
    : null;
}

export async function requestRoomWhiteboardPermission(
  roomId: number,
  learnerUserId: number,
  env?: unknown,
) {
  const db = await getPool(env);
  const result = await db.query<{
    tutor_user_id: number | null;
    learner_name: string;
    subject: string;
    grade: string;
  }>(
    `SELECT cr.tutor_user_id, concat_ws(' ', learner.first_name, learner.last_name) AS learner_name,
            lc.subject, lc.grade
     FROM conference_rooms cr
     JOIN live_classes lc ON lc.id = cr.class_id
     JOIN conference_participants cp ON cp.room_id = cr.id AND cp.user_id = $2 AND cp.left_at IS NULL
     JOIN users learner ON learner.id = cp.user_id
     WHERE cr.id = $1 AND lc.is_active = TRUE
     LIMIT 1`,
    [roomId, learnerUserId],
  );
  const room = result.rows[0];
  if (!room?.tutor_user_id) return null;

  await createUserNotification(
    Number(room.tutor_user_id),
    {
      eventType: "whiteboard_permission_request",
      title: "Whiteboard access requested",
      description: `${room.learner_name} is asking to use the shared whiteboard in ${room.subject} (${room.grade}).`,
      subject: room.subject,
      course: room.grade,
      metadata: { roomId, learnerUserId },
    },
    env,
  );
  return { tutorUserId: Number(room.tutor_user_id), learnerName: room.learner_name };
}

export async function updateUserRole(userId: number, role: string, env?: unknown) {
  const db = await getPool(env);
  const res = await db.query<UserRow>(
    "UPDATE users SET role = $1, updated_at = now() WHERE id = $2 RETURNING id, email, first_name, last_name, role",
    [role, userId],
  );
  return res.rows[0] ? toPublicUser(res.rows[0]) : null;
}

export async function updateUserAccountStatus(
  userId: number,
  isActive: boolean,
  suspensionReason: string | null,
  env?: unknown,
) {
  const db = await getPool(env);
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query<UserRow>(
      `UPDATE users
       SET is_active = $2,
           suspended_at = CASE WHEN $2 THEN NULL ELSE now() END,
           suspension_reason = CASE WHEN $2 THEN NULL ELSE $3 END,
           updated_at = now()
       WHERE id = $1 AND role IN ('learner', 'tutor')
       RETURNING id, email, first_name, last_name, role, is_active, suspension_reason`,
      [userId, isActive, suspensionReason],
    );
    const user = result.rows[0];
    if (!user) {
      await client.query("ROLLBACK");
      return null;
    }
    if (!isActive) {
      await client.query(
        "UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
        [userId],
      );
    }
    await client.query("COMMIT");
    return {
      ...toPublicUser(user),
      isActive: Boolean(user.is_active),
      suspensionReason: user.suspension_reason ?? null,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteUser(userId: number, env?: unknown) {
  const db = await getPool(env);
  await db.query("DELETE FROM users WHERE id = $1", [userId]);
}

export async function listPayments(env?: unknown) {
  const db = await getPool(env);
  const res = await db.query<PaymentRecord>(
    `SELECT * FROM (
      SELECT
        'class-' || p.id::TEXT AS id,
        p.user_id AS "userId",
        p.class_id AS "classId",
        p.amount_kes AS "amountKes",
        p.provider,
        CASE
          WHEN p.status = 'completed'
            AND (p.provider <> 'M-Pesa' OR p.mpesa_receipt IS NULL)
          THEN 'unverified'
          ELSE p.status
        END AS status,
        p.reference,
        CASE WHEN csr.id IS NULL THEN 'class' ELSE 'service' END::TEXT AS type,
        CASE
          WHEN csr.id IS NOT NULL THEN
            (CASE WHEN csr.service_type = 'one_on_one' THEN 'One-on-one classes' ELSE 'Homework help' END)
            || ' — ' || replace(csr.package_type, '_', ' ')
            || ' (' || array_to_string(csr.subjects, ', ') || ')'
          ELSE COALESCE(lc.subject || ' (' || lc.grade || ')', 'Class')
        END AS "itemName",
        p.phone_number AS "phoneNumber",
        p.checkout_request_id AS "checkoutRequestId",
        p.merchant_request_id AS "merchantRequestId",
        p.mpesa_receipt AS receipt,
        u.first_name || ' ' || u.last_name AS "learnerName",
        p.created_at AS "createdAt"
      FROM payments p
      LEFT JOIN custom_service_requests csr ON csr.payment_id = p.id
      LEFT JOIN live_classes lc ON lc.id = p.class_id
      JOIN users u ON u.id = p.user_id
      UNION ALL
      SELECT
        'resource-' || rp.id::TEXT AS id,
        rp.user_id AS "userId",
        NULL::BIGINT AS "classId",
        rp.amount_kes AS "amountKes",
        rp.provider,
        CASE
          WHEN rp.status = 'completed'
            AND (rp.provider <> 'M-Pesa' OR rp.mpesa_receipt IS NULL)
          THEN 'unverified'
          ELSE rp.status
        END AS status,
        rp.reference,
        'resource'::TEXT AS type,
        r.title AS "itemName",
        rp.phone_number AS "phoneNumber",
        rp.checkout_request_id AS "checkoutRequestId",
        rp.merchant_request_id AS "merchantRequestId",
        rp.mpesa_receipt AS receipt,
        u.first_name || ' ' || u.last_name AS "learnerName",
        rp.created_at AS "createdAt"
      FROM resource_purchases rp
      JOIN resources r ON r.id = rp.resource_id
      JOIN users u ON u.id = rp.user_id
    ) AS payment_history
    ORDER BY "createdAt" DESC`,
  );
  return res.rows.map((row) => ({
    ...row,
    id: String(row.id),
    userId: Number(row.userId),
    classId: row.classId ? Number(row.classId) : null,
    amountKes: Number(row.amountKes),
    reference: row.reference ?? null,
    phoneNumber: row.phoneNumber ?? null,
    checkoutRequestId: row.checkoutRequestId ?? null,
    merchantRequestId: row.merchantRequestId ?? null,
    receipt: row.receipt ?? null,
    createdAt: row.createdAt,
  }));
}

export async function getAttendanceReport(
  userId: number | null,
  role: "learner" | "tutor" | "admin",
  limit = 100,
  offset = 0,
  env?: unknown,
  classId: number | null = null,
  roomId: number | null = null,
) {
  const db = await getPool(env);
  const ctes = `
    WITH sessions AS (
      SELECT
        cr.id AS room_id,
        cr.class_id,
        cr.class_session_id,
        cr.started_at,
        COALESCE(cs.scheduled_at, cr.started_at) AS scheduled_at,
        COALESCE(
          cr.ended_at,
          CASE WHEN NOT EXISTS (
            SELECT 1 FROM conference_participants active
            WHERE active.room_id = cr.id
              AND active.left_at IS NULL
              AND active.last_seen_at > now() - interval '2 minutes'
          ) THEN (
            SELECT MAX(previous.last_seen_at)
            FROM conference_participants previous
            WHERE previous.room_id = cr.id
          ) END
        ) AS completed_at,
        lc.subject,
        lc.grade,
        COALESCE(cr.tutor_user_id, lc.tutor_user_id) AS tutor_user_id,
        COALESCE(tutor.first_name || ' ' || tutor.last_name, lc.tutor_name) AS tutor_name
      FROM conference_rooms cr
      JOIN live_classes lc ON lc.id = cr.class_id
      LEFT JOIN class_sessions cs ON cs.id = cr.class_session_id
      LEFT JOIN users tutor ON tutor.id = COALESCE(cr.tutor_user_id, lc.tutor_user_id)
      WHERE cr.ended_at IS NOT NULL OR NOT EXISTS (
        SELECT 1 FROM conference_participants active
        WHERE active.room_id = cr.id
          AND active.left_at IS NULL
          AND active.last_seen_at > now() - interval '2 minutes'
      )
    ),
    participant_presence AS (
      SELECT
        room_id,
        user_id,
        SUM(duration_seconds)::INTEGER AS duration_seconds
      FROM conference_participants
      GROUP BY room_id, user_id
    ),
    expected_people AS (
      SELECT s.room_id, s.tutor_user_id AS user_id, 'tutor'::TEXT AS role
      FROM sessions s
      WHERE s.completed_at IS NOT NULL AND s.tutor_user_id IS NOT NULL
      UNION
      SELECT s.room_id, cb.user_id, 'learner'::TEXT AS role
      FROM sessions s
      JOIN class_bookings cb
        ON cb.class_id = s.class_id
       AND cb.status = 'booked'
       AND cb.created_at <= s.started_at
      WHERE s.completed_at IS NOT NULL AND s.class_session_id IS NULL
      UNION
      SELECT s.room_id, booking.user_id, 'learner'::TEXT AS role
      FROM sessions s
      JOIN class_session_bookings booking
        ON booking.class_session_id = s.class_session_id
       AND booking.status = 'booked'
      WHERE s.completed_at IS NOT NULL AND s.class_session_id IS NOT NULL
      UNION
      SELECT s.room_id, cp.user_id, cp.participant_role::TEXT AS role
      FROM sessions s
      JOIN conference_participants cp ON cp.room_id = s.room_id
      WHERE cp.participant_role IN ('tutor', 'learner')
    ),
    attendance AS (
      SELECT
        s.room_id,
        s.class_id,
        s.class_session_id,
        s.subject,
        s.grade,
        s.tutor_user_id,
        s.tutor_name,
        s.started_at,
        s.scheduled_at,
        s.completed_at,
        people.user_id,
        people.role,
        concat_ws(' ', participant.first_name, participant.last_name) AS participant_name,
        (presence.user_id IS NOT NULL) AS attended,
        COALESCE(presence.duration_seconds, 0) AS duration_seconds
      FROM expected_people people
      JOIN sessions s ON s.room_id = people.room_id
      JOIN users participant ON participant.id = people.user_id
      LEFT JOIN participant_presence presence
        ON presence.room_id = people.room_id AND presence.user_id = people.user_id
      WHERE s.completed_at IS NOT NULL
    )
  `;
  const scope =
    "($2 = 'admin' OR ($2 = 'learner' AND role = 'learner' AND user_id = $1) OR ($2 = 'tutor' AND tutor_user_id = $1))";
  const [summaryResult, attendanceResult, upcomingResult] = await Promise.all([
    db.query<{
      total_records: string;
      attended_records: string;
      missed_records: string;
      completed_sessions: string;
      classes_taught: string;
      tutor_missed: string;
      tutors_taught: string;
      learner_attended: string;
      learner_missed: string;
      current_streak: string;
    }>(
      `${ctes}
       SELECT
         COUNT(*)::TEXT AS total_records,
         COUNT(*) FILTER (WHERE attended)::TEXT AS attended_records,
         COUNT(*) FILTER (WHERE NOT attended)::TEXT AS missed_records,
         COUNT(DISTINCT room_id)::TEXT AS completed_sessions,
         COUNT(DISTINCT room_id) FILTER (WHERE role = 'tutor' AND attended)::TEXT AS classes_taught,
         COUNT(DISTINCT room_id) FILTER (WHERE role = 'tutor' AND NOT attended)::TEXT AS tutor_missed,
         COUNT(DISTINCT user_id) FILTER (WHERE role = 'tutor' AND attended)::TEXT AS tutors_taught,
         COUNT(*) FILTER (WHERE role = 'learner' AND attended)::TEXT AS learner_attended,
         COUNT(*) FILTER (WHERE role = 'learner' AND NOT attended)::TEXT AS learner_missed,
         (SELECT COUNT(*)::TEXT
          FROM (
            SELECT attended,
              row_number() OVER (ORDER BY completed_at DESC, room_id DESC, class_id DESC) AS position
            FROM attendance
            WHERE role = 'learner' AND user_id = $1
          ) recent
          WHERE attended AND position < COALESCE(
            (SELECT MIN(position) FROM (
              SELECT attended,
                row_number() OVER (ORDER BY completed_at DESC, room_id DESC, class_id DESC) AS position
              FROM attendance
              WHERE role = 'learner' AND user_id = $1
            ) history WHERE NOT attended),
            2147483647
          ))::TEXT AS current_streak
       FROM attendance
       WHERE ${scope} AND ($3::BIGINT IS NULL OR class_id = $3)
         AND ($4::BIGINT IS NULL OR room_id = $4)`,
      [userId, role, classId, roomId],
    ),
    db.query<{
      roomId: number | string;
      classId: number | string;
      classSessionId: number | string | null;
      subject: string;
      grade: string;
      tutorName: string;
      userId: number | string;
      role: "learner" | "tutor";
      participantName: string;
      attended: boolean;
      durationSeconds: number | string | null;
      startedAt: Date | string;
      scheduledAt: Date | string;
      completedAt: Date | string;
    }>(
      `${ctes}
       SELECT
         room_id AS "roomId",
         class_id AS "classId",
         class_session_id AS "classSessionId",
         subject,
         grade,
         tutor_name AS "tutorName",
         user_id AS "userId",
         role,
         participant_name AS "participantName",
         attended,
         duration_seconds AS "durationSeconds",
         started_at AS "startedAt",
         scheduled_at AS "scheduledAt",
         completed_at AS "completedAt"
       FROM attendance
       WHERE ${scope} AND ($3::BIGINT IS NULL OR class_id = $3)
         AND ($4::BIGINT IS NULL OR room_id = $4)
       ORDER BY completed_at DESC, room_id DESC, role, participant_name
       LIMIT $5 OFFSET $6`,
      [userId, role, classId, roomId, limit, offset],
    ),
    role === "admin"
      ? db.query<{ count: string }>(
          `SELECT COUNT(*)::TEXT AS count
           FROM live_classes lc
           WHERE lc.is_active = TRUE
             AND NOT EXISTS (
               SELECT 1 FROM conference_rooms cr
               WHERE cr.class_id = lc.id
                 AND (cr.ended_at IS NOT NULL OR NOT EXISTS (
                   SELECT 1 FROM conference_participants cp
                   WHERE cp.room_id = cr.id
                     AND cp.left_at IS NULL
                     AND cp.last_seen_at > now() - interval '2 minutes'
                 ))
             )`,
        )
      : role === "tutor"
        ? db.query<{ count: string }>(
            `SELECT COUNT(*)::TEXT AS count
             FROM live_classes lc
             WHERE lc.is_active = TRUE AND lc.tutor_user_id = $1
               AND NOT EXISTS (
                 SELECT 1 FROM conference_rooms cr
                 WHERE cr.class_id = lc.id
                   AND (cr.ended_at IS NOT NULL OR NOT EXISTS (
                     SELECT 1 FROM conference_participants cp
                     WHERE cp.room_id = cr.id
                       AND cp.left_at IS NULL
                       AND cp.last_seen_at > now() - interval '2 minutes'
                   ))
               )`,
            [userId],
          )
        : db.query<{ count: string }>(
            `SELECT COUNT(*)::TEXT AS count
             FROM class_bookings cb
             JOIN live_classes lc ON lc.id = cb.class_id AND lc.is_active = TRUE
             WHERE cb.user_id = $1 AND cb.status = 'booked'
               AND NOT EXISTS (
                 SELECT 1 FROM conference_rooms cr
                 WHERE cr.class_id = lc.id
                   AND (cr.ended_at IS NOT NULL OR NOT EXISTS (
                     SELECT 1 FROM conference_participants cp
                     WHERE cp.room_id = cr.id
                       AND cp.left_at IS NULL
                       AND cp.last_seen_at > now() - interval '2 minutes'
                   ))
               )`,
            [userId],
          ),
  ]);
  const summary = summaryResult.rows[0];
  const totalRecords = Number(summary.total_records ?? 0);
  const attendedRecords = Number(summary.attended_records ?? 0);
  const missedRecords = Number(summary.missed_records ?? 0);
  return {
    summary: {
      totalRecords,
      totalSessions: totalRecords,
      attended: attendedRecords,
      attendedSessions: attendedRecords,
      missed: missedRecords,
      missedSessions: missedRecords,
      completedSessions: Number(summary.completed_sessions ?? 0),
      classesTaught: Number(summary.classes_taught ?? 0),
      tutorMissed: Number(summary.tutor_missed ?? 0),
      tutorsTaught: Number(summary.tutors_taught ?? 0),
      learnerAttended: Number(summary.learner_attended ?? 0),
      learnerMissed: Number(summary.learner_missed ?? 0),
      currentStreak: Number(summary.current_streak ?? 0),
      upcomingClasses: Number(upcomingResult.rows[0]?.count ?? 0),
    },
    records: attendanceResult.rows.map((row) => ({
      ...row,
      roomId: Number(row.roomId),
      classId: Number(row.classId),
      classSessionId: row.classSessionId === null ? null : Number(row.classSessionId),
      userId: Number(row.userId),
      durationSeconds: Number(row.durationSeconds),
      attended: Boolean(row.attended),
    })),
    limit,
    offset,
  };
}

export async function getAttendanceClasses(
  userId: number | null,
  role: "learner" | "tutor" | "admin",
  env?: unknown,
) {
  const db = await getPool(env);
  const result = await db.query<{
    classId: number | string;
    subject: string;
    grade: string;
    tutorName: string;
    scheduleLabel: string;
    schedule_days: number[] | null;
    start_time: string | null;
    registeredLearners: number | string;
    completedSessions: number | string;
    sessionsTaught: number | string;
  }>(
    `SELECT lc.id AS "classId", lc.subject, lc.grade,
       COALESCE(tutor.first_name || ' ' || tutor.last_name, lc.tutor_name) AS "tutorName",
       lc.schedule_label AS "scheduleLabel",
       lc.schedule_days, lc.start_time,
       (SELECT COUNT(DISTINCT registered.user_id)
        FROM (
          SELECT user_id FROM class_bookings
          WHERE class_id = lc.id AND status = 'booked'
          UNION
          SELECT b.user_id
          FROM class_sessions cs
          JOIN class_session_bookings b ON b.class_session_id = cs.id
          WHERE cs.class_id = lc.id AND b.status = 'booked'
        ) registered) AS "registeredLearners",
       COUNT(DISTINCT cr.id) FILTER (
         WHERE EXISTS (
           SELECT 1 FROM conference_participants any_presence
           WHERE any_presence.room_id = cr.id
         )
         AND (cr.ended_at IS NOT NULL OR NOT EXISTS (
           SELECT 1 FROM conference_participants active
           WHERE active.room_id = cr.id AND active.left_at IS NULL
             AND active.last_seen_at > now() - interval '2 minutes'
         ))
       ) AS "completedSessions",
       COUNT(DISTINCT cr.id) FILTER (
         WHERE (cr.ended_at IS NOT NULL OR NOT EXISTS (
           SELECT 1 FROM conference_participants active
           WHERE active.room_id = cr.id AND active.left_at IS NULL
             AND active.last_seen_at > now() - interval '2 minutes'
         ))
         AND EXISTS (
           SELECT 1 FROM conference_participants tutor_presence
           WHERE tutor_presence.room_id = cr.id
             AND tutor_presence.user_id = COALESCE(cr.tutor_user_id, lc.tutor_user_id)
             AND tutor_presence.participant_role = 'tutor'
         )
       ) AS "sessionsTaught"
     FROM live_classes lc
     LEFT JOIN users tutor ON tutor.id = lc.tutor_user_id
     LEFT JOIN conference_rooms cr ON cr.class_id = lc.id
     WHERE lc.is_active = TRUE AND ($2 = 'admin'
         OR ($2 = 'tutor' AND lc.tutor_user_id = $1)
         OR ($2 = 'learner' AND (
           EXISTS (
             SELECT 1 FROM class_bookings enrolled
             WHERE enrolled.class_id = lc.id AND enrolled.user_id = $1
               AND enrolled.status = 'booked'
           ) OR EXISTS (
             SELECT 1 FROM class_sessions enrolled_session
             JOIN class_session_bookings enrolled_booking
               ON enrolled_booking.class_session_id = enrolled_session.id
             WHERE enrolled_session.class_id = lc.id AND enrolled_booking.user_id = $1
               AND enrolled_booking.status = 'booked'
           )
         )))
     GROUP BY lc.id, tutor.first_name, tutor.last_name
     ORDER BY lc.subject, lc.grade`,
    [userId, role],
  );
  return result.rows.map((row) => ({
    ...row,
    classId: Number(row.classId),
    scheduleDays: row.schedule_days?.map(Number) ?? [],
    startTime: row.start_time?.slice(0, 5) ?? null,
    scheduleLabel:
      row.schedule_days?.length && row.start_time
        ? formatRecurringSchedule(row.schedule_days.map(Number), row.start_time)
        : row.scheduleLabel,
    registeredLearners: Number(row.registeredLearners),
    completedSessions: Number(row.completedSessions),
    sessionsTaught: Number(row.sessionsTaught),
  }));
}

export async function getAdminReports(env?: unknown) {
  const db = await getPool(env);
  const [
    rolesRes,
    classesRes,
    activeConferencesRes,
    participantsRes,
    onlineParticipantsRes,
    resourcesRes,
    paymentsRes,
    attendanceRes,
  ] = await Promise.all([
    (db as any).query(
      `SELECT CASE
                  WHEN role IN ('learner', 'tutor', 'admin') THEN role
                  ELSE 'other'
                END AS role,
                COUNT(*)::TEXT AS count
         FROM users
         GROUP BY 1
         ORDER BY role`,
    ),
    (db as any).query("SELECT COUNT(*)::TEXT AS count FROM live_classes WHERE is_active = TRUE"),
    (db as any).query(
      `SELECT COUNT(*)::TEXT AS count
         FROM conference_rooms cr
         JOIN live_classes lc ON lc.id = cr.class_id
         WHERE cr.ended_at IS NULL
           AND lc.is_active = TRUE
           AND EXISTS (
             SELECT 1 FROM conference_participants cp
             WHERE cp.room_id = cr.id
               AND cp.left_at IS NULL
               AND cp.last_seen_at > now() - interval '2 minutes'
           )`,
    ),
    (db as any).query(
      `SELECT COUNT(DISTINCT cp.user_id)::TEXT AS count
         FROM conference_participants cp
         JOIN conference_rooms cr ON cr.id = cp.room_id
         JOIN live_classes lc ON lc.id = cr.class_id
         WHERE cp.participant_role = 'learner'`,
    ),
    (db as any).query(
      `SELECT COUNT(DISTINCT cp.user_id)::TEXT AS count
         FROM conference_participants cp
         JOIN conference_rooms cr ON cr.id = cp.room_id AND cr.ended_at IS NULL
         JOIN live_classes lc ON lc.id = cr.class_id AND lc.is_active = TRUE
         WHERE cp.left_at IS NULL AND cp.last_seen_at > now() - interval '2 minutes'`,
    ),
    (db as any).query("SELECT COUNT(*)::TEXT AS count FROM resources"),
    (db as any).query(
      `SELECT
          COUNT(*)::TEXT AS completed,
          COALESCE(SUM(amount_kes), 0)::TEXT AS revenue
         FROM (
           SELECT amount_kes FROM payments
           WHERE provider = 'M-Pesa' AND status = 'completed' AND mpesa_receipt IS NOT NULL
           UNION ALL
           SELECT amount_kes FROM resource_purchases
           WHERE provider = 'M-Pesa' AND status = 'completed' AND mpesa_receipt IS NOT NULL
         ) AS verified_payments`,
    ),
    (db as any).query(`
      SELECT cr.id, cr.class_id, lc.subject, lc.grade, lc.tutor_name, cr.started_at,
        CASE
          WHEN cr.ended_at IS NOT NULL THEN cr.ended_at
          WHEN BOOL_OR(
            cp.left_at IS NULL
            AND cp.last_seen_at > now() - interval '2 minutes'
          ) THEN NULL
          ELSE COALESCE(MAX(cp.last_seen_at), cr.started_at)
        END AS ended_at,
        COALESCE(SUM(
          CASE WHEN cp.left_at IS NULL AND cp.last_seen_at > now() - interval '2 minutes'
            THEN EXTRACT(EPOCH FROM now() - cp.joined_at)::INTEGER
            ELSE cp.duration_seconds END
        ) FILTER (WHERE cp.participant_role = 'tutor'), 0)::TEXT AS tutor_seconds,
        COUNT(DISTINCT cp.user_id) FILTER (WHERE cp.participant_role = 'learner')::TEXT AS learner_count,
        BOOL_OR(
          cp.participant_role = 'tutor'
          AND cp.left_at IS NULL
          AND cp.last_seen_at > now() - interval '2 minutes'
        ) AS tutor_present,
        COALESCE(SUM(
          CASE WHEN cp.left_at IS NULL AND cp.last_seen_at > now() - interval '2 minutes'
            THEN EXTRACT(EPOCH FROM now() - cp.joined_at)::INTEGER
            ELSE cp.duration_seconds END
        ) FILTER (WHERE cp.participant_role = 'learner'), 0)::TEXT AS learner_seconds
      FROM conference_rooms cr
      JOIN live_classes lc ON lc.id = cr.class_id
      LEFT JOIN conference_participants cp ON cp.room_id = cr.id
      GROUP BY cr.id, lc.id
      ORDER BY cr.started_at DESC
      LIMIT 50
    `),
  ]);

  return {
    usersByRole: rolesRes.rows.reduce((acc: Record<string, number>, row: any) => {
      acc[row.role] = Number(row.count);
      return acc;
    }, {}),
    totalClasses: Number(classesRes.rows[0]?.count ?? 0),
    activeConferences: Number(activeConferencesRes.rows[0]?.count ?? 0),
    totalParticipants: Number(participantsRes.rows[0]?.count ?? 0),
    onlineParticipants: Number(onlineParticipantsRes.rows[0]?.count ?? 0),
    totalResources: Number(resourcesRes.rows[0]?.count ?? 0),
    verifiedPayments: Number(paymentsRes.rows[0]?.completed ?? 0),
    verifiedRevenueKes: Number(paymentsRes.rows[0]?.revenue ?? 0),
    generatedAt: new Date().toISOString(),
    sessions: attendanceRes.rows.map((row: any) => ({
      id: Number(row.id),
      classId: Number(row.class_id),
      subject: row.subject,
      grade: row.grade,
      tutorName: row.tutor_name,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      tutorSeconds: Number(row.tutor_seconds),
      learnerCount: Number(row.learner_count),
      learnerSeconds: Number(row.learner_seconds),
      tutorPresent: Boolean(row.tutor_present),
    })),
  };
}

export async function insertConferenceLog(
  roomId: number | null,
  participantId: number | null,
  eventType: string,
  payload: unknown | null,
  env?: unknown,
) {
  const db = await getPool(env);
  const res = await db.query(
    `INSERT INTO conference_logs (room_id, participant_id, event_type, payload)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [roomId ?? null, participantId ?? null, eventType, payload ? JSON.stringify(payload) : null],
  );
  return Number(res.rows[0]?.id ?? 0);
}

export async function addWhiteboardStroke(
  roomId: number,
  userId: number,
  points: Array<[number, number]>,
  color: string,
  lineWidth: number,
  env?: unknown,
) {
  const db = await getPool(env);
  const res = await db.query<{ id: number }>(
    `INSERT INTO conference_whiteboard_strokes (room_id, user_id, points, color, line_width)
     SELECT $1, $2, $3, $4, $5
     WHERE EXISTS (SELECT 1 FROM conference_participants WHERE room_id = $1 AND user_id = $2 AND left_at IS NULL)
     RETURNING id`,
    [roomId, userId, JSON.stringify(points), color, lineWidth],
  );
  return Number(res.rows[0]?.id ?? 0);
}

export async function listWhiteboardStrokes(roomId: number, afterId = 0, env?: unknown) {
  const db = await getPool(env);
  const res = await db.query(
    `SELECT id, points, color, line_width AS "lineWidth"
     FROM conference_whiteboard_strokes
     WHERE room_id = $1 AND id > $2
     ORDER BY id ASC LIMIT 500`,
    [roomId, afterId],
  );
  return res.rows.map((row: any) => ({
    id: Number(row.id),
    points: tryParseJson(row.points),
    color: row.color,
    lineWidth: Number(row.lineWidth),
  }));
}

export async function getConferenceWhiteboardState(roomId: number, userId: number, env?: unknown) {
  const db = await getPool(env);
  const result = await db.query<{ whiteboard_visible: boolean; ended: boolean }>(
    `SELECT cr.whiteboard_visible, (cr.ended_at IS NOT NULL) AS ended
     FROM conference_rooms cr
     JOIN conference_participants cp ON cp.room_id = cr.id
     WHERE cr.id = $1 AND cp.user_id = $2
     LIMIT 1`,
    [roomId, userId],
  );
  if (!result.rows[0]) return null;
  return {
    visible: Boolean(result.rows[0].whiteboard_visible),
    ended: Boolean(result.rows[0].ended),
  };
}

export async function updateConferenceWhiteboardState(
  roomId: number,
  userId: number,
  isAdmin: boolean,
  visible: boolean,
  env?: unknown,
) {
  const db = await getPool(env);
  const result = await db.query<{ whiteboard_visible: boolean }>(
    `UPDATE conference_rooms
     SET whiteboard_visible = $3
     WHERE id = $1 AND ended_at IS NULL AND (tutor_user_id = $2 OR $4 = TRUE)
     RETURNING whiteboard_visible`,
    [roomId, userId, visible, isAdmin],
  );
  return result.rows[0] ? Boolean(result.rows[0].whiteboard_visible) : null;
}

export async function listActiveConferences(env?: unknown) {
  const db = await getPool(env);
  const res = await db.query(`
    SELECT cr.id, cr.room_name, cr.class_id, cr.started_at, cr.tutor_user_id, lc.subject, lc.grade
    FROM conference_rooms cr
    JOIN live_classes lc ON lc.id = cr.class_id
    WHERE cr.ended_at IS NULL
      AND lc.is_active = TRUE
      AND EXISTS (
        SELECT 1 FROM conference_participants cp
        WHERE cp.room_id = cr.id
          AND cp.left_at IS NULL
          AND cp.last_seen_at > now() - interval '2 minutes'
      )
    ORDER BY cr.started_at DESC
    LIMIT 200
  `);
  return res.rows.map((r: any) => ({
    id: Number(r.id),
    roomName: r.room_name,
    classId: Number(r.class_id),
    startedAt: r.started_at,
    tutorUserId: r.tutor_user_id ? Number(r.tutor_user_id) : null,
    subject: r.subject,
    grade: r.grade,
  }));
}

export async function listConferenceLogs(limit = 200, env?: unknown) {
  const db = await getPool(env);
  const res = await db.query(
    `SELECT logs.id, logs.room_id, logs.participant_id, logs.event_type, logs.payload, logs.created_at
     FROM conference_logs logs
     JOIN conference_rooms cr ON cr.id = logs.room_id
     JOIN live_classes lc ON lc.id = cr.class_id
    WHERE lc.is_active = TRUE
       AND logs.created_at > now() - interval '24 hours'
     ORDER BY logs.created_at DESC
     LIMIT $1`,
    [limit],
  );
  return res.rows.map((r: any) => ({
    id: Number(r.id),
    roomId: r.room_id ? Number(r.room_id) : null,
    participantId: r.participant_id ? Number(r.participant_id) : null,
    eventType: r.event_type,
    payload: r.payload ? tryParseJson(r.payload) : null,
    createdAt: r.created_at,
  }));
}

export async function getActiveRoomIdForClass(classId: number, env?: unknown) {
  const db = await getPool(env);
  const res = await db.query(
    `SELECT id FROM conference_rooms
     WHERE class_id = $1 AND ended_at IS NULL
       AND EXISTS (
         SELECT 1 FROM conference_participants cp
         WHERE cp.room_id = conference_rooms.id AND cp.left_at IS NULL
           AND cp.last_seen_at > now() - interval '2 minutes'
       )
     ORDER BY started_at DESC LIMIT 1`,
    [classId],
  );
  if (!res.rows[0]) return null;
  return Number(res.rows[0].id);
}

function tryParseJson(v: any) {
  try {
    return typeof v === "string" ? JSON.parse(v) : v;
  } catch (e) {
    return v;
  }
}

function configuredValue(env: unknown, key: keyof DbEnv) {
  const value =
    env && typeof env === "object" && key in env
      ? (env as DbEnv)[key]
      : typeof process !== "undefined"
        ? process.env[key]
        : undefined;
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function configuredJitsiPrivateKey(env?: unknown) {
  const keyFile = configuredValue(env, "JITSI_PRIVATE_KEY_FILE");
  if (keyFile) {
    try {
      return fs.readFileSync(keyFile, "utf8").trim();
    } catch {
      throw new Error("JITSI_PRIVATE_KEY_FILE_UNREADABLE");
    }
  }
  return configuredValue(env, "JITSI_PRIVATE_KEY");
}

function base64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

export function buildConferenceRoomName(lessonId: number | string, sessionId?: string) {
  const normalized = String(lessonId).trim();
  const roomName = normalized ? `elimusphere-lesson-${normalized}` : "elimusphere-lesson";
  return sessionId?.trim() ? `${roomName}-${sessionId.trim()}` : roomName;
}

export function createJaasJwt(input: {
  appId: string;
  keyId: string;
  privateKey: string;
  roomName: string;
  userId: number;
  userName?: string;
  role: string;
}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", kid: input.keyId, typ: "JWT" };
  const payload = {
    aud: "jitsi",
    iss: "chat",
    sub: input.appId,
    room: input.roomName,
    iat: now,
    nbf: now - 30,
    // Fresh tokens prevent a short-lived test token from terminating a lesson.
    exp: now + 60 * 60 * 4,
    context: {
      user: {
        id: String(input.userId),
        name: input.userName ?? "Elimusphere participant",
        moderator: input.role === "tutor" || input.role === "admin",
      },
      room: { regex: false },
    },
  };
  const signingInput = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(payload))}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  return `${signingInput}.${signer.sign(input.privateKey.replace(/\\n/g, "\n")).toString("base64url")}`;
}

type JitsiConfiguration = {
  domain: string;
  whiteboardUrl?: string;
  jaas?: { appId: string; keyId: string; privateKey: string };
  staticJwt?: string;
};

function resolveJitsiConfiguration(env?: unknown): JitsiConfiguration {
  const configuredDomain = configuredValue(env, "JITSI_DOMAIN")
    ?.replace(/^https?:\/\//, "")
    .replace(/\/$/, "");

  // Legacy JaaS (8x8) configuration - DEPRECATED
  // Support kept for backward compatibility, but self-hosted is recommended
  const appId = configuredValue(env, "JITSI_APP_ID");
  const keyId = configuredValue(env, "JITSI_KEY_ID");
  const privateKey = configuredJitsiPrivateKey(env);
  const usesJaas = Boolean(appId || keyId || privateKey);

  // JaaS validation: all three must be present or none
  if (usesJaas && (!appId || !keyId || !privateKey)) {
    throw new Error("JITSI_CONFIGURATION_INCOMPLETE");
  }

  const jaas = appId && keyId && privateKey ? { appId, keyId, privateKey } : undefined;
  const isProduction = configuredValue(env, "NODE_ENV") === "production";

  // Determine domain with proper fallback
  const domain = configuredDomain || (jaas ? "8x8.vc" : "meet.jit.si");
  const configuredWhiteboardUrl = configuredValue(env, "JITSI_WHITEBOARD_URL");
  const whiteboardUrl = configuredWhiteboardUrl
    ? configuredWhiteboardUrl.replace(/\/+$/, "")
    : configuredDomain && !jaas
      ? `https://${domain}`
      : undefined;

  if (whiteboardUrl) {
    let parsedWhiteboardUrl: URL;
    try {
      parsedWhiteboardUrl = new URL(whiteboardUrl);
    } catch {
      throw new Error("JITSI_WHITEBOARD_URL_INVALID");
    }
    if (parsedWhiteboardUrl.protocol !== "https:") {
      throw new Error("JITSI_WHITEBOARD_URL_INVALID");
    }
  }

  // Validate domain format
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(domain)) {
    throw new Error("JITSI_DOMAIN_INVALID");
  }

  // Production requires either JaaS OR a configured self-hosted domain
  if (isProduction && !jaas && !configuredDomain) {
    throw new Error("JITSI_CONFIGURATION_REQUIRED");
  }

  // Self-hosted in production: domain must be configured explicitly
  if (isProduction && !jaas && configuredDomain && configuredDomain === "meet.jit.si") {
    throw new Error("JITSI_DOMAIN_INVALID");
  }

  return {
    domain,
    whiteboardUrl,
    jaas,
    staticJwt: isProduction ? undefined : configuredValue(env, "JITSI_JWT"),
  };
}

export async function startConference(
  classId: number,
  userId: number,
  authSessionId: number,
  role: string,
  env?: unknown,
  classSessionId: number | null = null,
) {
  const db = await getPool(env);
  const participantRole = role === "tutor" || role === "admin" ? role : "learner";
  const classesRes = await db.query<ClassRow>(
    "SELECT * FROM live_classes WHERE id = $1 AND is_active = TRUE LIMIT 1",
    [classId],
  );
  const liveClass = classesRes.rows[0];
  if (!liveClass) return null;
  if (classSessionId !== null) {
    const scheduledSession = await db.query(
      "SELECT 1 FROM class_sessions WHERE id = $1 AND class_id = $2",
      [classSessionId, classId],
    );
    if (!scheduledSession.rowCount) return null;
  }
  // Validate provider setup before creating rooms, participants, or notifications.
  const jitsiConfig = resolveJitsiConfiguration(env);

  let roomId: number;
  let roomName: string;
  let participantId: number;
  let startedNewSession = false;
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [8_642_032, classId]);
    const existingRoom = await client.query<{
      id: number;
      room_name: string;
      ended_at: string | null;
      has_active_participant: boolean;
    }>(
      `SELECT cr.id, cr.room_name, cr.ended_at,
         EXISTS (
           SELECT 1 FROM conference_participants cp
           WHERE cp.room_id = cr.id
             AND cp.left_at IS NULL
             AND cp.last_seen_at > now() - interval '2 minutes'
         ) AS has_active_participant
       FROM conference_rooms cr
       WHERE cr.class_id = $1 AND ($2::BIGINT IS NULL OR cr.class_session_id = $2)
       ORDER BY cr.started_at DESC, cr.id DESC
       LIMIT 1
       FOR UPDATE`,
      [classId, classSessionId],
    );
    const currentRoom = existingRoom.rows[0];
    if (currentRoom && !currentRoom.ended_at && currentRoom.has_active_participant) {
      roomId = Number(currentRoom.id);
      roomName = currentRoom.room_name;
      if (role === "tutor") {
        await client.query(
          "UPDATE conference_rooms SET jitsi_domain = $2, tutor_user_id = COALESCE(tutor_user_id, $3) WHERE id = $1",
          [roomId, jitsiConfig.domain, userId],
        );
      } else {
        await client.query("UPDATE conference_rooms SET jitsi_domain = $2 WHERE id = $1", [
          roomId,
          jitsiConfig.domain,
        ]);
      }
    } else {
      if (currentRoom && !currentRoom.ended_at) {
        await client.query(
          "UPDATE conference_rooms SET ended_at = now(), whiteboard_visible = FALSE WHERE id = $1",
          [currentRoom.id],
        );
      }
      roomName = buildConferenceRoomName(classId, crypto.randomUUID());
      const newRoom = await client.query<{ id: number }>(
        `INSERT INTO conference_rooms (class_id, class_session_id, room_name, jitsi_domain, tutor_user_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          classId,
          classSessionId,
          roomName,
          jitsiConfig.domain,
          role === "tutor" ? userId : (liveClass.tutor_user_id ?? null),
        ],
      );
      roomId = Number(newRoom.rows[0].id);
      startedNewSession = true;
    }
    const participant = await client.query<{ id: number }>(
      `INSERT INTO conference_participants (room_id, user_id, auth_session_id, participant_role)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [roomId, userId, authSessionId, participantRole],
    );
    participantId = Number(participant.rows[0].id);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  if (startedNewSession && role === "tutor") {
    if (classSessionId !== null) {
      await db.query(
        `INSERT INTO learning_timeline_events (user_id, event_type, title, description, subject, course, event_date, highlighted, metadata)
         SELECT user_id, 'class_started', 'Live class started', $1, $2, $3, now(), TRUE, $4
         FROM class_session_bookings WHERE class_session_id = $5 AND status = 'booked'`,
        [
          `Your ${liveClass.subject} class with ${liveClass.tutor_name} is starting now. Join the room to participate.`,
          liveClass.subject,
          liveClass.grade,
          { classId, classSessionId, roomName },
          classSessionId,
        ],
      );
    } else {
      await db.query(
        `INSERT INTO learning_timeline_events (user_id, event_type, title, description, subject, course, event_date, highlighted, metadata)
         SELECT user_id, 'class_started', 'Live class started', $1, $2, $3, now(), TRUE, $4
         FROM class_bookings
         WHERE class_id = $5 AND status = 'booked'`,
        [
          `Your ${liveClass.subject} class with ${liveClass.tutor_name} is starting now. Join the room to participate.`,
          liveClass.subject,
          liveClass.grade,
          { classId, roomName },
          classId,
        ],
      );
    }
  }

  // fetch user's display name for Jitsi prefill
  const userRes = await db.query("SELECT first_name, last_name FROM users WHERE id = $1 LIMIT 1", [
    userId,
  ]);
  const userRow = userRes.rows[0];
  const userDisplayName = userRow ? `${userRow.first_name} ${userRow.last_name}` : undefined;
  const conferencePermissions = await getConferencePermissions(userId, role, env);
  const roomPermissions = await db.query(
    `SELECT can_use_whiteboard, can_share_screen
     FROM conference_room_permissions WHERE room_id = $1 AND user_id = $2 LIMIT 1`,
    [roomId, userId],
  );
  const roomPermission = roomPermissions.rows[0];

  return {
    class: toLiveClass(liveClass),
    participantId,
    roomId,
    roomName,
    // Use a managed Jitsi/JaaS tenant or self-hosted instance in production; the
    // public host remains only as a local-development fallback.
    jitsiDomain: jitsiConfig.domain,
    jitsiWhiteboardUrl: jitsiConfig.whiteboardUrl,
    jitsiAppId: jitsiConfig.jaas?.appId,
    jitsiJwt: jitsiConfig.jaas
      ? createJaasJwt({
          ...jitsiConfig.jaas,
          roomName,
          userId,
          userName: userDisplayName,
          role,
        })
      : jitsiConfig.staticJwt,
    userDisplayName,
    participantRole,
    conferencePermissions: {
      canUseWhiteboard: roomPermission
        ? Boolean(roomPermission.can_use_whiteboard)
        : conferencePermissions.canUseWhiteboard,
      canShareScreen: roomPermission
        ? Boolean(roomPermission.can_share_screen)
        : conferencePermissions.canShareScreen,
    },
  };
}

export async function touchConferenceParticipant(
  participantId: number,
  userId: number,
  env?: unknown,
) {
  const db = await getPool(env);
  await db.query(
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
  await db.query(
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

export async function endConference(
  roomId: number,
  userId: number,
  isAdmin: boolean,
  env?: unknown,
) {
  const db = await getPool(env);
  const result = await db.query(
    `UPDATE conference_rooms
     SET ended_at = COALESCE(ended_at, now()), whiteboard_visible = FALSE
     WHERE id = $1 AND (tutor_user_id = $2 OR $3 = TRUE) AND ended_at IS NULL`,
    [roomId, userId, isAdmin],
  );
  if ((result.rowCount ?? 0) === 0) return false;

  await db.query(
    `UPDATE conference_participants
     SET
       left_at = COALESCE(left_at, now()),
       last_seen_at = now(),
       duration_seconds = FLOOR(EXTRACT(EPOCH FROM (now() - joined_at)))::INT
     WHERE room_id = $1 AND left_at IS NULL`,
    [roomId],
  );
  return true;
}
