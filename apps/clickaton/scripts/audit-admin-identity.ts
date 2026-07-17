/**
 * Auditoría segura de administradores Clickatón (sin secrets/hashes/tokens).
 * Uso: pnpm --filter clickaton exec tsx scripts/audit-admin-identity.ts
 */
import { prisma } from "@repo/db";
import {
  isClickatonAdminEmail,
  normalizeEmail,
} from "../config/admin/admins";
import {
  hasClickatonAdminAccess,
  sanitizeAdminReturnPath,
} from "../lib/admin/access";

async function main() {
  const emails = [
    "dnxfotografia@gmail.com",
    "rodrigorincon40@gmail.com",
    "tammytamerph@gmail.com",
  ];

  console.log("===ADMIN_IDENTITY_AUDIT===");
  for (const email of emails) {
    const normalized = normalizeEmail(email);
    const u = await prisma.user.findFirst({
      where: { email: { equals: normalized, mode: "insensitive" } },
      select: {
        id: true,
        email: true,
        role: true,
        isBlocked: true,
        password: true,
        emailVerifiedAt: true,
        googleId: true,
        lastLoginAt: true,
        name: true,
      },
    });

    if (!u) {
      console.log(
        JSON.stringify({
          email,
          exists: false,
          allowlistRecognized: isClickatonAdminEmail(email),
          policyIfUserSession: hasClickatonAdminAccess({
            email,
            globalRole: "USER",
          }),
          status: "PENDIENTE_DE_ALTA_MANUAL_DEL_USUARIO",
        }),
      );
      continue;
    }

    const globalRole = u.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER";
    const authMethods = [
      u.password ? "password" : null,
      u.googleId ? "google" : null,
    ].filter(Boolean);

    console.log(
      JSON.stringify({
        emailRequested: email,
        exists: true,
        id: u.id,
        emailStored: u.email,
        emailNormalized: normalizeEmail(u.email),
        namePresent: Boolean(u.name?.trim()),
        emailVerified: Boolean(u.emailVerifiedAt),
        emailVerifiedAt: u.emailVerifiedAt?.toISOString() ?? null,
        authMethods,
        role: u.role,
        isBlocked: u.isBlocked,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        allowlistRecognized: isClickatonAdminEmail(u.email),
        hasClickatonAdminAccess: hasClickatonAdminAccess({
          email: u.email,
          globalRole,
        }),
        canCreateDnxSession: !u.isBlocked,
      }),
    );
  }

  console.log("===POLICY_NEGATIVES===");
  const cases = [
    { email: "  DNXfotografia@gmail.com ", globalRole: "USER" },
    { email: "not-admin@example.com", globalRole: "USER" },
    { email: "not-admin@example.com", globalRole: "SUPER_ADMIN" },
  ] as const;
  for (const c of cases) {
    console.log(
      JSON.stringify({
        email: c.email,
        normalized: normalizeEmail(c.email),
        globalRole: c.globalRole,
        hasAccess: hasClickatonAdminAccess(c),
      }),
    );
  }

  console.log("===NEXT_SANITIZE===");
  for (const raw of [
    "/admin/ediciones",
    "https://evil.example",
    "//evil",
    "/maratones",
    "/admin/login",
    "/admin/integraciones",
  ]) {
    console.log(JSON.stringify({ raw, sanitized: sanitizeAdminReturnPath(raw) }));
  }
}

main()
  .catch((err) => {
    console.error("AUDIT_FAILED", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
