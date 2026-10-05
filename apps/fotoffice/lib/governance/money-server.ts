import "server-only";
import { prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { getModuleLevel, hasModuleAction } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { CASH_PROJECT_MONEY_ACTION } from "@/lib/permissions/actions";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { GOVERNANCE_MODULE_KEY } from "./constants";
import { neededFor, projectNumbers, type ProjectNumbers } from "./money";

/**
 * Lecturas de la plata de los proyectos (diseño §8). El cálculo es de `money.ts`; acá sólo se
 * junta lo que hace falta de la base.
 */

const aMinor = (d: { toString(): string } | null | undefined) => (d ? decimalArsToMinor(d) : 0);

/** Si Caja está encendida: sin Caja, la sección de dinero muestra sólo lo necesario y las cotizaciones. */
export async function isCashOn(workspaceId: string): Promise<boolean> {
  return isModuleEnabledForWorkspace(workspaceId, CASH_MODULE_KEY);
}

/** Reservar, gastar e ingresar plata de proyectos: Caja en Gestionar + la acción `cash.project_money`. */
export async function canHandleProjectMoney(userId: number, workspaceId: string): Promise<boolean> {
  const [nivel, accion] = await Promise.all([
    getModuleLevel(userId, workspaceId, CASH_MODULE_KEY),
    hasModuleAction(userId, workspaceId, CASH_MODULE_KEY, CASH_PROJECT_MONEY_ACTION),
  ]);
  return hasLevel(nivel, "MANAGE") && accion;
}

export async function loadProjectMoney(workspaceId: string, projectId: string) {
  const p = await prisma.govProject.findFirst({
    where: { id: projectId, workspaceId },
    select: {
      manualNeededArs: true,
      openingAssignedArs: true,
      openingSpentArs: true,
      openingAt: true,
      stages: {
        orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          estimatedCostArs: true,
          quotes: {
            orderBy: { createdAt: "asc" },
            include: { attachments: { select: { id: true, filename: true, sizeBytes: true } } },
          },
        },
      },
      reservations: { orderBy: { createdAt: "desc" } },
      movements: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          stageId: true,
          quoteId: true,
          cashMovement: {
            select: {
              id: true,
              kind: true,
              amountArs: true,
              occurredAt: true,
              description: true,
              account: { select: { name: true } },
              reversedBy: { select: { id: true } },
            },
          },
        },
      },
    },
  });
  if (!p) return null;

  const necesario = neededFor(
    p.stages.map((s) => ({
      id: s.id,
      estimatedCostMinor: s.estimatedCostArs ? aMinor(s.estimatedCostArs) : null,
      quotes: s.quotes.map((q) => ({ amountMinor: aMinor(q.amountArs), status: q.status })),
    })),
    p.manualNeededArs ? aMinor(p.manualNeededArs) : null,
  );
  const movimientos = p.movements.map((m) => ({
    linkId: m.id,
    stageId: m.stageId,
    quoteId: m.quoteId,
    id: m.cashMovement.id,
    kind: m.cashMovement.kind as "INGRESO" | "EGRESO",
    amountMinor: aMinor(m.cashMovement.amountArs),
    occurredAt: m.cashMovement.occurredAt,
    description: m.cashMovement.description,
    accountName: m.cashMovement.account.name,
    reversed: m.cashMovement.reversedBy !== null,
  }));
  const numeros = projectNumbers({
    neededMinor: necesario.totalMinor,
    reservationsMinor: p.reservations.map((r) => aMinor(r.amountArs)),
    movements: movimientos,
    openingAssignedMinor: aMinor(p.openingAssignedArs),
    openingSpentMinor: aMinor(p.openingSpentArs),
  });
  return { necesario, numeros, stages: p.stages, reservations: p.reservations, movimientos, opening: p };
}

export type ProjectMoney = NonNullable<Awaited<ReturnType<typeof loadProjectMoney>>>;

/** El restante de un proyecto, sin traer etapas ni cotizaciones (no hacen falta para restar). */
async function remainingOf(projectIds: readonly string[]): Promise<Map<string, ProjectNumbers["remainingMinor"]>> {
  if (projectIds.length === 0) return new Map();
  const [proyectos, reservas, enlaces] = await Promise.all([
    prisma.govProject.findMany({
      where: { id: { in: [...projectIds] } },
      select: { id: true, openingAssignedArs: true, openingSpentArs: true },
    }),
    prisma.govReservation.groupBy({ by: ["projectId"], where: { projectId: { in: [...projectIds] } }, _sum: { amountArs: true } }),
    prisma.govProjectMovement.findMany({
      where: { projectId: { in: [...projectIds] } },
      select: { projectId: true, cashMovement: { select: { kind: true, amountArs: true, reversedBy: { select: { id: true } } } } },
    }),
  ]);
  const out = new Map<string, number>();
  for (const p of proyectos) {
    const r = reservas.find((x) => x.projectId === p.id)?._sum.amountArs;
    const movs = enlaces
      .filter((e) => e.projectId === p.id)
      .map((e) => ({
        kind: e.cashMovement.kind as "INGRESO" | "EGRESO",
        amountMinor: aMinor(e.cashMovement.amountArs),
        reversed: e.cashMovement.reversedBy !== null,
      }));
    out.set(
      p.id,
      projectNumbers({
        neededMinor: 0,
        reservationsMinor: r ? [aMinor(r)] : [],
        movements: movs,
        openingAssignedMinor: aMinor(p.openingAssignedArs),
        openingSpentMinor: aMinor(p.openingSpentArs),
      }).remainingMinor,
    );
  }
  return out;
}

export async function remainingOfProject(projectId: string): Promise<number> {
  return (await remainingOf([projectId])).get(projectId) ?? 0;
}

/**
 * Lo comprometido en proyectos vivos (aprobados o en ejecución). Es lo que Caja resta del saldo
 * total para mostrar el saldo libre. Con Gobierno apagado, cero.
 */
export async function committedMinor(workspaceId: string): Promise<{ totalMinor: number; projects: number }> {
  if (!(await isModuleEnabledForWorkspace(workspaceId, GOVERNANCE_MODULE_KEY))) return { totalMinor: 0, projects: 0 };
  const vivos = await prisma.govProject.findMany({
    where: { workspaceId, status: { in: ["APPROVED", "IN_PROGRESS"] } },
    select: { id: true },
  });
  const restos = await remainingOf(vivos.map((v) => v.id));
  let total = 0;
  let conPlata = 0;
  for (const r of restos.values()) {
    if (r > 0) {
      total += r;
      conPlata++;
    }
  }
  return { totalMinor: total, projects: conPlata };
}

/** Proyectos a los que se puede imputar un movimiento desde Caja. */
export async function listMoneyProjects(workspaceId: string) {
  if (!(await isModuleEnabledForWorkspace(workspaceId, GOVERNANCE_MODULE_KEY))) return [];
  return prisma.govProject.findMany({
    where: { workspaceId, status: { in: ["APPROVED", "IN_PROGRESS"] } },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });
}
