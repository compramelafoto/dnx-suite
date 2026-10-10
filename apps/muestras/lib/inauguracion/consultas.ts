import "server-only";
import { cache } from "react";
import { prisma } from "@repo/db";
import type { OpeningEvent } from "@repo/muestras";
import { esTokenConForma, hashDeToken } from "@/lib/curaduria/token";
import { lugarDeLaInauguracion } from "./lugar";
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

const SELECT_INVITACION = {
  id: true, slug: true, title: true, type: true, coverImageUrl: true, organizersText: true, venueName: true, address: true, city: true,
  province: true, latitude: true, longitude: true, isVirtualOnly: true, isCancelled: true, reviewStatus: true, openingAt: true,
  openingEndsAt: true, openingNote: true, rsvpStatus: true, rsvpMaxCompanions: true, updatedAt: true,
} as const;

/**
 * La invitación pública (`/m/<slug>/inauguracion`). Nunca cuenta ni lee confirmaciones: la página
 * no muestra quiénes ni cuántos van. `cache`: metadatos y página la piden juntos.
 */
export const invitacionPublica = cache((slug: string) =>
  typeof slug === "string" && /^[a-z0-9-]{1,120}$/.test(slug)
    ? prisma.culturalActivity.findFirst({ where: { slug, reviewStatus: "APPROVED" }, select: SELECT_INVITACION })
    : Promise.resolve(null),
);
export type InvitacionPublica = NonNullable<Awaited<ReturnType<typeof invitacionPublica>>>;

/** Lo que ve quien tiene el enlace personal (sin email: no hace falta mostrarlo). */
export async function asistenciaPorToken(token: string) {
  if (!esTokenConForma(token)) return null;
  return prisma.culturalActivityRsvp.findUnique({
    where: { manageTokenHash: hashDeToken(token) },
    select: { name: true, companions: true, status: true, promotedAt: true, activity: { select: SELECT_INVITACION } },
  });
}

/** El evento para el `.ics` y Google Calendar. */
export function eventoDeInauguracion(a: InvitacionPublica, base: string): OpeningEvent | null {
  if (!a.openingAt) return null;
  return {
    id: a.id, title: a.title, openingAt: a.openingAt, openingEndsAt: a.openingEndsAt, venue: lugarDeLaInauguracion(a),
    note: a.openingNote, url: `${base}/m/${a.slug}/inauguracion`, stamp: a.updatedAt,
  };
}
