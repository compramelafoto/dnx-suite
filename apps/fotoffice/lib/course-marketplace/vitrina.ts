// lib/course-marketplace/vitrina.ts
import "server-only";
import { prisma } from "@repo/db";
import { getAuthUser } from "@/lib/auth";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { cobroConRepartoHabilitado } from "@/lib/payments/split-1n";
import { cargarBeneficiarios, cargarDueno } from "./cargar";
import { estadoDeVenta, beneficiariosParaMotor } from "./beneficiarios";
import { decidirVenta, montosDeVenta } from "./venta";

/**
 * Los cursos de otros negocios en el sitio y el portal de quien los revende (spec, sección 4.3):
 * aparecen con su marca, igual que los propios. Sólo con un acuerdo ACTIVO y el curso publicado.
 */

export type AcuerdoDeVitrina = { id: string; courseId: string; shareBps: number; memberDiscountBps: number };

/**
 * El acuerdo por el que `workspaceId` muestra en `/cursos/{courseSlug}` un curso ajeno. Se busca
 * sólo si el negocio no tiene un curso propio con ese slug: el propio siempre gana. Entre dos
 * revendidos con el mismo slug, el acuerdo más viejo.
 */
export async function buscarAcuerdoDeVitrina(workspaceId: string, courseSlug: string): Promise<AcuerdoDeVitrina | null> {
  return prisma.courseResaleAgreement.findFirst({
    where: {
      resellerWorkspaceId: workspaceId,
      status: "ACTIVO",
      course: { slug: courseSlug, status: "PUBLISHED", deliveryMode: "RECORDED" },
    },
    orderBy: { createdAt: "asc" },
    select: { id: true, courseId: true, shareBps: true, memberDiscountBps: true },
  });
}

export async function cursosRevendidosDe(workspaceId: string) {
  return prisma.courseResaleAgreement.findMany({
    where: { resellerWorkspaceId: workspaceId, status: "ACTIVO", course: { status: "PUBLISHED", deliveryMode: "RECORDED" } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      shareBps: true,
      memberDiscountBps: true,
      course: {
        select: { id: true, slug: true, title: true, shortDescription: true, coverImageUrl: true, thumbnailImageUrl: true, priceArs: true, workspaceId: true },
      },
    },
  });
}

/**
 * ¿Quien está mirando es socio activo de este negocio? Sale de la sesión: el descuento nunca se
 * pide desde el navegador. Sin sesión (o en un dominio propio, donde la sesión de FOTOFFICE no
 * viaja), no es socio: paga el precio público.
 */
export async function esSocioActivoDe(workspaceId: string): Promise<boolean> {
  const user = await getAuthUser();
  if (!user) return false;
  const ficha = await prisma.member.findFirst({ where: { userId: user.id, workspaceId, status: "ACTIVE" }, select: { id: true } });
  return ficha !== null;
}

export type CursoRevendidoParaSocio = {
  courseId: string;
  titulo: string;
  descripcion: string | null;
  precioPublicoArs: string | null;
  precioSocioArs: string | null;
  aLaVenta: boolean;
  href: string | null;
};

/** Los cursos ajenos que la institución del socio revende, con el precio para socios. */
export async function cursosRevendidosParaSocios(workspaceId: string): Promise<CursoRevendidoParaSocio[]> {
  const [acuerdos, marca, feeBps] = await Promise.all([
    cursosRevendidosDe(workspaceId),
    prisma.fotofficeWorkspaceBranding.findUnique({ where: { workspaceId }, select: { publicSlug: true, commercialName: true } }),
    getPlatformFeeBps(workspaceId, COURSES_SALES_MODULE_KEY),
  ]);
  const splitHabilitado = cobroConRepartoHabilitado();
  return Promise.all(
    acuerdos.map(async (a) => {
      const [dueno, registrados] = await Promise.all([cargarDueno(a.course.workspaceId), cargarBeneficiarios(a.course.id)]);
      const base = {
        listaArs: a.course.priceArs?.toString() ?? "0",
        comisionPlataformaBps: feeBps,
        beneficiarios: beneficiariosParaMotor(dueno, registrados),
        vendedorWorkspaceId: workspaceId,
        reventa: { workspaceId, nombre: marca?.commercialName ?? "", bps: a.shareBps, descuentoSociosBps: a.memberDiscountBps },
      };
      const publico = montosDeVenta({ ...base, esSocioDelVendedor: false });
      const socio = montosDeVenta({ ...base, esSocioDelVendedor: true });
      const decision = decidirVenta({ estado: estadoDeVenta(a.course.workspaceId, registrados), revendido: true, splitHabilitado });
      return {
        courseId: a.course.id,
        titulo: a.course.title,
        descripcion: a.course.shortDescription,
        precioPublicoArs: publico.ok ? publico.amountArs : null,
        precioSocioArs: socio.ok && a.memberDiscountBps > 0 ? socio.amountArs : null,
        aLaVenta: decision.tipo !== "PROXIMAMENTE",
        href: marca ? `/w/${marca.publicSlug}/cursos/${a.course.slug}` : null,
      };
    }),
  );
}
