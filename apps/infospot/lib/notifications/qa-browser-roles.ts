/**
 * Roles QA para browser/E2E (Etapa 21).
 * Contraseñas bcrypt (compatibles CLF + InfoSpot).
 * Credenciales solo en `.qa-artifacts/` (gitignored).
 */

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { hashSync } from "bcryptjs";
import { prisma, Role } from "@repo/db";
import { createUserSession, DNX_SESSION_COOKIE } from "@repo/auth";
import {
  assertQaGate,
  QA_EMAIL_DOMAIN,
  QA_PREFIX,
  QA_TAG,
  resolveQaPassword,
} from "./qa-kit";

const ARTIFACTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../.qa-artifacts");

export type QaBrowserRoleKey =
  | "director"
  | "editor_both"
  | "editor_provision_only"
  | "no_perms"
  | "photo_inapp"
  | "photo_inapp_email"
  | "photo_prefs_off";

export type QaBrowserRoleRow = {
  key: QaBrowserRoleKey;
  email: string;
  userId: number;
  roleLabel: string;
  canProvision: boolean;
  canNotify: boolean;
};

function qaStaffEmail(key: string) {
  return `qa-staff-${key}@${QA_EMAIL_DOMAIN}`;
}

async function upsertStaffUser(input: {
  key: string;
  name: string;
  passwordHash: string;
  globalRole?: "USER" | "SUPER_ADMIN";
  infoSpot?: {
    role: "INFOSPOT_DIRECTOR" | "INFOSPOT_REDACTOR" | "INFOSPOT_COLABORADOR";
    canProvision: boolean;
    canNotify: boolean;
  };
}): Promise<number> {
  const email = qaStaffEmail(input.key);
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: `${QA_PREFIX} ${input.name}`,
          password: input.passwordHash,
          role: Role.ORGANIZER,
          globalRole: input.globalRole ?? "USER",
          tags: { set: [QA_TAG] },
          isBlocked: false,
        },
      })
    : await prisma.user.create({
        data: {
          email,
          name: `${QA_PREFIX} ${input.name}`,
          password: input.passwordHash,
          role: Role.ORGANIZER,
          globalRole: input.globalRole ?? "USER",
          tags: [QA_TAG],
        },
      });

  if (input.infoSpot) {
    await prisma.infoSpotUserRole.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        role: input.infoSpot.role,
        canPublish: true,
        publicationPolicy: "DIRECT_PUBLISH",
        canProvisionClfPhotographerCall: input.infoSpot.canProvision,
        canNotifyClfPhotographerCall: input.infoSpot.canNotify,
        status: "ACTIVE",
      },
      update: {
        role: input.infoSpot.role,
        canPublish: true,
        publicationPolicy: "DIRECT_PUBLISH",
        canProvisionClfPhotographerCall: input.infoSpot.canProvision,
        canNotifyClfPhotographerCall: input.infoSpot.canNotify,
        status: "ACTIVE",
      },
    });
  } else {
    await prisma.infoSpotUserRole.deleteMany({ where: { userId: user.id } });
  }

  return user.id;
}

/** DDL aditivo seguro si el host staging no aplicó Etapa 13 completa. */
async function ensureProvisionColumn() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "InfoSpotUserRole"
      ADD COLUMN IF NOT EXISTS "canProvisionClfPhotographerCall" BOOLEAN NOT NULL DEFAULT false;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "InfoSpotUserRole_canProvisionClfPhotographerCall_status_idx"
      ON "InfoSpotUserRole"("canProvisionClfPhotographerCall", "status");
  `);
}

export async function seedQaBrowserRoles(): Promise<{
  roles: QaBrowserRoleRow[];
  passwordFile: string;
}> {
  assertQaGate();
  await ensureProvisionColumn();
  const password = resolveQaPassword();
  const passwordHash = hashSync(password, 10);

  const roles: QaBrowserRoleRow[] = [];

  const directorId = await upsertStaffUser({
    key: "director",
    name: "Director QA",
    passwordHash,
    infoSpot: {
      role: "INFOSPOT_DIRECTOR",
      canProvision: true,
      canNotify: true,
    },
  });
  roles.push({
    key: "director",
    email: qaStaffEmail("director"),
    userId: directorId,
    roleLabel: "INFOSPOT_DIRECTOR",
    canProvision: true,
    canNotify: true,
  });

  const bothId = await upsertStaffUser({
    key: "editor-both",
    name: "Editor ambos permisos",
    passwordHash,
    infoSpot: {
      role: "INFOSPOT_REDACTOR",
      canProvision: true,
      canNotify: true,
    },
  });
  roles.push({
    key: "editor_both",
    email: qaStaffEmail("editor-both"),
    userId: bothId,
    roleLabel: "INFOSPOT_REDACTOR",
    canProvision: true,
    canNotify: true,
  });

  const provId = await upsertStaffUser({
    key: "editor-provision",
    name: "Editor solo provisioning",
    passwordHash,
    infoSpot: {
      role: "INFOSPOT_REDACTOR",
      canProvision: true,
      canNotify: false,
    },
  });
  roles.push({
    key: "editor_provision_only",
    email: qaStaffEmail("editor-provision"),
    userId: provId,
    roleLabel: "INFOSPOT_REDACTOR",
    canProvision: true,
    canNotify: false,
  });

  const noneId = await upsertStaffUser({
    key: "no-perms",
    name: "Usuario sin permisos InfoSpot",
    passwordHash,
  });
  roles.push({
    key: "no_perms",
    email: qaStaffEmail("no-perms"),
    userId: noneId,
    roleLabel: "NONE",
    canProvision: false,
    canNotify: false,
  });

  // Fotógrafos ya creados por seed principal — resolver IDs por email
  const photoKeys: Array<{ key: QaBrowserRoleKey; emailKey: string; label: string }> = [
    { key: "photo_inapp", emailKey: "inapp-only", label: "PHOTOGRAPHER IN_APP" },
    { key: "photo_inapp_email", emailKey: "inapp-email", label: "PHOTOGRAPHER IN_APP+EMAIL" },
    { key: "photo_prefs_off", emailKey: "prefs-off", label: "PHOTOGRAPHER prefs off" },
  ];
  for (const p of photoKeys) {
    const email = `qa-notif-${p.emailKey}@${QA_EMAIL_DOMAIN}`;
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!u) continue;
    await prisma.user.update({
      where: { id: u.id },
      data: { password: passwordHash },
    });
    roles.push({
      key: p.key,
      email,
      userId: u.id,
      roleLabel: p.label,
      canProvision: false,
      canNotify: false,
    });
  }

  mkdirSync(ARTIFACTS_DIR, { recursive: true });
  const passwordFile = resolve(ARTIFACTS_DIR, "notifications-qa-password.txt");
  writeFileSync(passwordFile, `${password}\n`, { mode: 0o600 });
  writeFileSync(
    resolve(ARTIFACTS_DIR, "notifications-qa-roles.json"),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        roles: roles.map((r) => ({
          key: r.key,
          email: r.email,
          userId: r.userId,
          roleLabel: r.roleLabel,
          canProvision: r.canProvision,
          canNotify: r.canNotify,
        })),
        note: "Password en notifications-qa-password.txt (no commitear).",
      },
      null,
      2,
    ),
  );

  return { roles, passwordFile };
}

export async function writeStorageStates(options?: {
  infospotOrigin?: string;
  clfOrigin?: string;
}): Promise<string[]> {
  assertQaGate();
  const infospotOrigin = options?.infospotOrigin || "http://127.0.0.1:3004";
  const clfOrigin = options?.clfOrigin || "http://127.0.0.1:3002";
  mkdirSync(ARTIFACTS_DIR, { recursive: true });

  const rolesJsonPath = resolve(ARTIFACTS_DIR, "notifications-qa-roles.json");
  const roles = JSON.parse(readFileSync(rolesJsonPath, "utf8")).roles as QaBrowserRoleRow[];

  const written: string[] = [];
  for (const role of roles) {
    const session = await createUserSession(role.userId, { rememberMe: true });
    const origins = role.key.startsWith("photo_")
      ? [clfOrigin, infospotOrigin]
      : [infospotOrigin, clfOrigin];
    for (const origin of origins) {
      const host = new URL(origin).hostname;
      const state = {
        cookies: [
          {
            name: DNX_SESSION_COOKIE,
            value: session.rawToken,
            domain: host,
            path: "/",
            httpOnly: true,
            secure: false,
            sameSite: "Lax" as const,
            expires: Math.floor(session.expiresAt.getTime() / 1000),
          },
        ],
        origins: [],
      };
      const file = resolve(ARTIFACTS_DIR, `storage-${role.key}-${host}.json`);
      writeFileSync(file, JSON.stringify(state, null, 2), { mode: 0o600 });
      written.push(file);
    }
  }
  return written;
}
