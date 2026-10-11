"use server";

import { revalidatePath } from "next/cache";
import { prisma, type Prisma } from "@repo/db";
import {
  CONTEST_IMAGE_BATCH, activityRole, canEdit, dayEndAr, dayStartAr, newSlug, parseContestTiers, toArDay, type ContestTier, type ReviewStatus,
} from "@repo/muestras";
import { conPermiso, puede } from "@/lib/equipo/permisos";
import { datosDeCambio } from "@/lib/equipo/registro";
import { frenarPorUsuario } from "@/lib/limite";
import { getUsuario, type Usuario } from "@/lib/usuario";
import { aplicarResultados, CorteDeArmado } from "./armar";
import { mensajeDeResultados, resultadosDelConcurso, type ResultadosDelConcurso } from "./fotorank";
import { sincronizarObraConGaleria } from "./galeria";
import { borrarImagenDeConcurso, copiarImagenDeConcurso, ImagenDeConcursoError } from "./imagen";

/**
 * Acciones del concurso de FotoRank en la muestra (etapa 7). Cada una vuelve a leer la sesión y el
 * permiso en la base (D3): `resultadosDelConcurso` pide ser de la organización del concurso (o super
 * admin) y, sobre la muestra, la capacidad `contest` (sólo el dueño). Todo lo que escribe obras lo
 * hace en una transacción que bloquea la muestra (`FOR UPDATE`).
 */
export type ResultadoConcurso = { ok: true; id: string; avisos?: string[] } | { ok: false; errores: string[] };
export type ResultadoCopia =
  | { ok: true; copiadas: number; faltan: number; fallaron: number; avisos?: string[] }
  | { ok: false; errores: string[] };

const error = (texto: string): ResultadoConcurso => ({ ok: false, errores: [texto] });
const SIN_SESION = error("Tenés que ingresar.");
const MUESTRA_NO_EXISTE = "La muestra no existe.";
const NO_EDITABLE = "La muestra no se puede editar ahora (está en revisión o despublicada).";
const ES_ID = /^[A-Za-z0-9_-]{1,64}$/;
const DIA_MS = 24 * 60 * 60 * 1000;
/** Dos "Armar" del mismo concurso y la misma persona con menos de esto de diferencia son un doble clic. */
const VENTANA_DOBLE_CLIC_MS = 2 * 60 * 1000;
const OPCIONES_TX = { timeout: 60_000, maxWait: 10_000 } as const;
const NO_PUDIMOS_TRAER = "No pudimos traer la imagen de FotoRank. Probá de nuevo en un rato.";

type Resultados = Extract<ResultadosDelConcurso, { ok: true }>;

/** La fila del equipo de quien actúa (sólo la suya y activa): alcanza para `activityRole`. */
const filaPropia = (userId: number) => ({ where: { userId, status: "ACTIVE" }, select: { userId: true, role: true, status: true } }) as const;
const MUESTRA = {
  id: true, slug: true, type: true, reviewStatus: true, proposedByUserId: true, workspaceId: true, isCancelled: true,
  contestImport: { select: { id: true, contestId: true, tiers: true } },
} as const;

/** Bloquea la muestra y devuelve lo que piden las reglas de estado y permiso, ya con la fila bloqueada. */
async function bloquearMuestra(tx: Prisma.TransactionClient, activityId: string, usuario: Usuario) {
  await tx.$queryRaw`SELECT id FROM "CulturalActivity" WHERE id = ${activityId} FOR UPDATE`;
  const a = await tx.culturalActivity.findUnique({ where: { id: activityId }, select: { ...MUESTRA, members: filaPropia(usuario.id) } });
  if (!a) throw new CorteDeArmado(MUESTRA_NO_EXISTE);
  const role = activityRole(a, usuario.id);
  if (!puede(usuario, "contest", role)) throw new CorteDeArmado(MUESTRA_NO_EXISTE);
  if (!canEdit({ ...a, reviewStatus: a.reviewStatus as ReviewStatus }, { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin, role })) {
    throw new CorteDeArmado(NO_EDITABLE);
  }
  return a;
}

/** D8: título, descripción, organización y fechas provisorias (desde dentro de 30 días, por 30 días). */
function datosDeMuestraNueva(r: Resultados, usuarioId: number, ahora: Date) {
  const titulo = `Muestra ${r.contest.title.trim()}`.slice(0, 200);
  const descripcion =
    r.contest.shortDescription?.trim() ||
    `Las obras premiadas y seleccionadas de ${r.contest.title.trim()}, organizado por ${r.contest.organizationName.trim()}.`;
  return {
    type: "MUESTRA",
    title: titulo,
    slug: newSlug(titulo),
    description: descripcion,
    organizersText: r.contest.organizationName.trim(),
    startsAt: dayStartAr(toArDay(new Date(ahora.getTime() + 30 * DIA_MS))),
    endsAt: dayEndAr(toArDay(new Date(ahora.getTime() + 59 * DIA_MS))),
    proposedByUserId: usuarioId,
    ...datosDeCambio(usuarioId, "FICHA", ahora),
  };
}

const datosDelImport = (r: Resultados, tiers: readonly ContestTier[], usuarioId: number) => ({
  contestId: r.contest.id,
  contestSlug: r.contest.slug,
  contestTitle: r.contest.title,
  organizationId: r.contest.organizationId,
  organizationName: r.contest.organizationName,
  tiers: [...tiers],
  resultBatchId: r.batch.id,
  resultBatchStatus: r.batch.status,
  sourceVersion: r.batch.version,
  createdByUserId: usuarioId,
});

function refrescar(activityId: string, slug?: string) {
  revalidatePath("/panel", "layout");
  revalidatePath(`/panel/muestras/${activityId}`, "layout");
  if (slug) revalidatePath(`/m/${slug}`, "layout");
}

/**
 * "Armar la muestra" (D7, D8, D10): `contestId`, `tiers` (varios) y `destino` (`"nueva"` o el id de
 * una muestra propia). Una muestra existente tiene que ser del tipo muestra, editable y sin obras de
 * otro concurso; si ya tiene obras de este, se comporta como "Actualizar desde FotoRank".
 */
export async function armarMuestraDesdeConcurso(fd: FormData): Promise<ResultadoConcurso> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  const contestId = fd.get("contestId");
  const destino = fd.get("destino");
  if (typeof contestId !== "string" || !ES_ID.test(contestId)) return error(mensajeDeResultados("NO_EXISTE"));
  if (typeof destino !== "string" || (destino !== "nueva" && !ES_ID.test(destino))) return error("Elegí dónde van las obras.");
  const tiers = parseContestTiers(fd.getAll("tiers"));
  if (tiers.length === 0) return error("Elegí al menos un nivel: ganadores, menciones o preseleccionados.");
  if (!frenarPorUsuario("armarDesdeConcurso", usuario.id).allowed) return error("Armaste muchas muestras seguidas. Esperá un rato y probá de nuevo.");

  // Pide ser de la organización del concurso (o super admin): si no, "no existe".
  const r = await resultadosDelConcurso(usuario, contestId);
  if (!r.ok) return error(mensajeDeResultados(r.motivo));

  const ahora = new Date();
  let activityId = "";
  let slug = "";
  let avisos: string[] = [];
  try {
    await prisma.$transaction(async (tx) => {
      if (destino === "nueva") {
        // Bloqueo por concurso (no toca tablas de FotoRank): un doble clic o dos pestañas esperan acá
        // y la segunda encuentra la muestra que armó la primera.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`muestras-concurso:${contestId}`}))`;
        const reciente = await tx.culturalContestImport.findFirst({
          where: { contestId, createdByUserId: usuario.id, createdAt: { gte: new Date(ahora.getTime() - VENTANA_DOBLE_CLIC_MS) } },
          orderBy: { createdAt: "desc" },
          select: { activityId: true, activity: { select: { slug: true } } },
        });
        if (reciente) {
          activityId = reciente.activityId;
          slug = reciente.activity.slug;
          return;
        }
        const creada = await tx.culturalActivity.create({ data: datosDeMuestraNueva(r, usuario.id, ahora), select: { id: true, slug: true } });
        await tx.$queryRaw`SELECT id FROM "CulturalActivity" WHERE id = ${creada.id} FOR UPDATE`;
        const imp = await tx.culturalContestImport.create({ data: { activityId: creada.id, ...datosDelImport(r, tiers, usuario.id) }, select: { id: true } });
        await aplicarResultados(tx, { activityId: creada.id, importId: imp.id, resultados: r, tiers, ahora });
        activityId = creada.id;
        slug = creada.slug;
        avisos = ["Revisá fechas y sede: las pusimos provisorias."];
        return;
      }

      const a = await bloquearMuestra(tx, destino, usuario);
      if (a.type !== "MUESTRA") throw new CorteDeArmado("Las obras de un concurso van en una muestra (no en una charla, taller u otra actividad).");
      let importId = a.contestImport?.id;
      if (a.contestImport && a.contestImport.contestId !== contestId) throw new CorteDeArmado("Esta muestra ya tiene obras de otro concurso.");
      if (!importId) {
        importId = (await tx.culturalContestImport.create({ data: { activityId: a.id, ...datosDelImport(r, tiers, usuario.id) }, select: { id: true } })).id;
      }
      avisos = (await aplicarResultados(tx, { activityId: a.id, importId, resultados: r, tiers, ahora })).avisos ?? [];
      activityId = a.id;
      slug = a.slug;
    }, OPCIONES_TX);
  } catch (err) {
    if (err instanceof CorteDeArmado) return error(err.message);
    throw err;
  }
  refrescar(activityId, slug);
  return avisos.length ? { ok: true, id: activityId, avisos } : { ok: true, id: activityId };
}

/**
 * "Actualizar desde FotoRank" (D11): suma las obras nuevas de los niveles elegidos, actualiza premio,
 * categoría y orden, y marca las que ya no figuran. Hay que seguir organizando el concurso (D3). Si
 * ya no hay un lote cerrado (el jurado reabrió), no cambia nada.
 */
export async function actualizarDesdeConcurso(activityId: string, tiersPedidos?: readonly string[]): Promise<ResultadoConcurso> {
  const usuario = await getUsuario();
  if (!usuario) return SIN_SESION;
  if (typeof activityId !== "string" || !ES_ID.test(activityId)) return error(MUESTRA_NO_EXISTE);
  if (!frenarPorUsuario("actualizarConcurso", usuario.id).allowed) return error("Actualizaste muchas veces seguidas. Esperá un rato y probá de nuevo.");
  const a = await prisma.culturalActivity.findFirst({
    where: conPermiso({ id: activityId }, usuario, "contest"),
    select: { id: true, contestImport: { select: { id: true, contestId: true, tiers: true } } },
  });
  if (!a?.contestImport) return error(MUESTRA_NO_EXISTE);
  const tiers = tiersPedidos ? parseContestTiers(tiersPedidos) : parseContestTiers(a.contestImport.tiers);
  if (tiers.length === 0) return error("Elegí al menos un nivel: ganadores, menciones o preseleccionados.");

  const r = await resultadosDelConcurso(usuario, a.contestImport.contestId);
  if (!r.ok) {
    if (r.motivo === "SIN_RESULTADOS") return error("Los resultados de este concurso ya no están cerrados en FotoRank. La muestra queda como está.");
    if (r.motivo === "MARATON") return error(mensajeDeResultados("MARATON"));
    return error("No podés actualizar desde FotoRank: el concurso ya no está o ya no lo organizás. La muestra queda como está.");
  }

  let slug = "";
  let avisos: string[] = [];
  const importId = a.contestImport.id;
  try {
    await prisma.$transaction(async (tx) => {
      const m = await bloquearMuestra(tx, activityId, usuario);
      if (m.contestImport?.id !== importId) throw new CorteDeArmado("La muestra cambió mientras tanto. Recargá la página.");
      avisos = (await aplicarResultados(tx, { activityId, importId, resultados: r, tiers })).avisos ?? [];
      slug = m.slug;
    }, OPCIONES_TX);
  } catch (err) {
    if (err instanceof CorteDeArmado) return error(err.message);
    throw err;
  }
  refrescar(activityId, slug);
  return avisos.length ? { ok: true, id: activityId, avisos } : { ok: true, id: activityId };
}

// ── Imágenes ────────────────────────────────────────────────────────────────

/**
 * Sesión, id, freno y la capacidad `contest` sobre la muestra, leída en la base (D3). La coorganización
 * no la tiene: para ella la muestra "no existe" en estas acciones.
 */
async function prepararMuestra(activityId: unknown, freno: "copiarImagenesConcurso" | "opcionesConcurso") {
  const usuario = await getUsuario();
  if (!usuario) return { listo: false as const, error: SIN_SESION };
  if (typeof activityId !== "string" || !ES_ID.test(activityId)) return { listo: false as const, error: error(MUESTRA_NO_EXISTE) };
  if (!frenarPorUsuario(freno, usuario.id).allowed) return { listo: false as const, error: error("Hiciste muchos cambios seguidos. Esperá unos minutos.") };
  const a = await prisma.culturalActivity.findFirst({
    where: conPermiso({ id: activityId }, usuario, "contest"),
    select: {
      id: true, slug: true, reviewStatus: true, proposedByUserId: true, workspaceId: true, isCancelled: true, startsAt: true, endsAt: true,
      members: filaPropia(usuario.id), contestImport: { select: { id: true } },
    },
  });
  if (!a?.contestImport) return { listo: false as const, error: error(MUESTRA_NO_EXISTE) };
  // Como el editor y la revisión de expositores: en revisión (o despublicada) no cambian sus obras.
  const editable = canEdit({ ...a, reviewStatus: a.reviewStatus as ReviewStatus }, { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin, role: activityRole(a, usuario.id) });
  return { listo: true as const, usuario, activityId: a.id, muestra: a, editable };
}

const EN_REVISION = "La muestra está en revisión: esperá a que se revise para cambiar sus obras.";
const noEditable = (reviewStatus: string) => error(reviewStatus === "IN_REVIEW" ? EN_REVISION : NO_EDITABLE);

/** Las obras que esperan su imagen: marcadas, con permiso y sin copiar. Antes del permiso, la imagen no sale de FotoRank. */
const esperanImagen = (activityId: string) => ({ activityId, include: true, imageStatus: "PENDING", exhibitConsent: "ACCEPTED" });

/** Borra del bucket las copias de las obras que salieron de la muestra (después de la transacción). */
async function borrarCopias(urls: readonly (string | undefined)[]) {
  for (const u of urls) if (u) await borrarImagenDeConcurso(u);
}

/**
 * Copia una tanda de imágenes (D12): hasta `CONTEST_IMAGE_BATCH`, en el orden del ranking. La copia
 * (bajar de FotoRank, procesar y subir) va **fuera** de la transacción, una por una; después, por
 * cada una, una transacción corta que bloquea la muestra, marca la imagen y lleva la obra a la
 * galería. Lo copiado no se pierde: si se corta, la próxima vez sigue donde quedó. Una que falla
 * queda `FAILED` con el motivo y las demás siguen; sin la conexión con FotoRank, frena y lo dice.
 */
export async function copiarImagenesDelConcurso(activityId: string): Promise<ResultadoCopia> {
  const p = await prepararMuestra(activityId, "copiarImagenesConcurso");
  if (!p.listo) return p.error as ResultadoCopia;
  if (!p.editable) return noEditable(p.muestra.reviewStatus) as ResultadoCopia;
  const { usuario } = p;
  const tanda = await prisma.culturalContestWork.findMany({
    where: esperanImagen(p.activityId),
    orderBy: [{ rank: "asc" }, { id: "asc" }],
    take: CONTEST_IMAGE_BATCH,
    select: { id: true },
  });

  let copiadas = 0;
  const avisos = new Set<string>();
  const borrar: (string | undefined)[] = [];
  const fallar = (ids: string[], motivo: string) =>
    prisma.culturalContestWork.updateMany({ where: { id: { in: ids }, activityId: p.activityId, imageStatus: "PENDING" }, data: { imageStatus: "FAILED", imageError: motivo } });

  for (let i = 0; i < tanda.length; i++) {
    const { id } = tanda[i]!;
    let copia: { url: string };
    try {
      copia = await copiarImagenDeConcurso(id);
    } catch (err) {
      if (err instanceof ImagenDeConcursoError && err.code === "NOT_CONFIGURED") {
        await fallar(tanda.slice(i).map((t) => t.id), err.message);
        return { ok: false, errores: [err.message] };
      }
      // Cambió mientras tanto (el autor la sacó o la quitaron): no es un error de la imagen.
      if (err instanceof ImagenDeConcursoError && err.code === "NOT_ALLOWED") continue;
      if (!(err instanceof ImagenDeConcursoError)) console.error("[muestras] concurso copia:", id, err instanceof Error ? err.message : String(err));
      await fallar([id], err instanceof ImagenDeConcursoError && err.code === "INVALID" ? err.message : NO_PUDIMOS_TRAER);
      continue;
    }
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "CulturalActivity" WHERE id = ${p.activityId} FOR UPDATE`;
        if ((await tx.culturalActivity.count({ where: conPermiso({ id: p.activityId }, usuario, "contest") })) === 0) throw new CorteDeArmado(MUESTRA_NO_EXISTE);
        const { count } = await tx.culturalContestWork.updateMany({
          where: { id, ...esperanImagen(p.activityId) },
          data: { imageStatus: "COPIED", imageUrl: copia.url, imageError: null, copiedAt: new Date() },
        });
        // Otra pestaña ya la copió, o cambió en el medio: la próxima tanda lo resuelve.
        if (count === 0) return;
        const s = await sincronizarObraConGaleria(tx, p.activityId, id);
        if (s.aviso) avisos.add(s.aviso);
        borrar.push(s.borrarImagen);
      }, { timeout: 30_000, maxWait: 10_000 });
      copiadas += 1;
    } catch (err) {
      if (err instanceof CorteDeArmado) return error(err.message) as ResultadoCopia;
      throw err;
    }
  }
  await borrarCopias(borrar);

  const [faltan, fallaron] = await Promise.all([
    prisma.culturalContestWork.count({ where: esperanImagen(p.activityId) }),
    prisma.culturalContestWork.count({ where: { activityId: p.activityId, include: true, imageStatus: "FAILED" } }),
  ]);
  if (copiadas) refrescar(p.activityId);
  return avisos.size ? { ok: true, copiadas, faltan, fallaron, avisos: [...avisos] } : { ok: true, copiadas, faltan, fallaron };
}

/** "Reintentar": las imágenes que fallaron vuelven a esperar su copia. */
export async function reintentarImagenes(activityId: string): Promise<ResultadoConcurso> {
  const p = await prepararMuestra(activityId, "copiarImagenesConcurso");
  if (!p.listo) return p.error;
  await prisma.culturalContestWork.updateMany({
    where: { activityId: p.activityId, include: true, imageStatus: "FAILED" },
    data: { imageStatus: "PENDING", imageError: null },
  });
  refrescar(p.activityId);
  return { ok: true, id: p.activityId };
}
