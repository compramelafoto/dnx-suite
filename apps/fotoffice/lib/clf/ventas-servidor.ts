import "server-only";
import { prisma } from "@repo/db";
import { puede } from "@/lib/access/policy";
import { resolverAcceso } from "@/lib/access/acceso";
import { getAuthUser } from "@/lib/auth";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { arMonthRange } from "@/lib/store/artworks/royalty-report";
import { resolveActiveWorkspace } from "@/lib/workspace";
import { netoReintegrado, type VentaVista } from "./ventas-vista";

export const CLF_SALES_MODULE_KEY = "clf-sales";

/**
 * Guarda de «Ventas CLF» (etapa 2): sesión, workspace activo, módulo `clf-sales` encendido y «ver dinero» en ese
 * módulo. El rol Equipo no lo tiene por omisión. Devuelve null ante cualquier falta, sin decir el motivo.
 */
export async function accesoVentasClf(): Promise<{ workspaceId: string; workspaceName: string } | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  if (!(await isModuleEnabledForWorkspace(workspace.id, CLF_SALES_MODULE_KEY))) return null;
  const acceso = await resolverAcceso(user.id, workspace.id);
  if (!puede(acceso, "verDinero", CLF_SALES_MODULE_KEY)) return null;
  return { workspaceId: workspace.id, workspaceName: workspace.name };
}

/** Sólo el sí o el no, para la tarjeta del pedido (quien no puede ver dinero de Ventas CLF no ve la línea). */
export async function puedeVerVentasClf(userId: number, workspaceId: string): Promise<boolean> {
  if (!(await isModuleEnabledForWorkspace(workspaceId, CLF_SALES_MODULE_KEY))) return false;
  return puede(await resolverAcceso(userId, workspaceId), "verDinero", CLF_SALES_MODULE_KEY);
}

export type VentaFila = VentaVista & {
  id: string;
  clfOrderId: number;
  mpPaymentId: string | null;
  albumId: number;
  albumTitulo: string;
  detalle: string;
  conexionCerrada: boolean;
};

const n = (d: unknown): number => Number(String(d));
const nn = (d: unknown): number | null => (d === null || d === undefined ? null : n(d));

/** Las ventas pagadas en el mes y las reintegradas en el mes (para restar el reintegro donde ocurrió). */
export async function ventasDelMes(workspaceId: string, mes: string, albumId: number | null): Promise<VentaFila[]> {
  const { start, end } = arMonthRange(mes);
  const filas = await prisma.fotofficeClfVenta.findMany({
    where: {
      workspaceId,
      ...(albumId !== null ? { albumId } : {}),
      OR: [{ pagadoEl: { gte: start, lt: end } }, { reintegradoEl: { gte: start, lt: end } }],
    },
    orderBy: { pagadoEl: "desc" },
    take: 2000,
  });
  return filas.map((f) => ({
    id: f.id,
    clfOrderId: f.clfOrderId,
    mpPaymentId: f.mpPaymentId,
    albumId: f.albumId,
    albumTitulo: f.albumTitulo,
    detalle: f.detalle,
    conexionCerrada: f.conexionCerrada,
    pagadoEl: f.pagadoEl,
    validacion: f.validacion,
    pagoFamiliaArs: n(f.pagoFamiliaArs),
    netoFotografoArs: n(f.netoFotografoArs),
    comisionPlataformaArs: n(f.comisionPlataformaArs),
    mpComisionPlataformaArs: nn(f.mpComisionPlataformaArs),
    mpComisionMpArs: nn(f.mpComisionMpArs),
    mpAcreditadoArs: nn(f.mpAcreditadoArs),
    mpBrutoArs: nn(f.mpBrutoArs),
    mpReintegradoArs: nn(f.mpReintegradoArs),
    reintegradoEl: f.reintegradoEl,
  }));
}

/** Para la tarjeta del pedido vinculado: cuántas ventas del álbum y cuánto se acreditó (sin las que no están en tu MP). */
export async function resumenDelAlbum(workspaceId: string, albumId: number): Promise<{ ventas: number; acreditado: number } | null> {
  const filas = await prisma.fotofficeClfVenta.findMany({
    where: { workspaceId, albumId, validacion: { notIn: ["NO_EN_TU_MP"] } },
    select: { mpAcreditadoArs: true, mpReintegradoArs: true, mpBrutoArs: true },
  });
  if (filas.length === 0) return null;
  const acreditado = filas.reduce(
    (s, f) => s + (nn(f.mpAcreditadoArs) ?? 0) - netoReintegrado({ mpAcreditadoArs: nn(f.mpAcreditadoArs), mpBrutoArs: nn(f.mpBrutoArs), mpReintegradoArs: nn(f.mpReintegradoArs) }),
    0,
  );
  return { ventas: filas.length, acreditado: Math.round(acreditado * 100) / 100 };
}

/** Los álbumes con ventas, para el filtro. */
export async function albumesConVentas(workspaceId: string): Promise<{ id: number; titulo: string }[]> {
  const filas = await prisma.fotofficeClfVenta.findMany({
    where: { workspaceId },
    select: { albumId: true, albumTitulo: true },
    distinct: ["albumId"],
    orderBy: { albumId: "desc" },
    take: 200,
  });
  return filas.map((f) => ({ id: f.albumId, titulo: f.albumTitulo }));
}
