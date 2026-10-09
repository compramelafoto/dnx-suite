"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import {
  MAX_HIGHLIGHTS, MAX_WORKS, canEdit, canPerform, missingForSubmission, newSlug, nextStatus,
  toArDay, type ReviewAction, type ReviewStatus,
} from "@repo/muestras";
import { getUsuario } from "@/lib/usuario";
import { avisarAprobada, avisarNuevaPropuesta, avisarRechazada } from "@/lib/correos/enviar";
import { frenarPorUsuario } from "@/lib/limite";
import { datosParaGuardar, fichaDesdeFormData } from "./mapear";

export type ResultadoAccion = { ok: true; id: string } | { ok: false; errores: string[] };

const SIN_SESION: ResultadoAccion = { ok: false, errores: ["Tenés que ingresar."] };
const NO_EXISTE: ResultadoAccion = { ok: false, errores: ["La actividad no existe."] };

function refrescar(slug?: string) {
  revalidatePath("/");
  revalidatePath("/panel", "layout");
  // La ficha y las páginas de sus obras (`/m/<slug>/o/<id>`).
  if (slug) revalidatePath(`/m/${slug}`, "layout");
  revalidatePath("/fotografos", "layout");
}

/** Crea o actualiza la ficha y reemplaza su galería. No cambia el estado de revisión. */
export async function guardarBorrador(fd: FormData): Promise<ResultadoAccion> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const f = fichaDesdeFormData(fd);
  if (!f.title) return { ok: false, errores: ["Poné al menos un título para guardar."] };
  if (f.works.length > MAX_WORKS) return { ok: false, errores: [`La galería admite hasta ${MAX_WORKS} obras.`] };
  if (f.works.filter((w) => w.isHighlight).length > MAX_HIGHLIGHTS) {
    return { ok: false, errores: [`Podés destacar hasta ${MAX_HIGHLIGHTS} obras.`] };
  }
  const datos: ReturnType<typeof datosParaGuardar> = datosParaGuardar(f);
  const obras = f.works.map((w, i) => ({
    imageUrl: w.imageUrl, title: w.title, authorName: w.authorName, year: w.year,
    technique: w.technique, isHighlight: w.isHighlight, sortOrder: i,
  }));

  if (!f.id) {
    // Sólo se cuenta la creación: editar un borrador propio no tiene tope.
    if (!frenarPorUsuario("crearBorrador", usuario.id).allowed) {
      return { ok: false, errores: ["Creaste muchas actividades seguidas. Esperá un rato y probá de nuevo."] };
    }
    const creada = await prisma.culturalActivity.create({
      data: { ...datos, slug: newSlug(f.title), proposedByUserId: usuario.id, works: { create: obras } },
      select: { id: true },
    });
    refrescar();
    return { ok: true, id: creada.id };
  }

  const actual = await prisma.culturalActivity.findUnique({ where: { id: f.id } });
  if (!actual) return NO_EXISTE;
  const actor = { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin };
  if (!canEdit({ ...actual, reviewStatus: actual.reviewStatus as ReviewStatus }, actor)) {
    return { ok: false, errores: ["No podés editar esta actividad ahora."] };
  }
  // Una ficha ya enviada o publicada no puede quedar incompleta por una edición.
  if (actual.reviewStatus !== "DRAFT" && actual.reviewStatus !== "REJECTED") {
    const faltan = missingForSubmission({
      type: f.type, title: f.title, description: f.description, coverImageUrl: f.coverImageUrl,
      organizersText: f.organizersText, startDay: f.startDay, endDay: f.endDay,
      scheduleText: f.scheduleText, isVirtualOnly: f.isVirtualOnly, address: f.address,
      latitude: f.latitude, longitude: f.longitude, rightsConfirmed: f.rightsConfirmed,
      worksCount: f.works.length, highlightsCount: f.works.filter((w) => w.isHighlight).length,
    });
    if (faltan.length) return { ok: false, errores: faltan };
  }
  // Se conserva la primera confirmación de derechos.
  if (datos.rightsConfirmedAt && actual.rightsConfirmedAt) datos.rightsConfirmedAt = actual.rightsConfirmedAt;
  await prisma.$transaction([
    prisma.culturalActivity.update({ where: { id: f.id }, data: datos }),
    prisma.culturalActivityWork.deleteMany({ where: { activityId: f.id } }),
    prisma.culturalActivityWork.createMany({ data: obras.map((o) => ({ ...o, activityId: f.id! })) }),
  ]);
  refrescar(actual.slug);
  return { ok: true, id: f.id };
}

async function transicion(
  id: string,
  accion: ReviewAction,
  extra: (ahora: Date, revisor: number) => Record<string, unknown> = () => ({}),
  antes?: (usuario: { id: number }) => ResultadoAccion | null,
): Promise<ResultadoAccion> {
  if (typeof id !== "string") return NO_EXISTE;
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const corte = antes?.(usuario);
  if (corte) return corte;
  const fila = await prisma.culturalActivity.findUnique({ where: { id }, include: { works: true } });
  if (!fila) return NO_EXISTE;
  const estado = fila.reviewStatus as ReviewStatus;
  const permiso = canPerform(accion, { ...fila, reviewStatus: estado }, { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin });
  if (!permiso.ok) return { ok: false, errores: [permiso.reason] };

  if (accion === "submit") {
    const faltan = missingForSubmission({
      type: fila.type, title: fila.title, description: fila.description, coverImageUrl: fila.coverImageUrl,
      organizersText: fila.organizersText, startDay: toArDay(fila.startsAt), endDay: toArDay(fila.endsAt),
      scheduleText: fila.scheduleText, isVirtualOnly: fila.isVirtualOnly, address: fila.address,
      latitude: fila.latitude, longitude: fila.longitude, rightsConfirmed: fila.rightsConfirmedAt != null,
      worksCount: fila.works.length, highlightsCount: fila.works.filter((w) => w.isHighlight).length,
    });
    if (faltan.length) return { ok: false, errores: faltan };
  }

  const ahora = new Date();
  const { count } = await prisma.culturalActivity.updateMany({
    where: { id, reviewStatus: estado },
    data: { reviewStatus: nextStatus(accion, estado), ...extra(ahora, usuario.id) },
  });
  if (count === 0) return { ok: false, errores: ["La actividad cambió mientras tanto. Recargá la página."] };
  refrescar(fila.slug);
  return { ok: true, id };
}

/** Cada envío dispara un correo a la bandeja de revisión: por eso lleva tope por persona. */
function frenoDeEnvio(usuario: { id: number }): ResultadoAccion | null {
  if (frenarPorUsuario("enviarARevision", usuario.id).allowed) return null;
  return { ok: false, errores: ["Enviaste muchas actividades a revisión seguidas. Esperá un rato y probá de nuevo."] };
}

export async function enviarARevision(id: string) {
  const r = await transicion(id, "submit", (ahora) => ({ submittedAt: ahora, rejectionReason: null }), frenoDeEnvio);
  if (r.ok) await avisarNuevaPropuesta(id);
  return r;
}

export async function aprobar(id: string) {
  const r = await transicion(id, "approve", (ahora, revisor) => ({ reviewedAt: ahora, reviewedByUserId: revisor }));
  if (r.ok) await avisarAprobada(id);
  return r;
}

export async function rechazar(id: string, motivo: string): Promise<ResultadoAccion> {
  if (typeof id !== "string") return NO_EXISTE;
  if (typeof motivo !== "string") return { ok: false, errores: ["Escribí el motivo del rechazo."] };
  const m = motivo.trim();
  if (!m) return { ok: false, errores: ["Escribí el motivo del rechazo."] };
  const r = await transicion(id, "reject", (ahora, revisor) => ({ reviewedAt: ahora, reviewedByUserId: revisor, rejectionReason: m.slice(0, 1000) }));
  if (r.ok) await avisarRechazada(id);
  return r;
}

export async function despublicar(id: string) {
  return transicion(id, "unpublish", (ahora, revisor) => ({ reviewedAt: ahora, reviewedByUserId: revisor }));
}
export async function republicar(id: string) {
  return transicion(id, "republish", (ahora, revisor) => ({ reviewedAt: ahora, reviewedByUserId: revisor }));
}
export async function cancelar(id: string) {
  return transicion(id, "cancel", () => ({ isCancelled: true }));
}
export async function reactivar(id: string) {
  return transicion(id, "uncancel", () => ({ isCancelled: false }));
}
