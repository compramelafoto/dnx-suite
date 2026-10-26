import "server-only";
import { prisma } from "@repo/db";
import {
  compilarRedirecciones,
  normalizarRuta,
  resolverRedireccion,
  type DestinoRedireccion,
  type ReglaRedireccion,
  type ReglaValidada,
  type TablaRedirecciones,
} from "./redirecciones-reglas";

/**
 * Redirecciones del sitio, del lado del servidor: leer las reglas de una institución (con una
 * memoria de 60 s por instancia, como el dominio propio) y las altas y bajas del panel.
 *
 * Nunca rompe una página: si la tabla todavía no existe (el SQL se aplica a mano, Prisma avisa
 * P2021) o la base falla, no hay redirección y la visita sigue como siempre.
 *
 * Las reglas puras (normalizar, comodines, cadenas) viven en `redirecciones-reglas.ts`, que es lo
 * que puede importar el `proxy.ts`.
 */
export { normalizarRuta };

const TTL_MS = 60_000;
/** Tope de reglas por institución que se cargan en memoria (DNX tiene unas 250). */
export const MAX_REDIRECCIONES = 2000;
export const ORIGEN_ALBOOM = "alboom-prosite";

const memoria = new Map<string, { tabla: TablaRedirecciones; at: number }>();

function esTablaFaltante(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2021";
}

/** Las reglas de una institución tal como están guardadas. Sin tabla, ninguna. */
export async function reglasDelWorkspace(workspaceId: string): Promise<ReglaRedireccion[]> {
  try {
    return await prisma.fotofficeSitioRedireccion.findMany({
      where: { workspaceId },
      select: { desde: true, hacia: true, codigo: true },
      take: MAX_REDIRECCIONES,
      orderBy: { createdAt: "asc" },
    });
  } catch (err) {
    if (esTablaFaltante(err)) return [];
    throw err;
  }
}

async function tablaDelWorkspace(workspaceId: string): Promise<TablaRedirecciones | null> {
  const hit = memoria.get(workspaceId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.tabla;
  try {
    const tabla = compilarRedirecciones(await reglasDelWorkspace(workspaceId));
    memoria.set(workspaceId, { tabla, at: Date.now() });
    return tabla;
  } catch (err) {
    console.error("[fotoffice][website] no se pudieron leer las redirecciones:", err);
    return null;
  }
}

/** Adónde lleva `ruta` (del sitio, sin `/w/<slug>`) en esta institución, o null. Nunca tira. */
export async function buscarRedireccion(workspaceId: string, ruta: string): Promise<DestinoRedireccion | null> {
  const tabla = await tablaDelWorkspace(workspaceId);
  return tabla ? resolverRedireccion(tabla, ruta) : null;
}

/** Para que un cambio del panel se vea enseguida en esta instancia (las demás tardan 60 s). */
export function olvidarRedirecciones(workspaceId?: string): void {
  if (workspaceId) memoria.delete(workspaceId);
  else memoria.clear();
}

// ── Panel ───────────────────────────────────────────────────────────────────────────────────

export type RedireccionDelPanel = { id: string; desde: string; hacia: string; codigo: number; origen: string | null; createdAt: Date };

/** `null` = la tabla todavía no existe en la base. */
export async function listarRedirecciones(workspaceId: string): Promise<RedireccionDelPanel[] | null> {
  try {
    return await prisma.fotofficeSitioRedireccion.findMany({
      where: { workspaceId },
      orderBy: [{ desde: "asc" }],
      take: MAX_REDIRECCIONES,
      select: { id: true, desde: true, hacia: true, codigo: true, origen: true, createdAt: true },
    });
  } catch (err) {
    if (esTablaFaltante(err)) return null;
    throw err;
  }
}

export async function crearRedireccion(workspaceId: string, regla: ReglaValidada): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await prisma.fotofficeSitioRedireccion.create({ data: { workspaceId, ...regla, origen: null } });
  } catch (err) {
    if (esTablaFaltante(err)) return { ok: false, error: "Falta crear la tabla de redirecciones en la base. Avisale al administrador." };
    if (typeof err === "object" && err !== null && (err as { code?: unknown }).code === "P2002") {
      return { ok: false, error: "Esa dirección vieja ya tiene una redirección." };
    }
    throw err;
  }
  olvidarRedirecciones(workspaceId);
  return { ok: true };
}

export async function borrarRedireccion(workspaceId: string, id: string): Promise<boolean> {
  const r = await prisma.fotofficeSitioRedireccion.deleteMany({ where: { id, workspaceId } });
  olvidarRedirecciones(workspaceId);
  return r.count > 0;
}
