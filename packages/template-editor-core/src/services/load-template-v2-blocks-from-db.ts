import type { PrismaClient } from "@prisma/client";

/** Campos de bloque usados por el editor y preview (sin relaciones). */
const TEMPLATE_V2_BLOCK_SELECT_BASE = {
  id: true,
  type: true,
  name: true,
  x: true,
  y: true,
  width: true,
  height: true,
  rotation: true,
  zIndex: true,
  opacity: true,
  locked: true,
  visible: true,
  configJson: true,
} as const;

export type TemplateV2BlockRowFromDb = {
  id: string;
  type: string;
  name: string | null;
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  opacity: number;
  locked: boolean;
  visible: boolean;
  configJson: unknown;
};

function isMissingPageIndexSelectError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("Unknown field") && msg.includes("pageIndex");
}

/**
 * Carga bloques de una versión. Si el cliente Prisma está desactualizado respecto al schema
 * (campo `pageIndex` en TemplateV2Block), reintenta sin ese campo y usa pageIndex=0.
 * Para datos reales multipágina: `npx prisma migrate deploy && npx prisma generate`.
 */
export async function loadTemplateV2BlocksForVersion(
  db: Pick<PrismaClient, "templateV2Block">,
  templateVersionId: string
): Promise<TemplateV2BlockRowFromDb[]> {
  const orderBy = { zIndex: "asc" as const };
  const selectWithPage = {
    ...TEMPLATE_V2_BLOCK_SELECT_BASE,
    pageIndex: true,
  };

  try {
    const rows = await db.templateV2Block.findMany({
      where: { templateVersionId },
      orderBy,
      select: selectWithPage,
    });
    return rows.map((b: TemplateV2BlockRowFromDb) => ({
      ...b,
      pageIndex: typeof b.pageIndex === "number" ? b.pageIndex : 0,
    }));
  } catch (e) {
    if (!isMissingPageIndexSelectError(e)) throw e;
    console.warn(
      "[template-v2] Cliente Prisma sin campo TemplateV2Block.pageIndex; recargando sin él. Ejecutá: npx prisma migrate deploy && npx prisma generate"
    );
    const rows = await db.templateV2Block.findMany({
      where: { templateVersionId },
      orderBy,
      select: TEMPLATE_V2_BLOCK_SELECT_BASE,
    });
    return rows.map((b: Omit<TemplateV2BlockRowFromDb, "pageIndex">) => ({
      ...b,
      pageIndex: 0,
    }));
  }
}
