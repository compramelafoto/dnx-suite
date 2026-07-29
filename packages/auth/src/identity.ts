/**
 * Contrato canónico de identidad DNX (ETAPA 10B.4).
 *
 * Las aplicaciones NO deben reimplementar estas operaciones.
 * Fuente de verdad: modelo `User` en `@repo/db` + este paquete.
 */

import { prisma } from "./prisma";
import {
  hashPassword,
  verifyPassword,
} from "./password";
import {
  detectPasswordHashFormat,
  isLegacyPasswordHash,
} from "./password-format";
import {
  normalizeIdentityEmail,
  requireNormalizedIdentityEmail,
} from "./identity-email";
import {
  createUserSession,
  destroyUserSessionByRawToken,
  getSessionIdentityByRawToken,
  getSessionUserByRawToken,
  revokeAllUserSessions,
  type SessionIdentityContext,
  type SessionUser,
} from "./sessions";

export {
  normalizeIdentityEmail,
  requireNormalizedIdentityEmail,
} from "./identity-email";
export {
  detectPasswordHashFormat,
  isCanonicalPasswordHash,
  isLegacyPasswordHash,
  type PasswordHashFormat,
} from "./password-format";

/** Aplicaciones conocidas de la suite (Application ID lógico). */
export const DNX_APPLICATIONS = [
  "compramelafoto",
  "clickaton",
  "fotorank",
  "infospot",
  "fotoffice",
  "dnx-payments",
] as const;

export type DnxApplicationId = (typeof DNX_APPLICATIONS)[number] | (string & {});

export type IdentityLookup =
  | { type: "email"; email: string }
  | { type: "userId"; userId: number }
  | { type: "googleSubject"; googleSubject: string };

export type DnxIdentityUser = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  globalRole: string | null;
  googleId: string | null;
  isBlocked: boolean;
  emailVerifiedAt: Date | null;
  hasPassword: boolean;
  passwordFormat: ReturnType<typeof detectPasswordHashFormat> | "none";
};

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  globalRole: true,
  googleId: true,
  isBlocked: true,
  emailVerifiedAt: true,
  password: true,
} as const;

function toIdentityUser(row: {
  id: number;
  email: string;
  name: string | null;
  role: string;
  globalRole?: string | null;
  googleId: string | null;
  isBlocked: boolean;
  emailVerifiedAt: Date | null;
  password: string | null;
}): DnxIdentityUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: String(row.role),
    globalRole: row.globalRole != null ? String(row.globalRole) : null,
    googleId: row.googleId,
    isBlocked: row.isBlocked,
    emailVerifiedAt: row.emailVerifiedAt,
    hasPassword: Boolean(row.password),
    passwordFormat: row.password
      ? detectPasswordHashFormat(row.password)
      : "none",
  };
}

export async function findUserByIdentity(
  identity: IdentityLookup,
): Promise<DnxIdentityUser | null> {
  let row:
    | {
        id: number;
        email: string;
        name: string | null;
        role: string;
        globalRole?: string | null;
        googleId: string | null;
        isBlocked: boolean;
        emailVerifiedAt: Date | null;
        password: string | null;
      }
    | null = null;

  if (identity.type === "email") {
    const normalized = normalizeIdentityEmail(identity.email);
    if (!normalized.ok) return null;
    row = await prisma.user.findUnique({
      where: { email: normalized.email },
      select: userSelect,
    });
  } else if (identity.type === "userId") {
    row = await prisma.user.findUnique({
      where: { id: identity.userId },
      select: userSelect,
    });
  } else {
    row = await prisma.user.findFirst({
      where: { googleId: identity.googleSubject },
      select: userSelect,
    });
  }

  return row ? toIdentityUser(row) : null;
}

export type ResolveOrCreateUserInput = {
  email: string;
  /** Solo se usa al crear. Nunca sobrescribe password existente. */
  password?: string;
  name?: string | null;
  /** Role Prisma al crear (default CUSTOMER). No modifica roles de usuarios existentes. */
  createRole?: string;
  /** Origen de alta para auditoría/logs. */
  sourceApplication: DnxApplicationId;
  googleId?: string | null;
  markEmailVerified?: boolean;
};

export type ResolveOrCreateUserResult = {
  user: DnxIdentityUser;
  created: boolean;
};

/**
 * Resuelve o crea el User DNX canónico.
 * Nunca duplica por email. Nunca sobrescribe password/roles de un usuario existente.
 */
export async function resolveOrCreateUser(
  input: ResolveOrCreateUserInput,
): Promise<ResolveOrCreateUserResult> {
  const email = requireNormalizedIdentityEmail(input.email);

  const existing = await prisma.user.findUnique({
    where: { email },
    select: userSelect,
  });

  if (existing) {
    if (existing.isBlocked) {
      throw new Error("Esta cuenta está bloqueada.");
    }
    // Vincular googleId si se aporta y no hay conflicto
    if (input.googleId && !existing.googleId) {
      const taken = await prisma.user.findFirst({
        where: { googleId: input.googleId, NOT: { id: existing.id } },
        select: { id: true },
      });
      if (taken) {
        throw new Error("Esa identidad de Google ya está vinculada a otra cuenta.");
      }
      const updated = await prisma.user.update({
        where: { id: existing.id },
        data: {
          googleId: input.googleId,
          ...(input.markEmailVerified && !existing.emailVerifiedAt
            ? { emailVerifiedAt: new Date() }
            : {}),
        },
        select: userSelect,
      });
      console.info("[dnx.identity] resolveOrCreateUser.reuse", {
        userId: updated.id,
        source: input.sourceApplication,
        linkedGoogle: true,
      });
      return { user: toIdentityUser(updated), created: false };
    }
    console.info("[dnx.identity] resolveOrCreateUser.reuse", {
      userId: existing.id,
      source: input.sourceApplication,
    });
    return { user: toIdentityUser(existing), created: false };
  }

  const passwordHash = input.password ? hashPassword(input.password) : null;
  const role = input.createRole ?? "CUSTOMER";

  try {
    const created = await prisma.user.create({
      data: {
        email,
        password: passwordHash,
        name: input.name?.trim() || null,
        role: role as never,
        ...(input.googleId ? { googleId: input.googleId } : {}),
        ...(input.markEmailVerified || input.googleId
          ? { emailVerifiedAt: new Date() }
          : {}),
      },
      select: userSelect,
    });
    console.info("[dnx.identity] resolveOrCreateUser.created", {
      userId: created.id,
      source: input.sourceApplication,
    });
    return { user: toIdentityUser(created), created: true };
  } catch (err) {
    // Carrera concurrente: unique email
    const raced = await prisma.user.findUnique({
      where: { email },
      select: userSelect,
    });
    if (raced) {
      return { user: toIdentityUser(raced), created: false };
    }
    throw err;
  }
}

export type VerifyUserPasswordInput = {
  email?: string;
  userId?: number;
  password: string;
  /** Si true (default), rehashea bcrypt → scrypt canónico tras login válido. */
  upgradeLegacyHash?: boolean;
};

export type VerifyUserPasswordResult =
  | {
      ok: true;
      user: DnxIdentityUser;
      rehashed: boolean;
      previousFormat: ReturnType<typeof detectPasswordHashFormat>;
    }
  | { ok: false; reason: "NOT_FOUND" | "BLOCKED" | "NO_PASSWORD" | "INVALID" };

/**
 * Verifica contraseña contra el User central.
 * Soporta scrypt canónico y bcrypt legacy; rehashea progresivamente.
 */
export async function verifyUserPassword(
  input: VerifyUserPasswordInput,
): Promise<VerifyUserPasswordResult> {
  if (!input.password) return { ok: false, reason: "INVALID" };

  let row:
    | {
        id: number;
        email: string;
        name: string | null;
        role: string;
        globalRole?: string | null;
        googleId: string | null;
        isBlocked: boolean;
        emailVerifiedAt: Date | null;
        password: string | null;
      }
    | null = null;

  if (input.userId != null) {
    row = await prisma.user.findUnique({
      where: { id: input.userId },
      select: userSelect,
    });
  } else if (input.email) {
    const normalized = normalizeIdentityEmail(input.email);
    if (!normalized.ok) return { ok: false, reason: "NOT_FOUND" };
    row = await prisma.user.findUnique({
      where: { email: normalized.email },
      select: userSelect,
    });
  } else {
    return { ok: false, reason: "NOT_FOUND" };
  }

  if (!row) return { ok: false, reason: "NOT_FOUND" };
  if (row.isBlocked) return { ok: false, reason: "BLOCKED" };
  if (!row.password) return { ok: false, reason: "NO_PASSWORD" };

  const previousFormat = detectPasswordHashFormat(row.password);
  if (previousFormat === "unknown") return { ok: false, reason: "INVALID" };
  if (!verifyPassword(input.password, row.password)) {
    return { ok: false, reason: "INVALID" };
  }

  let rehashed = false;
  const shouldUpgrade = input.upgradeLegacyHash !== false && isLegacyPasswordHash(row.password);
  if (shouldUpgrade) {
    const nextHash = hashPassword(input.password);
    await prisma.user.update({
      where: { id: row.id },
      data: { password: nextHash },
    });
    row = { ...row, password: nextHash };
    rehashed = true;
    console.info("[dnx.identity] password.rehashed", {
      userId: row.id,
      from: previousFormat,
      to: "scrypt_v1",
    });
  }

  return {
    ok: true,
    user: toIdentityUser(row),
    rehashed,
    previousFormat,
  };
}

export type ExternalIdentityProvider = "GOOGLE" | "AUTH0" | "APPLE";

export type LinkExternalIdentityInput = {
  userId: number;
  provider: ExternalIdentityProvider;
  providerSubject: string;
  emailAtProvider?: string;
  emailVerified?: boolean;
};

/**
 * Vincula identidad externa al User DNX.
 * Hoy GOOGLE usa `User.googleId` (sin tabla ExternalIdentity aún).
 * AUTH0/APPLE: rechazados hasta existir modelo ExternalIdentity.
 */
export async function linkExternalIdentity(
  input: LinkExternalIdentityInput,
): Promise<{ userId: number; provider: ExternalIdentityProvider; linked: boolean }> {
  if (input.provider !== "GOOGLE") {
    throw new Error(
      `Provider ${input.provider} requiere modelo ExternalIdentity (migración pendiente).`,
    );
  }
  if (!input.providerSubject.trim()) {
    throw new Error("providerSubject es obligatorio.");
  }

  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, googleId: true, isBlocked: true, emailVerifiedAt: true },
  });
  if (!user || user.isBlocked) {
    throw new Error("Usuario no encontrado o bloqueado.");
  }
  if (user.googleId && user.googleId !== input.providerSubject) {
    throw new Error("Conflicto: el usuario ya tiene otra identidad Google.");
  }

  const taken = await prisma.user.findFirst({
    where: {
      googleId: input.providerSubject,
      NOT: { id: user.id },
    },
    select: { id: true },
  });
  if (taken) {
    throw new Error("Conflicto de proveedor: Google subject ya vinculado a otro User.");
  }

  if (!user.googleId) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId: input.providerSubject,
        ...(input.emailVerified && !user.emailVerifiedAt
          ? { emailVerifiedAt: new Date() }
          : {}),
      },
    });
    console.info("[dnx.identity] externalIdentity.linked", {
      userId: user.id,
      provider: "GOOGLE",
    });
    return { userId: user.id, provider: "GOOGLE", linked: true };
  }

  return { userId: user.id, provider: "GOOGLE", linked: false };
}

/** Alias semántico del contrato — crea sesión UserSession + cookie dnx_session. */
export async function createIdentitySession(
  userId: number,
  options?: { rememberMe?: boolean; maxAgeSeconds?: number; application?: DnxApplicationId },
) {
  const session = await createUserSession(userId, options);
  console.info("[dnx.identity] session.created", {
    userId,
    application: options?.application ?? null,
  });
  return session;
}

export async function resolveSession(rawToken: string): Promise<SessionUser | null> {
  return getSessionUserByRawToken(rawToken);
}

export async function resolveSessionIdentity(
  rawToken: string,
  params?: { currentWorkspaceId?: string | null },
): Promise<SessionIdentityContext | null> {
  return getSessionIdentityByRawToken(rawToken, params);
}

export async function destroySession(rawToken: string): Promise<void> {
  await destroyUserSessionByRawToken(rawToken);
}

export async function revokeUserSessions(userId: number): Promise<void> {
  await revokeAllUserSessions(userId);
  console.info("[dnx.identity] sessions.revoked_all", { userId });
}

export type ApplicationAccess = {
  application: string;
  enabled: boolean;
  appRole: string | null;
  source: "workspace_app_access" | "info_spot_role" | "user_role_legacy" | "none";
};

/**
 * Resuelve acceso por aplicación server-side.
 * No confiar en roles enviados por el frontend.
 */
export async function getUserApplicationAccess(input: {
  userId: number;
  application?: DnxApplicationId;
  workspaceId?: string | null;
}): Promise<ApplicationAccess[]> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, role: true, globalRole: true, isBlocked: true },
  });
  if (!user || user.isBlocked) return [];

  const results: ApplicationAccess[] = [];

  // InfoSpot: rol editorial dedicado
  try {
    const client = prisma as unknown as {
      infoSpotUserRole?: {
        findUnique: (args: unknown) => Promise<{ role: string } | null>;
      };
    };
    if (client.infoSpotUserRole?.findUnique) {
      const isp = await client.infoSpotUserRole.findUnique({
        where: { userId: input.userId },
      });
      if (isp) {
        results.push({
          application: "infospot",
          enabled: true,
          appRole: isp.role,
          source: "info_spot_role",
        });
      }
    }
  } catch {
    // tabla opcional
  }

  // WorkspaceAppAccess si existe
  if (input.workspaceId) {
    try {
      const client = prisma as unknown as {
        workspaceAppAccess?: {
          findMany: (args: unknown) => Promise<
            Array<{ app: string; enabled: boolean; appRole: string | null }>
          >;
        };
      };
      if (client.workspaceAppAccess?.findMany) {
        const rows = await client.workspaceAppAccess.findMany({
          where: { userId: input.userId, workspaceId: input.workspaceId },
        });
        for (const row of rows) {
          results.push({
            application: String(row.app).toLowerCase(),
            enabled: row.enabled,
            appRole: row.appRole,
            source: "workspace_app_access",
          });
        }
      }
    } catch {
      // opcional
    }
  }

  // Legacy: role en User (CLF-centric)
  results.push({
    application: "compramelafoto",
    enabled: true,
    appRole: String(user.role),
    source: "user_role_legacy",
  });

  if (input.application) {
    return results.filter(
      (r) => r.application === String(input.application).toLowerCase(),
    );
  }
  return results;
}
