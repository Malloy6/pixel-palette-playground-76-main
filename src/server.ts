import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import {
  createAuthSession,
  createUser,
  findUserByEmail,
  getUserFromToken,
  leaveConferenceParticipant,
  listLiveClasses,
  revokeAuthSession,
  startConference,
  touchConferenceParticipant,
  verifyPassword,
} from "./lib/tusome-db";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;
const sessionCookie = "tusome_session";

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function json(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...init.headers,
    },
  });
}

function readCookie(request: Request, name: string) {
  const cookies = request.headers.get("cookie") ?? "";
  const match = cookies
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

function setSessionCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`;
}

function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${sessionCookie}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}

async function readJson<T extends Record<string, unknown>>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    return {} as T;
  }
}

function clientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isDbUnavailable(error: unknown) {
  if (!(error instanceof Error)) return false;
  const code = (error as Error & { code?: string }).code;
  const message = error.message.toLowerCase();
  return (
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    code === "ETIMEDOUT" ||
    code === "ER_ACCESS_DENIED_ERROR" ||
    message.includes("db_password") ||
    message.includes("connection refused") ||
    message.includes("could not connect to server") ||
    message.includes("password authentication failed") ||
    message.includes("peer authentication failed")
  );
}

async function requireUser(request: Request, env: unknown) {
  const token = readCookie(request, sessionCookie);
  return getUserFromToken(token, env);
}

async function handleApi(request: Request, env: unknown) {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    if (path === "/api/auth/signup" && request.method === "POST") {
      const body = await readJson(request);
      const firstName = cleanText(body.firstName);
      const lastName = cleanText(body.lastName);
      const email = cleanText(body.email).toLowerCase();
      const phone = cleanText(body.phone);
      const password = cleanText(body.password);
      const role = cleanText(body.role) || "parent";

      if (!firstName || !lastName || !email || !password) {
        return json({ message: "Please fill in all required fields." }, { status: 400 });
      }
      if (password.length < 8) {
        return json({ message: "Password must be at least 8 characters." }, { status: 400 });
      }
      if (!["parent", "learner", "tutor"].includes(role)) {
        return json({ message: "Please choose a valid account type." }, { status: 400 });
      }

      const user = await createUser({ firstName, lastName, email, phone, password, role }, env);
      const token = await createAuthSession(
        {
          userId: user.id,
          userAgent: request.headers.get("user-agent"),
          ipAddress: clientIp(request),
        },
        env,
      );
      return json(
        { user },
        {
          status: 201,
          headers: { "set-cookie": setSessionCookie(token) },
        },
      );
    }

    if (path === "/api/auth/login" && request.method === "POST") {
      const body = await readJson(request);
      const email = cleanText(body.email).toLowerCase();
      const password = cleanText(body.password);
      const user = await findUserByEmail(email, env);

      if (!user || !verifyPassword(password, user.password_hash)) {
        return json({ message: "Invalid email or password." }, { status: 401 });
      }

      const token = await createAuthSession(
        {
          userId: Number(user.id),
          userAgent: request.headers.get("user-agent"),
          ipAddress: clientIp(request),
        },
        env,
      );
      return json(
        {
          user: {
            id: Number(user.id),
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role,
          },
        },
        { headers: { "set-cookie": setSessionCookie(token) } },
      );
    }

    if (path === "/api/auth/logout" && request.method === "POST") {
      await revokeAuthSession(readCookie(request, sessionCookie), env);
      return json({ ok: true }, { headers: { "set-cookie": clearSessionCookie() } });
    }

    if (path === "/api/auth/me" && request.method === "GET") {
      const session = await requireUser(request, env);
      return json({ user: session?.user ?? null });
    }

    if (path === "/api/classes" && request.method === "GET") {
      return json({ classes: await listLiveClasses(env) });
    }

    const conferenceJoin = path.match(/^\/api\/conferences\/(\d+)\/join$/);
    if (conferenceJoin && request.method === "POST") {
      const session = await requireUser(request, env);
      if (!session)
        return json({ message: "Please sign in to join the live class." }, { status: 401 });

      const conference = await startConference(
        Number(conferenceJoin[1]),
        session.user.id,
        session.sessionId,
        env,
      );
      if (!conference) return json({ message: "Class not found." }, { status: 404 });
      return json(conference);
    }

    if (path === "/api/conferences/heartbeat" && request.method === "POST") {
      const session = await requireUser(request, env);
      if (!session) return json({ message: "Please sign in again." }, { status: 401 });
      const body = await readJson(request);
      await touchConferenceParticipant(Number(body.participantId), session.user.id, env);
      return json({ ok: true });
    }

    if (path === "/api/conferences/leave" && request.method === "POST") {
      const session = await requireUser(request, env);
      if (!session) return json({ ok: true });
      const body = await readJson(request);
      await leaveConferenceParticipant(Number(body.participantId), session.user.id, env);
      return json({ ok: true });
    }
  } catch (error) {
    console.error(error);

    if (error instanceof Error && error.message.includes("Duplicate")) {
      return json({ message: "An account with this email already exists." }, { status: 409 });
    }

    if (isDbUnavailable(error)) {
      return json(
        {
          message:
            "Database connection failed. Start PostgreSQL or update DB_HOST, DB_PORT, DB_USER and DB_PASSWORD in .env.local.",
          detail: error instanceof Error ? error.message : undefined,
        },
        { status: 503 },
      );
    }

    if (process.env.NODE_ENV !== "production" && error instanceof Error) {
      return json(
        {
          message: error.message || "The server could not complete that request.",
          detail: error.stack?.split("\n").slice(0, 5),
        },
        { status: 500 },
      );
    }

    return json({ message: "The server could not complete that request." }, { status: 500 });
  }

  return json({ message: "Not found" }, { status: 404 });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/")) {
        return await handleApi(request, env);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
