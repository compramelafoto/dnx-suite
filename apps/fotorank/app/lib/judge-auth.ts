import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@repo/db";

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
  profile: {
    firstName: string;
    lastName: string;
    publicSlug: string;
    avatarUrl: string | null;
  } | null;
};

export async function getJudgeAuthUser(): Promise<JudgeAuthUser | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(JUDGE_SESSION_COOKIE)?.value;
  if (!rawToken) return null;

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

  if (!session) return null;

  const now = new Date();
  if (session.expiresAt <= now) {
    await prisma.fotorankJudgeSession.delete({ where: { id: session.id } }).catch(() => {});
    return null;
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
