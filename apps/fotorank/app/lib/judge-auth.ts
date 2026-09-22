import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";

import { getAuthUser } from "./auth";
import { puedeEntrarConLaSesionDelSitio } from "./fotorank/judges/puenteDeSesion";

/** Cookie con token opaco (no es el id de cuenta). Nombre distinto al legado `dnx_judge_auth`. */
const JUDGE_SESSION_COOKIE = "dnx_judge_session";
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 días
/** Cookie antigua (id de cuenta); se borra al login/logout para no dejar basura. */
const LEGACY_JUDGE_AUTH_COOKIE = "dnx_judge_auth";

function hashSessionToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

export type JudgeAuthUser = {
  id: string;
  email: string;
  accountStatus: string;
  /** Null hasta que confirma el correo. Sin esto su ficha no entra a revisión. */
  emailVerifiedAt: Date | null;
  profile: {
    firstName: string;
    lastName: string;
    publicSlug: string;
    avatarUrl: string | null;
  } | null;
};

/**
 * El jurado entra con la contraseña del sitio, sin una segunda clave.
 *
 * Se consulta cuando no hay sesión de jurado propia. Ver `puenteDeSesion.ts`
 * para por qué hacen falta las dos confirmaciones de correo.
 */
async function juradoPorLaSesionDelSitio(): Promise<JudgeAuthUser | null> {
  const sesion = await getAuthUser();
  if (!sesion?.email) return null;

  /*
   * `AuthUser` no trae `emailVerifiedAt` y agregárselo tocaría un tipo que usa
   * toda la app, así que se consulta acá. Cuesta poco: esto sólo corre cuando
   * no hay sesión de jurado propia.
   */
  const usuario = await prisma.user.findUnique({
    where: { id: sesion.id },
    select: { email: true, emailVerifiedAt: true },
  });
  if (!usuario) return null;

  const cuenta = await prisma.fotorankJudgeAccount.findUnique({
    where: { email: usuario.email.trim().toLowerCase() },
    select: {
      id: true,
      email: true,
      accountStatus: true,
      emailVerifiedAt: true,
      profile: {
        select: { firstName: true, lastName: true, publicSlug: true, avatarUrl: true },
      },
    },
  });

  const permiso = puedeEntrarConLaSesionDelSitio({
    usuario: { email: usuario.email, emailVerifiedAt: usuario.emailVerifiedAt },
    cuentaDeJurado: cuenta,
  });
  if (!permiso.ok || !cuenta) return null;

  return {
    id: cuenta.id,
    email: cuenta.email,
    accountStatus: cuenta.accountStatus,
    emailVerifiedAt: cuenta.emailVerifiedAt,
    profile: cuenta.profile,
  };
}

export async function getJudgeAuthUser(): Promise<JudgeAuthUser | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(JUDGE_SESSION_COOKIE)?.value;
  if (!rawToken) return juradoPorLaSesionDelSitio();

  const tokenHash = hashSessionToken(rawToken);

  const session = await prisma.fotorankJudgeSession.findUnique({
    where: { tokenHash },
    include: {
      judgeAccount: {
        include: {
          profile: {
            select: { firstName: true, lastName: true, publicSlug: true, avatarUrl: true },
          },
        },
      },
    },
  });

  // Una sesión de jurado vencida o desconocida no puede tapar el puente: si no,
  // una cookie vieja dejaría a la persona pidiendo una contraseña que ya no usa.
  if (!session) return juradoPorLaSesionDelSitio();

  const now = new Date();
  if (session.expiresAt <= now) {
    await prisma.fotorankJudgeSession.delete({ where: { id: session.id } }).catch(() => {});
    return juradoPorLaSesionDelSitio();
  }

  const judge = session.judgeAccount;

  if (judge.accountStatus !== "ACTIVE") {
    await prisma.fotorankJudgeSession.deleteMany({ where: { judgeAccountId: judge.id } });
    return null;
  }

  return {
    id: judge.id,
    email: judge.email,
    accountStatus: judge.accountStatus,
    emailVerifiedAt: judge.emailVerifiedAt,
    profile: judge.profile,
  };
}

export async function requireJudgeAuth(): Promise<JudgeAuthUser> {
  const judge = await getJudgeAuthUser();
  if (!judge) redirect("/jurado/login");
  if (judge.accountStatus !== "ACTIVE") redirect("/jurado/login?blocked=1");
  return judge;
}

/**
 * Crea sesión en BD (hash del token) y fija cookie httpOnly con el token en claro (solo en tránsito al cliente).
 */
export async function createJudgeSessionForJudge(judgeAccountId: string): Promise<void> {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SEC * 1000);

  await prisma.fotorankJudgeSession.create({
    data: {
      judgeAccountId,
      tokenHash,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.delete(LEGACY_JUDGE_AUTH_COOKIE);
  cookieStore.set(JUDGE_SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_SEC,
    path: "/",
  });
}

/** Elimina la sesión actual (fila en BD + cookie). Idempotente. */
export async function destroyCurrentJudgeSession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(JUDGE_SESSION_COOKIE)?.value;
  if (rawToken) {
    const tokenHash = hashSessionToken(rawToken);
    await prisma.fotorankJudgeSession.deleteMany({ where: { tokenHash } });
  }
  cookieStore.delete(JUDGE_SESSION_COOKIE);
  cookieStore.delete(LEGACY_JUDGE_AUTH_COOKIE);
}

/** Revoca todas las sesiones de la cuenta (suspensión, cambio de contraseña, etc.). */
export async function revokeAllJudgeSessionsForJudge(judgeAccountId: string): Promise<void> {
  await prisma.fotorankJudgeSession.deleteMany({ where: { judgeAccountId } });
}
