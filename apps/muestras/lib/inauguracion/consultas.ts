import "server-only";
import { cache } from "react";
import { prisma } from "@repo/db";
import { RSVP_LIMITS, RSVP_RETENTION_DAYS, rsvpPurgeDue, rsvpTotals, type OpeningEvent, type RsvpTotals } from "@repo/muestras";
import { esTokenConForma, hashDeToken } from "@/lib/curaduria/token";
import { purgarAsistencias } from "./limpieza";
import { lugarDeLaInauguracion } from "./lugar";
import { ordenarAsistencia } from "./orden";
import type { Usuario } from "@/lib/usuario";
import { dondePuede } from "@/lib/equipo/permisos";

type Quien = Pick<Usuario, "id" | "esSuperAdmin">;

/**
 * La inauguración de una muestra para el panel (`rsvp`: dueño, coorganización o super admin), con
 * la lista. Si ya pasaron 30 días del cierre, primero se borran los datos personales (D22): nadie
 * ve datos vencidos aunque el cron no haya corrido.
 */
export async function cargarInauguracionPanel(id: string, usuario: Quien) {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;
  const leer = () => prisma.culturalActivity.findFirst({
    where: { id, type: "MUESTRA", ...dondePuede(usuario, "rsvp") },
    select: {
      id: true, slug: true, title: true, type: true, reviewStatus: true, isVirtualOnly: true, isCancelled: true,
      openingAt: true, openingEndsAt: true, openingNote: true, endsAt: true,
      rsvpStatus: true, rsvpCapacity: true, rsvpMaxCompanions: true, rsvpSummary: true, rsvpPurgedAt: true,
    },
  });
  let a = await leer();
  if (!a) return null;
  const ahora = new Date();
  if (rsvpPurgeDue(a.endsAt, ahora) && !a.rsvpPurgedAt) {
    await purgarAsistencias(a.id, ahora);
    a = await leer();
    if (!a) return null;
  }
  const filas = a.rsvpPurgedAt || rsvpPurgeDue(a.endsAt, ahora)
    ? []
    : await prisma.culturalActivityRsvp.findMany({
        where: { activityId: a.id },
        orderBy: { createdAt: "asc" },
        take: RSVP_LIMITS.entries,
        select: { id: true, name: true, email: true, companions: true, status: true, createdAt: true, promotedAt: true },
      });
  const resumen = a.rsvpSummary && typeof a.rsvpSummary === "object" ? (a.rsvpSummary as unknown as RsvpTotals) : null;
  return {
    muestra: a,
    lista: ordenarAsistencia(filas),
    totales: a.rsvpPurgedAt ? resumen ?? rsvpTotals([]) : rsvpTotals(filas),
    borrado: a.rsvpPurgedAt,
    borraEl: new Date(a.endsAt.getTime() + RSVP_RETENTION_DAYS * 24 * 60 * 60 * 1000),
  };
}
export type AsistenciaDelPanel = NonNullable<Awaited<ReturnType<typeof cargarInauguracionPanel>>>["lista"][number];

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
