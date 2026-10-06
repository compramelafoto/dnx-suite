import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { puedeEnContexto, type AccesoEfectivo } from "@/lib/access/policy";
import { esGrupoConsulta, type GrupoConsulta } from "./constantes";

/**
 * Lo común de los tres catálogos de Consultas (categorías, orígenes y roles de participante):
 * nombre, orden, archivar y borrar. Cada uno lo arma con su tabla en `categorias.ts`,
 * `origenes.ts` y `participantes.ts`.
 *
 * Toda escritura exige `configurar` (dueño o administrador, `canManageWorkspaceSettings`) y
 * filtra por el `workspaceId` del contexto: un id de otra organización no se encuentra.
 */

/** Quién opera. El `workspaceId` sale siempre de la sesión. */
export type CtxConsultas = {
  workspaceId: string;
  userId: number | null;
  userLabel: string;
  role: string | null;
  /** Acceso efectivo (modelo de main). */
  acceso?: AccesoEfectivo;
};

export const MAX_NOMBRE_CATALOGO = 80;
/** Elementos activos por catálogo y organización. */
export const MAX_ACTIVOS_CATALOGO = 200;

export type ItemCatalogo = {
  id: string;
  name: string;
  order: number;
  archivedAt: Date | null;
  /** Sólo en categorías. */
  group?: GrupoConsulta;
  /** Sólo en categorías: el `eventType` viejo que reemplaza. */
  legacyEventType?: string | null;
  /** Cuántas consultas (o participantes, en los roles) lo usan. 0 = se puede borrar. */
  usos: number;
};

export type ResultadoCatalogo = { ok: true } | { ok: false; error: string };
export type ResultadoCreadoCatalogo = { ok: true; id: string } | { ok: false; error: string };

export const MENSAJES_CATALOGO = {
  sinPermiso: "Sólo un administrador puede configurar las consultas.",
  nombre: `Poné un nombre de hasta ${MAX_NOMBRE_CATALOGO} caracteres.`,
  grupo: "Elegí un grupo válido: Boda, Evento, Trabajo con fecha o Trabajo sin fecha.",
  grupoUsado: "El grupo de una categoría que ya tiene consultas no se puede cambiar.",
  ordenDesactualizado: "La lista cambió mientras la ordenabas: recargá la página.",
  datosInvalidos: "Los datos no son válidos.",
  tope: `Ya hay ${MAX_ACTIVOS_CATALOGO} activos. Archivá alguno.`,
} as const;

/** Textos propios de cada catálogo (el género cambia: "una categoría", "un origen"). */
export type TextosCatalogo = {
  noEncontrado: string;
  repetido: string;
  yaSeUso: string;
  /** Sólo si el catálogo exige al menos uno activo. */
  ultimoActivo?: string;
};

type Tx = Prisma.TransactionClient;
type Fila = { id: string; name: string; order: number; archivedAt: Date | null; group?: string; legacyEventType?: string | null };

/** Los métodos que usa este módulo, comunes a las tres tablas. */
type DelegadoCatalogo = {
  findMany(a: unknown): Promise<Fila[]>;
  findFirst(a: unknown): Promise<Fila | null>;
  count(a: unknown): Promise<number>;
  create(a: unknown): Promise<{ id: string }>;
  updateMany(a: unknown): Promise<{ count: number }>;
  deleteMany(a: unknown): Promise<{ count: number }>;
};

export type ConfigCatalogo = {
  tabla: "fotofficeConsultaCategoria" | "fotofficeOrigen" | "fotofficeRolParticipante";
  conGrupo: boolean;
  textos: TextosCatalogo;
  /** Usos de cada id del workspace (consultas o participantes que lo nombran). */
  usos(db: Tx | typeof prisma, workspaceId: string, ids: string[]): Promise<Map<string, number>>;
  /** Exige al menos uno activo (las categorías: toda consulta necesita una). */
  minimoActivos: number;
};

const no = (error: string) => ({ ok: false as const, error });

function esChoqueDeUnicidad(e: unknown): boolean {
  return (e as { code?: unknown } | null)?.code === "P2002";
}

export function limpiarNombreCatalogo(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.replace(/\s+/g, " ").trim();
  return t.length >= 1 && t.length <= MAX_NOMBRE_CATALOGO ? t : null;
}

const SELECT_BASE = { id: true, name: true, order: true, archivedAt: true } as const;

/** Arma las funciones de un catálogo sobre su tabla. */
export function crearCatalogo(config: ConfigCatalogo) {
  const select = config.conGrupo ? { ...SELECT_BASE, group: true, legacyEventType: true } : SELECT_BASE;
  const tabla = (db: Tx | typeof prisma) => (db as unknown as Record<string, DelegadoCatalogo>)[config.tabla]!;
  const puedeConfigurar = (ctx: CtxConsultas) => puedeEnContexto(ctx, "configurar");

  function aItem(f: Fila, usos: number): ItemCatalogo {
    const item: ItemCatalogo = { id: f.id, name: f.name, order: f.order, archivedAt: f.archivedAt, usos };
    if (config.conGrupo) {
      item.group = esGrupoConsulta(f.group) ? f.group : "EVENTO";
      item.legacyEventType = f.legacyEventType ?? null;
    }
    return item;
  }

  /** Activos por orden; con `incluirArchivados`, también los archivados (al final de su orden). */
  async function listar(workspaceId: string, opciones: { incluirArchivados?: boolean } = {}): Promise<ItemCatalogo[]> {
    const filas = await tabla(prisma).findMany({
      where: { workspaceId, ...(opciones.incluirArchivados ? {} : { archivedAt: null }) },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      take: 1000,
      select,
    });
    const usos = await config.usos(prisma, workspaceId, filas.map((f) => f.id));
    return filas.map((f) => aItem(f, usos.get(f.id) ?? 0));
  }

  async function delWorkspace(db: Tx | typeof prisma, workspaceId: string, id: unknown): Promise<Fila | null> {
    if (typeof id !== "string" || !id || id.length > 100) return null;
    return tabla(db).findFirst({ where: { id, workspaceId }, select });
  }

  async function nombreRepetido(workspaceId: string, name: string, salvoId?: string): Promise<boolean> {
    const otro = await tabla(prisma).findFirst({
      where: { workspaceId, name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    return otro !== null && otro.id !== salvoId;
  }

  async function activos(workspaceId: string): Promise<number> {
    return tabla(prisma).count({ where: { workspaceId, archivedAt: null } });
  }

  async function ordenAlFinal(workspaceId: string): Promise<number> {
    const ultimo = await tabla(prisma).findFirst({
      where: { workspaceId, archivedAt: null },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    return (ultimo?.order ?? -1) + 1;
  }

  async function crear(ctx: CtxConsultas, datos: { nombre: unknown; grupo?: unknown }): Promise<ResultadoCreadoCatalogo> {
    if (!puedeConfigurar(ctx)) return no(MENSAJES_CATALOGO.sinPermiso);
    if (!datos || typeof datos !== "object") return no(MENSAJES_CATALOGO.datosInvalidos);
    const name = limpiarNombreCatalogo(datos.nombre);
    if (!name) return no(MENSAJES_CATALOGO.nombre);
    if (config.conGrupo && !esGrupoConsulta(datos.grupo)) return no(MENSAJES_CATALOGO.grupo);
    if (await nombreRepetido(ctx.workspaceId, name)) return no(config.textos.repetido);
    if ((await activos(ctx.workspaceId)) >= MAX_ACTIVOS_CATALOGO) return no(MENSAJES_CATALOGO.tope);
    try {
      const creado = await tabla(prisma).create({
        data: {
          workspaceId: ctx.workspaceId,
          name,
          order: await ordenAlFinal(ctx.workspaceId),
          ...(config.conGrupo ? { group: datos.grupo } : {}),
        },
        select: { id: true },
      });
      return { ok: true, id: creado.id };
    } catch (e) {
      // Otra pestaña lo creó con el mismo nombre en el mismo instante.
      if (esChoqueDeUnicidad(e)) return no(config.textos.repetido);
      throw e;
    }
  }

  /** Nombre y (en categorías) grupo. El grupo no cambia si la categoría ya tiene consultas. */
  async function editar(ctx: CtxConsultas, id: unknown, cambios: { nombre?: unknown; grupo?: unknown }): Promise<ResultadoCatalogo> {
    if (!puedeConfigurar(ctx)) return no(MENSAJES_CATALOGO.sinPermiso);
    if (!cambios || typeof cambios !== "object") return no(MENSAJES_CATALOGO.datosInvalidos);
    const actual = await delWorkspace(prisma, ctx.workspaceId, id);
    if (!actual) return no(config.textos.noEncontrado);
    const data: { name?: string; group?: GrupoConsulta } = {};
    if (cambios.nombre !== undefined) {
      const name = limpiarNombreCatalogo(cambios.nombre);
      if (!name) return no(MENSAJES_CATALOGO.nombre);
      if (name !== actual.name && (await nombreRepetido(ctx.workspaceId, name, actual.id))) return no(config.textos.repetido);
      data.name = name;
    }
    if (cambios.grupo !== undefined) {
      if (!config.conGrupo) return no(MENSAJES_CATALOGO.datosInvalidos);
      if (!esGrupoConsulta(cambios.grupo)) return no(MENSAJES_CATALOGO.grupo);
      if (cambios.grupo !== actual.group) data.group = cambios.grupo;
    }
    if (Object.keys(data).length === 0) return { ok: true };
    try {
      return await prisma.$transaction(async (tx) => {
        // Adentro: una consulta creada en el mismo instante también cuenta como uso.
        if (data.group !== undefined && ((await config.usos(tx, ctx.workspaceId, [actual.id])).get(actual.id) ?? 0) > 0) {
          return no(MENSAJES_CATALOGO.grupoUsado);
        }
        await tabla(tx).updateMany({ where: { id: actual.id, workspaceId: ctx.workspaceId }, data });
        return { ok: true as const };
      });
    } catch (e) {
      if (esChoqueDeUnicidad(e)) return no(config.textos.repetido);
      throw e;
    }
  }

  /** `ids` son los activos, en el orden nuevo (todos, sin repetir). */
  async function reordenar(ctx: CtxConsultas, ids: unknown): Promise<ResultadoCatalogo> {
    if (!puedeConfigurar(ctx)) return no(MENSAJES_CATALOGO.sinPermiso);
    if (!Array.isArray(ids) || ids.length > 1000 || !ids.every((i) => typeof i === "string")) {
      return no(MENSAJES_CATALOGO.datosInvalidos);
    }
    const actuales = await tabla(prisma).findMany({ where: { workspaceId: ctx.workspaceId, archivedAt: null }, select: { id: true } });
    const set = new Set(actuales.map((a) => a.id));
    if (new Set(ids).size !== ids.length || ids.length !== set.size || !ids.every((i) => set.has(i))) {
      return no(MENSAJES_CATALOGO.ordenDesactualizado);
    }
    await prisma.$transaction(async (tx) => {
      for (const [i, id] of (ids as string[]).entries()) {
        await tabla(tx).updateMany({ where: { id, workspaceId: ctx.workspaceId }, data: { order: i } });
      }
    });
    return { ok: true };
  }

  /** Deja de ofrecerse en las altas nuevas; lo ya cargado lo sigue mostrando. */
  async function archivar(ctx: CtxConsultas, id: unknown): Promise<ResultadoCatalogo> {
    if (!puedeConfigurar(ctx)) return no(MENSAJES_CATALOGO.sinPermiso);
    const actual = await delWorkspace(prisma, ctx.workspaceId, id);
    if (!actual) return no(config.textos.noEncontrado);
    if (actual.archivedAt) return { ok: true };
    if (config.minimoActivos > 0 && (await activos(ctx.workspaceId)) <= config.minimoActivos) {
      return no(config.textos.ultimoActivo ?? MENSAJES_CATALOGO.datosInvalidos);
    }
    await tabla(prisma).updateMany({ where: { id: actual.id, workspaceId: ctx.workspaceId }, data: { archivedAt: new Date() } });
    return { ok: true };
  }

  /** Vuelve al final de la lista, si no se pasa el tope de activos. */
  async function desarchivar(ctx: CtxConsultas, id: unknown): Promise<ResultadoCatalogo> {
    if (!puedeConfigurar(ctx)) return no(MENSAJES_CATALOGO.sinPermiso);
    const actual = await delWorkspace(prisma, ctx.workspaceId, id);
    if (!actual) return no(config.textos.noEncontrado);
    if (!actual.archivedAt) return { ok: true };
    if ((await activos(ctx.workspaceId)) >= MAX_ACTIVOS_CATALOGO) return no(MENSAJES_CATALOGO.tope);
    await tabla(prisma).updateMany({
      where: { id: actual.id, workspaceId: ctx.workspaceId },
      data: { archivedAt: null, order: await ordenAlFinal(ctx.workspaceId) },
    });
    return { ok: true };
  }

  /** Sólo si nunca se usó; si se usó, hay que archivarlo. */
  async function borrar(ctx: CtxConsultas, id: unknown): Promise<ResultadoCatalogo> {
    if (!puedeConfigurar(ctx)) return no(MENSAJES_CATALOGO.sinPermiso);
    const actual = await delWorkspace(prisma, ctx.workspaceId, id);
    if (!actual) return no(config.textos.noEncontrado);
    if (config.minimoActivos > 0 && actual.archivedAt === null && (await activos(ctx.workspaceId)) <= config.minimoActivos) {
      return no(config.textos.ultimoActivo ?? MENSAJES_CATALOGO.datosInvalidos);
    }
    return prisma.$transaction(async (tx) => {
      // Adentro de la transacción: un uso registrado en el mismo instante también frena.
      if (((await config.usos(tx, ctx.workspaceId, [actual.id])).get(actual.id) ?? 0) > 0) return no(config.textos.yaSeUso);
      await tabla(tx).deleteMany({ where: { id: actual.id, workspaceId: ctx.workspaceId } });
      return { ok: true as const };
    });
  }

  return { listar, crear, editar, reordenar, archivar, desarchivar, borrar };
}

/** Cuenta filas agrupadas por una columna (ids del workspace). */
export async function contarPor(
  db: Tx | typeof prisma,
  tabla: "fotofficeConsulta" | "fotofficeConsultaParticipante",
  columna: "categoryId" | "originId" | "roleId",
  workspaceId: string,
  ids: string[],
): Promise<Map<string, number>> {
  if (ids.length === 0) return new Map();
  const delegado = (db as unknown as Record<string, { groupBy(a: unknown): Promise<Record<string, unknown>[]> }>)[tabla]!;
  const grupos = await delegado.groupBy({ by: [columna], where: { workspaceId, [columna]: { in: ids } }, _count: true });
  return new Map(grupos.map((g) => [g[columna] as string, Number(g._count)]));
}
