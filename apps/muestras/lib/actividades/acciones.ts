"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import {
  AVISO_PERFIL_EN_PUBLICADA, MAX_HIGHLIGHTS, MAX_WORKS, allowedAuthorProfileId, canEdit, canPerform, missingForSubmission, newSlug, nextStatus, resolveAuthorProfileId,
  toArDay, type ReviewAction, type ReviewStatus,
} from "@repo/muestras";
import { getUsuario } from "@/lib/usuario";
import { avisarAprobada, avisarNuevaPropuesta, avisarRechazada } from "@/lib/correos/enviar";
import { frenarPorUsuario } from "@/lib/limite";
import { datosParaGuardar, fichaDesdeFormData, type FichaForm } from "./mapear";

/** `avisos`: cosas que no frenaron el guardado pero conviene contarle a la persona. */
export type ResultadoAccion =
  | { ok: true; id: string; avisos?: string[]; /** Enlace para mandar a mano cuando el correo no salió. */ enlace?: string }
  | { ok: false; errores: string[] };

const SIN_SESION: ResultadoAccion = { ok: false, errores: ["Tenés que ingresar."] };
const NO_EXISTE: ResultadoAccion = { ok: false, errores: ["La actividad no existe."] };

function refrescar(slug?: string) {
  revalidatePath("/");
  revalidatePath("/panel", "layout");
  // La ficha y las páginas de sus obras (`/m/<slug>/o/<id>`).
  if (slug) revalidatePath(`/m/${slug}`, "layout");
  revalidatePath("/fotografos", "layout");
}

/**
 * Las obras tal como se escriben.
 *
 * - Cada obra que ya era de esta muestra conserva su id: está en la URL de su página y en el QR
 *   de la ficha impresa. Un id ajeno o repetido se descarta y la obra se crea como nueva.
 * - El perfil del autor se resuelve con `resolveAuthorProfileId`, usando el perfil de quien
 *   propuso la muestra (no el de quien edita: puede ser el super admin).
 * - Si la muestra ya se publicó, `allowedAuthorProfileId` limita a qué perfil se puede vincular
 *   (el vínculo que la obra ya tenía, el perfil de quien propuso o ninguno). Lo demás se ignora y
 *   vuelve un aviso que no frena el guardado.
 */
async function obrasParaGuardar(
  works: FichaForm["works"],
  previas: ReadonlyMap<string, { authorProfileId: string | null; authorUserId: number | null }>,
  duenoId: number,
  contexto: { status: string; isSuperAdmin: boolean } = { status: "DRAFT", isSuperAdmin: false },
) {
  const perfilPropio = await prisma.photographerProfile.findUnique({ where: { userId: duenoId }, select: { id: true, displayName: true } });
  const pedidos = [...new Set(works.map((w) => w.authorProfileId).filter((x): x is string => !!x))];
  const existentes = new Set(
    pedidos.length
      ? (await prisma.photographerProfile.findMany({ where: { id: { in: pedidos } }, select: { id: true } })).map((p) => p.id)
      : [],
  );
  const usados = new Set<string>();
  let bloqueado = false;
  const obras = works.map((w, i) => {
    const conserva = !!w.id && previas.has(w.id) && !usados.has(w.id);
    if (conserva) usados.add(w.id!);
    const pedido = resolveAuthorProfileId(
      { isNew: !conserva, authorName: w.authorName, requestedProfileId: w.authorProfileId },
      existentes,
      perfilPropio,
    );
    const permitido = allowedAuthorProfileId({
      status: contexto.status,
      previous: conserva ? previas.get(w.id!)?.authorProfileId ?? null : null,
      requested: pedido,
      ownerProfileId: perfilPropio?.id ?? null,
      isSuperAdmin: contexto.isSuperAdmin,
    });
    if (permitido.blocked) bloqueado = true;
    return {
      ...(conserva ? { id: w.id } : {}),
      imageUrl: w.imageUrl, title: w.title, authorName: w.authorName, year: w.year,
      technique: w.technique, isHighlight: w.isHighlight, sortOrder: i,
      authorProfileId: permitido.id,
      // La cuenta del autor (p. ej. de una obra que llegó por convocatoria) no se edita en el
      // formulario: se conserva, porque reescribir la galería no puede borrarla.
      authorUserId: conserva ? previas.get(w.id!)?.authorUserId ?? null : null,
    };
  });
  return { obras, avisos: bloqueado ? [AVISO_PERFIL_EN_PUBLICADA] : [] };
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

  if (!f.id) {
    // Sólo se cuenta la creación: editar un borrador propio no tiene tope.
    if (!frenarPorUsuario("crearBorrador", usuario.id).allowed) {
      return { ok: false, errores: ["Creaste muchas actividades seguidas. Esperá un rato y probá de nuevo."] };
    }
    // Una actividad nueva es un borrador: todavía no hay límite de perfiles.
    const { obras } = await obrasParaGuardar(f.works, new Map(), usuario.id);
    const creada = await prisma.culturalActivity.create({
      data: { ...datos, slug: newSlug(f.title), proposedByUserId: usuario.id, works: { create: obras } },
      select: { id: true },
    });
    refrescar();
    return { ok: true, id: creada.id };
  }

  const actual = await prisma.culturalActivity.findUnique({ where: { id: f.id }, include: { works: { select: { id: true, authorProfileId: true, authorUserId: true } } } });
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
  const { obras, avisos } = await obrasParaGuardar(
    f.works,
    new Map(actual.works.map((w) => [w.id, { authorProfileId: w.authorProfileId ?? null, authorUserId: w.authorUserId ?? null }])),
    actual.proposedByUserId,
    { status: actual.reviewStatus, isSuperAdmin: usuario.esSuperAdmin },
  );
  await prisma.$transaction([
    prisma.culturalActivity.update({ where: { id: f.id }, data: datos }),
    prisma.culturalActivityWork.deleteMany({ where: { activityId: f.id } }),
    prisma.culturalActivityWork.createMany({ data: obras.map((o) => ({ ...o, activityId: f.id! })) }),
  ]);
  refrescar(actual.slug);
  return avisos.length ? { ok: true, id: f.id, avisos } : { ok: true, id: f.id };
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
