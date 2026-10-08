"use server";

import { revalidatePath } from "next/cache";
import { MENSAJES_PEDIDO } from "@/lib/pedidos/acceso";
import { confirmarPedido, vistaPreviaConfirmacion, type ResultadoConfirmacion, type VistaPreviaConfirmacion } from "@/lib/pedidos/confirmar";
import { contextoDePedidos } from "@/lib/pedidos/contexto";
import { cambiarEstadoPedido, cambiarRubro, crearPedidoManual, type Resultado, type ResultadoAlta } from "@/lib/pedidos/pedidos";
import { editarPlan } from "@/lib/pedidos/plan";

// Archivo "use server": sólo exporta funciones async. Cada acción, en este orden: revisa la forma
// de lo que llega, arma el contexto (sesión + workspace de la sesión + módulo `orders` encendido
// + "Gestionar" en Pedidos) y recién ahí escribe. Cada id se valida contra el workspace en
// `lib/pedidos`. Ninguna devuelve costos.

const SIN_ACCESO = { ok: false as const, error: MENSAJES_PEDIDO.sinPermiso };
const INVALIDO = { ok: false as const, error: MENSAJES_PEDIDO.datosInvalidos };

function esObjeto(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function esId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

function revalidar(pedidoId?: string, presupuestoId?: string): void {
  revalidatePath("/pedidos");
  if (pedidoId) revalidatePath(`/pedidos/${pedidoId}`);
  if (presupuestoId) {
    revalidatePath("/presupuestos");
    revalidatePath(`/presupuestos/${presupuestoId}`);
  }
}

/** Vista previa de "Confirmar pedido" (opción elegida, total y plan propuesto). No escribe. */
export async function vistaPreviaConfirmacionAction(presupuestoId: string): Promise<VistaPreviaConfirmacion> {
  if (!esId(presupuestoId)) return INVALIDO;
  const ctx = await contextoDePedidos("operar");
  if (!ctx) return SIN_ACCESO;
  return vistaPreviaConfirmacion(ctx, presupuestoId);
}

/** "Confirmar pedido" desde un presupuesto aceptado, con el plan propuesto o el ajustado. */
export async function confirmarPedidoAction(datos: { presupuestoId: string; plan?: unknown[] | null }): Promise<ResultadoConfirmacion> {
  if (!esObjeto(datos) || !esId(datos.presupuestoId)) return INVALIDO;
  if (datos.plan != null && !Array.isArray(datos.plan)) return INVALIDO;
  const ctx = await contextoDePedidos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await confirmarPedido(ctx, datos.presupuestoId, datos.plan ?? undefined);
  if (r.ok) revalidar(r.pedidoId, datos.presupuestoId);
  return r;
}

/** "Nuevo pedido" desde un contacto, sin presupuesto. */
export async function crearPedidoManualAction(datos: {
  clientId: string;
  items: unknown[];
  descuento?: unknown;
  opcion: unknown;
  fechaEvento?: string | null;
  eventLabel?: string | null;
  plan?: unknown[] | null;
}): Promise<ResultadoAlta> {
  if (!esObjeto(datos) || !esId(datos.clientId) || !Array.isArray(datos.items) || !esObjeto(datos.opcion)) return INVALIDO;
  if (datos.fechaEvento != null && typeof datos.fechaEvento !== "string") return INVALIDO;
  if (datos.eventLabel != null && typeof datos.eventLabel !== "string") return INVALIDO;
  if (datos.plan != null && !Array.isArray(datos.plan)) return INVALIDO;
  const ctx = await contextoDePedidos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await crearPedidoManual(ctx, {
    clientId: datos.clientId,
    items: datos.items,
    descuento: datos.descuento,
    opcion: datos.opcion,
    fechaEvento: datos.fechaEvento ?? null,
    eventLabel: datos.eventLabel ?? null,
    plan: datos.plan ?? undefined,
  });
  if (r.ok) {
    revalidar(r.pedidoId);
    revalidatePath(`/clientes/${datos.clientId}`);
  }
  return r;
}

/** "Cambiar estado". Cancelar exige motivo. */
export async function cambiarEstadoPedidoAction(datos: { pedidoId: string; estado: string; motivo?: string | null }): Promise<Resultado> {
  if (!esObjeto(datos) || !esId(datos.pedidoId) || typeof datos.estado !== "string") return INVALIDO;
  if (datos.motivo != null && typeof datos.motivo !== "string") return INVALIDO;
  const ctx = await contextoDePedidos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await cambiarEstadoPedido(ctx, datos.pedidoId, datos.estado, datos.motivo ?? undefined);
  if (r.ok) revalidar(datos.pedidoId);
  return r;
}

/** "Editar plan": las cuotas en orden, con `id` las que ya existen. */
export async function editarPlanAction(datos: { pedidoId: string; cuotas: unknown[] }): Promise<Resultado> {
  if (!esObjeto(datos) || !esId(datos.pedidoId) || !Array.isArray(datos.cuotas)) return INVALIDO;
  const ctx = await contextoDePedidos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await editarPlan(ctx, datos.pedidoId, datos.cuotas);
  if (r.ok) revalidar(datos.pedidoId);
  return r;
}

/** Cambia el rubro de ingreso del pedido (un rubro INGRESO de Caja). */
export async function cambiarRubroPedidoAction(datos: { pedidoId: string; categoryId: string }): Promise<Resultado> {
  if (!esObjeto(datos) || !esId(datos.pedidoId) || !esId(datos.categoryId)) return INVALIDO;
  const ctx = await contextoDePedidos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await cambiarRubro(ctx, datos.pedidoId, datos.categoryId);
  if (r.ok) revalidar(datos.pedidoId);
  return r;
}
