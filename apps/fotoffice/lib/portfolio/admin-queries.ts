import "server-only";
import { prisma } from "@repo/db";
import { PORTFOLIO_OVERDUE_LIMIT } from "./constants";
import { portfolioVisibility, type PortfolioVisibility } from "./visibility";

/**
 * Lo que la institución ve de los portfolios de su gente.
 *
 * Incluye a quienes **no** tienen portfolio, y eso es lo que vuelve útil la pantalla: el listado
 * sirve tanto para controlar lo publicado como para saber a quién hay que recordarle que cargue
 * sus fotos. Un listado de sólo los que ya publicaron no contesta la segunda pregunta, que es la
 * que más se hace al principio.
 */

export type AdminPortfolioRow = {
  memberId: string;
  /** `null` si la persona nunca entró a armarlo. */
  portfolioId: string | null;
  displayName: string;
  memberNumber: string;
  publicSlug: string | null;
  photoCount: number;
  memberPublished: boolean;
  hiddenByAdminAt: Date | null;
  hiddenReason: string | null;
  hiddenByLabel: string | null;
  adminForcePublish: boolean;
  overdueCount: number;
  visibility: PortfolioVisibility;
};

export type AdminPortfolioSummary = {
  publicados: number;
  armadosSinPublicar: number;
  sinPortfolio: number;
};

export async function loadPortfoliosForAdmin(workspaceId: string): Promise<AdminPortfolioRow[]> {
  const ahora = new Date();

  const [miembros, vencidos] = await Promise.all([
    prisma.member.findMany({
      where: { workspaceId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        memberNumber: true,
        status: true,
        directoryOptIn: true,
        portfolio: {
          select: {
            id: true,
            publicSlug: true,
            memberPublished: true,
            hiddenByAdminAt: true,
            hiddenReason: true,
            adminForcePublish: true,
            hiddenByUser: { select: { name: true, email: true } },
            _count: { select: { photos: true } },
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.membershipCharge
      .groupBy({
        by: ["memberId"],
        where: { workspaceId, balanceArs: { gt: 0 }, dueDate: { lt: ahora } },
        _count: { _all: true },
      })
      .then((filas) => new Map(filas.map((f) => [f.memberId, f._count._all]))),
  ]);

  return miembros.map((m) => {
    const p = m.portfolio;
    const overdueCount = vencidos.get(m.id) ?? 0;
    const photoCount = p?._count.photos ?? 0;

    return {
      memberId: m.id,
      portfolioId: p?.id ?? null,
      displayName: `${m.firstName} ${m.lastName}`.trim(),
      memberNumber: m.memberNumber,
      publicSlug: p?.publicSlug ?? null,
      photoCount,
      memberPublished: p?.memberPublished ?? false,
      hiddenByAdminAt: p?.hiddenByAdminAt ?? null,
      hiddenReason: p?.hiddenReason ?? null,
      hiddenByLabel: p?.hiddenByUser?.name ?? p?.hiddenByUser?.email ?? null,
      adminForcePublish: p?.adminForcePublish ?? false,
      overdueCount,
      visibility: portfolioVisibility({
        // Quien llama ya verificó el módulo; la pantalla no existe si está apagado.
        moduleEnabled: true,
        hiddenByAdminAt: p?.hiddenByAdminAt ?? null,
        memberStatus: m.status as "ACTIVE" | "SUSPENDED" | "INACTIVE",
        directoryOptIn: m.directoryOptIn,
        photoCount,
        memberPublished: p?.memberPublished ?? false,
        overdueCount,
        adminForcePublish: p?.adminForcePublish ?? false,
      }),
    };
  });
}

/** Los tres números de arriba de la pantalla. */
export function summarizePortfolios(filas: AdminPortfolioRow[]): AdminPortfolioSummary {
  return {
    publicados: filas.filter((f) => f.visibility.visible).length,
    armadosSinPublicar: filas.filter((f) => !f.visibility.visible && f.photoCount > 0).length,
    sinPortfolio: filas.filter((f) => f.photoCount === 0).length,
  };
}

/** Si esta persona está tapada por la deuda y la institución podría destrabarla con un clic. */
export function trabadaPorDeuda(fila: AdminPortfolioRow): boolean {
  return (
    !fila.visibility.visible &&
    fila.visibility.reason === "OVERDUE_DUES" &&
    fila.overdueCount >= PORTFOLIO_OVERDUE_LIMIT
  );
}
