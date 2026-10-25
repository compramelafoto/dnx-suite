import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { normalizarCodigo, validarPadre, type LadoRubro, type PerfilRubro, type RubroFila } from "./rubros";

/**
 * Lectura y escritura del perfil `FotofficeRubro` (padre y código de una categoría de Caja).
 *
 * El `workspaceId` sale siempre de la sesión; el permiso (`cash.configure`) lo pide la acción
 * que llama. Todo id que llega del navegador se valida contra el workspace.
 */

/** El cliente global o el de una transacción. */
type Db = Pick<Prisma.TransactionClient, "cashCategory" | "fotofficeRubro">;

/** Perfiles del workspace, por id de categoría. */
export async function perfilesRubro(workspaceId: string, db: Db = prisma): Promise<Map<string, PerfilRubro>> {
  const filas = await db.fotofficeRubro.findMany({
    where: { workspaceId },
    select: { categoryId: true, parentCategoryId: true, code: true },
  });
  return new Map(filas.map((f) => [f.categoryId, { parentCategoryId: f.parentCategoryId, code: f.code }]));
}

/**
 * Las categorías del workspace con su perfil. Dos consultas y no un `include`: una categoría
 * sin perfil tiene que salir igual, como rubro de primer nivel sin código.
 */
export async function listarRubros(
  workspaceId: string,
  opts: { kind?: LadoRubro; includeInactive?: boolean } = {},
): Promise<RubroFila[]> {
  const [categorias, perfiles] = await Promise.all([
    prisma.cashCategory.findMany({
      where: {
        workspaceId,
        ...(opts.includeInactive ? {} : { isActive: true }),
        ...(opts.kind ? { kind: opts.kind } : {}),
      },
      select: { id: true, name: true, kind: true, isActive: true, order: true },
      orderBy: { order: "asc" },
    }),
    perfilesRubro(workspaceId),
  ]);
  return categorias.map((c) => {
    const p = perfiles.get(c.id);
    return {
      id: c.id,
      name: c.name,
      kind: c.kind as LadoRubro,
      isActive: c.isActive,
      order: c.order,
      parentCategoryId: p?.parentCategoryId ?? null,
      code: p?.code ?? null,
    };
  });
}

export type PerfilRubroValidado = { ok: true; valores: PerfilRubro } | { ok: false; error: string };

/**
 * Valida padre y código que llegan del formulario, ANTES de escribir nada. `categoryId` es
 * `null` en un alta.
 */
export async function validarPerfilRubro(
  workspaceId: string,
  categoryId: string | null,
  kind: LadoRubro,
  raw: { parentCategoryId: unknown; code: unknown },
  db: Db = prisma,
): Promise<PerfilRubroValidado> {
  const codigo = normalizarCodigo(raw.code);
  if (!codigo.ok) return codigo;

  const parentIdPedido =
    typeof raw.parentCategoryId === "string" && raw.parentCategoryId.trim() !== "" ? raw.parentCategoryId.trim() : null;
  if (raw.parentCategoryId !== null && raw.parentCategoryId !== undefined && typeof raw.parentCategoryId !== "string") {
    return { ok: false, error: "Ese rubro padre no existe." };
  }

  const [padreCategoria, padrePerfil, hijos] = await Promise.all([
    parentIdPedido
      ? db.cashCategory.findFirst({ where: { id: parentIdPedido, workspaceId }, select: { id: true, kind: true } })
      : Promise.resolve(null),
    parentIdPedido
      ? db.fotofficeRubro.findFirst({ where: { categoryId: parentIdPedido, workspaceId }, select: { parentCategoryId: true } })
      : Promise.resolve(null),
    categoryId
      ? db.fotofficeRubro.findMany({ where: { parentCategoryId: categoryId, workspaceId }, select: { categoryId: true } })
      : Promise.resolve([] as { categoryId: string }[]),
  ]);

  const kindsHijos = hijos.length
    ? await db.cashCategory.findMany({
        where: { id: { in: hijos.map((h) => h.categoryId) }, workspaceId },
        select: { kind: true },
      })
    : [];

  const error = validarPadre({
    categoryId,
    kind,
    parentIdPedido,
    padre: padreCategoria
      ? { id: padreCategoria.id, kind: padreCategoria.kind, parentCategoryId: padrePerfil?.parentCategoryId ?? null }
      : null,
    hijos: kindsHijos,
  });
  if (error) return { ok: false, error };
  return { ok: true, valores: { parentCategoryId: parentIdPedido, code: codigo.valor } };
}

/**
 * Escribe el perfil ya validado. Sin padre ni código y sin perfil previo no crea nada: la
 * categoría sigue siendo como era.
 */
export async function escribirPerfilRubro(
  workspaceId: string,
  categoryId: string,
  valores: PerfilRubro,
  db: Db = prisma,
): Promise<void> {
  const existe = await db.fotofficeRubro.findFirst({ where: { categoryId, workspaceId }, select: { id: true } });
  if (!existe) {
    if (valores.parentCategoryId === null && valores.code === null) return;
    await db.fotofficeRubro.create({ data: { workspaceId, categoryId, ...valores } });
    return;
  }
  await db.fotofficeRubro.update({ where: { categoryId }, data: valores });
}
