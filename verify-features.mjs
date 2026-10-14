#!/usr/bin/env node
/**
 * Feature verification script for:
 * - Admin routes and permissions
 * - File uploads and readability
 * - Approval workflows
 */

import fs from "fs/promises";
import path from "path";

const BASE_URL = "https://elimusphere.co.ke";

async function checkServerEndpoint(endpoint) {
  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: "GET",
      headers: { "Accept": "application/json" },
    });
    return {
      endpoint,
      status: response.status,
      ok: response.ok,
      statusText: response.statusText,
    };
  } catch (err) {
    return {
      endpoint,
      error: err.message,
    };
  }
}

async function verifySourceCode() {
  const checks = [];

  // Check admin route file exists
  const adminRouteFile = path.resolve("./src/routes/admin.tsx");
  const adminRouteExists = await fs
    .stat(adminRouteFile)
    .then(() => true)
    .catch(() => false);
  checks.push({
    check: "Admin route file (src/routes/admin.tsx)",
    status: adminRouteExists ? "✓ EXISTS" : "✗ MISSING",
  });

  // Read and check admin.tsx for approval functionality
  if (adminRouteExists) {
    const content = await fs.readFile(adminRouteFile, "utf-8");
    const hasApprovals = content.includes("Approvals") && content.includes("applications");
    checks.push({
      check: "Approvals section in admin.tsx",
      status: hasApprovals ? "✓ FOUND" : "✗ NOT FOUND",
    });

    const hasResendApproval = content.includes("resendApprovalEmail");
    checks.push({
      check: "Resend approval email function",
      status: hasResendApproval ? "✓ FOUND" : "✗ NOT FOUND",
    });
  }

  // Check server.ts for API endpoints
  const serverFile = path.resolve("./src/server.ts");
  const serverContent = await fs.readFile(serverFile, "utf-8");

  const adminEndpoints = [
    { pattern: "/api/admin/applications", name: "Admin applications list" },
    { pattern: "/api/admin/users", name: "Admin users list" },
    { pattern: "/api/admin/payments", name: "Admin payments list" },
    { pattern: "/api/admin/reports", name: "Admin reports" },
    { pattern: "/api/admin/active-conferences", name: "Admin active conferences" },
    { pattern: "/api/admin/resources", name: "Admin resource upload" },
    { pattern: "applicationReview", name: "Approval actions (approve/reject)" },
    { pattern: "resend-approval", name: "Resend approval email" },
  ];

  checks.push({
    check: "=== ADMIN ENDPOINTS ===",
    status: "VERIFICATION",
  });

  for (const ep of adminEndpoints) {
    const found = serverContent.includes(ep.pattern);
    checks.push({
      check: ep.name,
      status: found ? "✓ IMPLEMENTED" : "✗ NOT FOUND",
    });
  }

  // Check file upload functionality
  checks.push({
    check: "=== FILE UPLOAD ===",
    status: "VERIFICATION",
  });

  const hasFileUpload = serverContent.includes("multipart/form-data") && serverContent.includes("formData");
  checks.push({
    check: "Multipart file upload support",
    status: hasFileUpload ? "✓ IMPLEMENTED" : "✗ NOT FOUND",
  });

  const hasFileWrite = serverContent.includes("fs.writeFile");
  checks.push({
    check: "File writing to disk",
    status: hasFileWrite ? "✓ IMPLEMENTED" : "✗ NOT FOUND",
  });

  const hasFileRead = serverContent.includes("fs.readFile");
  checks.push({
    check: "File reading from disk",
    status: hasFileRead ? "✓ IMPLEMENTED" : "✗ NOT FOUND",
  });

  const hasUploadDir = serverContent.includes('path.resolve(process.cwd(), "public", "uploads")');
  checks.push({
    check: "Upload directory path configured",
    status: hasUploadDir ? "✓ CONFIGURED" : "✗ NOT FOUND",
  });

  // Check authentication and permissions
  checks.push({
    check: "=== AUTHENTICATION & PERMISSIONS ===",
    status: "VERIFICATION",
  });

  const hasRoleCheck = serverContent.includes("requireRole");
  checks.push({
    check: "Role-based access control",
    status: hasRoleCheck ? "✓ IMPLEMENTED" : "✗ NOT FOUND",
  });

  const hasAdminCheck = serverContent.includes('"admin"');
  checks.push({
    check: "Admin role enforcement",
    status: hasAdminCheck ? "✓ IMPLEMENTED" : "✗ NOT FOUND",
  });

  return checks;
}

async function verifyBuild() {
  const checks = [];

  checks.push({
    check: "=== BUILD VERIFICATION ===",
    status: "VERIFICATION",
  });

  // Check if dist folder exists
  const distExists = await fs
    .stat("./dist")
    .then(() => true)
    .catch(() => false);
  checks.push({
    check: "Production build (dist/)",
    status: distExists ? "✓ EXISTS" : "✗ MISSING",
  });

  if (distExists) {
    // Check server assets
    const serverExists = await fs
      .stat("./dist/server/server.js")
      .then(() => true)
      .catch(() => false);
    checks.push({
      check: "Server bundle",
      status: serverExists ? "✓ EXISTS" : "✗ MISSING",
    });

    // Check client assets
    const clientExists = await fs
      .stat("./dist/client")
      .then((stat) => stat.isDirectory())
      .catch(() => false);
    checks.push({
      check: "Client assets",
      status: clientExists ? "✓ EXISTS" : "✗ MISSING",
    });
  }

  // Check for logo in public
  const logoExists = await fs
    .stat("./public/elimusphere-logo.png")
    .then(() => true)
    .catch(() => false);
  checks.push({
    check: "Logo asset (elimusphere-logo.png)",
    status: logoExists ? "✓ EXISTS" : "✗ MISSING",
  });

  return checks;
}

async function verifyLiveServer() {
  const checks = [];

  checks.push({
    check: "=== LIVE SERVER ENDPOINTS ===",
    status: "VERIFICATION",
  });

  const endpoints = [
    "/",
    "/login",
    "/signup",
    "/classes",
    "/admin",
    "/api/auth/me",
    "/api/admin/users",
  ];

  for (const endpoint of endpoints) {
    const result = await checkServerEndpoint(endpoint);
    if (result.error) {
      checks.push({
        check: endpoint,
        status: `✗ ERROR: ${result.error}`,
      });
    } else {
      checks.push({
        check: endpoint,
        status: `${result.ok ? "✓" : "✗"} ${result.status} ${result.statusText}`,
      });
    }
  }

  return checks;
}

async function main() {
  console.log("\n🔍 FEATURE VERIFICATION REPORT\n");
  console.log("=" .repeat(60));

  try {
    // Source code verification
    console.log("\n📝 Source Code Analysis:\n");
    const sourceChecks = await verifySourceCode();
    for (const check of sourceChecks) {
      const pad = " ".repeat(Math.max(0, 50 - check.check.length));
      console.log(`${check.check}${pad} ${check.status}`);
    }

    // Build verification
    console.log("\n🏗️  Build Status:\n");
    const buildChecks = await verifyBuild();
    for (const check of buildChecks) {
      const pad = " ".repeat(Math.max(0, 50 - check.check.length));
      console.log(`${check.check}${pad} ${check.status}`);
    }

    // Live server verification
    console.log("\n🌐 Live Server Check:\n");
    const liveChecks = await verifyLiveServer();
    for (const check of liveChecks) {
      const pad = " ".repeat(Math.max(0, 50 - check.check.length));
      console.log(`${check.check}${pad} ${check.status}`);
    }

    console.log("\n" + "=".repeat(60));
    console.log("\n✅ Verification complete!\n");

  } catch (err) {
    console.error("❌ Verification error:", err.message);
    process.exit(1);
  }
}

main();
