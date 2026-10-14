import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import fs from "node:fs/promises";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";
import {
  createAuthSession,
  createApplication,
  createAssignmentRequest,
  createTutorAssignment,
  updateTutorAssignment,
  setTutorAssignmentWithdrawn,
  createLiveClass,
  patchLiveClass,
  deleteLiveClass,
  createResource,
  updateResource,
  deleteResource,
  listPublishedResources,
  listPurchasedResources,
  findResourceById,
  hasPurchasedResource,
  purchaseResourceWithMpesa,
  updateMpesaRequestIds,
  failMpesaCheckout,
  getMpesaPaymentStatus,
  settleMpesaCallback,
  createChatMessage,
  canTutorStartClass,
  purchaseClassWithMpesa,
  listSubscribedClasses,
  hasClassBooking,
  createUser,
  createPasswordResetTokenForEmail,
  deleteUser,
  endConference,
  findUserByEmail,
  findApplicationById,
  getAttendanceReport,
  getAttendanceClasses,
  getClassTutorUserId,
  purchaseClassSessionsWithMpesa,
  purchaseCustomServiceWithMpesa,
  getCustomServicePricing,
  updateCustomServicePricing,
  scheduleCustomServiceRequest,
  listCustomServiceRequests,
  listClassSessions,
  bookClassSession,
  hasClassSessionBooking,
  getClassSessionPaymentStatus,
  registerLearnerForClass,
  getActiveRoomIdForClass,
  getActiveRoomIdForSession,
  getClassSessionStartStatus,
  getAdminReports,
  getPlatformHealth,
  enrollInFreeClass,
  getUserFromToken,
  leaveConferenceParticipant,
  listAssignmentRequestsForTutor,
  listAssignmentRequestsForUser,
  listLiveClasses,
  listActiveConferences,
  listPayments,
  listUsers,
  listApplications,
  listConferenceLogs,
  listLearningTimelineEventsForViewer,
  listClassSubscribers,
  listChatContacts,
  listChatMessages,
  listTutorStudents,
  getTutorStudent,
  getLearningProgress,
  getUnreadMessageCount,
  gradeAssignmentSubmission,
  listAssignmentsForLearner,
  listAssignmentsForTutor,
  revokeAuthSession,
  resetPasswordWithToken,
  reviewAssignmentRequest,
  sendPasswordResetEmail,
  sendWelcomeEmailToUser,
  sendApplicationApprovedEmail,
  sendApplicationRejectedEmail,
  sendContactFormEmail,
  sendPaymentReceiptEmail,
  sendUpcomingClassSessionsEmail,
  createUserNotification,
  sendClassAssignmentEmail,
  sendCustomServiceLearnerScheduleEmail,
  sendCustomServiceTutorAssignmentEmail,
  reviewApplication,
  startConference,
  touchConferenceParticipant,
  insertConferenceLog,
  updateUserRole,
  updateUserAccountStatus,
  updateConferencePermissions,
  listConferenceParticipants,
  updateRoomConferencePermissions,
  getRoomConferencePermissions,
  requestRoomWhiteboardPermission,
  addWhiteboardStroke,
  listWhiteboardStrokes,
  getConferenceWhiteboardState,
  updateConferenceWhiteboardState,
  submitAssignment,
  verifyPassword,
} from "./lib/tusome-db.ts";
import { isValidEmailAddress } from "./lib/validation.ts";
import { normalizeMpesaPhone, startStkPush } from "./lib/mpesa.ts";
import { CLASS_SESSION_START_WINDOW_MS, isClassSessionStartAllowed } from "./lib/class-schedule.ts";

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
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      // Allow the browser to request camera/microphone/display-capture and clipboard access
      // Note: use conservative permissions in production as needed.
      "permissions-policy":
        "camera=*, microphone=*, display-capture=*, fullscreen=*, clipboard-read=*, clipboard-write=*",
      ...init.headers,
    },
  });
}

function withSecurityHeaders(response: Response, request: Request) {
  const headers = new Headers(response.headers);
  headers.set("x-content-type-options", "nosniff");
  headers.set("referrer-policy", "strict-origin-when-cross-origin");
  // Allow more permissive media features when using secure contexts
  headers.set(
    "permissions-policy",
    "camera=*, microphone=*, display-capture=*, fullscreen=*, clipboard-read=*, clipboard-write=*",
  );
  if (isSecureRequest(request)) {
    headers.set("cross-origin-opener-policy", "same-origin");
    headers.set("strict-transport-security", "max-age=31536000; includeSubDomains");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
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

function isSecureRequest(request: Request) {
  return (
    new URL(request.url).protocol === "https:" ||
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https"
  );
}

function setSessionCookie(token: string, request: Request) {
  const secure = isSecureRequest(request) ? "; Secure" : "";
  return `${sessionCookie}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`;
}

function clearSessionCookie(request: Request) {
  const secure = isSecureRequest(request) ? "; Secure" : "";
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

function resourceUploadDirectory() {
  return nodePath.resolve(process.cwd(), "public", "uploads");
}

type ResourceBucket = {
  put: (
    key: string,
    value: ArrayBuffer | ArrayBufferView,
    options?: { httpMetadata?: { contentType?: string } },
  ) => Promise<unknown>;
  get: (key: string) => Promise<{
    body: ReadableStream<Uint8Array>;
    httpMetadata?: { contentType?: string };
  } | null>;
  delete: (key: string) => Promise<void>;
};

function resourceBucket(env: unknown): ResourceBucket | null {
  if (!env || typeof env !== "object") return null;
  const bucket = (env as { RESOURCE_BUCKET?: ResourceBucket }).RESOURCE_BUCKET;
  return bucket &&
    typeof bucket.put === "function" &&
    typeof bucket.get === "function" &&
    typeof bucket.delete === "function"
    ? bucket
    : null;
}

function resolveResourceFilePath(filePath: string) {
  const uploadDir = resourceUploadDirectory();
  const candidate = filePath.startsWith("/")
    ? nodePath.resolve(filePath)
    : nodePath.resolve(process.cwd(), "public", filePath);
  return candidate === uploadDir || candidate.startsWith(`${uploadDir}${nodePath.sep}`)
    ? candidate
    : null;
}

function resourceFileName(filePath: string) {
  return filePath.split(/[\\/]/).pop() || "resource.bin";
}

function resourceContentType(filePath: string) {
  const extension = nodePath.extname(filePath).toLowerCase();
  const contentTypes: Record<string, string> = {
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".webp": "image/webp",
  };
  return contentTypes[extension] ?? "application/octet-stream";
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

async function tryServeStaticAsset(request: Request, env: unknown, ctx: unknown) {
  if (request.method !== "GET") return null;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const publicImages = new Set([
    "/elimusphere-logo.png",
    "/founder-joseph-wandera.jpg",
    "/founder-stephen-owiti-omondi.png",
  ]);
  if (!pathname.startsWith("/assets/") && !publicImages.has(pathname)) {
    return null;
  }

  const distDir = nodePath.resolve(process.cwd(), "dist", "client");
  const relativePath = pathname.slice(1);
  const assetPath = nodePath.resolve(distDir, relativePath);

  if (!assetPath.startsWith(distDir)) return null;

  try {
    const file = await fs.readFile(assetPath);
    const extension = nodePath.extname(assetPath).toLowerCase();
    const contentType =
      extension === ".css"
        ? "text/css; charset=utf-8"
        : extension === ".js"
          ? "text/javascript; charset=utf-8"
          : extension === ".jpg" || extension === ".jpeg"
            ? "image/jpeg"
            : extension === ".png"
              ? "image/png"
              : extension === ".svg"
                ? "image/svg+xml"
                : "application/octet-stream";

    return new Response(file, {
      headers: {
        "content-type": contentType,
        "cache-control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Asset not found", {
      status: 404,
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store, max-age=0, must-revalidate",
      },
    });
  }
}

async function requireUser(request: Request, env: unknown) {
  const token = readCookie(request, sessionCookie);
  return getUserFromToken(token, env);
}

async function requireRole(request: Request, env: unknown, allowedRoles: string[]) {
  const session = await requireUser(request, env);
  if (!session || !allowedRoles.includes(session.user.role)) return null;
  return session;
}

async function handleApi(request: Request, env: unknown) {
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    if (path === "/api/contact" && request.method === "POST") {
      const body = await readJson(request);
      const name = cleanText(body.name);
      const email = cleanText(body.email).toLowerCase();
      const subject = cleanText(body.subject);
      const message = cleanText(body.message);
      if (
        !name ||
        name.length > 120 ||
        !isValidEmailAddress(email) ||
        email.length > 254 ||
        !subject ||
        subject.length > 200 ||
        !message ||
        message.length > 5000
      ) {
        return json(
          { message: "Please provide valid contact details and a message." },
          { status: 400 },
        );
      }

      try {
        await sendContactFormEmail({ name, email, subject, message });
      } catch (error) {
        console.error("Contact form email delivery failed.", error);
        return json(
          { message: "We couldn't send your message right now. Please try again shortly." },
          { status: 503 },
        );
      }

      return json({ sent: true });
    }

    if (path === "/api/service-pricing" && request.method === "GET") {
      return json({ prices: await getCustomServicePricing(env) });
    }

    if (path === "/api/service-pricing" && request.method === "PUT") {
      const session = await requireRole(request, env, ["admin"]);
      if (!session) return json({ message: "Administrator access required." }, { status: 401 });
      const body = await readJson(request);
      try {
        const prices = await updateCustomServicePricing(body.prices, env);
        return json({ prices });
      } catch (error) {
        if (
          error instanceof Error &&
          (error.message.startsWith("Package prices must be whole KES amounts") ||
            error.message.startsWith("Provide valid prices"))
        ) {
          return json({ message: error.message }, { status: 400 });
        }
        throw error;
      }
    }

    if (path === "/api/mpesa/callback" && request.method === "POST") {
      const body = await readJson(request);
      const callbackEnvelope = body.Body;
      const callback =
        callbackEnvelope && typeof callbackEnvelope === "object"
          ? (callbackEnvelope as Record<string, unknown>).stkCallback
          : undefined;
      const callbackData =
        callback && typeof callback === "object"
          ? (callback as Record<string, unknown>)
          : undefined;
      const checkoutRequestId = callbackData?.CheckoutRequestID;
      const resultCode = Number(callbackData?.ResultCode);
      if (typeof checkoutRequestId !== "string" || !Number.isInteger(resultCode)) {
        return json({ message: "Invalid M-Pesa callback." }, { status: 400 });
      }
      if (resultCode !== 0) {
        console.warn("Safaricom reported a failed M-Pesa payment.", {
          checkoutRequestId,
          resultCode,
          resultDescription:
            typeof callbackData?.ResultDesc === "string" ? callbackData.ResultDesc : undefined,
        });
      }
      const callbackMetadata = callbackData?.CallbackMetadata;
      const items =
        callbackMetadata && typeof callbackMetadata === "object"
          ? (callbackMetadata as Record<string, unknown>).Item
          : undefined;
      const metadata: Record<string, unknown> = {};
      if (Array.isArray(items)) {
        for (const item of items) {
          if (item && typeof item === "object" && "Name" in item) {
            const name = (item as { Name?: unknown }).Name;
            if (typeof name === "string") {
              metadata[name] = (item as { Value?: unknown }).Value;
            }
          }
        }
      }
      const settlement = await settleMpesaCallback(
        checkoutRequestId,
        resultCode,
        typeof metadata.Amount === "number" ? metadata.Amount : null,
        typeof metadata.MpesaReceiptNumber === "string" ? metadata.MpesaReceiptNumber : null,
        typeof callbackData?.ResultDesc === "string" ? callbackData.ResultDesc : undefined,
        env,
      );
      if (!settlement) {
        console.warn("Received an M-Pesa callback for an unknown checkout request.");
      } else if (settlement.completedNow) {
        try {
          await sendPaymentReceiptEmail({
            to: settlement.email,
            firstName: settlement.firstName,
            itemName: settlement.itemName,
            amountKes: settlement.amountKes,
            reference: settlement.reference,
            kind: settlement.kind,
          });
        } catch (error) {
          console.error("Could not send the M-Pesa payment receipt email.", error);
        }
        if (settlement.kind === "class" && settlement.sessions.length) {
          try {
            await sendUpcomingClassSessionsEmail({
              to: settlement.email,
              firstName: settlement.firstName,
              subject: settlement.itemName.split(" (")[0],
              grade: settlement.grade,
              scheduledSessions: settlement.sessions,
              amountKes: settlement.amountKes,
            });
          } catch (error) {
            console.error("Could not send the upcoming class schedule email.", error);
          }
        }
      }
      return json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const mpesaStatus = path.match(/^\/api\/mpesa\/transactions\/([^/]+)$/);
    if (mpesaStatus && request.method === "GET") {
      const session = await requireRole(request, env, ["learner"]);
      if (!session) return json({ message: "Please sign in as a learner." }, { status: 401 });
      const reference = decodeURIComponent(mpesaStatus[1]);
      const payment = await getMpesaPaymentStatus(session.user.id, reference, env);
      if (!payment) return json({ message: "Payment was not found." }, { status: 404 });
      return json(payment);
    }

    if (path === "/api/auth/signup" && request.method === "POST") {
      const body = await readJson(request);
      const firstName = cleanText(body.firstName);
      const lastName = cleanText(body.lastName);
      const email = cleanText(body.email).toLowerCase();
      const phone = cleanText(body.phone);
      const password = cleanText(body.password);
      const role = cleanText(body.role) || "learner";
      const acceptsLegal = body.acceptLegal === true;
      const safaricomPattern = /^(?:01[0-1]|070|071|072|074|075|076|079)\d{7}$/;
      const subject = cleanText(body.subject);
      const documents = Array.isArray(body.documents)
        ? body.documents
            .slice(0, 10)
            .map((item) => {
              if (typeof item === "string") {
                return { name: item, mimeType: "application/octet-stream", content: "" };
              }
              if (item && typeof item === "object" && typeof (item as any).name === "string") {
                return {
                  name: (item as any).name,
                  documentType:
                    typeof (item as any).documentType === "string"
                      ? (item as any).documentType
                      : undefined,
                  mimeType:
                    typeof (item as any).mimeType === "string" && (item as any).mimeType
                      ? (item as any).mimeType
                      : "application/octet-stream",
                  content: typeof (item as any).content === "string" ? (item as any).content : "",
                };
              }
              return null;
            })
            .filter(
              (
                item,
              ): item is {
                name: string;
                documentType?: string;
                mimeType: string;
                content: string;
              } => item !== null && typeof item.name === "string",
            )
        : [];

      if (!firstName || !lastName || !email || !password) {
        return json({ message: "Please fill in all required fields." }, { status: 400 });
      }
      if (password.length < 8) {
        return json({ message: "Password must be at least 8 characters." }, { status: 400 });
      }
      if (!isValidEmailAddress(email)) {
        return json({ message: "Please provide a valid email address." }, { status: 400 });
      }
      if (!safaricomPattern.test(phone)) {
        return json(
          { message: "Please provide a valid 10-digit Safaricom phone number." },
          { status: 400 },
        );
      }
      if (!["learner", "tutor"].includes(role)) {
        return json({ message: "Please choose a valid account type." }, { status: 400 });
      }
      if (!acceptsLegal) {
        return json(
          { message: "You must accept the Terms of Use and your account agreement to sign up." },
          { status: 400 },
        );
      }
      if (role === "tutor") {
        if (!subject || subject.length > 160) {
          return json(
            { message: "Please provide the subject you are applying to teach." },
            { status: 400 },
          );
        }
        const requiredDocuments = new Set(["cv", "tscCertificate", "applicationLetter"]);
        for (const document of documents) {
          if (document.documentType) requiredDocuments.delete(document.documentType);
        }
        if (requiredDocuments.size > 0) {
          return json(
            {
              message: "Tutor applications require a CV, TSC certificate, and application letter.",
            },
            { status: 400 },
          );
        }
      }
      if (role === "learner") {
        const user = await createUser(
          {
            email,
            phone,
            firstName,
            lastName,
            role,
            password,
            termsVersion: "2026-08-28",
            roleAgreementVersion: "2026-08-28",
          },
          env,
        );
        void sendWelcomeEmailToUser({ email, firstName, role }).catch((error) => {
          console.error("Learner welcome email failed.", error);
        });
        return json({ user }, { status: 201 });
      }

      const application = await createApplication(
        {
          firstName,
          lastName,
          email,
          phone,
          password,
          role: "tutor",
          subject,
          documents,
          termsVersion: "2026-08-28",
          roleAgreementVersion: "2026-08-28",
        },
        env,
      );
      void sendWelcomeEmailToUser({ email, firstName, role }).catch((error) => {
        console.error("Tutor application confirmation email failed.", error);
      });
      return json({ application }, { status: 201 });
    }

    if (path === "/api/auth/login" && request.method === "POST") {
      const body = await readJson(request);
      const email = cleanText(body.email).toLowerCase();
      const password = cleanText(body.password);
      const user = await findUserByEmail(email, env);

      if (!user || !verifyPassword(password, user.password_hash)) {
        return json({ message: "Invalid email or password." }, { status: 401 });
      }
      if (user.is_active === false) {
        return json(
          {
            message:
              "Your account is temporarily paused while it is under review. Please contact support.",
          },
          { status: 403 },
        );
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
        { headers: { "set-cookie": setSessionCookie(token, request) } },
      );
    }

    if (path === "/api/auth/logout" && request.method === "POST") {
      await revokeAuthSession(readCookie(request, sessionCookie), env);
      return json({ ok: true }, { headers: { "set-cookie": clearSessionCookie(request) } });
    }
    if (path === "/api/chat/unread-count" && request.method === "GET") {
      const session = await requireRole(request, env, ["tutor", "learner"]);
      if (!session) return json({ count: 0 }, { status: 401 });
      return json({ count: await getUnreadMessageCount(session.user.id, env) });
    }

    if (path === "/api/auth/me" && request.method === "GET") {
      const session = await requireUser(request, env);
      return json({ user: session?.user ?? null });
    }

    if (path === "/api/auth/forgot-password" && request.method === "POST") {
      const body = await readJson(request);
      const email = cleanText(body.email).toLowerCase();
      if (!isValidEmailAddress(email)) {
        return json({ message: "Please provide a valid email address." }, { status: 400 });
      }

      const tokenRecord = await createPasswordResetTokenForEmail(email, env);
      if (tokenRecord) {
        void sendPasswordResetEmail(email, tokenRecord.token).catch((error) => {
          console.error("Password reset email failed.", error);
        });
      }

      return json({
        message: "If that email exists in our system, we have sent reset instructions.",
      });
    }

    if (path === "/api/auth/reset-password" && request.method === "POST") {
      const body = await readJson(request);
      const token = cleanText(body.token);
      const password = cleanText(body.password);
      if (!token || !password) {
        return json(
          { message: "Please provide the reset token and a new password." },
          { status: 400 },
        );
      }
      if (password.length < 8) {
        return json({ message: "Password must be at least 8 characters." }, { status: 400 });
      }

      const success = await resetPasswordWithToken(token, password, env);
      if (!success) {
        return json(
          { message: "The password reset link is invalid or has expired." },
          { status: 400 },
        );
      }

      return json({ message: "Password has been updated successfully." });
    }

    if (path === "/api/service-requests" && request.method === "GET") {
      const account = await requireUser(request, env);
      if (!account)
        return json({ message: "Please sign in to view your lesson requests." }, { status: 401 });
      return json({
        requests: await listCustomServiceRequests(account.user.id, account.user.role, env),
      });
    }

    if (path === "/api/service-requests/checkout" && request.method === "POST") {
      const account = await requireRole(request, env, ["learner"]);
      if (!account) return json({ message: "Learner access required." }, { status: 401 });
      const body = await readJson(request);
      const serviceType =
        body.serviceType === "one_on_one" || body.serviceType === "homework_help"
          ? body.serviceType
          : null;
      const packageType = typeof body.packageType === "string" ? body.packageType : "";
      const grade = typeof body.grade === "string" ? body.grade : "";
      const subjects = Array.isArray(body.subjects)
        ? body.subjects.filter((subject): subject is string => typeof subject === "string")
        : [];
      const phone = typeof body.phone === "string" ? normalizeMpesaPhone(body.phone) : null;
      if (!serviceType || !packageType || !grade || !subjects.length)
        return json(
          { message: "Choose a service package, learner grade, and at least one subject." },
          { status: 400 },
        );
      if (!phone)
        return json(
          { message: "Enter a valid Safaricom mobile number to receive the M-Pesa prompt." },
          { status: 400 },
        );

      let purchase: Awaited<ReturnType<typeof purchaseCustomServiceWithMpesa>>;
      try {
        purchase = await purchaseCustomServiceWithMpesa(
          account.user.id,
          serviceType,
          packageType,
          grade,
          subjects,
          phone,
          env,
        );
      } catch (error) {
        if (error instanceof Error && error.message.startsWith("Choose a valid package"))
          return json({ message: error.message }, { status: 400 });
        throw error;
      }
      try {
        const stk = await startStkPush(
          {
            phone,
            amountKes: purchase.amountKes,
            accountReference: `ELM${purchase.reference.slice(-6)}`,
            transactionDesc: purchase.itemName,
          },
          env,
        );
        await updateMpesaRequestIds(
          purchase.reference,
          stk.checkoutRequestId,
          stk.merchantRequestId,
          env,
        );
      } catch (error) {
        console.error("Custom lesson M-Pesa checkout failed.", error);
        await failMpesaCheckout(purchase.reference, env);
        const message =
          error instanceof Error ? error.message : "Could not initiate the M-Pesa payment.";
        const status =
          /configuration is missing|Set APP_URL|callback URL|MPESA_TRANSACTION_TYPE|MPESA_PARTY_B|MPESA_ENV|non-production/i.test(
            message,
          )
            ? 503
            : 502;
        return json({ message }, { status });
      }
      return json(
        {
          status: "pending",
          reference: purchase.reference,
          amountKes: purchase.amountKes,
          requestId: purchase.requestId,
        },
        { status: 202 },
      );
    }

    if (path === "/api/classes" && request.method === "GET") {
      const account = await requireUser(request, env);
      return json({
        classes: await listLiveClasses(
          env,
          account && (account.user.role === "learner" || account.user.role === "admin")
            ? account.user.id
            : null,
        ),
      });
    }

    if (path === "/api/classes/subscribed" && request.method === "GET") {
      const session = await requireRole(request, env, ["learner"]);
      if (!session) return json({ message: "Learner access required." }, { status: 401 });
      return json({ classes: await listSubscribedClasses(session.user.id, env) });
    }

    const classSessionsPath = path.match(/^\/api\/classes\/(\d+)\/sessions$/);
    if (classSessionsPath && request.method === "GET") {
      const account = await requireUser(request, env);
      return json({
        sessions: await listClassSessions(
          Number(classSessionsPath[1]),
          account && (account.user.role === "learner" || account.user.role === "admin")
            ? account.user.id
            : null,
          env,
        ),
      });
    }

    const sessionBookingPath = path.match(/^\/api\/classes\/(\d+)\/sessions\/(\d+)\/book$/);
    if (sessionBookingPath && request.method === "POST") {
      const session = await requireRole(request, env, ["learner"]);
      if (!session)
        return json(
          { message: "Learner access required to book a class session." },
          { status: 401 },
        );
      const booking = await bookClassSession(
        session.user.id,
        Number(sessionBookingPath[1]),
        Number(sessionBookingPath[2]),
        env,
      );
      if (booking.notFound)
        return json({ message: "Upcoming class session not found." }, { status: 404 });
      if (booking.paymentRequired)
        return json(
          { message: "Select this session and complete the M-Pesa checkout to reserve it." },
          { status: 409 },
        );
      if (booking.full) return json({ message: "This session is fully booked." }, { status: 409 });
      return json({ booked: true, alreadyBooked: booking.alreadyBooked });
    }

    const selectedSessionsCheckout = path.match(/^\/api\/classes\/(\d+)\/sessions\/checkout$/);
    if (selectedSessionsCheckout && request.method === "POST") {
      const session = await requireRole(request, env, ["learner"]);
      if (!session)
        return json(
          { message: "Learner access required to book class sessions." },
          { status: 401 },
        );
      const body = await readJson(request);
      const sessionIds = Array.isArray(body.sessionIds)
        ? [...new Set(body.sessionIds.map(Number))]
        : [];
      if (
        !sessionIds.length ||
        sessionIds.length > 20 ||
        sessionIds.some((id) => !Number.isSafeInteger(id) || id < 1)
      )
        return json(
          { message: "Select between 1 and 20 valid upcoming class sessions." },
          { status: 400 },
        );
      const phone = typeof body.phone === "string" ? normalizeMpesaPhone(body.phone) : null;
      const booking = await purchaseClassSessionsWithMpesa(
        session.user.id,
        Number(selectedSessionsCheckout[1]),
        sessionIds,
        phone ?? "",
        env,
      );
      if (!booking) return json({ message: "Class not found." }, { status: 404 });
      if ("invalidSession" in booking)
        return json(
          { message: "One or more selected class sessions are no longer available." },
          { status: 404 },
        );
      if ("full" in booking)
        return json(
          { message: "One or more selected class sessions are fully booked." },
          { status: 409 },
        );
      if ("alreadyPaid" in booking)
        return json(
          { message: "One or more selected sessions are already paid for." },
          { status: 409 },
        );
      if ("sessionPending" in booking)
        return json(
          { message: "A selected session already has a payment request in progress." },
          { status: 409 },
        );
      if ("free" in booking && booking.free) {
        await createUserNotification(
          session.user.id,
          {
            eventType: "upcoming_class",
            title: "Upcoming class sessions booked",
            description: `${booking.sessions.length} ${booking.liveClass.subject} session${booking.sessions.length === 1 ? "" : "s"} booked for ${booking.sessions
              .map((scheduledAt) =>
                new Date(scheduledAt).toLocaleString("en-KE", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Africa/Nairobi",
                }),
              )
              .join(", ")}.`,
            subject: "Classes",
            course: `${booking.liveClass.subject} · ${booking.liveClass.grade}`,
            metadata: { sessions: booking.sessions },
          },
          env,
        );
        try {
          await sendUpcomingClassSessionsEmail({
            to: session.user.email,
            firstName: session.user.firstName,
            subject: booking.liveClass.subject,
            grade: booking.liveClass.grade,
            scheduledSessions: booking.sessions,
            amountKes: 0,
          });
          return json({ free: true, booked: true, emailSent: true });
        } catch (error) {
          console.error("Free class booking email failed:", error);
          return json({
            free: true,
            booked: true,
            emailSent: false,
            message: "Sessions were booked, but the email confirmation could not be sent.",
          });
        }
      }
      if ("alreadyPending" in booking && booking.alreadyPending && booking.phone !== phone) {
        return json(
          {
            message:
              "A payment request is already pending for this booking. Confirm it on the phone that received the earlier prompt.",
          },
          { status: 409 },
        );
      }
      if (!("alreadyPending" in booking && booking.alreadyPending) && !phone)
        return json(
          { message: "Enter a valid Safaricom mobile number to receive the M-Pesa prompt." },
          { status: 400 },
        );
      if (!("reference" in booking) || !booking.reference)
        return json({ message: "The pending payment is missing its reference." }, { status: 500 });
      if (!("alreadyPending" in booking && booking.alreadyPending)) {
        try {
          const stk = await startStkPush(
            {
              phone: booking.phone,
              amountKes: booking.amountKes,
              accountReference: `ELM${booking.reference.slice(-6)}`,
              transactionDesc: `${booking.liveClass.subject} ${sessionIds.length} sessions`,
            },
            env,
          );
          await updateMpesaRequestIds(
            booking.reference,
            stk.checkoutRequestId,
            stk.merchantRequestId,
            env,
          );
        } catch (error) {
          console.error("M-Pesa multi-session checkout failed.", error);
          await failMpesaCheckout(booking.reference, env);
          const message =
            error instanceof Error ? error.message : "Could not initiate the M-Pesa payment.";
          const status =
            /configuration is missing|Set APP_URL|callback URL|MPESA_TRANSACTION_TYPE|MPESA_PARTY_B|MPESA_ENV|non-production/i.test(
              message,
            )
              ? 503
              : 502;
          return json({ message }, { status });
        }
      }
      return json(
        {
          status: "pending",
          reference: booking.reference,
          amountKes: "amountKes" in booking ? booking.amountKes : undefined,
          sessionCount: sessionIds.length,
          liveClass: booking.liveClass,
        },
        { status: 202 },
      );
    }

    const classEnrollment = path.match(/^\/api\/classes\/(\d+)\/enroll$/);
    if (classEnrollment && request.method === "POST") {
      const session = await requireRole(request, env, ["learner"]);
      if (!session) return json({ message: "Learner access required." }, { status: 401 });
      const enrollment = await registerLearnerForClass(
        session.user.id,
        Number(classEnrollment[1]),
        env,
      );
      if (!enrollment) return json({ message: "Class not found." }, { status: 404 });
      if (enrollment.full) return json({ message: "This class is fully booked." }, { status: 409 });
      return json(enrollment);
    }

    const classSubscribers = path.match(/^\/api\/classes\/(\d+)\/subscribers$/);
    if (classSubscribers && request.method === "GET") {
      const session = await requireRole(request, env, ["tutor", "admin"]);
      if (!session) return json({ message: "Tutor or admin access required." }, { status: 401 });
      const classId = Number(classSubscribers[1]);
      if (session.user.role === "tutor") {
        const allowed = await canTutorStartClass(classId, session.user.id, env);
        if (!allowed)
          return json({ message: "You do not have access to this class." }, { status: 403 });
      }
      const subscribers = await listClassSubscribers(classId, env);
      return json({ subscribers });
    }

    if (path === "/api/tutor/students" && request.method === "GET") {
      const session = await requireRole(request, env, ["tutor"]);
      if (!session) return json({ message: "Tutor access required." }, { status: 401 });
      return json({ students: await listTutorStudents(session.user.id, env) });
    }

    const tutorStudent = path.startsWith("/api/tutor/students/")
      ? path.slice("/api/tutor/students/".length)
      : "";
    if (tutorStudent && request.method === "GET") {
      const session = await requireRole(request, env, ["tutor"]);
      if (!session) return json({ message: "Tutor access required." }, { status: 401 });
      const student = await getTutorStudent(session.user.id, Number(tutorStudent), env);
      if (!student) return json({ message: "Student not found." }, { status: 404 });
      return json({ student });
    }

    if (path === "/api/chat/contacts" && request.method === "GET") {
      const session = await requireRole(request, env, ["tutor", "learner"]);
      if (!session) return json({ message: "Tutor or learner access required." }, { status: 401 });
      return json({ contacts: await listChatContacts(session.user.id, session.user.role, env) });
    }

    if (path === "/api/chat/messages" && request.method === "GET") {
      const session = await requireRole(request, env, ["tutor", "learner"]);
      const contactId = Number(url.searchParams.get("contactId"));
      if (!session) return json({ message: "Tutor or learner access required." }, { status: 401 });
      if (!contactId)
        return json({ message: "Please provide a valid contact id." }, { status: 400 });
      const messages = await listChatMessages(session.user.id, contactId, env);
      if (messages === null)
        return json({ message: "You can only chat with people in your classes." }, { status: 403 });
      return json({ messages });
    }

    if (path === "/api/chat/messages" && request.method === "POST") {
      const session = await requireRole(request, env, ["tutor", "learner"]);
      if (!session) return json({ message: "Tutor or learner access required." }, { status: 401 });
      const body = await readJson(request);
      const recipientId = Number(body.recipientId);
      if (!recipientId) return json({ message: "Please choose a recipient." }, { status: 400 });
      const message = await createChatMessage(
        {
          senderId: session.user.id,
          recipientId,
          body: cleanText(body.body),
          attachments: body.attachments,
        },
        env,
      );
      if (message === undefined)
        return json({ message: "You can only chat with people in your classes." }, { status: 403 });
      if (message === null)
        return json({ message: "Write a message or attach a file." }, { status: 400 });
      return json({ message }, { status: 201 });
    }

    const mpesaCheckout = path.match(/^\/api\/classes\/(\d+)\/mpesa-checkout$/);
    if (mpesaCheckout && request.method === "POST") {
      const session = await requireRole(request, env, ["learner"]);
      if (!session)
        return json(
          { message: "Please sign in as a learner to pay for a class." },
          { status: 401 },
        );
      const body = await readJson(request);
      const classSessionId =
        body.sessionId === undefined || body.sessionId === null ? null : Number(body.sessionId);
      if (
        classSessionId !== null &&
        (!Number.isSafeInteger(classSessionId) || classSessionId < 1)
      ) {
        return json({ message: "Please select a valid class session." }, { status: 400 });
      }
      if (classSessionId === null) {
        const freeEnrollment = await enrollInFreeClass(
          session.user.id,
          Number(mpesaCheckout[1]),
          env,
        );
        if (!freeEnrollment) return json({ message: "Class not found." }, { status: 404 });
        if (!freeEnrollment.requiresPayment) {
          if (freeEnrollment.full)
            return json({ message: "This class is fully booked." }, { status: 409 });
          return json({
            free: true,
            alreadyBooked: freeEnrollment.alreadyBooked,
            status: "completed",
            liveClass: freeEnrollment.liveClass,
          });
        }
      } else if (!(await hasClassSessionBooking(session.user.id, classSessionId, env))) {
        return json({ message: "Book this session before paying to join." }, { status: 403 });
      }
      const phone = typeof body.phone === "string" ? normalizeMpesaPhone(body.phone) : null;
      if (!phone) {
        return json(
          { message: "Enter a valid Safaricom mobile number to receive the M-Pesa prompt." },
          { status: 400 },
        );
      }
      const activeRoomId =
        classSessionId === null
          ? await getActiveRoomIdForClass(Number(mpesaCheckout[1]), env)
          : await getActiveRoomIdForSession(classSessionId, env);
      const purchase = await purchaseClassWithMpesa(
        session.user.id,
        Number(mpesaCheckout[1]),
        activeRoomId ?? 0,
        phone,
        env,
        classSessionId,
      );
      if (!purchase) return json({ message: "Class not found." }, { status: 404 });
      if ("sessionUnavailable" in purchase && purchase.sessionUnavailable)
        return json(
          { message: "The tutor must start the live session before you can pay for it." },
          { status: 409 },
        );
      if ("notRegistered" in purchase && purchase.notRegistered)
        return json(
          { message: "Register for this class before paying for a live session." },
          { status: 403 },
        );
      if ("alreadyPaid" in purchase && purchase.alreadyPaid)
        return json({ alreadyPaid: true, status: "completed", liveClass: purchase.liveClass });
      if (!purchase.reference) {
        return json({ message: "The pending payment is missing its reference." }, { status: 500 });
      }
      if (purchase.alreadyPending && purchase.phone && purchase.phone !== phone) {
        return json(
          {
            message:
              "A payment request is already pending for this purchase. Confirm it on the phone that received the earlier prompt before starting another.",
          },
          { status: 409 },
        );
      }
      if (!purchase.alreadyPending) {
        try {
          if (typeof purchase.amountKes !== "number") {
            throw new Error("The class payment amount is unavailable.");
          }
          if (!purchase.phone) {
            throw new Error("Add a Safaricom phone number to your account before paying.");
          }
          const stk = await startStkPush(
            {
              phone: purchase.phone,
              amountKes: purchase.amountKes,
              accountReference: `ELM${purchase.reference.slice(-6)}`,
              transactionDesc: `${purchase.liveClass.subject} class`,
            },
            env,
          );
          await updateMpesaRequestIds(
            purchase.reference,
            stk.checkoutRequestId,
            stk.merchantRequestId,
            env,
          );
        } catch (error) {
          console.error("M-Pesa class checkout failed.", error);
          await failMpesaCheckout(purchase.reference, env);
          const message =
            error instanceof Error ? error.message : "Could not initiate the M-Pesa payment.";
          const status = message.startsWith("Add a Safaricom")
            ? 400
            : /configuration is missing|Set APP_URL|callback URL|MPESA_TRANSACTION_TYPE|MPESA_PARTY_B|MPESA_ENV|non-production/i.test(
                  message,
                )
              ? 503
              : 502;
          return json({ message }, { status });
        }
      }
      return json(
        {
          status: "pending",
          alreadyPending: purchase.alreadyPending,
          reference: purchase.reference,
          liveClass: purchase.liveClass,
        },
        { status: 202 },
      );
    }

    const resourceMpesa = path.match(/^\/api\/resources\/(\d+)\/mpesa-checkout$/);
    if (resourceMpesa && request.method === "POST") {
      const session = await requireRole(request, env, ["learner", "tutor"]);
      if (!session)
        return json(
          { message: "Please sign in as a learner or tutor to purchase resources." },
          { status: 401 },
        );
      const resource = await findResourceById(Number(resourceMpesa[1]), env);
      if (!resource) return json({ message: "Resource not found." }, { status: 404 });
      if (resource.priceKes === 0)
        return json({ free: true, status: "completed", resourceId: resource.id });
      const body = await readJson(request);
      const phone = typeof body.phone === "string" ? normalizeMpesaPhone(body.phone) : null;
      if (!phone) {
        return json(
          { message: "Enter a valid Safaricom mobile number to receive the M-Pesa prompt." },
          { status: 400 },
        );
      }
      const purchase = await purchaseResourceWithMpesa(
        session.user.id,
        Number(resourceMpesa[1]),
        phone,
        env,
      );
      if (!purchase) return json({ message: "Resource not found." }, { status: 404 });
      if (purchase.alreadyPurchased) {
        return json({ alreadyPurchased: true, status: "completed" });
      }
      if (!purchase.reference) {
        return json({ message: "The pending payment is missing its reference." }, { status: 500 });
      }
      if (purchase.alreadyPending && purchase.phone && purchase.phone !== phone) {
        return json(
          {
            message:
              "A payment request is already pending for this purchase. Confirm it on the phone that received the earlier prompt before starting another.",
          },
          { status: 409 },
        );
      }
      if (!purchase.alreadyPending) {
        try {
          if (typeof purchase.amountKes !== "number") {
            throw new Error("The resource payment amount is unavailable.");
          }
          if (!purchase.phone) {
            throw new Error("Add a Safaricom phone number to your account before paying.");
          }
          const stk = await startStkPush(
            {
              phone: purchase.phone,
              amountKes: purchase.amountKes,
              accountReference: `ELM${purchase.reference.slice(-6)}`,
              transactionDesc: `Resource ${purchase.resource.id}`,
            },
            env,
          );
          await updateMpesaRequestIds(
            purchase.reference,
            stk.checkoutRequestId,
            stk.merchantRequestId,
            env,
          );
        } catch (error) {
          console.error("M-Pesa resource checkout failed.", error);
          await failMpesaCheckout(purchase.reference, env);
          const message =
            error instanceof Error ? error.message : "Could not initiate the M-Pesa payment.";
          const status = message.startsWith("Add a Safaricom")
            ? 400
            : /configuration is missing|Set APP_URL|callback URL|MPESA_TRANSACTION_TYPE|MPESA_PARTY_B|MPESA_ENV|non-production/i.test(
                  message,
                )
              ? 503
              : 502;
          return json({ message }, { status });
        }
      }
      return json(
        {
          status: "pending",
          alreadyPending: purchase.alreadyPending,
          reference: purchase.reference,
          resource: purchase.resource,
        },
        { status: 202 },
      );
    }

    if (path === "/api/timeline" && request.method === "GET") {
      const session = await requireUser(request, env);
      if (!session)
        return json({ message: "Please sign in to view your learning timeline." }, { status: 401 });

      const url = new URL(request.url);
      const targetUserIdRaw = url.searchParams.get("userId");
      const targetUserId = targetUserIdRaw ? Number(targetUserIdRaw) : null;

      if (targetUserIdRaw && Number.isNaN(targetUserId)) {
        return json({ message: "Please provide a valid user id." }, { status: 400 });
      }

      return json(
        await listLearningTimelineEventsForViewer(
          session.user.id,
          session.user.role,
          targetUserId,
          env,
        ),
      );
    }

    if (path === "/api/classes" && request.method === "POST") {
      const session = await requireRole(request, env, ["admin"]);
      if (!session)
        return json(
          { message: "Only an administrator can create and assign classes." },
          { status: 401 },
        );

      const body = await readJson(request);
      const subject = cleanText(body.subject);
      const grade = cleanText(body.grade);
      const scheduleDays = Array.isArray(body.scheduleDays)
        ? [...new Set(body.scheduleDays.map(Number))]
        : [];
      const startTime = typeof body.startTime === "string" ? body.startTime : "";
      const seatsTotal = Number(body.seatsTotal ?? 0);
      const priceKes = Number(body.priceKes ?? 0);

      if (
        !subject ||
        !grade ||
        !scheduleDays.length ||
        scheduleDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
        !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
        seatsTotal <= 0 ||
        priceKes < 0
      ) {
        return json({ message: "Please provide valid class details." }, { status: 400 });
      }

      const tutorUserId = Number(body.tutorUserId);
      const tutor = (await listUsers(env)).find(
        (candidate) =>
          candidate.id === tutorUserId && candidate.role === "tutor" && candidate.isActive,
      );
      if (!tutor) return json({ message: "Please select an approved tutor." }, { status: 400 });
      const liveClass = await createLiveClass(
        {
          subject,
          grade,
          scheduleDays,
          startTime,
          seatsTotal,
          priceKes,
          tutorName: `${tutor.firstName} ${tutor.lastName}`,
          tutorUserId,
        },
        env,
      );

      try {
        await sendClassAssignmentEmail({
          email: tutor.email,
          firstName: tutor.firstName,
          subject: liveClass.subject,
          grade: liveClass.grade,
          scheduleLabel: liveClass.scheduleLabel,
        });
        return json({ class: liveClass, emailSent: true }, { status: 201 });
      } catch (error) {
        console.error("Class assignment email failed:", error);
        return json(
          {
            class: liveClass,
            emailSent: false,
            message: "Class was assigned, but the tutor notification email could not be sent.",
          },
          { status: 201 },
        );
      }
    }

    const classAdmin = path.match(/^\/api\/classes\/(\d+)$/);
    if (classAdmin && request.method === "PATCH") {
      const session = await requireRole(request, env, ["admin"]);
      if (!session) return json({ message: "Admin access required." }, { status: 401 });
      const id = Number(classAdmin[1]);
      if (!id) return json({ message: "Invalid class id." }, { status: 400 });
      const body = await readJson(request);
      const updates: {
        subject?: string;
        grade?: string;
        scheduleDays?: number[];
        startTime?: string;
        seatsTotal?: number;
        priceKes?: number;
        tutorUserId?: number;
        isActive?: boolean;
      } = {};
      if ("subject" in body) {
        const subject = cleanText(body.subject);
        if (!subject) return json({ message: "Subject cannot be empty." }, { status: 400 });
        updates.subject = subject;
      }
      if ("grade" in body) {
        const grade = cleanText(body.grade);
        if (!grade) return json({ message: "Grade cannot be empty." }, { status: 400 });
        updates.grade = grade;
      }
      if ("scheduleDays" in body || "startTime" in body) {
        const scheduleDays = Array.isArray(body.scheduleDays)
          ? [...new Set(body.scheduleDays.map(Number))]
          : null;
        const startTime = typeof body.startTime === "string" ? body.startTime : "";
        if (
          !scheduleDays?.length ||
          scheduleDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
          !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(startTime)
        ) {
          return json(
            { message: "Choose at least one weekday and a valid start time." },
            { status: 400 },
          );
        }
        updates.scheduleDays = scheduleDays;
        updates.startTime = startTime;
      }
      if ("seatsTotal" in body) {
        const seatsTotal = Number(body.seatsTotal);
        if (!Number.isSafeInteger(seatsTotal) || seatsTotal < 1)
          return json({ message: "Seats total must be a positive whole number." }, { status: 400 });
        updates.seatsTotal = seatsTotal;
      }
      if ("priceKes" in body) {
        const priceKes = Number(body.priceKes);
        if (!Number.isSafeInteger(priceKes) || priceKes < 0)
          return json({ message: "Price must be a non-negative whole number." }, { status: 400 });
        updates.priceKes = priceKes;
      }
      if ("tutorUserId" in body) {
        const tutorUserId = Number(body.tutorUserId);
        if (!Number.isSafeInteger(tutorUserId) || tutorUserId < 1)
          return json({ message: "Please select a valid tutor." }, { status: 400 });
        updates.tutorUserId = tutorUserId;
      }
      if ("isActive" in body) {
        if (typeof body.isActive !== "boolean")
          return json({ message: "Class active status must be true or false." }, { status: 400 });
        updates.isActive = body.isActive;
      }
      if (!Object.keys(updates).length)
        return json({ message: "No updates provided." }, { status: 400 });
      if (
        updates.tutorUserId !== undefined &&
        !(await listUsers(env)).some(
          (candidate) =>
            candidate.id === updates.tutorUserId &&
            candidate.role === "tutor" &&
            candidate.isActive,
        )
      ) {
        return json({ message: "Please select an approved tutor." }, { status: 400 });
      }
      const previousTutorUserId =
        updates.tutorUserId === undefined ? null : await getClassTutorUserId(id, env);
      const liveClass = await patchLiveClass(id, updates, env);
      if (!liveClass) return json({ message: "Class not found." }, { status: 404 });
      if (updates.tutorUserId !== undefined && updates.tutorUserId !== previousTutorUserId) {
        const tutor = (await listUsers(env)).find(
          (candidate) => candidate.id === updates.tutorUserId,
        );
        if (tutor) {
          try {
            await sendClassAssignmentEmail({
              email: tutor.email,
              firstName: tutor.firstName,
              subject: liveClass.subject,
              grade: liveClass.grade,
              scheduleLabel: liveClass.scheduleLabel,
            });
            return json({ class: liveClass, emailSent: true });
          } catch (error) {
            console.error("Class reassignment email failed:", error);
            return json({
              class: liveClass,
              emailSent: false,
              message: "Class was reassigned, but the tutor notification email could not be sent.",
            });
          }
        }
      }
      return json({ class: liveClass });
    }

    if (classAdmin && request.method === "DELETE") {
      const session = await requireRole(request, env, ["admin"]);
      if (!session) return json({ message: "Admin access required." }, { status: 401 });
      const deleted = await deleteLiveClass(Number(classAdmin[1]), env);
      if (!deleted) return json({ message: "Class not found." }, { status: 404 });
      return json({ ok: true });
    }

    if (path === "/api/assignments" && request.method === "POST") {
      const session = await requireUser(request, env);
      if (!session)
        return json({ message: "Please sign in to request assignment help." }, { status: 401 });

      const body = await readJson(request);
      const title = cleanText(body.title);
      const description = cleanText(body.description);
      const grade = cleanText(body.grade);
      const subject = cleanText(body.subject);
      const fileName = cleanText(body.fileName);
      const classIdRaw = body.classId;
      const classId = classIdRaw ? Number(classIdRaw) : null;

      if (!title || !description) {
        return json(
          { message: "Please provide a title and description for your request." },
          { status: 400 },
        );
      }

      const assignment = await createAssignmentRequest(
        {
          userId: session.user.id,
          classId,
          title,
          description,
          fileName: fileName || null,
        },
        env,
      );

      return json({ assignment }, { status: 201 });
    }

    if (path === "/api/admin/resources" && request.method === "POST") {
      const session = await requireRole(request, env, ["admin"]);
      if (!session) return json({ message: "Admin access required." }, { status: 401 });
      const ct = request.headers.get("content-type") ?? "";
      if (ct.startsWith("multipart/form-data")) {
        const contentLength = Number(request.headers.get("content-length"));
        if (Number.isFinite(contentLength) && contentLength > 26 * 1024 * 1024)
          return json({ message: "Resource files must be 25 MB or smaller." }, { status: 413 });
        const form = await request.formData();
        const title = cleanText(form.get("title"));
        const description = cleanText(form.get("description"));
        const grade = cleanText(form.get("grade"));
        const subject = cleanText(form.get("subject"));
        const priceKes = Number(form.get("priceKes") ?? 0);
        const fileEntry = form.get("file");
        const file = fileEntry && typeof fileEntry !== "string" ? fileEntry : null;
        if (!title || !file || typeof file.arrayBuffer !== "function")
          return json({ message: "Title and file are required." }, { status: 400 });
        if (!subject)
          return json(
            { message: "Enter a subject so learners can filter this resource." },
            { status: 400 },
          );
        if (!Number.isFinite(priceKes) || priceKes < 0)
          return json({ message: "Enter a valid resource price." }, { status: 400 });
        if (file.size === 0)
          return json({ message: "The selected file is empty." }, { status: 400 });
        if (file.size > 25 * 1024 * 1024)
          return json({ message: "Resource files must be 25 MB or smaller." }, { status: 413 });

        let storedFilePath: string | null = null;
        const bucket = resourceBucket(env);
        try {
          const submittedName =
            typeof file.name === "string" && file.name ? file.name : "upload.bin";
          const originalName = resourceFileName(submittedName).replace(/[^a-zA-Z0-9._-]/g, "_");
          const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${originalName || "upload.bin"}`;
          storedFilePath = `uploads/${filename}`;
          const arrayBuffer = await file.arrayBuffer();
          if (bucket) {
            await bucket.put(storedFilePath, arrayBuffer, {
              httpMetadata: { contentType: file.type || "application/octet-stream" },
            });
          } else {
            const uploadDir = resourceUploadDirectory();
            await fs.mkdir(uploadDir, { recursive: true });
            await fs.writeFile(`${uploadDir}${nodePath.sep}${filename}`, Buffer.from(arrayBuffer));
          }
          const resource = await createResource(
            {
              title,
              description,
              grade,
              subject,
              priceKes,
              filePath: storedFilePath,
              uploaderUserId: session.user.id,
            },
            env,
          );
          return json({ resource }, { status: 201 });
        } catch (error) {
          console.error("Resource upload failed:", error);
          if (storedFilePath) {
            try {
              if (bucket) await bucket.delete(storedFilePath);
              else
                await fs.unlink(
                  nodePath.join(resourceUploadDirectory(), resourceFileName(storedFilePath)),
                );
            } catch {
              // Keep the original failure as the actionable error.
            }
          }
          return json(
            {
              message: bucket
                ? "Could not save the resource to object storage or register it in the database."
                : "Could not save the resource. Check that persistent uploads storage is writable and the database is available.",
            },
            { status: 500 },
          );
        }
      }

      const body = await readJson(request);
      const title = cleanText(body.title);
      const description = cleanText(body.description ?? "");
      const grade = cleanText(body.grade);
      const subject = cleanText(body.subject);
      const priceKes = Number(body.priceKes ?? 0);
      const filePath = cleanText(body.filePath ?? "");
      if (!title || !filePath || !subject)
        return json({ message: "Title, subject and filePath are required." }, { status: 400 });
      if (!Number.isFinite(priceKes) || priceKes < 0)
        return json({ message: "Enter a valid resource price." }, { status: 400 });
      const resource = await createResource(
        { title, description, grade, subject, priceKes, filePath, uploaderUserId: session.user.id },
        env,
      );
      return json({ resource }, { status: 201 });
    }

    if (path === "/api/resources" && request.method === "GET") {
      const resources = await listPublishedResources(env);
      return json({
        resources: resources.map(
          ({ id, title, description, grade, subject, priceKes, createdAt }) => ({
            id,
            title,
            description,
            grade,
            subject,
            priceKes,
            createdAt,
          }),
        ),
      });
    }

    if (path === "/api/resources/purchased" && request.method === "GET") {
      const session = await requireRole(request, env, ["learner", "tutor"]);
      if (!session)
        return json(
          { message: "Please sign in as a learner or tutor to view your resources." },
          { status: 401 },
        );
      return json({ resources: await listPurchasedResources(session.user.id, env) });
    }

    const resourceIdMatch = path.match(/^\/api\/resources\/(\d+)(?:\/(download|purchase))?$/);
    if (resourceIdMatch) {
      const resourceId = Number(resourceIdMatch[1]);
      const action = resourceIdMatch[2] ?? null;
      if (!action && request.method === "GET") {
        const resource = await findResourceById(resourceId, env);
        if (!resource) return json({ message: "Resource not found." }, { status: 404 });
        const { id, title, description, grade, subject, priceKes, createdAt } = resource;
        return json({ resource: { id, title, description, grade, subject, priceKes, createdAt } });
      }

      if (action === "purchase" && request.method === "POST") {
        return json(
          { message: "Use the M-Pesa checkout to purchase this resource." },
          { status: 410 },
        );
      }

      if (action === "download" && request.method === "GET") {
        const session = await requireUser(request, env);
        if (!session) return json({ message: "Sign in to download resources." }, { status: 401 });
        const resource = await findResourceById(resourceId, env);
        if (!resource) return json({ message: "Resource not found." }, { status: 404 });
        const isAdmin = session.user.role === "admin";
        const isPurchasingRole = session.user.role === "learner" || session.user.role === "tutor";
        const purchased = isPurchasingRole && (await hasPurchasedResource(session.user.id, resourceId, env));
        if (!isAdmin && resource.priceKes > 0 && !purchased)
          return json({ message: "Purchase required to download this resource." }, { status: 403 });

        const fp = typeof resource.filePath === "string" ? resource.filePath : "";
        if (!fp) return json({ message: "Resource file is unavailable." }, { status: 404 });
        if (fp.startsWith("data:")) {
          const separator = fp.indexOf(",");
          if (separator < 0)
            return json({ message: "Resource file is unavailable." }, { status: 404 });
          const metadata = fp.slice(5, separator);
          const encodedContent = fp.slice(separator + 1);
          const isBase64 = metadata.split(";").some((part) => part.toLowerCase() === "base64");
          const contentType = metadata.split(";")[0];
          let content: Buffer;
          try {
            content = isBase64
              ? Buffer.from(encodedContent, "base64")
              : Buffer.from(decodeURIComponent(encodedContent));
          } catch (error) {
            console.error("Resource data URL could not be decoded:", error);
            return json({ message: "Could not read resource file." }, { status: 500 });
          }
          const safeContentType =
            contentType && /^[\w.+-]+\/[\w.+-]+$/.test(contentType)
              ? contentType
              : "application/octet-stream";
          const filename =
            resourceFileName(resource.title).replace(/[^a-zA-Z0-9._-]/g, "_") || "resource";
          return new Response(content, {
            status: 200,
            headers: {
              "content-type": safeContentType,
              "content-disposition": `attachment; filename="${filename}"`,
            },
          });
        }

        const bucket = resourceBucket(env);
        if (bucket && fp.startsWith("uploads/")) {
          const object = await bucket.get(fp);
          if (!object) return json({ message: "Resource file is unavailable." }, { status: 404 });
          return new Response(object.body, {
            status: 200,
            headers: {
              "content-type":
                resourceContentType(fp) !== "application/octet-stream"
                  ? resourceContentType(fp)
                  : (object.httpMetadata?.contentType ?? "application/octet-stream"),
              "content-disposition": `attachment; filename="${resourceFileName(fp).replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
            },
          });
        }

        const resolvedPath = resolveResourceFilePath(fp);
        if (!resolvedPath)
          return json({ message: "Resource file is unavailable." }, { status: 404 });

        try {
          const buffer = await fs.readFile(resolvedPath);
          return new Response(buffer, {
            status: 200,
            headers: {
              "content-type": resourceContentType(resolvedPath),
              "content-disposition": `attachment; filename="${resourceFileName(resolvedPath)}"`,
            },
          });
        } catch (err) {
          const code = (err as NodeJS.ErrnoException).code;
          if (code === "ENOENT" && fp.startsWith("uploads/")) {
            const legacyName = `uploadsundefined${resourceFileName(fp)}`;
            const legacyPath = nodePath.resolve(process.cwd(), "public", legacyName);
            try {
              const buffer = await fs.readFile(legacyPath);
              return new Response(buffer, {
                status: 200,
                headers: {
                  "content-type": resourceContentType(fp),
                  "content-disposition": `attachment; filename="${resourceFileName(fp)}"`,
                },
              });
            } catch (legacyError) {
              const legacyCode = (legacyError as NodeJS.ErrnoException).code;
              if (legacyCode !== "ENOENT") {
                console.error("Legacy resource file read failed:", legacyError);
                return json({ message: "Could not read resource file." }, { status: 500 });
              }
            }
            return json({ message: "Resource file is unavailable." }, { status: 404 });
          }
          console.error("Resource file read failed:", err);
          return json({ message: "Could not read resource file." }, { status: 500 });
        }
      }
    }

    if (path === "/api/assignments" && request.method === "GET") {
      const session = await requireUser(request, env);
      if (!session)
        return json(
          { message: "Please sign in to view your assignment requests." },
          { status: 401 },
        );
      return json({ assignments: await listAssignmentRequestsForUser(session.user.id, env) });
    }

    if (path === "/api/assignments/tutor" && request.method === "GET") {
      const session = await requireRole(request, env, ["tutor"]);
      if (!session) return json({ message: "Tutor access required." }, { status: 401 });
      return json({ assignments: await listAssignmentRequestsForTutor(session.user.id, env) });
    }

    if (path === "/api/assignments/review" && request.method === "POST") {
      const session = await requireRole(request, env, ["tutor"]);
      if (!session) return json({ message: "Tutor access required." }, { status: 401 });

      const body = await readJson(request);
      const assignmentId = Number(body.assignmentId);
      const status = cleanText(body.status) || "reviewed";
      const grade = body.grade != null ? Number(body.grade) : null;
      const feedback = cleanText(body.feedback);

      if (!assignmentId || !["submitted", "reviewed", "completed"].includes(status)) {
        return json(
          { message: "Please provide a valid assignment review payload." },
          { status: 400 },
        );
      }

      const assignment = await reviewAssignmentRequest(
        assignmentId,
        session.user.id,
        status,
        grade,
        feedback,
        env,
      );

      if (!assignment) {
        return json(
          { message: "Assignment not found or you are not authorized to review it." },
          { status: 404 },
        );
      }

      return json({ assignment });
    }

    if (path === "/api/learning/progress" && request.method === "GET") {
      const session = await requireUser(request, env);
      if (!session) return json({ message: "Please sign in to view progress." }, { status: 401 });
      return json({ progress: await getLearningProgress(session.user.id, session.user.role, env) });
    }

    if (path === "/api/attendance" && request.method === "GET") {
      const session = await requireRole(request, env, ["learner", "tutor"]);
      if (!session) return json({ message: "Learner or tutor access required." }, { status: 401 });
      const url = new URL(request.url);
      const limitValue = Number(url.searchParams.get("limit") ?? 100);
      const offsetValue = Number(url.searchParams.get("offset") ?? 0);
      if (
        !Number.isSafeInteger(limitValue) ||
        limitValue < 1 ||
        limitValue > 200 ||
        !Number.isSafeInteger(offsetValue) ||
        offsetValue < 0
      ) {
        return json({ message: "Attendance pagination values are invalid." }, { status: 400 });
      }
      const classIdValue = url.searchParams.get("classId");
      const classId = classIdValue === null ? null : Number(classIdValue);
      const roomIdValue = url.searchParams.get("roomId");
      const roomId = roomIdValue === null ? null : Number(roomIdValue);
      if (
        (classId !== null && (!Number.isSafeInteger(classId) || classId < 1)) ||
        (roomId !== null && (!Number.isSafeInteger(roomId) || roomId < 1))
      ) {
        return json({ message: "Valid class and session ids are required." }, { status: 400 });
      }
      return json(
        await getAttendanceReport(
          session.user.id,
          session.user.role,
          limitValue,
          offsetValue,
          env,
          classId,
          roomId,
        ),
      );
    }

    if (path === "/api/attendance/classes" && request.method === "GET") {
      const session = await requireRole(request, env, ["learner", "tutor"]);
      if (!session) return json({ message: "Learner or tutor access required." }, { status: 401 });
      return json({
        classes: await getAttendanceClasses(session.user.id, session.user.role, env),
      });
    }

    if (path === "/api/learning/assignments" && request.method === "GET") {
      const session = await requireRole(request, env, ["learner", "tutor"]);
      if (!session) return json({ message: "Learner or tutor access required." }, { status: 401 });
      const assignments =
        session.user.role === "tutor"
          ? await listAssignmentsForTutor(session.user.id, env)
          : await listAssignmentsForLearner(session.user.id, env);
      return json({ assignments });
    }

    if (path === "/api/learning/assignments" && request.method === "POST") {
      const session = await requireRole(request, env, ["tutor"]);
      if (!session) return json({ message: "Tutor access required." }, { status: 401 });
      const body = await readJson(request);
      const classId = Number(body.classId);
      const targetLearnerId =
        body.targetLearnerId === undefined ||
        body.targetLearnerId === null ||
        body.targetLearnerId === ""
          ? null
          : Number(body.targetLearnerId);
      const title = cleanText(body.title);
      const instructions = cleanText(body.instructions);
      if (
        !Number.isSafeInteger(classId) ||
        classId <= 0 ||
        !title ||
        !instructions ||
        (targetLearnerId !== null &&
          (!Number.isSafeInteger(targetLearnerId) || targetLearnerId <= 0))
      )
        return json(
          { message: "Choose a class, valid learner (if individual), title and instructions." },
          { status: 400 },
        );
      const assignment = await createTutorAssignment(
        {
          classId,
          tutorId: session.user.id,
          targetLearnerId,
          title,
          instructions,
          dueAt: cleanText(body.dueAt) || null,
          attachments: body.attachments,
        },
        env,
      );
      if (!assignment)
        return json(
          { message: "Choose your own class and, for individual work, a learner enrolled in it." },
          { status: 403 },
        );
      return json({ assignment }, { status: 201 });
    }

    const tutorAssignment = path.match(/^\/api\/learning\/assignments\/(\d+)$/);
    if (tutorAssignment && request.method === "PATCH") {
      const session = await requireRole(request, env, ["tutor"]);
      if (!session) return json({ message: "Tutor access required." }, { status: 401 });
      const assignmentId = Number(tutorAssignment[1]);
      const body = await readJson(request);
      const title = cleanText(body.title);
      const instructions = cleanText(body.instructions);
      if (!Number.isSafeInteger(assignmentId) || assignmentId <= 0 || !title || !instructions) {
        return json(
          { message: "Provide a valid title and assignment instructions." },
          { status: 400 },
        );
      }
      const assignment = await updateTutorAssignment(
        {
          assignmentId,
          tutorId: session.user.id,
          title,
          instructions,
          dueAt: cleanText(body.dueAt) || null,
          ...(Object.hasOwn(body, "attachments") ? { attachments: body.attachments } : {}),
        },
        env,
      );
      if (!assignment)
        return json({ message: "Assignment not found or not assigned by you." }, { status: 404 });
      return json({ assignmentId: assignment });
    }

    if (tutorAssignment && request.method === "DELETE") {
      const session = await requireRole(request, env, ["tutor"]);
      if (!session) return json({ message: "Tutor access required." }, { status: 401 });
      const assignmentId = Number(tutorAssignment[1]);
      if (!Number.isSafeInteger(assignmentId) || assignmentId <= 0)
        return json({ message: "Invalid assignment." }, { status: 400 });
      const assignment = await setTutorAssignmentWithdrawn(
        assignmentId,
        session.user.id,
        true,
        env,
      );
      if (!assignment)
        return json({ message: "Assignment not found or not assigned by you." }, { status: 404 });
      return json({ assignmentId: assignment });
    }

    const restoreAssignment = path.match(/^\/api\/learning\/assignments\/(\d+)\/restore$/);
    if (restoreAssignment && request.method === "POST") {
      const session = await requireRole(request, env, ["tutor"]);
      if (!session) return json({ message: "Tutor access required." }, { status: 401 });
      const assignmentId = Number(restoreAssignment[1]);
      if (!Number.isSafeInteger(assignmentId) || assignmentId <= 0)
        return json({ message: "Invalid assignment." }, { status: 400 });
      const assignment = await setTutorAssignmentWithdrawn(
        assignmentId,
        session.user.id,
        false,
        env,
      );
      if (!assignment)
        return json({ message: "Assignment not found or not assigned by you." }, { status: 404 });
      return json({ assignmentId: assignment });
    }

    const submission = path.match(/^\/api\/learning\/assignments\/(\d+)\/submit$/);
    if (submission && request.method === "POST") {
      const session = await requireRole(request, env, ["learner"]);
      if (!session) return json({ message: "Learner access required." }, { status: 401 });
      const body = await readJson(request);
      const result = await submitAssignment(
        session.user.id,
        Number(submission[1]),
        cleanText(body.response),
        body.attachments,
        env,
      );
      if (!result)
        return json(
          { message: "This assignment is not available to your account." },
          { status: 403 },
        );
      return json({ submission: result }, { status: 201 });
    }

    if (path === "/api/learning/submissions/grade" && request.method === "POST") {
      const session = await requireRole(request, env, ["tutor"]);
      if (!session) return json({ message: "Tutor access required." }, { status: 401 });
      const body = await readJson(request);
      const submissionId = Number(body.submissionId);
      const grade = Number(body.grade);
      if (!submissionId || !Number.isFinite(grade) || grade < 0 || grade > 100)
        return json({ message: "Provide a grade from 0 to 100." }, { status: 400 });
      const result = await gradeAssignmentSubmission(
        session.user.id,
        submissionId,
        grade,
        cleanText(body.feedback),
        env,
      );
      if (!result)
        return json({ message: "Submission not found or not assigned to you." }, { status: 404 });
      return json({ submissionId: result });
    }

    if (path.startsWith("/api/admin")) {
      const session = await requireRole(request, env, ["admin"]);
      if (!session) return json({ message: "Admin access required." }, { status: 401 });

      if (path === "/api/admin/users" && request.method === "GET") {
        return json({ users: await listUsers(env) });
      }

      const customServiceSchedule = path.match(/^\/api\/admin\/service-requests\/(\d+)\/schedule$/);
      if (customServiceSchedule && request.method === "POST") {
        const requestId = Number(customServiceSchedule[1]);
        const body = await readJson(request);
        const schedules = Array.isArray(body.schedules)
          ? body.schedules.map((entry) => ({
              subject: typeof entry?.subject === "string" ? cleanText(entry.subject) : "",
              tutorUserId: Number(entry?.tutorUserId),
              scheduledAt: typeof entry?.scheduledAt === "string" ? entry.scheduledAt : "",
            }))
          : [];
        if (
          !Number.isSafeInteger(requestId) ||
          requestId < 1 ||
          !schedules.length ||
          schedules.some(
            (entry) =>
              !entry.subject ||
              !Number.isSafeInteger(entry.tutorUserId) ||
              entry.tutorUserId < 1 ||
              !Number.isFinite(Date.parse(entry.scheduledAt)),
          )
        ) {
          return json(
            { message: "Provide valid lesson subjects, tutors, and times." },
            { status: 400 },
          );
        }
        let scheduled: Awaited<ReturnType<typeof scheduleCustomServiceRequest>>;
        try {
          scheduled = await scheduleCustomServiceRequest(
            requestId,
            session.user.id,
            schedules,
            env,
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Could not save lesson schedule.";
          return json({ message }, { status: 400 });
        }
        if (!scheduled) return json({ message: "Paid lesson request not found." }, { status: 404 });

        const serviceName = `${
          scheduled.serviceType === "one_on_one" ? "one-on-one classes" : "homework help"
        } (${scheduled.grade})`;
        const emailErrors: string[] = [];
        try {
          await sendCustomServiceLearnerScheduleEmail({
            to: scheduled.learnerEmail,
            firstName: scheduled.learnerFirstName,
            serviceName,
            schedules: scheduled.schedules,
          });
        } catch (error) {
          console.error("Could not email learner custom schedule.", error);
          emailErrors.push("learner");
        }

        const tutorSchedules = new Map<number, typeof scheduled.schedules>();
        for (const schedule of scheduled.schedules) {
          const assigned = tutorSchedules.get(schedule.tutorUserId) ?? [];
          assigned.push(schedule);
          tutorSchedules.set(schedule.tutorUserId, assigned);
        }
        for (const [tutorUserId, tutorLessons] of tutorSchedules) {
          const tutor = tutorLessons[0];
          try {
            await sendCustomServiceTutorAssignmentEmail({
              to: tutor.tutorEmail,
              firstName: tutor.tutorFirstName,
              learnerName: scheduled.learnerName,
              learnerEmail: scheduled.learnerEmail,
              serviceName,
              schedules: tutorLessons,
            });
          } catch (error) {
            console.error(`Could not email tutor ${tutorUserId} custom assignment.`, error);
            emailErrors.push(`tutor:${tutorUserId}`);
          }
        }

        const scheduleSummary = scheduled.schedules
          .map(
            (item) =>
              `${item.subject}: ${new Date(item.scheduledAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" })}`,
          )
          .join("; ");
        const notificationResults = await Promise.allSettled([
          createUserNotification(
            scheduled.learnerUserId,
            {
              eventType: "custom_service_scheduled",
              title: "Your custom classes are scheduled",
              description: scheduleSummary,
              subject: scheduled.subjects.join(", "),
              course: serviceName,
              metadata: { requestId, schedules: scheduled.schedules },
            },
            env,
          ),
          ...[...tutorSchedules].map(([tutorUserId, tutorLessons]) =>
            createUserNotification(
              tutorUserId,
              {
                eventType: "custom_service_assigned",
                title: "Custom learner sessions assigned",
                description: `${scheduled.learnerName}: ${tutorLessons
                  .map(
                    (item) =>
                      `${item.subject} on ${new Date(item.scheduledAt).toLocaleString("en-KE", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Nairobi" })}`,
                  )
                  .join(", ")}.`,
                subject: tutorLessons.map((item) => item.subject).join(", "),
                course: serviceName,
                metadata: { requestId, learnerUserId: scheduled.learnerUserId },
              },
              env,
            ),
          ),
        ]);
        const notificationErrors = notificationResults.filter(
          (result) => result.status === "rejected",
        );
        for (const result of notificationErrors) {
          if (result.status === "rejected")
            console.error("Could not create custom lesson schedule notification.", result.reason);
        }
        return json({
          scheduled: true,
          emailSent: emailErrors.length === 0,
          notificationsSent: notificationErrors.length === 0,
          message:
            emailErrors.length || notificationErrors.length
              ? "Schedule saved, but one or more notifications could not be delivered."
              : undefined,
        });
      }

      const resourceAdmin = path.match(/^\/api\/admin\/resources\/(\d+)$/);
      if (resourceAdmin && request.method === "PATCH") {
        const id = Number(resourceAdmin[1]);
        const body = await readJson(request);
        const title = cleanText(body.title);
        const description = cleanText(body.description);
        const grade = cleanText(body.grade);
        const subject = cleanText(body.subject);
        const priceKes = Number(body.priceKes);
        if (!title || !Number.isSafeInteger(priceKes) || priceKes < 0) {
          return json(
            { message: "Provide a title and a valid non-negative whole-number price." },
            { status: 400 },
          );
        }
        const resource = await updateResource(
          id,
          { title, description, grade, subject, priceKes },
          env,
        );
        if (!resource) return json({ message: "Resource not found." }, { status: 404 });
        return json({ resource });
      }

      if (resourceAdmin && request.method === "DELETE") {
        const resource = await deleteResource(Number(resourceAdmin[1]), env);
        if (!resource) return json({ message: "Resource not found." }, { status: 404 });
        try {
          if (resource.filePath.startsWith("uploads/")) {
            const bucket = resourceBucket(env);
            if (bucket) await bucket.delete(resource.filePath);
            else {
              const filePath = resolveResourceFilePath(resource.filePath);
              if (filePath) await fs.unlink(filePath).catch(() => undefined);
            }
          }
        } catch (error) {
          console.error("Deleted resource file cleanup failed:", error);
        }
        return json({ ok: true });
      }

      if (path === "/api/admin/applications" && request.method === "GET") {
        return json({ applications: await listApplications(env) });
      }

      const applicationReview = path.match(/^\/api\/admin\/applications\/(\d+)\/(approve|reject)$/);
      if (applicationReview && request.method === "POST") {
        const outcome = await reviewApplication(
          Number(applicationReview[1]),
          applicationReview[2] as "approve" | "reject",
          session.user.id,
          env,
        );
        if (!outcome)
          return json(
            { message: "Application is no longer available for review." },
            { status: 404 },
          );
        if ("consentRequired" in outcome)
          return json(
            {
              message:
                "This application does not include recorded legal acceptance. The applicant must submit a new application before approval.",
            },
            { status: 409 },
          );
        try {
          if (outcome.user) {
            await sendApplicationApprovedEmail({
              ...outcome.user,
              subject: outcome.application.subject,
            });
          } else if (outcome.application.status === "rejected") {
            await sendApplicationRejectedEmail(outcome.application);
          }
        } catch (error) {
          console.error("Application decision email failed:", error);
          return json(
            {
              ...outcome,
              message:
                "Application status was updated, but the notification email could not be sent. Use resend approval email after checking email configuration.",
            },
            { status: 502 },
          );
        }
        return json({ ...outcome, emailSent: true });
      }

      const resendApproval = path.match(/^\/api\/admin\/applications\/(\d+)\/resend-approval$/);
      if (resendApproval && request.method === "POST") {
        const application = await findApplicationById(Number(resendApproval[1]), env);
        if (!application || application.status !== "approved") {
          return json(
            { message: "Only approved applications can have the access email resent." },
            { status: 400 },
          );
        }

        const user = await findUserByEmail(application.email, env);
        if (!user) {
          return json(
            { message: "Approved applicant user account no longer exists." },
            { status: 500 },
          );
        }

        try {
          await sendApplicationApprovedEmail({
            email: user.email,
            firstName: user.first_name,
            role: user.role,
            subject: application.subject,
          });
        } catch (error) {
          console.error("Approval email resend failed:", error);
          return json(
            {
              message:
                "The approval email could not be sent. Check the email provider configuration.",
            },
            { status: 502 },
          );
        }

        return json({ ok: true, emailSent: true });
      }

      if (path.match(/^\/api\/admin\/users\/(\d+)$/) && request.method === "PATCH") {
        const id = Number(path.split("/").pop());
        if (!id) return json({ message: "Invalid user id." }, { status: 400 });
        const body = await readJson(request);
        if ("isActive" in body) {
          if (typeof body.isActive !== "boolean")
            return json({ message: "Account status must be active or paused." }, { status: 400 });
          if (id === session.user.id)
            return json(
              { message: "You cannot pause your own administrator account." },
              { status: 400 },
            );
          const suspensionReason = cleanText(body.suspensionReason);
          if (!body.isActive && !suspensionReason)
            return json(
              { message: "Provide a reason for pausing this account during the investigation." },
              { status: 400 },
            );
          const user = await updateUserAccountStatus(
            id,
            body.isActive,
            body.isActive ? null : suspensionReason.slice(0, 500),
            env,
          );
          if (!user)
            return json(
              { message: "Only learner and tutor accounts can be paused or reactivated." },
              { status: 404 },
            );
          return json({ user });
        }
        const role = cleanText(body.role);
        if (!role || !["learner", "tutor", "admin"].includes(role)) {
          return json({ message: "Please provide a valid role." }, { status: 400 });
        }
        const user = await updateUserRole(id, role, env);
        return json({ user });
      }

      const conferencePermissions = path.match(
        /^\/api\/admin\/users\/(\d+)\/conference-permissions$/,
      );
      if (conferencePermissions && request.method === "PATCH") {
        const body = await readJson(request);
        const permissions = await updateConferencePermissions(
          Number(conferencePermissions[1]),
          {
            canUseWhiteboard: Boolean(body.canUseWhiteboard),
            canShareScreen: Boolean(body.canShareScreen),
          },
          env,
        );
        if (!permissions) return json({ message: "User not found." }, { status: 404 });
        return json({ permissions });
      }

      if (path.match(/^\/api\/admin\/users\/(\d+)$/) && request.method === "DELETE") {
        const id = Number(path.split("/").pop());
        if (!id) return json({ message: "Invalid user id." }, { status: 400 });
        await deleteUser(id, env);
        return json({ ok: true });
      }

      if (path === "/api/admin/payments" && request.method === "GET") {
        return json({ payments: await listPayments(env) });
      }

      if (path === "/api/admin/health" && request.method === "GET") {
        return json({ health: await getPlatformHealth(env) });
      }

      if (path === "/api/admin/reports" && request.method === "GET") {
        return json({ reports: await getAdminReports(env) });
      }

      if (path === "/api/admin/attendance" && request.method === "GET") {
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 200);
        const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
        if (!Number.isSafeInteger(limit) || !Number.isSafeInteger(offset)) {
          return json({ message: "Attendance pagination values are invalid." }, { status: 400 });
        }
        const classIdValue = url.searchParams.get("classId");
        const classId = classIdValue === null ? null : Number(classIdValue);
        const roomIdValue = url.searchParams.get("roomId");
        const roomId = roomIdValue === null ? null : Number(roomIdValue);
        if (
          (classId !== null && (!Number.isSafeInteger(classId) || classId < 1)) ||
          (roomId !== null && (!Number.isSafeInteger(roomId) || roomId < 1))
        ) {
          return json({ message: "Valid class and session ids are required." }, { status: 400 });
        }
        return json(await getAttendanceReport(null, "admin", limit, offset, env, classId, roomId));
      }
      if (path === "/api/admin/attendance/classes" && request.method === "GET") {
        return json({ classes: await getAttendanceClasses(null, "admin", env) });
      }

      if (path === "/api/admin/active-conferences" && request.method === "GET") {
        return json({ conferences: await listActiveConferences(env) });
      }

      if (path.match(/^\/api\/admin\/conference-logs/) && request.method === "GET") {
        const url = new URL(request.url);
        const limit = Number(url.searchParams.get("limit") ?? "200");
        return json({ logs: await listConferenceLogs(limit, env) });
      }

      return json({ message: "Admin endpoint not found." }, { status: 404 });
    }

    if (path.startsWith("/api/admin")) {
      const session = await requireRole(request, env, ["admin"]);
      if (!session) return json({ message: "Admin access required." }, { status: 401 });
      if (path === "/api/admin/users" && request.method === "GET") {
        return json({ users: await listUsers(env) });
      }
      if (path === "/api/admin/applications" && request.method === "GET") {
        return json({ applications: await listApplications(env) });
      }
      if (path === "/api/admin/payments" && request.method === "GET") {
        return json({ payments: await listPayments(env) });
      }
      if (path === "/api/admin/health" && request.method === "GET") {
        return json({ health: await getPlatformHealth(env) });
      }
      if (path === "/api/admin/reports" && request.method === "GET") {
        return json({ reports: await getAdminReports(env) });
      }
      if (path === "/api/admin/attendance" && request.method === "GET") {
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 100), 1), 200);
        const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
        if (!Number.isSafeInteger(limit) || !Number.isSafeInteger(offset)) {
          return json({ message: "Attendance pagination values are invalid." }, { status: 400 });
        }
        const classIdValue = url.searchParams.get("classId");
        const classId = classIdValue === null ? null : Number(classIdValue);
        const roomIdValue = url.searchParams.get("roomId");
        const roomId = roomIdValue === null ? null : Number(roomIdValue);
        if (
          (classId !== null && (!Number.isSafeInteger(classId) || classId < 1)) ||
          (roomId !== null && (!Number.isSafeInteger(roomId) || roomId < 1))
        ) {
          return json({ message: "Valid class and session ids are required." }, { status: 400 });
        }
        return json(await getAttendanceReport(null, "admin", limit, offset, env, classId, roomId));
      }
      if (path === "/api/admin/attendance/classes" && request.method === "GET") {
        return json({ classes: await getAttendanceClasses(null, "admin", env) });
      }
      if (path === "/api/admin/active-conferences" && request.method === "GET") {
        return json({ conferences: await listActiveConferences(env) });
      }
      if (path.startsWith("/api/admin/conference-logs") && request.method === "GET") {
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 200), 1), 200);
        return json({ logs: await listConferenceLogs(limit, env) });
      }
      const userPath = path.match(/^\/api\/admin\/users\/(\d+)$/);
      if (userPath && request.method === "PATCH") {
        const body = await readJson(request);
        const role = cleanText(body.role);
        if (!["learner", "tutor", "admin"].includes(role)) {
          return json({ message: "Please provide a valid role." }, { status: 400 });
        }
        const user = await updateUserRole(Number(userPath[1]), role, env);
        if (!user) return json({ message: "User not found." }, { status: 404 });
        return json({ user });
      }
      if (userPath && request.method === "DELETE") {
        await deleteUser(Number(userPath[1]), env);
        return json({ ok: true });
      }
      return json({ message: "Admin endpoint not found." }, { status: 404 });
    }

    const conferenceJoin = path.match(/^\/api\/conferences\/(\d+)\/join$/);
    if (conferenceJoin && request.method === "POST") {
      const session = await requireRole(request, env, ["learner", "tutor", "admin"]);
      if (!session)
        return json({ message: "Please sign in to join the live class." }, { status: 401 });

      const classId = Number(conferenceJoin[1]);
      const classSessionRaw = url.searchParams.get("sessionId");
      const classSessionId = classSessionRaw === null ? null : Number(classSessionRaw);
      if (
        classSessionId !== null &&
        (!Number.isSafeInteger(classSessionId) || classSessionId < 1)
      ) {
        return json({ message: "Please select a valid class session." }, { status: 400 });
      }
      const activeRoomId =
        classSessionId === null
          ? await getActiveRoomIdForClass(classId, env)
          : await getActiveRoomIdForSession(classSessionId, env);
      if (
        (session.user.role === "tutor" || session.user.role === "admin") &&
        (!activeRoomId || classSessionId !== null)
      ) {
        if (classSessionId === null) {
          if (!activeRoomId) {
            return json(
              { message: "Select a scheduled class session before starting a live room." },
              { status: 400 },
            );
          }
        } else {
          const startStatus = await getClassSessionStartStatus(classId, classSessionId, env);
          if (!startStatus)
            return json({ message: "Scheduled class session not found." }, { status: 404 });
          if (!startStatus.isActive && !isClassSessionStartAllowed(startStatus.scheduledAt)) {
            const opensAt = new Date(
              Date.parse(startStatus.scheduledAt) - CLASS_SESSION_START_WINDOW_MS,
            );
            return json(
              {
                message: `This session can only be started from ${opensAt.toLocaleString("en-KE", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Africa/Nairobi",
                })} (5 minutes before its scheduled time).`,
              },
              { status: 409 },
            );
          }
        }
      }
      if (session.user.role === "learner") {
        const hasBooking =
          classSessionId === null
            ? await hasClassBooking(session.user.id, classId, env)
            : await hasClassSessionBooking(session.user.id, classSessionId, env);
        if (!hasBooking) {
          return json(
            { message: "Book this dated class session before joining the live room." },
            { status: 403 },
          );
        }
        if (!activeRoomId) {
          return json(
            { message: "The tutor has not started a live session yet." },
            { status: 409 },
          );
        }
        const paymentAccess = await getClassSessionPaymentStatus(
          session.user.id,
          classId,
          activeRoomId,
          env,
        );
        if (!paymentAccess) {
          return json({ message: "This live session is no longer available." }, { status: 409 });
        }
        if (paymentAccess.requiresPayment && !paymentAccess.paid) {
          return json(
            {
              message: "Pay for this session to join. Each class payment covers one live session.",
              requiresPayment: true,
              amountKes: paymentAccess.amountKes,
            },
            { status: 402 },
          );
        }
      }

      // A tutor may only enter rooms assigned to their profile, whether they are
      // creating the room or joining an already-running lesson.
      if (
        session.user.role === "tutor" &&
        !(await canTutorStartClass(classId, session.user.id, env))
      ) {
        return json(
          { message: "You can only start classes assigned to your profile." },
          { status: 403 },
        );
      }
      if (!activeRoomId && session.user.role !== "tutor" && session.user.role !== "admin") {
        return json(
          { message: "Only the class tutor or an administrator can start this live session." },
          { status: 403 },
        );
      }

      const conference = await startConference(
        classId,
        session.user.id,
        session.sessionId,
        session.user.role,
        env,
        classSessionId,
      );
      if (!conference) return json({ message: "Class not found." }, { status: 404 });
      return json(conference);
    }

    const conferenceParticipants = path.match(/^\/api\/conferences\/(\d+)\/participants$/);
    if (conferenceParticipants && request.method === "GET") {
      const session = await requireRole(request, env, ["tutor", "admin"]);
      if (!session) return json({ message: "Tutor or admin access required." }, { status: 401 });
      return json({
        participants: await listConferenceParticipants(Number(conferenceParticipants[1]), env),
      });
    }

    const conferencePermissions = path.match(/^\/api\/conferences\/(\d+)\/permissions$/);
    if (conferencePermissions && request.method === "GET") {
      const session = await requireRole(request, env, ["learner", "tutor", "admin"]);
      if (!session) return json({ message: "Please sign in." }, { status: 401 });
      const permissions = await getRoomConferencePermissions(
        Number(conferencePermissions[1]),
        session.user.id,
        env,
      );
      return json({ permissions });
    }

    const conferenceWhiteboard = path.match(/^\/api\/conferences\/(\d+)\/whiteboard$/);
    const conferenceWhiteboardState = path.match(/^\/api\/conferences\/(\d+)\/whiteboard-state$/);
    if (conferenceWhiteboardState && request.method === "GET") {
      const session = await requireRole(request, env, ["learner", "tutor", "admin"]);
      if (!session) return json({ message: "Please sign in." }, { status: 401 });
      const state = await getConferenceWhiteboardState(
        Number(conferenceWhiteboardState[1]),
        session.user.id,
        env,
      );
      if (state === null)
        return json({ message: "This meeting is no longer available." }, { status: 404 });
      return json(state);
    }
    if (conferenceWhiteboardState && request.method === "PUT") {
      const session = await requireRole(request, env, ["tutor", "admin"]);
      if (!session) return json({ message: "Tutor or admin access required." }, { status: 403 });
      const body = await readJson(request);
      if (typeof body.visible !== "boolean")
        return json({ message: "Whiteboard visibility must be true or false." }, { status: 400 });
      const visible = await updateConferenceWhiteboardState(
        Number(conferenceWhiteboardState[1]),
        session.user.id,
        session.user.role === "admin",
        body.visible,
        env,
      );
      if (visible === null)
        return json(
          { message: "This meeting cannot be updated by your account." },
          { status: 403 },
        );
      return json({ visible });
    }

    if (conferenceWhiteboard && request.method === "GET") {
      const session = await requireRole(request, env, ["learner", "tutor", "admin"]);
      if (!session) return json({ message: "Please sign in." }, { status: 401 });
      const afterId = Math.max(0, Number(new URL(request.url).searchParams.get("after") ?? 0));
      return json({
        strokes: await listWhiteboardStrokes(Number(conferenceWhiteboard[1]), afterId, env),
      });
    }
    if (conferenceWhiteboard && request.method === "POST") {
      const session = await requireRole(request, env, ["learner", "tutor"]);
      if (!session)
        return json({ message: "Only active learners and tutors can draw." }, { status: 403 });
      const body = await readJson(request);
      const points = Array.isArray(body.points)
        ? body.points
            .slice(0, 300)
            .filter(
              (point: unknown) =>
                Array.isArray(point) &&
                point.length === 2 &&
                point.every((value) => Number.isFinite(Number(value))),
            )
        : [];
      if (points.length < 2)
        return json({ message: "A stroke needs at least two points." }, { status: 400 });
      const id = await addWhiteboardStroke(
        Number(conferenceWhiteboard[1]),
        session.user.id,
        points.map((point: number[]) => [Number(point[0]), Number(point[1])]),
        typeof body.color === "string" ? body.color.slice(0, 32) : "#123b6d",
        Math.max(1, Math.min(16, Number(body.lineWidth) || 3)),
        env,
      );
      return json({ id }, { status: 201 });
    }

    const conferencePermission = path.match(
      /^\/api\/conferences\/(\d+)\/participants\/(\d+)\/permissions$/,
    );
    if (conferencePermission && request.method === "PATCH") {
      const session = await requireRole(request, env, ["tutor", "admin"]);
      if (!session) return json({ message: "Tutor or admin access required." }, { status: 401 });
      const roomId = Number(conferencePermission[1]);
      const participantUserId = Number(conferencePermission[2]);
      if (session.user.role === "tutor") {
        const room = await listActiveConferences(env);
        const ownsRoom = room.some(
          (item) => item.id === roomId && item.tutorUserId === session.user.id,
        );
        if (!ownsRoom)
          return json({ message: "You can only manage your active meeting." }, { status: 403 });
      }
      const body = await readJson(request);
      const permissions = await updateRoomConferencePermissions(
        roomId,
        participantUserId,
        {
          canUseWhiteboard: Boolean(body.canUseWhiteboard),
          canShareScreen: Boolean(body.canShareScreen),
        },
        env,
      );
      if (!permissions)
        return json({ message: "Participant is not in this meeting." }, { status: 404 });
      return json({ permissions });
    }

    const whiteboardRequest = path.match(/^\/api\/conferences\/(\d+)\/whiteboard-request$/);
    if (whiteboardRequest && request.method === "POST") {
      const session = await requireRole(request, env, ["learner"]);
      if (!session)
        return json({ message: "Only learners can request whiteboard access." }, { status: 403 });
      const result = await requestRoomWhiteboardPermission(
        Number(whiteboardRequest[1]),
        session.user.id,
        env,
      );
      if (!result)
        return json({ message: "This meeting is no longer available." }, { status: 404 });
      return json({ ok: true });
    }

    if (path === "/api/conferences/heartbeat" && request.method === "POST") {
      const session = await requireRole(request, env, ["learner", "tutor", "admin"]);
      if (!session) return json({ message: "Please sign in again." }, { status: 401 });
      const body = await readJson(request);
      await touchConferenceParticipant(Number(body.participantId), session.user.id, env);
      return json({ ok: true });
    }

    if (path === "/api/conferences/log" && request.method === "POST") {
      const session = await requireRole(request, env, ["learner", "tutor", "admin"]);
      if (!session) return json({ message: "Please sign in." }, { status: 401 });
      const body = await readJson(request).catch(() => ({}));
      const roomId = body.roomId ? Number(body.roomId) : null;
      const participantId = body.participantId ? Number(body.participantId) : null;
      const eventType = typeof body.eventType === "string" ? body.eventType : "unknown";
      const payload = body.payload ?? null;
      await insertConferenceLog(roomId, participantId, eventType, payload, env).catch(
        () => undefined,
      );
      return json({ ok: true });
    }

    if (path === "/api/conferences/leave" && request.method === "POST") {
      const session = await requireRole(request, env, ["learner", "tutor", "admin"]);
      if (!session) return json({ ok: true });
      const body = await readJson(request);
      await leaveConferenceParticipant(Number(body.participantId), session.user.id, env);
      return json({ ok: true });
    }

    if (path === "/api/conferences/end" && request.method === "POST") {
      const session = await requireRole(request, env, ["tutor", "admin"]);
      if (!session) return json({ message: "Tutor or admin access required." }, { status: 401 });
      const body = await readJson(request);
      const ended = await endConference(
        Number(body.roomId),
        session.user.id,
        session.user.role === "admin",
        env,
      );
      if (!ended)
        return json({ message: "This session cannot be ended by your account." }, { status: 403 });
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

    if (error instanceof Error && error.message.startsWith("JITSI_")) {
      return json(
        {
          message:
            "Live classes are not configured yet. The administrator must add the production Jitsi provider credentials before meetings can start.",
          code: error.message,
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
      if (
        url.pathname.startsWith("/assets/") ||
        [
          "/elimusphere-logo.png",
          "/founder-joseph-wandera.jpg",
          "/founder-stephen-owiti-omondi.png",
        ].includes(url.pathname)
      ) {
        const assetResponse = await tryServeStaticAsset(request, env, ctx);
        if (assetResponse) return withSecurityHeaders(assetResponse, request);
      }

      if (url.pathname.startsWith("/api/")) {
        return withSecurityHeaders(await handleApi(request, env), request);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return withSecurityHeaders(await normalizeCatastrophicSsrResponse(response), request);
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
