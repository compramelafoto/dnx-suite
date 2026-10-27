import "server-only";
import { prisma } from "@repo/db";
import { parseWebsiteSections } from "./blocks";
import { MAX_RUTAS_POR_DIA, diaArgentino, diaComoFecha, resumirVisitas, sumarDias, type FilaVisita, type ResumenVisitas } from "./visitas";

/**
 * Contador de visitas por página, del lado del servidor. La tabla se crea con SQL a mano: si
 * todavía no existe, Prisma avisa P2021 y acá no se cuenta nada (el beacon igual responde 204) y
 * el panel recibe `null` para avisar. Nunca se rompe una página.
 */

function esTablaFaltante(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2021";
}

/** Lo que el contador necesita saber del sitio: su workspace y los slugs de sus páginas publicadas. */
export async function sitioParaContar(workspaceSlug: string): Promise<{ workspaceId: string; paginasPropias: Set<string> } | null> {
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true },
  });
  if (!branding) return null;
  const website = await prisma.fotofficeWorkspaceWebsite.findUnique({
    where: { workspaceId: branding.workspaceId },
    select: { publishedVersion: { select: { sectionsJson: true } } },
  });
  const sections = website?.publishedVersion ? parseWebsiteSections(website.publishedVersion.sectionsJson) : null;
  const paginasPropias = new Set(sections ? Object.values(sections.pageMeta).map((m) => m.slug) : []);
  return { workspaceId: branding.workspaceId, paginasPropias };
}

/**
 * Suma una visita a la ruta en el día de hoy (hora argentina).
 *
 * 1. Si la fila ya existe, incremento atómico (`updateMany` con `increment`).
 * 2. Si no, se crea sólo si el sitio todavía no llegó a `MAX_RUTAS_POR_DIA` rutas distintas en el
 *    día: así nadie llena la tabla inventando direcciones. Pasado el tope, sólo suman las que ya
 *    tienen fila.
 * 3. Para crear, `upsert` con una sola clave única y sin anidados (Prisma lo manda como
 *    `INSERT … ON CONFLICT DO UPDATE`). Si dos visitas la crean a la vez y una choca (P2002), se
 *    reintenta como incremento.
 */
export async function sumarVisita(workspaceId: string, ruta: string, ahora = new Date()): Promise<void> {
  const fecha = diaComoFecha(diaArgentino(ahora));
  const where = { workspaceId_ruta_fecha: { workspaceId, ruta, fecha } };
  try {
    const existente = await prisma.fotofficeSitioVisita.updateMany({
      where: { workspaceId, ruta, fecha },
      data: { visitas: { increment: 1 } },
    });
    if (existente.count > 0) return;
    const rutasDelDia = await prisma.fotofficeSitioVisita.count({ where: { workspaceId, fecha } });
    if (rutasDelDia >= MAX_RUTAS_POR_DIA) return;
    await prisma.fotofficeSitioVisita.upsert({
      where,
      create: { workspaceId, ruta, fecha, visitas: 1 },
      update: { visitas: { increment: 1 } },
      select: { id: true },
    });
  } catch (err) {
    if (esTablaFaltante(err)) return;
    if ((err as { code?: unknown })?.code === "P2002") {
      await prisma.fotofficeSitioVisita.update({ where, data: { visitas: { increment: 1 } }, select: { id: true } });
      return;
    }
    throw err;
  }
}

/** Las filas de los últimos `dias` días (hasta hoy). `null` = falta la tabla. */
async function filasDeVisitas(workspaceId: string, dias: number, hoy: string): Promise<FilaVisita[] | null> {
  try {
    const filas = await prisma.fotofficeSitioVisita.findMany({
      where: { workspaceId, fecha: { gte: diaComoFecha(sumarDias(hoy, -(dias - 1))), lte: diaComoFecha(hoy) } },
      select: { ruta: true, fecha: true, visitas: true },
      take: 20000,
    });
    return filas.map((f) => ({ ruta: f.ruta, dia: f.fecha.toISOString().slice(0, 10), visitas: f.visitas }));
  } catch (err) {
    if (esTablaFaltante(err)) return null;
    throw err;
  }
}

/** Resumen de los últimos `dias` días. `null` = falta la tabla. */
export async function resumenDeVisitas(workspaceId: string, dias: number, ahora = new Date()): Promise<ResumenVisitas | null> {
  const hoy = diaArgentino(ahora);
  const filas = await filasDeVisitas(workspaceId, dias, hoy);
  return filas ? resumirVisitas(filas, dias, hoy) : null;
}
