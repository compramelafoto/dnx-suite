"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSalesAdmin, requireSalesStaff } from "@/lib/sales/access";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { asignarCliente, fotosCarnetDelCliente, usarFotoAnterior } from "@/lib/impresion/ficha-carnet";
import { estadoCopias, generarHojaCopia, guardarPiezasCopia, quitarFotoCopia, type PiezaCopiaEntrada } from "@/lib/impresion/copias";
import { guardarEscala, guardarProduccion, produccionDeProductos, type ProduccionVista } from "@/lib/impresion/configuracion";
import {
  anularPreparacion,
  confirmarOriginal,
  crearPreparacion,
  estadoPreparacion,
  generarHojaCarnet,
  guardarPiezaCarnet,
  pedirSubidaOriginal,
  registrarImpresion,
  registrarImpresiones,
  registrarPrueba,
  type CtxImpresion,
} from "@/lib/impresion/preparaciones";
import type { RegistroDeHoja } from "@/lib/impresion/impresion-multiple";
import { enviarFotoCarnetPorMail, marcarArchivoEntregado } from "@/lib/impresion/archivo-carnet";

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
        // El archivo digital no manda impresora ni hoja (el formulario las oculta).
        salidaId: formData.get("salidaId") ? String(formData.get("salidaId")) : null,
        tamanoHojaId: formData.get("tamanoHojaId") ? String(formData.get("tamanoHojaId")) : null,
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

/** Lo ya armado de una preparación, para reabrir el editor donde quedó (Mostrador → "Editar fotos"). */
export async function estadoPreparacionAction(preparacionId: string) {
  const ctx = await ctxImpresion();
  return estadoPreparacion(ctx, preparacionId);
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

/** Producto "Archivo digital": guarda la foto encuadrada y la da por entregada (no pasa por la impresora). */
export async function prepararArchivoCarnetAction(preparacionId: string, d: { originalId: string; anchoMm: number; altoMm: number; receta: unknown }) {
  const ctx = await ctxImpresion();
  const r = await guardarPiezaCarnet(ctx, preparacionId, d);
  if (r.ok) await marcarArchivoEntregado(ctx, preparacionId);
  revalidatePath("/ventas/impresiones");
  return r;
}

/** Le manda al cliente la foto carnet ya armada (sola, sin plancha) como adjunto. */
export async function enviarFotoCarnetPorMailAction(preparacionId: string, email: string) {
  const ctx = await ctxImpresion();
  return enviarFotoCarnetPorMail(ctx, preparacionId, email);
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

/** Las "Fotos anteriores" son de la ficha del cliente: además de Ventas, piden ver Clientes (como la pantalla de Foto carnet). */
async function puedeVerClientes(userId: number, workspaceId: string): Promise<boolean> {
  const clientes = await isModuleEnabledForWorkspace(workspaceId, CLIENTS_MODULE_KEY);
  const nivel = clientes ? await getModuleLevel(userId, workspaceId, CLIENTS_MODULE_KEY) : "NONE";
  return hasLevel(nivel, "VIEW");
}

export async function fotosCarnetDelClienteAction(clientId: string) {
  const { user, workspace } = await requireSalesStaff();
  if (!(await puedeVerClientes(user.id, workspace.id))) return [];
  return fotosCarnetDelCliente(workspace.id, clientId);
}

export async function usarFotoAnteriorAction(preparacionId: string, adjuntoId: string) {
  const ctx = await ctxImpresion();
  if (!(await puedeVerClientes(ctx.userId, ctx.workspaceId))) return { ok: false as const, error: "No tenés permiso para ver las fichas de clientes." };
  return usarFotoAnterior(ctx, preparacionId, adjuntoId);
}

export async function asignarClienteAction(preparacionId: string, clientId: string | null) {
  const ctx = await ctxImpresion();
  const r = await asignarCliente(ctx, preparacionId, clientId);
  revalidatePath("/ventas/impresiones");
  return r;
}

/** Copias: lo ya armado, para abrir o reabrir el editor. */
export async function estadoCopiasAction(preparacionId: string) {
  const ctx = await ctxImpresion();
  return estadoCopias(ctx, preparacionId);
}

export async function guardarPiezasCopiaAction(preparacionId: string, items: PiezaCopiaEntrada[]) {
  const ctx = await ctxImpresion();
  const r = await guardarPiezasCopia(ctx, preparacionId, items);
  revalidatePath("/ventas/impresiones");
  return r;
}

export async function quitarFotoCopiaAction(preparacionId: string, originalId: string) {
  const ctx = await ctxImpresion();
  const r = await quitarFotoCopia(ctx, preparacionId, originalId);
  revalidatePath("/ventas/impresiones");
  return r;
}

/** Arma la hoja de UNA foto. El editor la llama de a una foto por vez. */
export async function generarHojaCopiaAction(preparacionId: string, originalId: string) {
  const ctx = await ctxImpresion();
  const r = await generarHojaCopia(ctx, preparacionId, originalId);
  revalidatePath("/ventas/impresiones");
  return r;
}

/** "¿Cómo salió?" de la página que imprime toda la preparación: un registro por hoja. */
export async function registrarImpresionesAction(preparacionId: string, items: RegistroDeHoja[]) {
  const ctx = await ctxImpresion();
  const r = await registrarImpresiones(ctx, preparacionId, items);
  revalidatePath("/ventas/impresiones");
  return r;
}
