import "server-only";
import { prisma, type Prisma } from "@repo/db";
import type { ContextoListado } from "./tipos";

type Cliente = Pick<typeof prisma, "fotofficeListActivity"> | Prisma.TransactionClient;

export async function registrarActividad(
  db: Cliente,
  a: {
    ctx: ContextoListado;
    listKey: string;
    kind: "EXPORT" | "BULK_ACTION";
    action?: string;
    rowCount: number;
    query: string;
    detail?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await db.fotofficeListActivity.create({
    data: {
      workspaceId: a.ctx.workspaceId,
      listKey: a.listKey,
      kind: a.kind,
      action: a.action ?? null,
      actorUserId: a.ctx.userId,
      actorLabel: a.ctx.userLabel,
      rowCount: a.rowCount,
      query: a.query,
      detail: a.detail,
    },
  });
}
