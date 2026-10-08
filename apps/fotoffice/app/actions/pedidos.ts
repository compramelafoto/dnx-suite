"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { MENSAJES_PEDIDO } from "@/lib/pedidos/acceso";
import { anularCobro, registrarCobro, type ResultadoAnulacion, type ResultadoCobro } from "@/lib/pedidos/cobros";
import { enlaceDelPedido, enlaceDelRecibo, type ResultadoEnlace } from "@/lib/pedidos/enlace";
import { enviarMensajePedido, type ResultadoMensajePedido } from "@/lib/pedidos/envio";
import { enviarReciboAutomatico } from "@/lib/pedidos/recibos";
import { agregarTarea, aplicarPlantilla, marcarTarea, quitarTarea } from "@/lib/pedidos/checklist";
import { confirmarPedido, vistaPreviaConfirmacion, type ResultadoConfirmacion, type VistaPreviaConfirmacion } from "@/lib/pedidos/confirmar";
import { contextoDePedidos } from "@/lib/pedidos/contexto";
import {
  anularPagoCuenta,
  borrarCuenta,
  generarCostosDelPedido,
  guardarCuenta,
  pagarCuenta,
  type ResultadoAnularPago,
  type ResultadoCuenta,
  type ResultadoGenerar,
  type ResultadoPago,
} from "@/lib/pedidos/cuentas-pagar";
import { cambiarEstadoPedido, cambiarRubro, crearPedidoManual, type Resultado, type ResultadoAlta } from "@/lib/pedidos/pedidos";
import { editarPlan } from "@/lib/pedidos/plan";

// Archivo "use server": sólo exporta funciones async. Cada acción, en este orden: revisa la forma
// de lo que llega, arma el contexto (sesión + workspace de la sesión + módulo `orders` encendido
// + "Gestionar" en Pedidos) y recién ahí escribe. Cada id se valida contra el workspace en
// `lib/pedidos`. Ninguna devuelve costos. Las de cuentas a pagar exigen además ver costos
// (`veCostosDePedido`), y lo revisa `lib/pedidos/cuentas-pagar`.

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
export async function confirmarPedidoAction(datos: {
  presupuestoId: string;
  plan?: unknown[] | null;
  /** Plantilla de checklist (por nombre); no se manda = la primera; `null` = sin checklist. */
  checklist?: string | null;
}): Promise<ResultadoConfirmacion> {
  if (!esObjeto(datos) || !esId(datos.presupuestoId)) return INVALIDO;
  if (datos.plan != null && !Array.isArray(datos.plan)) return INVALIDO;
  if (datos.checklist != null && typeof datos.checklist !== "string") return INVALIDO;
  const ctx = await contextoDePedidos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await confirmarPedido(ctx, datos.presupuestoId, datos.plan ?? undefined, {}, datos.checklist);
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
  checklist?: string | null;
}): Promise<ResultadoAlta> {
  if (!esObjeto(datos) || !esId(datos.clientId) || !Array.isArray(datos.items) || !esObjeto(datos.opcion)) return INVALIDO;
  if (datos.fechaEvento != null && typeof datos.fechaEvento !== "string") return INVALIDO;
  if (datos.eventLabel != null && typeof datos.eventLabel !== "string") return INVALIDO;
  if (datos.plan != null && !Array.isArray(datos.plan)) return INVALIDO;
  if (datos.checklist != null && typeof datos.checklist !== "string") return INVALIDO;
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
    // `undefined` = la primera plantilla; `null` = sin checklist.
    checklist: datos.checklist,
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

/**
 * "Registrar cobro". Si el cobro se creó (no es un doble clic), el recibo sale por correo después
 * de responder (`after`), con la plantilla automática "Recibo de pago": nunca frena el cobro.
 */
export async function registrarCobroAction(datos: {
  pedidoId: string;
  importe: number;
  fecha: string;
  medio: string;
  imputaciones?: { cuotaId: string; amountArs: number }[] | null;
  adjuntoId?: string | null;
  idempotencyKey: string;
}): Promise<ResultadoCobro> {
  if (!esObjeto(datos) || !esId(datos.pedidoId) || typeof datos.importe !== "number" || typeof datos.fecha !== "string") return INVALIDO;
  if (typeof datos.medio !== "string" || typeof datos.idempotencyKey !== "string") return INVALIDO;
  if (datos.imputaciones != null && !Array.isArray(datos.imputaciones)) return INVALIDO;
  if (datos.adjuntoId != null && typeof datos.adjuntoId !== "string") return INVALIDO;
  const ctx = await contextoDePedidos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await registrarCobro(ctx, {
    pedidoId: datos.pedidoId,
    importe: datos.importe,
    fecha: datos.fecha,
    medio: datos.medio,
    imputaciones: datos.imputaciones ?? undefined,
    adjuntoId: datos.adjuntoId ?? undefined,
    idempotencyKey: datos.idempotencyKey,
  });
  if (r.ok) {
    revalidar(r.pedidoId);
    if (r.creado) {
      const { workspaceId } = ctx;
      const cobroId = r.cobroId;
      after(() => enviarReciboAutomatico(workspaceId, cobroId).then(() => undefined));
    }
  }
  return r;
}

/** "Anular cobro": exige motivo. Una segunda anulación no hace nada. */
export async function anularCobroAction(datos: { cobroId: string; motivo: string }): Promise<ResultadoAnulacion> {
  if (!esObjeto(datos) || !esId(datos.cobroId) || typeof datos.motivo !== "string") return INVALIDO;
  const ctx = await contextoDePedidos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await anularCobro(ctx, datos.cobroId, datos.motivo);
  if (r.ok && !r.yaAnulado) revalidar(r.pedidoId);
  return r;
}

/** "Copiar enlace del cliente": el enlace del pedido (lo crea la primera vez; `rotar` lo renueva). */
export async function enlaceDelPedidoAction(datos: { pedidoId: string; rotar?: boolean }): Promise<ResultadoEnlace> {
  if (!esObjeto(datos) || !esId(datos.pedidoId)) return INVALIDO;
  if (datos.rotar != null && typeof datos.rotar !== "boolean") return INVALIDO;
  const ctx = await contextoDePedidos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await enlaceDelPedido(ctx, datos.pedidoId, { rotar: datos.rotar === true });
  if (r.ok && datos.rotar) revalidar(datos.pedidoId);
  return r;
}

/** El enlace del recibo de un cobro, para copiarlo o mandarlo por WhatsApp. Sólo lee: con "Ver". */
export async function enlaceDelReciboAction(datos: { cobroId: string }): Promise<ResultadoEnlace> {
  if (!esObjeto(datos) || !esId(datos.cobroId)) return INVALIDO;
  const ctx = await contextoDePedidos("ver");
  if (!ctx) return SIN_ACCESO;
  return enlaceDelRecibo(ctx, datos.cobroId);
}

/**
 * "Enviar por correo" / "WhatsApp" desde la ficha del pedido (con `cobroId`, el recibo de ese
 * cobro). El texto llega con variables y lo completa el servidor. Queda en el historial del pedido.
 */
export async function enviarMensajePedidoAction(datos: {
  pedidoId: string;
  canal: string;
  templateId?: string | null;
  asunto?: string | null;
  cuerpo?: string | null;
  cobroId?: string | null;
}): Promise<ResultadoMensajePedido> {
  if (!esObjeto(datos) || !esId(datos.pedidoId) || typeof datos.canal !== "string") return INVALIDO;
  if (datos.templateId != null && !esId(datos.templateId)) return INVALIDO;
  if (datos.asunto != null && typeof datos.asunto !== "string") return INVALIDO;
  if (datos.cuerpo != null && typeof datos.cuerpo !== "string") return INVALIDO;
  if (datos.cobroId != null && !esId(datos.cobroId)) return INVALIDO;
  const ctx = await contextoDePedidos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await enviarMensajePedido(ctx, datos.pedidoId, {
    canal: datos.canal,
    templateId: datos.templateId ?? null,
    asunto: datos.asunto ?? null,
    cuerpo: datos.cuerpo ?? null,
    cobroId: datos.cobroId ?? null,
  });
  if (r.ok || r.registrado) revalidar(datos.pedidoId);
  return r;
}

// --- Cuentas a pagar (Entrega B1) -------------------------------------------------------------

function revalidarCuentas(pedidoId: string | null): void {
  revalidatePath("/pedidos/a-pagar");
  if (pedidoId) revalidatePath(`/pedidos/${pedidoId}`);
}

function textoOpcional(v: unknown): v is string | null | undefined {
  return v === undefined || v === null || typeof v === "string";
}

/** "Generar costos": las cuentas a pagar de un pedido que no tiene ninguna. */
export async function generarCostosAction(datos: { pedidoId: string }): Promise<ResultadoGenerar> {
  if (!esObjeto(datos) || !esId(datos.pedidoId)) return INVALIDO;
  const ctx = await contextoDePedidos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await generarCostosDelPedido(ctx, datos.pedidoId);
  if (r.ok && r.creadas > 0) revalidarCuentas(datos.pedidoId);
  return r;
}

/** Agrega una cuenta a pagar a un pedido (sin `id`) o edita una pendiente (con `id`). */
export async function guardarCuentaPagarAction(datos: {
  id?: string | null;
  pedidoId?: string | null;
  supplierClientId?: string | null;
  concepto: string;
  importe: number;
  vence?: string | null;
  costCategoryId?: string | null;
}): Promise<ResultadoCuenta> {
  if (!esObjeto(datos) || typeof datos.concepto !== "string" || typeof datos.importe !== "number") return INVALIDO;
  if (![datos.id, datos.pedidoId, datos.supplierClientId, datos.vence, datos.costCategoryId].every(textoOpcional)) return INVALIDO;
  const ctx = await contextoDePedidos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await guardarCuenta(ctx, {
    id: datos.id ?? null,
    pedidoId: datos.pedidoId ?? null,
    supplierClientId: datos.supplierClientId ?? null,
    concepto: datos.concepto,
    importe: datos.importe,
    vence: datos.vence ?? null,
    costCategoryId: datos.costCategoryId ?? null,
  });
  if (r.ok) revalidarCuentas(r.pedidoId);
  return r;
}

/** Borra una cuenta a pagar que no está pagada. */
export async function borrarCuentaPagarAction(datos: { cuentaId: string }): Promise<ResultadoCuenta> {
  if (!esObjeto(datos) || !esId(datos.cuentaId)) return INVALIDO;
  const ctx = await contextoDePedidos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await borrarCuenta(ctx, datos.cuentaId);
  if (r.ok) revalidarCuentas(r.pedidoId);
  return r;
}

/** "Pagar": egreso en Caja con el rubro de costo elegido. Un doble clic devuelve el mismo pago. */
export async function pagarCuentaAction(datos: {
  cuentaId: string;
  fecha: string;
  medio: string;
  categoryId: string;
  idempotencyKey: string;
  adjuntoId?: string | null;
}): Promise<ResultadoPago> {
  if (!esObjeto(datos) || !esId(datos.cuentaId) || typeof datos.fecha !== "string" || typeof datos.medio !== "string") return INVALIDO;
  if (typeof datos.categoryId !== "string" || typeof datos.idempotencyKey !== "string") return INVALIDO;
  if (datos.adjuntoId != null && typeof datos.adjuntoId !== "string") return INVALIDO;
  const ctx = await contextoDePedidos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await pagarCuenta(ctx, {
    cuentaId: datos.cuentaId,
    fecha: datos.fecha,
    medio: datos.medio,
    categoryId: datos.categoryId,
    idempotencyKey: datos.idempotencyKey,
    adjuntoId: datos.adjuntoId ?? undefined,
  });
  if (r.ok) revalidarCuentas(r.pedidoId);
  return r;
}

/** "Anular pago": exige motivo. La cuenta vuelve a pendiente; una segunda anulación no hace nada. */
export async function anularPagoCuentaAction(datos: { cuentaId: string; motivo: string }): Promise<ResultadoAnularPago> {
  if (!esObjeto(datos) || !esId(datos.cuentaId) || typeof datos.motivo !== "string") return INVALIDO;
  const ctx = await contextoDePedidos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await anularPagoCuenta(ctx, datos.cuentaId, datos.motivo);
  if (r.ok && !r.yaAnulado) revalidarCuentas(r.pedidoId);
  return r;
}

// --- Checklist del pedido (Entrega B1) -----------------------------------------------------------

/** Tilda o destilda una tarea del checklist (idempotente). */
export async function marcarTareaAction(datos: { pedidoId: string; tareaId: string; hecha: boolean }): Promise<Resultado> {
  if (!esObjeto(datos) || !esId(datos.pedidoId) || !esId(datos.tareaId) || typeof datos.hecha !== "boolean") return INVALIDO;
  const ctx = await contextoDePedidos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await marcarTarea(ctx, datos.pedidoId, datos.tareaId, datos.hecha);
  if (r.ok) revalidar(datos.pedidoId);
  return r;
}

/** Agrega una tarea al final del checklist. */
export async function agregarTareaAction(datos: { pedidoId: string; titulo: string }): Promise<Resultado> {
  if (!esObjeto(datos) || !esId(datos.pedidoId) || typeof datos.titulo !== "string") return INVALIDO;
  const ctx = await contextoDePedidos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await agregarTarea(ctx, datos.pedidoId, datos.titulo);
  if (r.ok) revalidar(datos.pedidoId);
  return r;
}

/** Quita una tarea del checklist. */
export async function quitarTareaAction(datos: { pedidoId: string; tareaId: string }): Promise<Resultado> {
  if (!esObjeto(datos) || !esId(datos.pedidoId) || !esId(datos.tareaId)) return INVALIDO;
  const ctx = await contextoDePedidos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await quitarTarea(ctx, datos.pedidoId, datos.tareaId);
  if (r.ok) revalidar(datos.pedidoId);
  return r;
}

/** "Aplicar plantilla": sólo si el pedido no tiene tareas. */
export async function aplicarPlantillaAction(datos: { pedidoId: string; plantilla: string }): Promise<Resultado> {
  if (!esObjeto(datos) || !esId(datos.pedidoId) || typeof datos.plantilla !== "string") return INVALIDO;
  const ctx = await contextoDePedidos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await aplicarPlantilla(ctx, datos.pedidoId, datos.plantilla);
  if (r.ok) revalidar(datos.pedidoId);
  return r;
}
