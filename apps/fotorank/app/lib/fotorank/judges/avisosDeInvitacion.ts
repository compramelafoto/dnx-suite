import { prisma } from "@repo/db";

import { enqueueTransactionalEmail } from "../notifications/outbox";

/**
 * Los correos del circuito de invitación a jurado.
 *
 * Hasta el 2026-09-25 invitar desde el directorio no mandaba nada: el jurado se
 * enteraba sólo si entraba a su cuenta por otra razón, y el organizador no
 * sabía si le habían respondido sin volver a mirar la lista.
 *
 * Nunca voltean la acción que los dispara: si el correo falla, la invitación
 * igual queda creada o respondida, y se ve en las pantallas de siempre.
 */

function fechaCorta(fecha: Date): string {
  return fecha.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

async function cargar(invitationId: string) {
  return prisma.fotorankJudgeDirectoryInvitation.findUnique({
    where: { id: invitationId },
    select: {
      contestId: true,
      message: true,
      expiresAt: true,
      categoryIdsJson: true,
      sentByUserId: true,
      contest: { select: { title: true } },
      organization: { select: { name: true } },
      judgeAccount: {
        select: { email: true, profile: { select: { firstName: true, lastName: true } } },
      },
    },
  });
}

/** Al jurado, cuando un organizador lo invita. */
export async function avisarInvitacionAlJurado(invitationId: string): Promise<void> {
  try {
    const inv = await cargar(invitationId);
    if (!inv) return;

    const ids = Array.isArray(inv.categoryIdsJson)
      ? (inv.categoryIdsJson as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
    const categorias = ids.length
      ? await prisma.fotorankContestCategory.findMany({
          where: { id: { in: ids } },
          select: { name: true },
          orderBy: { sortOrder: "asc" },
        })
      : [];
    const nombres = categorias.map((c) => c.name);

    await enqueueTransactionalEmail({
      kind: "JURY_INVITATION",
      toEmail: inv.judgeAccount.email,
      contestId: inv.contestId,
      payload: {
        firstName: inv.judgeAccount.profile?.firstName ?? "",
        contestTitle: inv.contest.title,
        organizationName: inv.organization.name,
        categorias:
          nombres.length === 0
            ? ""
            : nombres.length === 1
              ? `la categoría ${nombres[0]}`
              : `las categorías ${nombres.slice(0, -1).join(", ")} y ${nombres.at(-1)}`,
        mensaje: inv.message,
        vence: inv.expiresAt ? fechaCorta(inv.expiresAt) : "",
      },
    });
  } catch (err: unknown) {
    console.error("FOTORANK JURY INVITATION EMAIL ERROR", err);
  }
}

/** Al organizador que invitó, cuando el jurado acepta o rechaza. */
export async function avisarRespuestaAlOrganizador(
  invitationId: string,
  respuesta: "aceptada" | "rechazada",
): Promise<void> {
  try {
    const inv = await cargar(invitationId);
    if (!inv) return;
    const p = inv.judgeAccount.profile;
    await enqueueTransactionalEmail({
      kind: "JURY_INVITATION_ANSWERED",
      toUserId: inv.sentByUserId,
      contestId: inv.contestId,
      payload: {
        nombre: p ? `${p.firstName} ${p.lastName}`.trim() : inv.judgeAccount.email,
        respuesta,
        contestTitle: inv.contest.title,
      },
    });
  } catch (err: unknown) {
    console.error("FOTORANK JURY INVITATION ANSWER EMAIL ERROR", err);
  }
}
