import "server-only";
import { prisma } from "@repo/db";
import { hasPhysicalVenue } from "@repo/muestras";

/**
 * Los envíos de la persona, con sus obras. La decisión de cada obra sólo sale cuando la
 * convocatoria terminó (`DONE`): antes, ni siquiera viaja al navegador. `tienePaginaPublica` dice
 * si existe `/convocatorias/<slug>` (no borrador, muestra publicada y con lugar físico).
 */
export async function listarMisEnvios(userId: number) {
  const envios = await prisma.culturalCallSubmission.findMany({
    where: { userId },
    select: {
      id: true, status: true, updatedAt: true,
      call: { select: { id: true, slug: true, title: true, status: true, opensAt: true, closesAt: true, activity: { select: { reviewStatus: true, isVirtualOnly: true, venueName: true, address: true } } } },
      works: { orderBy: { sortOrder: "asc" }, select: { id: true, title: true, imageUrl: true, decision: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return envios.map(({ call: { activity, ...call }, ...e }) => ({
    ...e,
    call: {
      ...call,
      // Misma condición que `buscarConvocatoriaPublica`: si no, el enlace daría 404.
      tienePaginaPublica: call.status !== "DRAFT" && activity.reviewStatus === "APPROVED" && hasPhysicalVenue(activity),
    },
    works: e.works.map((w) => ({ ...w, decision: call.status === "DONE" && e.status === "ACTIVE" ? w.decision : null })),
  }));
}

/** El envío propio en una convocatoria, para volver a editarlo. */
export function buscarMiEnvio(callId: string, userId: number) {
  return prisma.culturalCallSubmission.findUnique({
    where: { callId_userId: { callId, userId } },
    select: {
      authorName: true, status: true,
      works: { orderBy: { sortOrder: "asc" }, select: { imageUrl: true, title: true, year: true, technique: true, statement: true } },
    },
  });
}
