import "server-only";
import { prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { sitioDelWorkspace } from "@/lib/presupuestos/sitio";
import { miniaturasDePortadas } from "@/lib/trabajos/publico";
import { esCodigoUnico, esTablaFaltante } from "@/lib/trabajos/reglas";
import {
  agrupar,
  motivoNoCompartible,
  normalizarEstilos,
  urlDelTrabajo,
  validarEnlaces,
  validarNombreRubro,
  type GrupoRubro,
  type PortfolioTrabajo,
  type Rubro,
} from "./reglas";

/**
 * Portfolios del estudio (spec 2026-11-15): rubros, etiquetas internas de cada trabajo y la vista
 * agrupada para la vendedora. Todo filtrado por `workspaceId` (de la sesión). Las tablas son nuevas y
 * el SQL se aplica a mano: si faltan, las lecturas devuelven `"FALTAN_TABLAS"` en vez de romper.
 */

export type Resultado<T> = { ok: true; valor: T } | { ok: false; error: string };
export const FALTAN_TABLAS = "FALTAN_TABLAS" as const;

const ok = <T>(valor: T): Resultado<T> => ({ ok: true, valor });
const fallo = (error: string): Resultado<never> => ({ ok: false, error });

const MENSAJES = {
  nombre: "El nombre del rubro tiene que tener entre 1 y 60 caracteres.",
  repetido: "Ya hay un rubro con ese nombre.",
  noExiste: "Ese rubro no existe.",
  trabajo: "El trabajo no existe.",
  faltan: "Esta sección todavía no está lista en esta cuenta.",
} as const;

type FilaRubro = { id: string; nombre: string; orden: number; enlacesJson: unknown };
const aRubro = (f: FilaRubro): Rubro => ({ id: f.id, nombre: f.nombre, orden: f.orden, enlaces: validarEnlaces(f.enlacesJson) });

async function conTablas<T>(fn: () => Promise<Resultado<T>>): Promise<Resultado<T>> {
  try {
    return await fn();
  } catch (err) {
    if (esTablaFaltante(err)) return fallo(MENSAJES.faltan);
    throw err;
  }
}

// ── Rubros ──────────────────────────────────────────────────────────────────

export async function listarRubros(workspaceId: string): Promise<Rubro[] | typeof FALTAN_TABLAS> {
  try {
    const filas = await prisma.fotofficePortfolioRubro.findMany({
      where: { workspaceId },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
      select: { id: true, nombre: true, orden: true, enlacesJson: true },
    });
    return filas.map(aRubro);
  } catch (err) {
    if (esTablaFaltante(err)) return FALTAN_TABLAS;
    throw err;
  }
}

export async function crearRubro(workspaceId: string, nombre: unknown): Promise<Resultado<Rubro>> {
  const n = validarNombreRubro(nombre);
  if (!n) return fallo(MENSAJES.nombre);
  return conTablas(async () => {
    const max = await prisma.fotofficePortfolioRubro.aggregate({ where: { workspaceId }, _max: { orden: true } });
    try {
      const f = await prisma.fotofficePortfolioRubro.create({
        data: { workspaceId, nombre: n, orden: (max._max.orden ?? -1) + 1, enlacesJson: [] },
        select: { id: true, nombre: true, orden: true, enlacesJson: true },
      });
      return ok(aRubro(f));
    } catch (err) {
      if (esCodigoUnico(err)) return fallo(MENSAJES.repetido);
      throw err;
    }
  });
}

export async function editarRubro(workspaceId: string, id: string, datos: { nombre?: unknown; enlaces?: unknown }): Promise<Resultado<Rubro>> {
  const data: { nombre?: string; enlacesJson?: { titulo: string; url: string }[] } = {};
  if (datos.nombre !== undefined) {
    const n = validarNombreRubro(datos.nombre);
    if (!n) return fallo(MENSAJES.nombre);
    data.nombre = n;
  }
  if (datos.enlaces !== undefined) data.enlacesJson = validarEnlaces(datos.enlaces);
  return conTablas(async () => {
    const r = await prisma.fotofficePortfolioRubro.findFirst({ where: { id, workspaceId }, select: { id: true } });
    if (!r) return fallo(MENSAJES.noExiste);
    try {
      const f = await prisma.fotofficePortfolioRubro.update({ where: { id }, data, select: { id: true, nombre: true, orden: true, enlacesJson: true } });
      return ok(aRubro(f));
    } catch (err) {
      if (esCodigoUnico(err)) return fallo(MENSAJES.repetido);
      throw err;
    }
  });
}

/** Lo cambia de lugar con el vecino y deja los órdenes en 0..n-1. */
export async function moverRubro(workspaceId: string, id: string, hacia: -1 | 1): Promise<Resultado<null>> {
  return conTablas(async () => {
    const filas = await prisma.fotofficePortfolioRubro.findMany({ where: { workspaceId }, orderBy: [{ orden: "asc" }, { nombre: "asc" }], select: { id: true } });
    const i = filas.findIndex((f) => f.id === id);
    if (i < 0) return fallo(MENSAJES.noExiste);
    const j = i + hacia;
    if (j < 0 || j >= filas.length) return ok(null);
    [filas[i], filas[j]] = [filas[j], filas[i]];
    await prisma.$transaction(filas.map((f, orden) => prisma.fotofficePortfolioRubro.update({ where: { id: f.id }, data: { orden } })));
    return ok(null);
  });
}

/** Sus trabajos quedan sin rubro (pasan a «Sin etiquetar»); nunca se borra un trabajo. */
export async function borrarRubro(workspaceId: string, id: string): Promise<Resultado<null>> {
  return conTablas(async () => {
    const r = await prisma.fotofficePortfolioRubro.findFirst({ where: { id, workspaceId }, select: { id: true } });
    if (!r) return fallo(MENSAJES.noExiste);
    await prisma.$transaction([
      prisma.fotofficeTrabajoPortfolio.updateMany({ where: { workspaceId, rubroId: id }, data: { rubroId: null } }),
      prisma.fotofficePortfolioRubro.delete({ where: { id } }),
    ]);
    return ok(null);
  });
}

// ── Etiquetas de un trabajo ─────────────────────────────────────────────────

export async function etiquetasDeTrabajo(
  workspaceId: string,
  trabajoId: string,
): Promise<{ rubroId: string | null; estilos: string[] } | typeof FALTAN_TABLAS> {
  try {
    const f = await prisma.fotofficeTrabajoPortfolio.findFirst({ where: { workspaceId, trabajoId }, select: { rubroId: true, estilos: true } });
    return { rubroId: f?.rubroId ?? null, estilos: f?.estilos ?? [] };
  } catch (err) {
    if (esTablaFaltante(err)) return FALTAN_TABLAS;
    throw err;
  }
}

export async function guardarEtiquetas(workspaceId: string, trabajoId: string, datos: { rubroId: unknown; estilos: unknown }): Promise<Resultado<null>> {
  const rubroId = typeof datos.rubroId === "string" && datos.rubroId.trim() ? datos.rubroId.trim() : null;
  const estilos = normalizarEstilos(datos.estilos);
  return conTablas(async () => {
    const t = await prisma.fotofficeTrabajo.findFirst({ where: { id: trabajoId, workspaceId }, select: { id: true } });
    if (!t) return fallo(MENSAJES.trabajo);
    if (!rubroId && estilos.length === 0) {
      await prisma.fotofficeTrabajoPortfolio.deleteMany({ where: { workspaceId, trabajoId } });
      return ok(null);
    }
    if (rubroId) {
      const r = await prisma.fotofficePortfolioRubro.findFirst({ where: { id: rubroId, workspaceId }, select: { id: true } });
      if (!r) return fallo(MENSAJES.noExiste);
    }
    await prisma.fotofficeTrabajoPortfolio.upsert({
      where: { trabajoId },
      create: { workspaceId, trabajoId, rubroId, estilos },
      update: { rubroId, estilos },
    });
    return ok(null);
  });
}

/** Estilos ya usados, por rubro (los más usados primero), para sugerir al etiquetar. */
export async function sugerenciasDeEstilos(workspaceId: string): Promise<Record<string, string[]>> {
  try {
    const filas = await prisma.fotofficeTrabajoPortfolio.findMany({ where: { workspaceId, rubroId: { not: null } }, select: { rubroId: true, estilos: true } });
    const cuentas = new Map<string, Map<string, number>>();
    for (const f of filas) {
      const m = cuentas.get(f.rubroId as string) ?? new Map<string, number>();
      for (const e of f.estilos) m.set(e, (m.get(e) ?? 0) + 1);
      cuentas.set(f.rubroId as string, m);
    }
    return Object.fromEntries([...cuentas].map(([r, m]) => [r, [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "es")).map(([e]) => e)]));
  } catch (err) {
    if (esTablaFaltante(err)) return {};
    throw err;
  }
}

// ── La vista ────────────────────────────────────────────────────────────────

export type PortfoliosDelEstudio = { rubros: Rubro[]; grupos: GrupoRubro[]; sinEtiquetar: PortfolioTrabajo[] };

/**
 * Todos los trabajos del workspace con su enlace público y si se puede compartir. Con
 * `incluirNoCompartibles: false` (la vendedora) lo que no abre en público no aparece en ningún lado.
 */
export async function cargarPortfoliosDelEstudio(
  workspaceId: string,
  opciones: { incluirNoCompartibles: boolean },
): Promise<PortfoliosDelEstudio | typeof FALTAN_TABLAS> {
  try {
    const [rubros, etiquetas] = await Promise.all([
      listarRubros(workspaceId),
      prisma.fotofficeTrabajoPortfolio.findMany({ where: { workspaceId }, select: { trabajoId: true, rubroId: true, estilos: true } }),
    ]);
    if (rubros === FALTAN_TABLAS) return FALTAN_TABLAS;
    const [filas, categorias, website, sitio] = await Promise.all([
      prisma.fotofficeTrabajo.findMany({
        where: { workspaceId },
        select: { id: true, titulo: true, slug: true, lugar: true, fecha: true, destacado: true, portadaUrl: true, estado: true, categoriaId: true },
      }),
      prisma.fotofficeTrabajoCategoria.findMany({ where: { workspaceId }, select: { id: true, slug: true, visible: true } }),
      prisma.fotofficeWorkspaceWebsite.findUnique({ where: { workspaceId }, select: { publishedAt: true } }),
      sitioDelWorkspace(workspaceId),
    ]);
    const miniaturas = await miniaturasDePortadas(workspaceId, filas);
    const porCategoria = new Map(categorias.map((c) => [c.id, c]));
    const porTrabajo = new Map(etiquetas.map((e) => [e.trabajoId, e]));
    const sitioPublicado = Boolean(website?.publishedAt);
    const trabajos: PortfolioTrabajo[] = [];
    for (const f of filas) {
      const cat = f.categoriaId ? porCategoria.get(f.categoriaId) : undefined;
      const url = cat
        ? urlDelTrabajo({ customDomain: sitio?.customDomain ?? null, appOrigin: appUrl(), slug: sitio?.slug ?? null, categoriaSlug: cat.slug, trabajoSlug: f.slug })
        : null;
      const motivo = motivoNoCompartible({ estado: f.estado, categoriaVisible: cat ? cat.visible : null, sitioPublicado, url });
      if (motivo && !opciones.incluirNoCompartibles) continue;
      const e = porTrabajo.get(f.id);
      trabajos.push({
        id: f.id,
        titulo: f.titulo,
        lugar: f.lugar,
        fecha: f.fecha,
        destacado: f.destacado,
        portadaUrl: (f.portadaUrl && miniaturas.get(f.portadaUrl)) || f.portadaUrl,
        rubroId: e?.rubroId ?? null,
        estilos: e?.estilos ?? [],
        compartible: motivo === null,
        motivo,
        url: motivo === null ? url : null,
      });
    }
    return { rubros, ...agrupar(rubros, trabajos) };
  } catch (err) {
    if (esTablaFaltante(err)) return FALTAN_TABLAS;
    throw err;
  }
}
