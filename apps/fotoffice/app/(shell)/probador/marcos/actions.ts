"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireSalesStaff } from "@/lib/sales/access";

/**
 * Guardar, activar y desactivar modelos de marco del probador. Sólo quien vende (Ventas con
 * permiso de gestión); el estudio sale siempre de la sesión.
 */

export type ResultadoMarco = { ok: true } | { ok: false; error: string };

const finito = (v: unknown, min: number, max: number): v is number => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;

export async function guardarModeloMarcoAction(datos: unknown): Promise<ResultadoMarco> {
  const { workspace } = await requireSalesStaff();
  const d = (datos ?? {}) as Record<string, unknown>;
  const productId = typeof d.productId === "string" ? d.productId : "";
  const color = typeof d.color === "string" ? d.color.trim().slice(0, 60) : "";
  const imagenUrl = typeof d.imagenUrl === "string" ? d.imagenUrl : "";
  const v = (d.ventana ?? {}) as Record<string, unknown>;
  if (!productId || !color || !/^(https:\/\/|\/uploads\/)/.test(imagenUrl)) return { ok: false, error: "Faltan datos del marco." };
  if (!finito(d.imagenAncho, 100, 4000) || !finito(d.imagenAlto, 100, 4000)) return { ok: false, error: "La imagen no tiene una medida válida." };
  if (!finito(v.x, 0, d.imagenAncho) || !finito(v.y, 0, d.imagenAlto) || !finito(v.w, 10, d.imagenAncho) || !finito(v.h, 10, d.imagenAlto)) {
    return { ok: false, error: "La ventana del marco no es válida. Volvé a marcar sus esquinas." };
  }
  if (!finito(d.exteriorAnchoCm, 5, 300) || !finito(d.exteriorAltoCm, 5, 300)) return { ok: false, error: "Cargá la medida de afuera del marco de la foto." };
  const producto = await prisma.product.findFirst({ where: { id: productId, workspaceId: workspace.id }, select: { id: true } });
  if (!producto) return { ok: false, error: "Ese producto no es de este estudio." };

  const datosModelo = {
    imagenUrl,
    imagenAncho: Math.round(d.imagenAncho),
    imagenAlto: Math.round(d.imagenAlto),
    ventanaX: v.x, ventanaY: v.y, ventanaW: v.w, ventanaH: v.h,
    exteriorAnchoCm: d.exteriorAnchoCm,
    exteriorAltoCm: d.exteriorAltoCm,
    activo: true,
  };
  await prisma.fotofficeModeloMarco.upsert({
    where: { workspaceId_productId_color: { workspaceId: workspace.id, productId, color } },
    create: { workspaceId: workspace.id, productId, color, ...datosModelo },
    update: datosModelo,
  });
  revalidatePath("/probador/marcos");
  return { ok: true };
}

export async function activarModeloMarcoAction(id: string, activo: boolean): Promise<ResultadoMarco> {
  const { workspace } = await requireSalesStaff();
  const r = await prisma.fotofficeModeloMarco.updateMany({ where: { id, workspaceId: workspace.id }, data: { activo } });
  if (r.count !== 1) return { ok: false, error: "No encontramos ese marco." };
  revalidatePath("/probador/marcos");
  return { ok: true };
}
