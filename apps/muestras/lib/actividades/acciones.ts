"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import {
  AVISO_PERFIL_EN_PUBLICADA, MAX_HIGHLIGHTS, MAX_WORKS, OBRA_QUITADA_DE_LA_GALERIA, activityRole, allowedAuthorProfileId,
  canEdit, canPerform, editorGalleryPlan, missingForSubmission, newSlug, nextStatus, openingProblems, resolveAuthorProfileId, toArDay,
  type ReviewAction, type ReviewStatus,
} from "@repo/muestras";
import { getUsuario } from "@/lib/usuario";
import { avisarAprobada, avisarNuevaPropuesta, avisarRechazada } from "@/lib/correos/enviar";
import { conPermiso } from "@/lib/equipo/permisos";
import { datosDeCambio } from "@/lib/equipo/registro";
import { OBRA_DE_EXPOSITOR_QUITADA, copiarTextosAExpositores } from "@/lib/expositores/copiar";
import { Choque, PAGINA_VIEJA, mensajeDeChoque } from "./choque";
import { frenarPorUsuario } from "@/lib/limite";
import { datosParaGuardar, fichaDesdeFormData, modoDeGaleriaAlGuardar, type FichaForm } from "./mapear";

/** `avisos`: cosas que no frenaron el guardado pero conviene contarle a la persona. */
export type ResultadoAccion =
  | { ok: true; id: string; avisos?: string[]; /** Enlace para mandar a mano cuando el correo no salió. */ enlace?: string }
  | { ok: false; errores: string[] };

const SIN_SESION: ResultadoAccion = { ok: false, errores: ["Tenés que ingresar."] };
const NO_EXISTE: ResultadoAccion = { ok: false, errores: ["La actividad no existe."] };

class Corte extends Error {}
/** Ya no tiene el permiso cuando se bloquea la fila (la sacaron del equipo en el medio). */
class SinPermiso extends Error {}

/** La fila del equipo de quien actúa (sólo la suya y activa): alcanza para `activityRole`. */
const filaPropia = (userId: number) =>
  ({ where: { userId, status: "ACTIVE" }, select: { userId: true, role: true, status: true } }) as const;

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
type Previa = { authorProfileId: string | null; authorUserId: number | null; imageUrl?: string; authorName?: string };

async function obrasParaGuardar(
  works: FichaForm["works"],
  previas: ReadonlyMap<string, Previa>,
  duenoId: number,
  contexto: { status: string; isSuperAdmin: boolean } = { status: "DRAFT", isSuperAdmin: false },
  db: Pick<typeof prisma, "photographerProfile"> = prisma,
  deExpositor: ReadonlySet<string> = new Set(),
) {
  const perfilPropio = await db.photographerProfile.findUnique({ where: { userId: duenoId }, select: { id: true, displayName: true } });
  const pedidos = [...new Set(works.map((w) => w.authorProfileId).filter((x): x is string => !!x))];
  const existentes = new Set(
    pedidos.length
      ? (await db.photographerProfile.findMany({ where: { id: { in: pedidos } }, select: { id: true } })).map((p) => p.id)
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
    const previa = conserva ? previas.get(w.id!) : undefined;
    // Una obra que cargó quien expone (etapa 6, D9) conserva su imagen y su autoría tal como están
    // en la base: lo que llegue del formulario para esos campos se ignora.
    if (previa && deExpositor.has(w.id!) && previa.imageUrl != null && previa.authorName != null) {
      return {
        id: w.id, imageUrl: previa.imageUrl, title: w.title, authorName: previa.authorName, year: w.year,
        technique: w.technique, isHighlight: w.isHighlight, sortOrder: i,
        authorProfileId: previa.authorProfileId, authorUserId: previa.authorUserId,
      };
    }
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
  const inauguracion = openingProblems({ openingDay: f.openingDay, openingClock: f.openingClock, openingEndClock: f.openingEndClock, endDay: f.endDay });
  if (inauguracion.length) return { ok: false, errores: inauguracion };
  const datos: ReturnType<typeof datosParaGuardar> = datosParaGuardar(f);

  if (!f.id) {
    // Sólo se cuenta la creación: editar un borrador propio no tiene tope.
    if (!frenarPorUsuario("crearBorrador", usuario.id).allowed) {
      return { ok: false, errores: ["Creaste muchas actividades seguidas. Esperá un rato y probá de nuevo."] };
    }
    // Una actividad nueva es un borrador: todavía no hay límite de perfiles.
    const { obras } = await obrasParaGuardar(f.works, new Map(), usuario.id);
    const creada = await prisma.culturalActivity.create({
      data: { ...datos, slug: newSlug(f.title), proposedByUserId: usuario.id, ...datosDeCambio(usuario.id, "FICHA"), works: { create: obras } },
      select: { id: true },
    });
    refrescar();
    return { ok: true, id: creada.id };
  }

  const actual = await prisma.culturalActivity.findUnique({
    where: { id: f.id },
    include: { works: { select: { id: true, isHighlight: true } }, members: filaPropia(usuario.id) },
  });
  if (!actual) return NO_EXISTE;
  // El rol se lee en la base en cada guardado: sacar a alguien del equipo corta en el próximo pedido.
  const actor = { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin, role: activityRole(actual, usuario.id) };
  if (!canEdit({ ...actual, reviewStatus: actual.reviewStatus as ReviewStatus }, actor)) {
    return { ok: false, errores: ["No podés editar esta actividad ahora."] };
  }
  if (f.editVersion == null) return { ok: false, errores: [PAGINA_VIEJA] };
  // Una ficha ya enviada o publicada no puede quedar incompleta por una edición. Cuentan también
  // las obras que se conservan aunque el editor no las haya visto (ver `editorGalleryPlan`).
  if (actual.reviewStatus !== "DRAFT" && actual.reviewStatus !== "REJECTED") {
    const cargadas = new Set([...f.idsCargados, ...f.works.flatMap((w) => (w.id ? [w.id] : []))]);
    const sinVer = actual.works.filter((w) => !cargadas.has(w.id));
    const faltan = missingForSubmission({
      type: f.type, title: f.title, description: f.description, coverImageUrl: f.coverImageUrl,
      organizersText: f.organizersText, startDay: f.startDay, endDay: f.endDay,
      scheduleText: f.scheduleText, isVirtualOnly: f.isVirtualOnly, address: f.address,
      latitude: f.latitude, longitude: f.longitude, rightsConfirmed: f.rightsConfirmed,
      worksCount: f.works.length + sinVer.length,
      highlightsCount: f.works.filter((w) => w.isHighlight).length + sinVer.filter((w) => w.isHighlight).length,
    });
    if (faltan.length) return { ok: false, errores: faltan };
  }
  // Se conserva la primera confirmación de derechos.
  if (datos.rightsConfirmedAt && actual.rightsConfirmedAt) datos.rightsConfirmedAt = actual.rightsConfirmedAt;
  // Con la sorpresa cargada (etapa 6, spec D24), qué se ve online lo decide Visibilidad: la casilla
  // del formulario ya no está y lo que llegue no pisa el modo guardado.
  datos.galleryMode = modoDeGaleriaAlGuardar(datos.galleryMode, actual);
  const id = f.id;
  const version = f.editVersion;
  let avisos: string[];
  try {
    avisos = await prisma.$transaction(
      async (tx) => {
        // Bloquea la muestra: armarla desde una convocatoria (que también la bloquea) no puede
        // sumar obras entre que se leen y se reescriben. De paso lee la versión: si otra persona
        // del equipo guardó la ficha o los textos desde que se abrió el formulario, no se pisa.
        // (`editVersion` es INTEGER: llega como número, no bigint.)
        const [bloqueada] = await tx.$queryRaw<{ editVersion: number; lastEditedByUserId: number | null; lastEditedPart: string | null }[]>`
          SELECT "editVersion", "lastEditedByUserId", "lastEditedPart" FROM "CulturalActivity" WHERE id = ${id} FOR UPDATE`;
        // El permiso se vuelve a leer con la fila bloqueada: si a esta persona la sacaron del
        // equipo (o le cambiaron el rol) después de la primera lectura, no guarda.
        if (bloqueada && (await tx.culturalActivity.count({ where: conPermiso({ id }, usuario, "editActivity") })) === 0) throw new SinPermiso();
        if (!bloqueada || Number(bloqueada.editVersion) !== version) throw new Choque(id, bloqueada ?? null);
        const enLaBase = await tx.culturalActivityWork.findMany({
          where: { activityId: id },
          select: { id: true, isHighlight: true, sortOrder: true, authorProfileId: true, authorUserId: true, imageUrl: true, authorName: true },
        });
        // Las obras que vinieron de un expositor (etapa 6): su imagen y su autor no se tocan desde acá.
        const expositoras = await tx.culturalExhibitorWork.findMany({
          where: { activityId: id, activityWorkId: { not: null } },
          select: { id: true, activityWorkId: true },
        });
        const deExpositor = new Map(expositoras.flatMap((e) => (e.activityWorkId ? [[e.activityWorkId, e.id] as const] : [])));
        const r = await obrasParaGuardar(
          f.works,
          new Map(enLaBase.map((w) => [w.id, {
            authorProfileId: w.authorProfileId ?? null, authorUserId: w.authorUserId ?? null, imageUrl: w.imageUrl, authorName: w.authorName,
          }])),
          actual.proposedByUserId,
          { status: actual.reviewStatus, isSuperAdmin: usuario.esSuperAdmin },
          tx,
          new Set(deExpositor.keys()),
        );
        const plan = editorGalleryPlan({
          current: enLaBase,
          loadedIds: f.idsCargados,
          keptIds: r.obras.flatMap((o) => (o.id ? [o.id] : [])),
          submittedCount: r.obras.length,
          submittedHighlights: r.obras.filter((o) => o.isHighlight).length,
        });
        if (plan.problems.length) throw new Corte(plan.problems.join(" "));
        const conservadas = plan.preserved.map((w) => w.id);
        await tx.culturalActivity.update({ where: { id }, data: { ...datos, editVersion: { increment: 1 }, ...datosDeCambio(usuario.id, "FICHA") } });
        // Se reescriben las enviadas (las que ya existían conservan su id) y se quitan las que el
        // editor sacó. Las conservadas no se tocan, salvo su orden: van después de las enviadas.
        await tx.culturalActivityWork.deleteMany({ where: { activityId: id, id: { notIn: conservadas } } });
        if (r.obras.length) await tx.culturalActivityWork.createMany({ data: r.obras.map((o) => ({ ...o, activityId: id })) });
        for (const w of plan.preserved) {
          await tx.culturalActivityWork.update({ where: { id: w.id }, data: { sortOrder: w.sortOrder } });
        }
        // Una obra elegida en una convocatoria que se quitó a propósito no se vuelve a copiar al
        // armar la muestra otra vez.
        if (plan.removedIds.length) {
          await tx.culturalCallWork.updateMany({
            where: { activityWorkId: { in: plan.removedIds }, call: { activityId: id } },
            data: { activityWorkId: OBRA_QUITADA_DE_LA_GALERIA },
          });
        }
        await copiarTextosAExpositores(tx, id, r.obras, deExpositor);
        // Una obra de expositor que el editor quitó deja de estar en la muestra (spec D9).
        const quitadas = plan.removedIds.filter((w) => deExpositor.has(w));
        if (quitadas.length) {
          await tx.culturalExhibitorWork.updateMany({
            where: { activityId: id, activityWorkId: { in: quitadas } },
            data: { status: "REMOVED", activityWorkId: null, reviewNote: OBRA_DE_EXPOSITOR_QUITADA },
          });
        }
        return r.avisos;
      },
      { timeout: 30_000, maxWait: 10_000 },
    );
  } catch (err) {
    if (err instanceof Corte) return { ok: false, errores: [err.message] };
    if (err instanceof SinPermiso) return { ok: false, errores: ["No podés editar esta actividad ahora."] };
    if (err instanceof Choque) return { ok: false, errores: [await mensajeDeChoque(err)] };
    throw err;
  }
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
  const fila = await prisma.culturalActivity.findUnique({ where: { id }, include: { works: true, members: filaPropia(usuario.id) } });
  if (!fila) return NO_EXISTE;
  const estado = fila.reviewStatus as ReviewStatus;
  const permiso = canPerform(accion, { ...fila, reviewStatus: estado }, { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin, role: activityRole(fila, usuario.id) });
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
