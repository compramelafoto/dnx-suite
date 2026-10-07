import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { contarPor, crearCatalogo } from "./catalogo";
import { esGrupoConsulta, type GrupoConsulta } from "./constantes";

/**
 * Categorías de consulta (spec §3.4): nombre, grupo, orden y archivar. Una categoría con
 * consultas no se borra (se archiva) y su grupo no cambia. Tiene que quedar al menos una activa:
 * toda consulta nueva necesita una.
 */
const catalogo = crearCatalogo({
  tabla: "fotofficeConsultaCategoria",
  conGrupo: true,
  minimoActivos: 1,
  textos: {
    noEncontrado: "No encontramos esa categoría.",
    repetido: "Ya hay una categoría con ese nombre.",
    yaSeUso: "Esta categoría ya tiene consultas: archivala.",
    ultimoActivo: "Tiene que quedar al menos una categoría activa.",
  },
  usos: (db, workspaceId, ids) => contarPor(db, "fotofficeConsulta", "categoryId", workspaceId, ids),
});

export const listarCategorias = catalogo.listar;
export const crearCategoria = catalogo.crear;
export const editarCategoria = catalogo.editar;
export const reordenarCategorias = catalogo.reordenar;
export const archivarCategoria = catalogo.archivar;
export const desarchivarCategoria = catalogo.desarchivar;
export const borrarCategoria = catalogo.borrar;

type Db = Prisma.TransactionClient | typeof prisma;

export type CategoriaElegida = { id: string; name: string; group: GrupoConsulta; legacyEventType: string | null };

const SELECT = { id: true, name: true, group: true, legacyEventType: true, archivedAt: true, order: true } as const;

function aElegida(f: { id: string; name: string; group: string; legacyEventType: string | null }): CategoriaElegida {
  return { id: f.id, name: f.name, group: esGrupoConsulta(f.group) ? f.group : "EVENTO", legacyEventType: f.legacyEventType };
}

/** Una categoría ACTIVA del workspace (las archivadas no se ofrecen en altas nuevas); null si no. */
export async function categoriaActiva(db: Db, workspaceId: string, id: unknown): Promise<CategoriaElegida | null> {
  if (typeof id !== "string" || !id || id.length > 100) return null;
  const f = await db.fotofficeConsultaCategoria.findFirst({ where: { id, workspaceId, archivedAt: null }, select: SELECT });
  return f ? aElegida(f) : null;
}

/** "Otro", "Otra", "Otro evento"…: el comodín de un grupo. */
const ES_OTRO = /^otr[oa]s?(\s|$)/i;

/**
 * La categoría de un `eventType` viejo (formularios públicos y consultas existentes). Los
 * formularios no guardan su categoría (no hay columna nueva en `ServiceLeadForm`): la
 * equivalencia se resuelve acá en cada alta, por el `legacyEventType` que marcó la semilla.
 *
 * Si la equivalente está archivada (spec §5): "Otro" del mismo grupo si existe, o la primera
 * activa del grupo; si el grupo no tiene ninguna activa, o el tipo no tiene equivalente, "Otro"
 * o la primera activa. `reemplazo` avisa que no es la equivalente (Configuración lo muestra).
 * Con `incluirArchivadas` (el enganche de consultas viejas) la equivalente archivada vale igual:
 * describe lo que la consulta ya era. null si el workspace no tiene ninguna categoría utilizable.
 */
export async function categoriaParaEventType(
  db: Db,
  workspaceId: string,
  eventType: unknown,
  opciones: { incluirArchivadas?: boolean } = {},
): Promise<(CategoriaElegida & { reemplazo: boolean }) | null> {
  const todas = await db.fotofficeConsultaCategoria.findMany({
    where: { workspaceId },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    take: 1000,
    select: SELECT,
  });
  const activas = todas.filter((c) => c.archivedAt === null);
  const equivalentes = typeof eventType === "string" ? todas.filter((c) => c.legacyEventType === eventType) : [];
  const equivalente = equivalentes.find((c) => c.archivedAt === null) ?? (opciones.incluirArchivadas ? equivalentes[0] : undefined);
  if (equivalente) return { ...aElegida(equivalente), reemplazo: false };

  const grupo = equivalentes[0]?.group;
  const delGrupo = grupo ? activas.filter((c) => c.group === grupo) : [];
  const elegida =
    delGrupo.find((c) => ES_OTRO.test(c.name.trim())) ??
    delGrupo[0] ??
    activas.find((c) => ES_OTRO.test(c.name.trim())) ??
    activas[0] ??
    (opciones.incluirArchivadas ? todas[0] : undefined);
  return elegida ? { ...aElegida(elegida), reemplazo: true } : null;
}

/**
 * El "mapa por formulario": la categoría que recibe hoy cada formulario público del workspace
 * (por su `eventType`), con `reemplazo` si su equivalente está archivada. Configuración lo usa
 * para avisar. No guarda nada: es la misma resolución que corre en cada alta.
 */
export async function categoriasDeFormularios(
  workspaceId: string,
): Promise<Map<string, (CategoriaElegida & { reemplazo: boolean }) | null>> {
  const formularios = await prisma.serviceLeadForm.findMany({
    where: { workspaceId },
    select: { id: true, eventType: true },
    take: 500,
  });
  const porTipo = new Map<string, (CategoriaElegida & { reemplazo: boolean }) | null>();
  const mapa = new Map<string, (CategoriaElegida & { reemplazo: boolean }) | null>();
  for (const f of formularios) {
    if (!porTipo.has(f.eventType)) porTipo.set(f.eventType, await categoriaParaEventType(prisma, workspaceId, f.eventType));
    mapa.set(f.id, porTipo.get(f.eventType) ?? null);
  }
  return mapa;
}
