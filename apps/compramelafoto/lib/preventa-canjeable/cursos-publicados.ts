/**
 * Aviso por curso en álbumes escolares con preventa (lado base de datos).
 *
 * El fotógrafo marca qué cursos ya subió (al subir las fotos o desde la pestaña Preventa). La
 * marca queda en `AlbumCursoPublicado` con `avisoAt` null y el aviso sale solo, a las familias
 * de esos cursos, cuando el álbum terminó de procesarse (misma regla que el resto de los mails
 * que llevan al álbum: `getAlbumsReadiness`). Lo revisa el cron horario y también el momento
 * de marcar, por si el álbum ya estaba listo.
 */

import { OrderOrigin, OrderStatus, prisma } from "@/lib/prisma";
import { getAlbumsReadiness } from "@/lib/analysis/album-analysis-readiness";
import { isPlaceholderEmail } from "@/lib/canje-externo/external-preventa";
import { textoCurso } from "@/lib/schools/embudo-pedidos-escolares";
import { fechaAvisoFotosListas } from "./aviso-fotos-listas";
import { notifyPreventaPhotosReady } from "./notify-preventa-photos-ready";
import { parsePreCompraOrderIdFromPaymentRef } from "./preventa-redeem-url";
import {
  packsAAvisar,
  resumirCursos,
  type MarcaDeCurso,
  type PackConCurso,
  type ResumenCurso,
} from "./cursos-publicados-reglas";

function tieneEmailReal(email: string | null): boolean {
  return Boolean(email?.includes("@")) && !isPlaceholderEmail(email);
}

/** Packs de preventa pagados (no de prueba) de los álbumes, con el curso que eligió la familia. */
export async function packsConCurso(albumIds: readonly number[]): Promise<Map<number, PackConCurso[]>> {
  const out = new Map<number, PackConCurso[]>();
  if (albumIds.length === 0) return out;
  const orders = await prisma.order.findMany({
    where: {
      albumId: { in: [...albumIds] },
      origin: OrderOrigin.PREVENTA_PACK,
      status: OrderStatus.PAID,
      isTest: false,
    },
    select: {
      id: true,
      albumId: true,
      buyerEmail: true,
      preCompraPaymentRef: true,
      redemptionOrderId: true,
      redemptionPaymentRefsJson: true,
    },
  });
  const preCompraIds = [
    ...new Set(
      orders
        .map((o) => parsePreCompraOrderIdFromPaymentRef(o.preCompraPaymentRef))
        .filter((id): id is number => id != null)
    ),
  ];
  const cursos = preCompraIds.length
    ? await prisma.preCompraOrder.findMany({
        where: { id: { in: preCompraIds } },
        select: { id: true, schoolCourseId: true },
      })
    : [];
  const cursoDe = new Map(cursos.map((c) => [c.id, c.schoolCourseId]));
  for (const o of orders) {
    if (o.albumId == null) continue;
    const pc = parsePreCompraOrderIdFromPaymentRef(o.preCompraPaymentRef);
    const lista = out.get(o.albumId) ?? [];
    lista.push({
      orderId: o.id,
      schoolCourseId: pc != null ? (cursoDe.get(pc) ?? null) : null,
      canjeado: o.redemptionOrderId != null,
      avisoAt: fechaAvisoFotosListas(o.redemptionPaymentRefsJson),
      tieneEmail: tieneEmailReal(o.buyerEmail),
    });
    out.set(o.albumId, lista);
  }
  return out;
}

/** Marcas de curso de los álbumes, por álbum y por curso. */
export async function marcasDeCurso(albumIds: readonly number[]): Promise<Map<number, Map<number, MarcaDeCurso>>> {
  const out = new Map<number, Map<number, MarcaDeCurso>>();
  if (albumIds.length === 0) return out;
  const rows = await prisma.albumCursoPublicado.findMany({
    where: { albumId: { in: [...albumIds] } },
    select: { albumId: true, schoolCourseId: true, marcadoAt: true, avisoAt: true },
  });
  for (const r of rows) {
    const m = out.get(r.albumId) ?? new Map<number, MarcaDeCurso>();
    m.set(r.schoolCourseId, { schoolCourseId: r.schoolCourseId, marcadoAt: r.marcadoAt, avisoAt: r.avisoAt });
    out.set(r.albumId, m);
  }
  return out;
}

export type CursosDelAlbum = {
  esEscolar: boolean;
  cursos: ResumenCurso[];
  /** Packs sin canjear cuyo curso no se sabe (packs cobrados por fuera, ventas viejas). */
  pendientesSinCurso: number;
};

/** Para el panel: cada curso de la escuela del álbum, con sus familias y si ya se avisó. */
export async function cursosDelAlbum(albumId: number): Promise<CursosDelAlbum> {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: {
      school: {
        select: {
          courses: {
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { division: "asc" }],
            select: { id: true, name: true, division: true },
          },
        },
      },
    },
  });
  if (!album?.school) return { esEscolar: false, cursos: [], pendientesSinCurso: 0 };
  const [packs, marcas] = await Promise.all([packsConCurso([albumId]), marcasDeCurso([albumId])]);
  const delAlbum = packs.get(albumId) ?? [];
  const cursos = album.school.courses.map((c) => ({ id: c.id, nombre: textoCurso(c) ?? c.name }));
  const idsDeLaEscuela = new Set(cursos.map((c) => c.id));
  return {
    esEscolar: true,
    cursos: resumirCursos(cursos, delAlbum, marcas.get(albumId) ?? new Map()),
    pendientesSinCurso: delAlbum.filter(
      (p) => !p.canjeado && (p.schoolCourseId == null || !idsDeLaEscuela.has(p.schoolCourseId))
    ).length,
  };
}

/**
 * Marca cursos como subidos. Si un curso ya estaba marcado, renueva la marca y lo deja otra vez
 * pendiente de aviso (p. ej. se subieron retomas): les vuelve a llegar a los que no canjearon.
 * Sólo acepta cursos de la escuela del álbum.
 */
export async function marcarCursosSubidos(params: {
  albumId: number;
  cursoIds: readonly number[];
  userId: number | null;
  now?: Date;
  /** El aviso ya salió por otro lado (Pedidos con el filtro de curso): se marca como avisado. */
  yaAvisado?: boolean;
}): Promise<number[]> {
  if (params.cursoIds.length === 0) return [];
  const now = params.now ?? new Date();
  const album = await prisma.album.findUnique({ where: { id: params.albumId }, select: { schoolId: true } });
  if (album?.schoolId == null) return [];
  const validos = await prisma.schoolCourse.findMany({
    where: { id: { in: [...params.cursoIds] }, schoolId: album.schoolId },
    select: { id: true },
  });
  const avisoAt = params.yaAvisado ? now : null;
  for (const c of validos) {
    await prisma.albumCursoPublicado.upsert({
      where: { albumId_schoolCourseId: { albumId: params.albumId, schoolCourseId: c.id } },
      create: {
        albumId: params.albumId,
        schoolCourseId: c.id,
        marcadoAt: now,
        avisoAt,
        marcadoPorUserId: params.userId,
      },
      update: { marcadoAt: now, avisoAt, marcadoPorUserId: params.userId },
    });
  }
  return validos.map((c) => c.id);
}

/** Cursos de esos packs (para marcar como avisados los cursos de un aviso hecho desde Pedidos). */
export async function cursosDeLosPacks(albumId: number, orderIds: readonly number[]): Promise<number[]> {
  const packs = (await packsConCurso([albumId])).get(albumId) ?? [];
  const ids = new Set(orderIds);
  return [
    ...new Set(
      packs.filter((p) => ids.has(p.orderId) && p.schoolCourseId != null).map((p) => p.schoolCourseId as number)
    ),
  ];
}

export type ResultadoAvisoPorCurso = {
  albumId: number;
  cursos: number;
  enviados: number;
  sinEmail: number;
};

/**
 * Manda el aviso de los cursos marcados que todavía no se avisaron, sólo en álbumes que ya
 * terminaron de procesarse. Si el álbum sigue procesando, quedan pendientes para la próxima
 * corrida. Devuelve lo que salió y los álbumes que siguen esperando.
 */
export async function avisarCursosPendientes(params: {
  baseUrl: string;
  albumIds?: readonly number[];
  now?: Date;
  dryRun?: boolean;
}): Promise<{ avisados: ResultadoAvisoPorCurso[]; esperando: number[] }> {
  const now = params.now ?? new Date();
  const pendientes = await prisma.albumCursoPublicado.findMany({
    where: { avisoAt: null, ...(params.albumIds ? { albumId: { in: [...params.albumIds] } } : {}) },
    select: { id: true, albumId: true, schoolCourseId: true },
    take: 500,
  });
  if (pendientes.length === 0) return { avisados: [], esperando: [] };

  const porAlbum = new Map<number, typeof pendientes>();
  for (const p of pendientes) porAlbum.set(p.albumId, [...(porAlbum.get(p.albumId) ?? []), p]);
  const albumIds = [...porAlbum.keys()];
  const [readiness, packs] = await Promise.all([getAlbumsReadiness(albumIds, now), packsConCurso(albumIds)]);

  const avisados: ResultadoAvisoPorCurso[] = [];
  const esperando: number[] = [];
  for (const [albumId, marcas] of porAlbum) {
    if (!readiness.get(albumId)?.ready) {
      esperando.push(albumId);
      continue;
    }
    const orderIds = packsAAvisar(packs.get(albumId) ?? [], new Set(marcas.map((m) => m.schoolCourseId)));
    if (params.dryRun) {
      avisados.push({ albumId, cursos: marcas.length, enviados: orderIds.length, sinEmail: 0 });
      continue;
    }
    // Se marca antes de mandar: si dos corridas se cruzan, la segunda ya no encuentra el curso.
    const tomadas = await prisma.albumCursoPublicado.updateMany({
      where: { id: { in: marcas.map((m) => m.id) }, avisoAt: null },
      data: { avisoAt: now },
    });
    if (tomadas.count === 0) continue;
    try {
      const r = await notifyPreventaPhotosReady({ albumId, baseUrl: params.baseUrl, orderIds, now });
      avisados.push({ albumId, cursos: marcas.length, ...r });
    } catch (err) {
      // Vuelven a quedar pendientes para la próxima corrida.
      await prisma.albumCursoPublicado.updateMany({
        where: { id: { in: marcas.map((m) => m.id) }, avisoAt: now },
        data: { avisoAt: null },
      });
      console.error("[cursos-publicados] aviso fallido", { albumId, err });
    }
  }
  return { avisados, esperando };
}
