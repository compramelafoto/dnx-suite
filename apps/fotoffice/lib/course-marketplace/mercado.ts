import "server-only";
import { prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { nombresDeNegocios } from "./cargar";
import { armarCursosEnMercado } from "./mercado-armado";
import { isFullAccessRole } from "@/lib/permissions/levels";
import { hasModuleLevel } from "@/lib/permissions/module-access";
import type { CursoEnMercado } from "./mercado-armado";

export type { CursoEnMercado } from "./mercado-armado";

/**
 * Los cursos que otros negocios ofrecen para revender (spec, sección 4.2): grabados, publicados,
 * con precio y con % sugerido. La comisión de la plataforma es la de quien mira, porque si lo
 * vende, la cobra su módulo de cursos.
 */
export async function cargarMercado(workspaceId: string): Promise<{ comisionPlataformaBps: number; cursos: CursoEnMercado[] }> {
  const [comisionPlataformaBps, filas] = await Promise.all([
    getPlatformFeeBps(workspaceId, COURSES_SALES_MODULE_KEY),
    prisma.course.findMany({
      where: {
        offeredToResellers: true,
        suggestedResellerBps: { not: null },
        status: "PUBLISHED",
        deliveryMode: "RECORDED",
        priceArs: { gt: 0 },
        workspaceId: { not: workspaceId },
        // Si quien mira es beneficiario del curso, el servidor le rechazaría el pedido: no se le ofrece.
        NOT: { beneficiaries: { some: { workspaceId } } },
        // Si el dueño apagó su módulo de cursos, ni la muestra ni la venta funcionan.
        workspace: { featureModules: { some: { moduleKey: COURSES_SALES_MODULE_KEY, enabled: true } } },
      },
      select: {
        id: true,
        title: true,
        slug: true,
        instructorName: true,
        priceArs: true,
        suggestedResellerBps: true,
        workspaceId: true,
        lessons: { where: { videoStatus: "READY" }, orderBy: { sortOrder: "asc" }, select: { id: true, isPreview: true } },
        beneficiaries: {
          orderBy: { createdAt: "asc" },
          select: { id: true, workspaceId: true, invitedEmail: true, shareBps: true, absorbsProcessorFee: true },
        },
        resaleAgreements: {
          where: { resellerWorkspaceId: workspaceId },
          select: { id: true, status: true, shareBps: true, memberDiscountBps: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  const ids = [
    ...new Set(filas.flatMap((f) => [f.workspaceId, ...f.beneficiaries.map((b) => b.workspaceId).filter((x): x is string => Boolean(x))])),
  ];
  const [nombres, marcas] = await Promise.all([
    nombresDeNegocios(ids),
    prisma.fotofficeWorkspaceBranding.findMany({
      where: { workspaceId: { in: filas.map((f) => f.workspaceId) } },
      select: { workspaceId: true, publicSlug: true },
    }),
  ]);

  return {
    comisionPlataformaBps,
    cursos: armarCursosEnMercado({
      filas,
      nombres,
      slugs: new Map(marcas.map((m) => [m.workspaceId, m.publicSlug])),
      baseUrl: appUrl(),
    }),
  };
}

/** Misma regla que `pedirReventaAction`: nivel MANAGE en cursos y dueño o administrador. */
export async function puedePedirReventa(userId: number, workspaceId: string): Promise<boolean> {
  if (!(await hasModuleLevel(userId, workspaceId, COURSES_SALES_MODULE_KEY, "MANAGE"))) return false;
  const membresia = await prisma.workspaceMembership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { role: true },
  });
  return isFullAccessRole(membresia?.role);
}
