"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSalesAdmin, requireSalesStaff } from "@/lib/sales/access";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { guardarEscala, guardarProduccion, produccionDeProductos, type ProduccionVista } from "@/lib/impresion/configuracion";
import {
  anularPreparacion,
  confirmarOriginal,
  crearPreparacion,
  generarHojaCarnet,
  guardarPiezaCarnet,
  pedirSubidaOriginal,
  registrarImpresion,
  registrarPrueba,
  type CtxImpresion,
} from "@/lib/impresion/preparaciones";

export async function guardarEscalaAction(formData: FormData): Promise<void> {
  const { workspace } = await requireSalesAdmin();
  const salidaId = String(formData.get("salidaId") ?? "");
  const r = await guardarEscala(workspace.id, salidaId, Number(String(formData.get("x")).replace(",", ".")), Number(String(formData.get("y")).replace(",", ".")));
  revalidatePath("/ventas/impresion/configuracion");
  redirect(`/ventas/impresion/configuracion?${r.ok ? "ok=1" : `error=${encodeURIComponent(r.error)}`}`);
}

export async function guardarProduccionAction(formData: FormData): Promise<void> {
  const { workspace } = await requireSalesAdmin();
  const productId = String(formData.get("productId") ?? "");
  const activo = formData.get("activo") === "on";
  const datos: ProduccionVista | null = activo
    ? {
        tipoPieza: String(formData.get("tipoPieza")) as ProduccionVista["tipoPieza"],
        salidaId: String(formData.get("salidaId")),
        tamanoHojaId: String(formData.get("tamanoHojaId")),
        unidad: String(formData.get("unidad")) as ProduccionVista["unidad"],
      }
    : null;
  const r = await guardarProduccion(workspace.id, productId, datos);
  revalidatePath(`/ventas/catalogo/${productId}`);
  redirect(`/ventas/catalogo/${productId}?${r.ok ? "ok=1" : `error=${encodeURIComponent(r.error)}`}`);
}

/** Privada: en un archivo "use server" todo lo exportado es una acción. */
async function ctxImpresion(): Promise<CtxImpresion> {
  const { user, workspace } = await requireSalesStaff();
  return { workspaceId: workspace.id, userId: user.id, userLabel: etiquetaDeUsuario(user) };
}

export async function crearPreparacionAction(d: { productId: string | null; clientId: string | null }) {
  const ctx = await ctxImpresion();
  return crearPreparacion(ctx, d);
}

export async function pedirSubidaOriginalAction(preparacionId: string, a: { nombre: string; tipo: string; bytes: number }) {
  const ctx = await ctxImpresion();
  return pedirSubidaOriginal(ctx, preparacionId, a);
}

export async function confirmarOriginalAction(originalId: string) {
  const ctx = await ctxImpresion();
  return confirmarOriginal(ctx, originalId);
}

export async function guardarPiezaCarnetAction(preparacionId: string, d: { originalId: string; anchoMm: number; altoMm: number; receta: unknown }) {
  const ctx = await ctxImpresion();
  return guardarPiezaCarnet(ctx, preparacionId, d);
}

export async function generarHojaCarnetAction(
  preparacionId: string,
  d: { salidaId: string | null; tamanoId: string | null; fotos: number | null; copias: number; conLineas: boolean },
) {
  const ctx = await ctxImpresion();
  const r = await generarHojaCarnet(ctx, preparacionId, d);
  revalidatePath("/ventas/impresiones");
  return r;
}

export async function registrarImpresionAction(hojaId: string, d: { motivo: "NORMAL" | "DESCARTADA"; hojas: number }) {
  const ctx = await ctxImpresion();
  const r = await registrarImpresion(ctx, hojaId, d);
  revalidatePath("/ventas/impresiones");
  return r;
}

export async function registrarPruebaAction(salidaId: string, tamanoId: string) {
  const ctx = await ctxImpresion();
  return registrarPrueba(ctx, salidaId, tamanoId);
}

export async function anularPreparacionAction(preparacionId: string) {
  const ctx = await ctxImpresion();
  const r = await anularPreparacion(ctx, preparacionId);
  revalidatePath("/ventas/impresiones");
  return r;
}

export async function produccionDeProductosAction() {
  const { workspace } = await requireSalesStaff();
  return produccionDeProductos(workspace.id);
}
