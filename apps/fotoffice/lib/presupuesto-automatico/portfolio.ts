import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { randomUUID } from "node:crypto";
import { urlsDeLecturaPorLote } from "@/lib/galerias/almacen";
import { getFotofficeR2PublicUrl, isFotofficeR2Configured, uploadToFotofficeR2 } from "@/lib/images/r2-client";
import { buscarEnlace } from "@/lib/presupuestos/publico";
import { puedeConfigurarPresupuestos, type CtxPresupuestos } from "@/lib/presupuestos/acceso";
import { MENSAJES_AJUSTES_AUTO, portfolioDeCategoria } from "./ajustes";
import {
  fotosParaMostrar,
  MAX_BYTES_SUBIDA,
  MAX_FOTOS_MOSTRADAS,
  MAX_ITEMS_PORTFOLIO,
  prefijoDeSubidas,
  TIPOS_SUBIDA,
  validarPortfolio,
  type FotoDelPortfolio,
  type ItemPortfolio,
} from "./portfolio-items";

/**
 * El portfolio de la categoría en la página pública del presupuesto (spec 2026-10-25 §3), y lo que
 * necesita la pantalla para armarlo.
 *
 * Las fotos de Galería viven en el bucket PRIVADO: se muestran con enlaces firmados que vencen en
 * una hora (la miniatura y la vista, nunca el original). Las subidas a propósito van al bucket de
 * FOTOFFICE, bajo `fotoffice/<workspace>/portfolio-consultas/`. Una galería o foto de otro
 * workspace, archivada o que ya no existe, simplemente no aparece. Nunca lanza.
 */

/** Las fotos (con URL) de los renglones del portfolio, en orden y hasta el tope de la página. */
export async function fotosDelPortfolio(workspaceId: string, items: readonly ItemPortfolio[]): Promise<FotoDelPortfolio[]> {
  if (items.length === 0) return [];
  try {
    const galerias = [...new Set(items.filter((i) => i.tipo !== "SUBIDA").map((i) => (i as { galeriaId: string }).galeriaId))];
    const vivas = galerias.length
      ? new Set(
          (
            await prisma.fotofficeGaleria.findMany({ where: { workspaceId, id: { in: galerias }, archivedAt: null }, select: { id: true } })
          ).map((g) => g.id),
        )
      : new Set<string>();

    type Cruda = { id: string; viewKey: string | null; thumbKey: string | null; width: number | null; height: number | null };
    const porItem: (Cruda[] | FotoDelPortfolio)[] = [];
    for (const i of items) {
      if (i.tipo === "SUBIDA") {
        if (!isFotofficeR2Configured()) continue;
        const url = getFotofficeR2PublicUrl(i.clave);
        porItem.push({ id: i.clave, miniatura: url, grande: url, ancho: i.ancho, alto: i.alto });
        continue;
      }
      if (!vivas.has(i.galeriaId)) continue;
      const where = { workspaceId, galeriaId: i.galeriaId, status: "LISTA", mediaType: "FOTO", thumbKey: { not: null } };
      const fotos =
        i.tipo === "GALERIA"
          ? await prisma.fotofficeGaleriaFoto.findMany({
              where,
              orderBy: [{ order: "asc" }, { createdAt: "asc" }],
              take: i.cantidad,
              select: { id: true, viewKey: true, thumbKey: true, width: true, height: true },
            })
          : await prisma.fotofficeGaleriaFoto.findMany({ where: { ...where, id: i.fotoId }, take: 1, select: { id: true, viewKey: true, thumbKey: true, width: true, height: true } });
      porItem.push(fotos);
    }
    const crudas = porItem.flatMap((x) => (Array.isArray(x) ? x : []));
    const urls = crudas.length ? await urlsDeLecturaPorLote(crudas.slice(0, MAX_FOTOS_MOSTRADAS * 2)) : new Map();
    const fotos: FotoDelPortfolio[] = [];
    for (const x of porItem) {
      if (!Array.isArray(x)) {
        fotos.push(x);
        continue;
      }
      for (const f of x) {
        const u = urls.get(f.id);
        if (!u?.thumbUrl) continue;
        fotos.push({ id: f.id, miniatura: u.thumbUrl, grande: u.viewUrl, ancho: f.width, alto: f.height });
      }
    }
    return fotosParaMostrar(fotos);
  } catch (e) {
    console.error("[presupuesto-automatico] no se pudo armar el portfolio", { codigo: (e as { code?: unknown })?.code ?? "desconocido" });
    return [];
  }
}

export type PortfolioPublico = { titulo: string; fotos: FotoDelPortfolio[] };

/** Para la página pública: el portfolio de la categoría de la consulta del presupuesto, o null. */
export async function portfolioDelEnlace(workspaceId: string, token: string, ahora: Date = new Date()): Promise<PortfolioPublico | null> {
  try {
    const enlace = await buscarEnlace(workspaceId, token, ahora);
    if (!enlace) return null;
    const consulta = await prisma.fotofficeConsulta.findFirst({ where: { workspaceId, leadId: enlace.leadId }, select: { categoryId: true } });
    if (!consulta) return null;
    const items = await portfolioDeCategoria(workspaceId, consulta.categoryId);
    if (items.length === 0) return null;
    const [fotos, categoria] = await Promise.all([
      fotosDelPortfolio(workspaceId, items),
      prisma.fotofficeConsultaCategoria.findFirst({ where: { id: consulta.categoryId, workspaceId }, select: { name: true } }),
    ]);
    if (fotos.length === 0) return null;
    return { titulo: categoria?.name ?? "Nuestro trabajo", fotos };
  } catch {
    return null;
  }
}

// --- Para la pantalla -----------------------------------------------------------------------------

export type GaleriaParaElegir = { id: string; numero: string; nombre: string; fotos: number };

/** Galerías del workspace que tienen fotos listas (las más nuevas primero). */
export async function galeriasParaElegir(workspaceId: string): Promise<GaleriaParaElegir[]> {
  try {
    const gs = await prisma.fotofficeGaleria.findMany({
      where: { workspaceId, archivedAt: null },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, number: true, name: true },
    });
    if (gs.length === 0) return [];
    const cuentas = await prisma.fotofficeGaleriaFoto.groupBy({
      by: ["galeriaId"],
      where: { workspaceId, galeriaId: { in: gs.map((g) => g.id) }, status: "LISTA", mediaType: "FOTO" },
      _count: { _all: true },
    });
    const n = new Map(cuentas.map((c) => [c.galeriaId, c._count._all]));
    return gs.map((g) => ({ id: g.id, numero: g.number, nombre: g.name, fotos: n.get(g.id) ?? 0 })).filter((g) => g.fotos > 0);
  } catch {
    return [];
  }
}

export type ResultadoSubida = { ok: true } | { ok: false; error: string };

export const MENSAJES_SUBIDA = {
  tipo: "Subí una foto JPG, PNG o WebP.",
  tamano: `La foto tiene que pesar menos de ${Math.round(MAX_BYTES_SUBIDA / 1_000_000 * 10) / 10} MB. Exportala más liviana (con 2000 px de lado alcanza).`,
  lleno: `El portfolio ya tiene ${MAX_ITEMS_PORTFOLIO} elementos: sacá alguno antes de subir otro.`,
  sinR2: "El almacenamiento de fotos no está configurado.",
  fallo: "No se pudo subir la foto. Probá de nuevo.",
} as const;

/** Sube una foto al bucket de FOTOFFICE y la agrega al final del portfolio de la categoría. */
export async function subirFotoAlPortfolio(ctx: CtxPresupuestos, categoriaId: unknown, archivo: unknown): Promise<ResultadoSubida> {
  if (!puedeConfigurarPresupuestos(ctx)) return { ok: false, error: MENSAJES_AJUSTES_AUTO.sinPermiso };
  if (typeof categoriaId !== "string" || !categoriaId || categoriaId.length > 64) return { ok: false, error: MENSAJES_AJUSTES_AUTO.datosInvalidos };
  if (!(archivo instanceof File) || archivo.size === 0) return { ok: false, error: MENSAJES_SUBIDA.tipo };
  const ext = TIPOS_SUBIDA[archivo.type];
  if (!ext) return { ok: false, error: MENSAJES_SUBIDA.tipo };
  if (archivo.size > MAX_BYTES_SUBIDA) return { ok: false, error: MENSAJES_SUBIDA.tamano };
  if (!isFotofficeR2Configured()) return { ok: false, error: MENSAJES_SUBIDA.sinR2 };
  const { workspaceId } = ctx;
  try {
    const categoria = await prisma.fotofficeConsultaCategoria.findFirst({ where: { id: categoriaId, workspaceId }, select: { id: true } });
    if (!categoria) return { ok: false, error: MENSAJES_AJUSTES_AUTO.categoria };
    const actuales = await portfolioDeCategoria(workspaceId, categoriaId);
    if (actuales.length >= MAX_ITEMS_PORTFOLIO) return { ok: false, error: MENSAJES_SUBIDA.lleno };
    const clave = `${prefijoDeSubidas(workspaceId)}${randomUUID()}.${ext}`;
    await uploadToFotofficeR2(Buffer.from(await archivo.arrayBuffer()), clave, archivo.type);
    const items = validarPortfolio(workspaceId, [...actuales, { tipo: "SUBIDA", clave, ancho: null, alto: null }]);
    await prisma.fotofficePresupuestoAutoCategoria.upsert({
      where: { workspaceId_categoryId: { workspaceId, categoryId: categoriaId } },
      create: { workspaceId, categoryId: categoriaId, portfolio: items as unknown as Prisma.InputJsonValue, updatedByUserId: ctx.userId },
      update: { portfolio: items as unknown as Prisma.InputJsonValue, updatedByUserId: ctx.userId },
      select: { id: true },
    });
    return { ok: true };
  } catch (e) {
    console.error("[presupuesto-automatico] no se pudo subir la foto del portfolio", { codigo: (e as { code?: unknown })?.code ?? "desconocido" });
    return { ok: false, error: MENSAJES_SUBIDA.fallo };
  }
}
