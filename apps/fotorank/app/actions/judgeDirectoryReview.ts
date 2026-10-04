"use server";

/**
 * La cola de revisión de las postulaciones a jurado.
 *
 * Aprueba DNX, no cada organizador: el directorio es común a toda la
 * plataforma, así que publicar a alguien lo publica para todos.
 *
 * Cada acción repite el control de permiso. Una acción de servidor es una
 * puerta propia: no confía en que la pantalla la cuidó.
 */
import { revalidatePath } from "next/cache";

import { prisma } from "@repo/db";

import { requireAuth } from "../lib/auth";
import {
  recordPlatformAudit,
  userIsFotorankSuperAdmin,
} from "../lib/fotorank/access/super-admin";
import { aprobar, rechazar } from "../lib/fotorank/judges/directoryReview";
import { enqueueTransactionalEmail } from "../lib/fotorank/notifications/outbox";

export type ResultadoDeRevision = { ok: true } | { ok: false; error: string };

const SIN_PERMISO = "No tenés permiso para revisar postulaciones.";

async function exigirSuperAdmin(): Promise<{ ok: true; userId: number } | { ok: false; error: string }> {
  const user = await requireAuth();
  if (!userIsFotorankSuperAdmin(user)) return { ok: false, error: SIN_PERMISO };
  return { ok: true, userId: user.id };
}

function refrescarPantallas(publicSlug: string | null): void {
  revalidatePath("/super-admin/jurados");
  revalidatePath("/super-admin");
  revalidatePath("/jurados/directorio");
  revalidatePath("/jurado/perfil");
  if (publicSlug) revalidatePath(`/jurados/publico/${publicSlug}`);
}

export async function aprobarJuradoAction(judgeProfileId: string): Promise<ResultadoDeRevision> {
  const permiso = await exigirSuperAdmin();
  if (!permiso.ok) return permiso;

  const perfil = await prisma.fotorankJudgeProfile.findUnique({
    where: { id: judgeProfileId },
    select: {
      id: true,
      publicSlug: true,
      firstName: true,
      directoryReviewStatus: true,
      wantsDirectoryListing: true,
      judgeAccount: { select: { id: true, email: true, emailVerifiedAt: true } },
    },
  });
  if (!perfil) return { ok: false, error: "No encontramos esa ficha." };

  if (!perfil.judgeAccount.emailVerifiedAt) {
    return {
      ok: false,
      error: "Todavía no confirmó su correo. Hasta que lo haga, la ficha no se puede aprobar.",
    };
  }

  const efecto = aprobar({
    estado: perfil.directoryReviewStatus,
    emailVerificado: true,
    quiereEstarEnElDirectorio: perfil.wantsDirectoryListing,
  });

  await prisma.fotorankJudgeProfile.update({
    where: { id: perfil.id },
    data: {
      directoryReviewStatus: efecto.estado,
      isPublic: efecto.isPublic,
      isListedInProfessionalDirectory: efecto.isListedInProfessionalDirectory,
      directoryReviewedAt: new Date(),
      directoryReviewedByUserId: permiso.userId,
      directoryReviewNotes: null,
    },
  });

  await recordPlatformAudit({
    actorUserId: permiso.userId,
    action: "JUDGE_DIRECTORY_APPROVED",
    metadata: { judgeProfileId: perfil.id, judgeAccountId: perfil.judgeAccount.id },
  });

  await enqueueTransactionalEmail({
    kind: "JUDGE_DIRECTORY_REVIEWED",
    toEmail: perfil.judgeAccount.email,
    payload: {
      firstName: perfil.firstName,
      resultado: "aprobada",
      publicSlug: perfil.publicSlug,
    },
  });

  refrescarPantallas(perfil.publicSlug);
  return { ok: true };
}

export async function rechazarJuradoAction(
  judgeProfileId: string,
  motivo: string,
): Promise<ResultadoDeRevision> {
  const permiso = await exigirSuperAdmin();
  if (!permiso.ok) return permiso;

  const perfil = await prisma.fotorankJudgeProfile.findUnique({
    where: { id: judgeProfileId },
    select: {
      id: true,
      publicSlug: true,
      firstName: true,
      directoryReviewStatus: true,
      wantsDirectoryListing: true,
      judgeAccount: { select: { id: true, email: true, emailVerifiedAt: true } },
    },
  });
  if (!perfil) return { ok: false, error: "No encontramos esa ficha." };

  const decision = rechazar(
    {
      estado: perfil.directoryReviewStatus,
      emailVerificado: !!perfil.judgeAccount.emailVerifiedAt,
      quiereEstarEnElDirectorio: perfil.wantsDirectoryListing,
    },
    motivo,
  );
  // Sin motivo no se escribe nada: el jurado tiene que poder corregir.
  if (!decision.ok) return { ok: false, error: decision.error };

  await prisma.fotorankJudgeProfile.update({
    where: { id: perfil.id },
    data: {
      directoryReviewStatus: decision.efecto.estado,
      isPublic: decision.efecto.isPublic,
      isListedInProfessionalDirectory: decision.efecto.isListedInProfessionalDirectory,
      directoryReviewedAt: new Date(),
      directoryReviewedByUserId: permiso.userId,
      directoryReviewNotes: motivo.trim(),
    },
  });

  await recordPlatformAudit({
    actorUserId: permiso.userId,
    action: "JUDGE_DIRECTORY_REJECTED",
    metadata: { judgeProfileId: perfil.id, judgeAccountId: perfil.judgeAccount.id },
  });

  await enqueueTransactionalEmail({
    kind: "JUDGE_DIRECTORY_REVIEWED",
    toEmail: perfil.judgeAccount.email,
    payload: {
      firstName: perfil.firstName,
      resultado: "rechazada",
      motivo: motivo.trim(),
    },
  });

  refrescarPantallas(perfil.publicSlug);
  return { ok: true };
}

export async function suspenderCuentaDeJuradoAction(
  judgeAccountId: string,
): Promise<ResultadoDeRevision> {
  const permiso = await exigirSuperAdmin();
  if (!permiso.ok) return permiso;

  const cuenta = await prisma.fotorankJudgeAccount.findUnique({
    where: { id: judgeAccountId },
    select: { id: true, profile: { select: { publicSlug: true } } },
  });
  if (!cuenta) return { ok: false, error: "No encontramos esa cuenta." };

  await prisma.$transaction([
    prisma.fotorankJudgeAccount.update({
      where: { id: cuenta.id },
      data: { accountStatus: "SUSPENDED" },
    }),
    // Suspender sin cerrar la sesión abierta no suspende nada.
    prisma.fotorankJudgeSession.deleteMany({ where: { judgeAccountId: cuenta.id } }),
    prisma.fotorankJudgeProfile.updateMany({
      where: { judgeAccountId: cuenta.id },
      data: { isPublic: false, isListedInProfessionalDirectory: false },
    }),
  ]);

  await recordPlatformAudit({
    actorUserId: permiso.userId,
    action: "JUDGE_ACCOUNT_SUSPENDED",
    metadata: { judgeAccountId: cuenta.id },
  });

  refrescarPantallas(cuenta.profile?.publicSlug ?? null);
  return { ok: true };
}

/**
 * Cuántas fichas esperan revisión: el contador de Super Admin.
 *
 * Exige el permiso como las demás acciones de este archivo. Es sólo un número,
 * pero es una server action: sin la guardia, cualquiera que conozca su nombre
 * puede preguntar cuánta gente está esperando. Quien no tiene permiso recibe
 * cero, que es lo que ve en pantalla de todos modos.
 *
 * Sólo cuenta a quienes confirmaron el correo: sin ese paso la ficha todavía
 * no entró a revisión y contarla mostraría trabajo que no se puede hacer.
 */
export async function contarJuradosPendientes(): Promise<number> {
  const permiso = await exigirSuperAdmin();
  if (!permiso.ok) return 0;

  return prisma.fotorankJudgeProfile.count({
    where: {
      directoryReviewStatus: "PENDING",
      judgeAccount: { emailVerifiedAt: { not: null } },
    },
  });
}
