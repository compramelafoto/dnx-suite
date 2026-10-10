import "server-only";
import { prisma } from "@repo/db";
import type { Usuario } from "@/lib/usuario";
import { dondePuede } from "@/lib/equipo/permisos";

type Quien = Pick<Usuario, "id" | "esSuperAdmin">;

/** La inauguración de una muestra para el panel (`rsvp`: dueño, coorganización o super admin). */
export async function cargarInauguracionPanel(id: string, usuario: Quien) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const a = await prisma.culturalActivity.findFirst({
    where: { id, type: "MUESTRA", ...dondePuede(usuario, "rsvp") },
    select: {
      id: true, slug: true, title: true, type: true, reviewStatus: true, isVirtualOnly: true, isCancelled: true,
      openingAt: true, openingEndsAt: true, openingNote: true, endsAt: true,
      rsvpStatus: true, rsvpCapacity: true, rsvpMaxCompanions: true, rsvpSummary: true, rsvpPurgedAt: true,
    },
  });
  return a ? { muestra: a } : null;
}
