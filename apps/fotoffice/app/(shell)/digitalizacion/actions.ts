"use server";

import { revalidatePath } from "next/cache";
import { contextoDigitalizacion } from "@/lib/digitalizacion/contexto";
import * as G from "@/lib/digitalizacion/servidor/grabaciones";
import * as E from "@/lib/digitalizacion/servidor/entregas";
import * as K from "@/lib/digitalizacion/servidor/cargos";
import { validarCierre, validarLatido, validarNuevaGrabacion, validarPedidoParte } from "@/lib/digitalizacion/validar";

const SIN_PERMISO = { ok: false as const, error: "No tenés permiso para hacer esto.", definitivo: true };
const INVALIDO = { ok: false as const, error: "Los datos no son válidos.", definitivo: true };

export async function crearGrabacionAction(input: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const g = validarNuevaGrabacion(input);
  return g ? G.crearGrabacion(ctx, g) : INVALIDO;
}

export async function pedirParteAction(input: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const p = validarPedidoParte(input);
  return p ? G.pedirParte(ctx, p) : INVALIDO;
}

export async function confirmarParteAction(input: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const p = validarPedidoParte({ ...(input as object), bytes: 1 });
  return p ? G.confirmarParte(ctx, { grabacionId: p.grabacionId, tramo: p.tramo, indice: p.indice }) : INVALIDO;
}

export async function latidoAction(grabacionId: string, latido: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const l = validarLatido(latido);
  return l ? G.registrarLatido(ctx, grabacionId, l) : INVALIDO;
}

export async function cerrarGrabacionAction(grabacionId: string, cierre: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const c = validarCierre(cierre);
  if (!c) return INVALIDO;
  const r = await G.cerrarGrabacion(ctx, grabacionId, c);
  revalidatePath("/digitalizacion");
  return r;
}

export async function continuarGrabacionAction(grabacionId: string) {
  const ctx = await contextoDigitalizacion("MANAGE");
  return ctx ? G.continuarGrabacion(ctx, grabacionId) : SIN_PERMISO;
}

export async function terminarConLoGrabadoAction(grabacionId: string) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const r = await G.terminarConLoGrabado(ctx, grabacionId);
  revalidatePath("/digitalizacion");
  return r;
}

export async function descartarGrabacionAction(grabacionId: string) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const r = await G.descartarGrabacion(ctx, grabacionId);
  revalidatePath("/digitalizacion");
  return r;
}

export async function editarTituloAction(grabacionId: string, titulo: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const r = await G.editarTitulo(ctx, grabacionId, titulo);
  revalidatePath("/digitalizacion");
  return r;
}

export async function urlsDeLecturaAction(grabacionId: string) {
  const ctx = await contextoDigitalizacion("VIEW");
  return ctx ? G.urlsDeLectura(ctx, grabacionId) : SIN_PERMISO;
}

export async function buscarTrabajosAction(q: string) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  return G.buscarTrabajos(ctx, typeof q === "string" ? q : "");
}

export async function guardarEquipoAction(input: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  return ctx ? G.guardarEquipo(ctx, input) : SIN_PERMISO;
}

export async function guardarAjustesAction(minutos: number) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const r = await G.guardarAjustes(ctx, minutos);
  revalidatePath("/digitalizacion");
  return r;
}

export async function urlDeVideoAction(grabacionId: string, modo: "ver" | "descargar") {
  const ctx = await contextoDigitalizacion("VIEW");
  if (!ctx) return SIN_PERMISO;
  if (modo !== "ver" && modo !== "descargar") return INVALIDO;
  return G.urlDeVideo(ctx, grabacionId, modo);
}

export async function reintentarConversionAction(grabacionId: string) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const r = await G.reintentarConversion(ctx, grabacionId);
  revalidatePath("/digitalizacion");
  return r;
}

// --- Entrega de los videos (spec 2026-10-22) ---------------------------------------------------

export async function guardarAjustesEntregaAction(envioAutomatico: unknown, franjas: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const r = await G.guardarAjustesEntrega(ctx, envioAutomatico, franjas);
  revalidatePath("/digitalizacion");
  return r;
}

/** "Enviar al cliente" / "Reenviar" (CORREO) o "Copiar enlace" (ENLACE: token nuevo, sin correo). */
export async function enviarEntregaAction(entregaIdOPedido: { entregaId?: unknown; pedidoId?: unknown }, modo: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  if (modo !== "CORREO" && modo !== "ENLACE") return INVALIDO;
  let entregaId = typeof entregaIdOPedido?.entregaId === "string" ? entregaIdOPedido.entregaId : null;
  if (!entregaId && typeof entregaIdOPedido?.pedidoId === "string") {
    // Un pedido listo que todavía no tiene la fila de entrega (el cron no pasó): se crea acá.
    const r = await E.asegurarEntrega(ctx.workspaceId, entregaIdOPedido.pedidoId);
    if (!r) return { ok: false as const, error: E.MENSAJES_ENTREGA.noExiste };
    entregaId = r.entrega.id;
  }
  if (!entregaId) return INVALIDO;
  const r = await E.enviarEntrega(ctx.workspaceId, entregaId, modo);
  revalidatePath("/digitalizacion");
  return r;
}

export async function cambiarEnvioAutomaticoAction(pedidoId: unknown, valor: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  if (typeof pedidoId !== "string" || typeof valor !== "boolean") return INVALIDO;
  const r = await E.cambiarEnvioAutomatico(ctx.workspaceId, pedidoId, valor);
  revalidatePath("/digitalizacion");
  return r;
}

// --- Cargos extra y envío de cassettes (spec 2026-10-22, E6 y E9) ------------------------------

/** "Marcar entregado": el envío de los cassettes llegó al cliente. */
export async function marcarEnvioEntregadoAction(entregaId: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const r = await K.marcarEnvioEntregado(ctx.workspaceId, entregaId);
  revalidatePath("/digitalizacion");
  return r;
}

/** "Anular" un cargo extra sin pagar: sale del pedido (renglón, total y cuota). */
export async function anularCargoAction(cargoId: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const r = await K.anularCargo(ctx.workspaceId, cargoId);
  revalidatePath("/digitalizacion");
  return r;
}

/** "Quitar del pedido a mano" un cargo "a revisar": saca su renglón y su monto del total. */
export async function quitarCargoAManoAction(cargoId: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const r = await K.quitarCargoAMano(ctx.workspaceId, cargoId, ctx.userId ?? null);
  revalidatePath("/digitalizacion");
  return r;
}
