"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { prisma } from "@repo/db";
import { RSVP_LIMITS, RSVP_RAW_MAX, isTooFast, partySize, rsvpInput, rsvpPlacement, rsvpProblems, rsvpState, rsvpTotals } from "@repo/muestras";
import { avisarAsistencia, avisarLugarLiberado } from "@/lib/correos/inauguracion";
import { esTokenConForma, hashDeToken, nuevoTokenDeInvitacion } from "@/lib/curaduria/token";
import { baseUrlPublica } from "@/lib/fichas/cargar";
import { frenarPorIp, frenarPorMuestra, ipDeLaPeticion } from "@/lib/limite";
import { promoverEnTx, type Promovida } from "./cupo";

/**
 * Confirmación de asistencia del público, sin cuenta (etapa 5, D15–D18). Guarda sólo lo que la
 * persona escribe: nada de IP, user-agent ni cookies. El enlace personal se muestra una sola vez
 * en pantalla (y va por correo si está encendido): es lo que permite cancelar con el correo apagado.
 */
export type ResultadoAsistencia =
  | { ok: true; estado: "CONFIRMED" | "WAITLIST"; enlace: string | null }
  | { ok: false; error: string };

const ID = /^[A-Za-z0-9_-]{1,64}$/;
// A un robot se le contesta como si hubiera salido bien: no aprende qué lo delató.
const COMO_SI_NADA: ResultadoAsistencia = { ok: true, estado: "CONFIRMED", enlace: null };
const YA_ANOTADO = "Ese email ya está anotado. Para cambiar la cantidad, cancelá con tu enlace personal y volvé a confirmar.";

class Corte extends Error {}

const SELECT_CONFIRMAR = {
  id: true, slug: true, title: true, type: true, reviewStatus: true, isVirtualOnly: true, isCancelled: true,
  openingAt: true, openingEndsAt: true, rsvpStatus: true, rsvpMaxCompanions: true, venueName: true, address: true, city: true,
} as const;

export async function confirmarAsistencia(fd: FormData): Promise<ResultadoAsistencia> {
  const activityId = String(fd.get("muestra") ?? "");
  if (!ID.test(activityId)) return { ok: false, error: "No encontramos esta muestra." };
  if (String(fd.get("sitio") ?? "") !== "") return COMO_SI_NADA;
  const t = String(fd.get("t") ?? "");
  if (isTooFast(/^\d{12,14}$/.test(t) ? Number(t) : null, Date.now())) return COMO_SI_NADA;
  const crudo = { name: fd.get("nombre"), email: fd.get("email"), companions: fd.get("acompanantes") };
  if (Object.values(crudo).some((v) => typeof v === "string" && v.length > RSVP_RAW_MAX)) return { ok: false, error: "Revisá los datos: hay un campo demasiado largo." };
  // Freno barato por IP, sin ámbito, antes de consultar la base.
  const ip = ipDeLaPeticion(await headers());
  if (!frenarPorIp("asistenciaConsultas", ip).allowed) return { ok: false, error: "Probá de nuevo en unos minutos." };
  const a = await prisma.culturalActivity.findUnique({ where: { id: activityId }, select: SELECT_CONFIRMAR });
  if (!a || rsvpState(a, new Date()) !== "OPEN") return { ok: false, error: "No se reciben confirmaciones para esta inauguración." };
  const entrada = rsvpInput(crudo);
  const problemas = rsvpProblems(entrada, a.rsvpMaxCompanions);
  if (problemas.length) return { ok: false, error: problemas.join(" ") };
  // Los frenos van después de validar la muestra: con ids inventados, cada pedido sumaría una clave.
  if (!frenarPorIp("asistencia", ip, a.id).allowed) return { ok: false, error: "Desde esta conexión ya se anotaron varias personas. Probá en unos minutos." };
  if (!frenarPorMuestra("asistencia", a.id).allowed) return { ok: false, error: "Llegaron muchas confirmaciones juntas. Probá en un rato." };
  const { token, hash } = nuevoTokenDeInvitacion();
  let estado: "CONFIRMED" | "WAITLIST";
  try {
    estado = await prisma.$transaction(async (tx) => {
      // Bloquea la muestra: dos confirmaciones simultáneas no pasan el cupo (D16). El cupo se lee acá.
      const [bloqueada] = await tx.$queryRaw<{ rsvpCapacity: number | null }[]>`
        SELECT id, "rsvpCapacity" FROM "CulturalActivity" WHERE id = ${a.id} FOR UPDATE`;
      const capacidad = bloqueada?.rsvpCapacity == null ? null : Number(bloqueada.rsvpCapacity);
      // Un email, una confirmación por muestra (D17). Quien había cancelado vuelve con su misma fila.
      const previo = entrada.email
        ? await tx.culturalActivityRsvp.findUnique({ where: { activityId_email: { activityId: a.id, email: entrada.email } }, select: { id: true, status: true } })
        : null;
      if (previo && previo.status !== "CANCELLED") throw new Corte(YA_ANOTADO);
      if (!previo && (await tx.culturalActivityRsvp.count({ where: { activityId: a.id } })) >= RSVP_LIMITS.entries) {
        throw new Corte("No se reciben más confirmaciones para esta inauguración.");
      }
      const filas = await tx.culturalActivityRsvp.findMany({ where: { activityId: a.id, status: { in: ["CONFIRMED", "WAITLIST"] } }, select: { status: true, companions: true } });
      const e = rsvpPlacement({ capacity: capacidad, confirmedPeople: rsvpTotals(filas).people, party: partySize(entrada.companions) });
      if (previo) {
        // Vuelve al final de la cola (`createdAt` es el orden de llegada) con un enlace nuevo.
        await tx.culturalActivityRsvp.update({
          where: { id: previo.id, status: "CANCELLED" },
          data: { name: entrada.name, companions: entrada.companions, status: e, manageTokenHash: hash, createdAt: new Date(), cancelledAt: null, promotedAt: null },
        });
      } else {
        await tx.culturalActivityRsvp.create({ data: { activityId: a.id, name: entrada.name, email: entrada.email, companions: entrada.companions, status: e, manageTokenHash: hash } });
      }
      return e;
    });
  } catch (err) {
    if ((err as { code?: string })?.code === "P2002" || (err as { code?: string })?.code === "P2025") return { ok: false, error: YA_ANOTADO };
    if (err instanceof Corte) return { ok: false, error: err.message };
    throw err;
  }
  const enlace = `${baseUrlPublica()}/m/${a.slug}/inauguracion/r/${token}`;
  if (entrada.email) await avisarAsistencia({ email: entrada.email, nombre: entrada.name, estado, enlace, muestra: a });
  revalidatePath(`/panel/difusion/${a.id}/inauguracion`);
  return { ok: true, estado, enlace };
}

export type ResultadoCancelar = { ok: true } | { ok: false; error: string };
const NO_VALIDO: ResultadoCancelar = { ok: false, error: "Este enlace no es válido." };

/** "No voy a poder ir": cancela con el enlace personal y pasa a la siguiente persona de la espera. */
export async function cancelarMiAsistencia(token: string): Promise<ResultadoCancelar> {
  if (!esTokenConForma(token)) return NO_VALIDO;
  const ip = ipDeLaPeticion(await headers());
  if (!frenarPorIp("miAsistencia", ip).allowed) return { ok: false, error: "Probá de nuevo en unos minutos." };
  const k = await prisma.culturalActivityRsvp.findUnique({
    where: { manageTokenHash: hashDeToken(token) },
    select: { id: true, activityId: true, status: true, activity: { select: { slug: true, openingAt: true } } },
  });
  if (!k) return NO_VALIDO;
  if (k.status === "CANCELLED") return { ok: true };
  if (k.activity.openingAt && Date.now() >= k.activity.openingAt.getTime()) {
    return { ok: false, error: "La inauguración ya empezó: ya no se puede cancelar desde acá." };
  }
  const promovidas: Promovida[] = await prisma.$transaction(async (tx) => {
    const [bloqueada] = await tx.$queryRaw<{ rsvpCapacity: number | null }[]>`
      SELECT id, "rsvpCapacity" FROM "CulturalActivity" WHERE id = ${k.activityId} FOR UPDATE`;
    const { count } = await tx.culturalActivityRsvp.updateMany({ where: { id: k.id, status: { not: "CANCELLED" } }, data: { status: "CANCELLED", cancelledAt: new Date() } });
    if (count === 0) return [];
    return promoverEnTx(tx, k.activityId, bloqueada?.rsvpCapacity == null ? null : Number(bloqueada.rsvpCapacity));
  });
  if (promovidas.some((p) => p.email)) {
    const m = await prisma.culturalActivity.findUnique({ where: { id: k.activityId }, select: SELECT_CONFIRMAR });
    if (m) for (const p of promovidas) if (p.email) await avisarLugarLiberado({ email: p.email, nombre: p.name, muestra: m });
  }
  revalidatePath(`/panel/difusion/${k.activityId}/inauguracion`);
  return { ok: true };
}
