// lib/course-classroom/asociarse.ts
import "server-only";
import { prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { getWorkspaceCollectionStatus } from "@/lib/payments/connect/status";
import { getActiveFeeValue } from "@/lib/membership/settings";
import type { InvitacionASociarse } from "./email";

/**
 * Cuándo invitar a alguien a asociarse y a dónde.
 *
 * El criterio de "abierto" es el mismo de `/w/<institución>/asociarse`: sin módulo de socios,
 * sin cobros conectados o sin valor de cuota, ese formulario no se publica — y una invitación
 * a un formulario cerrado sería una promesa rota.
 */
export function asociarseAbierto(input: { moduloSocios: boolean; puedeCobrar: boolean; hayValorCuota: boolean }): boolean {
  return input.moduloSocios && input.puedeCobrar && input.hayValorCuota;
}

async function decidir(workspaceId: string, userId: number): Promise<{ ruta: string; institucion: string } | null> {
  const [socio, branding, moduloSocios, cobros, valorCuota] = await Promise.all([
    prisma.member.findFirst({ where: { userId, workspaceId, status: "ACTIVE" }, select: { id: true } }),
    prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId },
      select: { publicSlug: true, commercialName: true },
    }),
    isModuleEnabledForWorkspace(workspaceId, MEMBERS_MODULE_KEY),
    getWorkspaceCollectionStatus(workspaceId),
    getActiveFeeValue(workspaceId, null, new Date()),
  ]);
  if (socio || !branding) return null;
  if (!asociarseAbierto({ moduloSocios, puedeCobrar: cobros.canCharge, hayValorCuota: Boolean(valorCuota) })) return null;
  return { ruta: `/w/${branding.publicSlug}/asociarse`, institucion: branding.commercialName };
}

/** La ruta relativa de Asociarse para el portal, o `null` si no corresponde invitar. */
export async function rutaAsociarse(workspaceId: string, userId: number): Promise<string | null> {
  return (await decidir(workspaceId, userId))?.ruta ?? null;
}

/** La invitación para el correo, con enlace absoluto, o `null` si no corresponde invitar. */
export async function invitacionASociarse(workspaceId: string, userId: number): Promise<InvitacionASociarse | null> {
  const d = await decidir(workspaceId, userId);
  const base = appUrl();
  if (!d || !base) return null;
  return { institucion: d.institucion, url: `${base}${d.ruta}` };
}

/** Los cursos gratis para socios de esa institución, para el argumento de la tarjeta. */
export async function cursosGratisDeLaInstitucion(workspaceId: string) {
  return prisma.course.findMany({
    where: { workspaceId, freeForMembers: true, status: "PUBLISHED", deliveryMode: "RECORDED" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, title: true },
  });
}
