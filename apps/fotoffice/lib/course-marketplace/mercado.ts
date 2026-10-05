import "server-only";
import { prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { nombresDeNegocios } from "./cargar";
import { beneficiariosParaMotor } from "./beneficiarios";
import type { BeneficiarioEntrada } from "./reparto";
import type { EstadoReventa } from "./reventa";

export type CursoEnMercado = {
  courseId: string;
  titulo: string;
  docente: string | null;
  dueno: { workspaceId: string; nombre: string };
  listaCentavos: number;
  sugeridoBps: number;
  clases: number;
  muestraUrl: string | null;
  beneficiarios: BeneficiarioEntrada[];
  miAcuerdo: { id: string; status: EstadoReventa; shareBps: number; memberDiscountBps: number } | null;
};

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
  const slugs = new Map(marcas.map((m) => [m.workspaceId, m.publicSlug]));
  const base = appUrl();

  return {
    comisionPlataformaBps,
    cursos: filas.map((f) => {
      const dueno = { workspaceId: f.workspaceId, nombre: nombres.get(f.workspaceId) ?? "Negocio" };
      const muestra = f.lessons.find((l) => l.isPreview);
      const slug = slugs.get(f.workspaceId);
      return {
        courseId: f.id,
        titulo: f.title,
        docente: f.instructorName,
        dueno,
        listaCentavos: Math.round(Number(f.priceArs ?? 0) * 100),
        sugeridoBps: f.suggestedResellerBps ?? 0,
        clases: f.lessons.length,
        // La muestra se ve en el sitio del dueño: los videos sólo se reproducen desde FOTOFFICE.
        muestraUrl: muestra && slug && base ? `${base}/w/${slug}/cursos/${f.slug}/muestra/${muestra.id}` : null,
        beneficiarios: beneficiariosParaMotor(
          dueno,
          f.beneficiaries.map((b) => ({
            ...b,
            nombre: b.workspaceId ? nombres.get(b.workspaceId) ?? "Negocio" : b.invitedEmail ?? "Invitado",
          })),
        ),
        miAcuerdo: f.resaleAgreements[0] ?? null,
      };
    }),
  };
}
