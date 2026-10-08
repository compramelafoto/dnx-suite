import { puedeEnContexto } from "@/lib/access/policy";
import type { CtxConsultas } from "@/lib/consultas/catalogo";

/**
 * Permisos de Pedidos sobre el adaptador de main (`lib/access/policy.ts`), igual que
 * `lib/presupuestos/acceso.ts`. Sin base ni sesión: la guarda que arma el contexto está en
 * `./contexto.ts`.
 *
 * - Módulo `orders`: "Ver" para leer; "Gestionar" para confirmar, dar de alta a mano, cobrar,
 *   anular, editar el plan, cambiar el estado y cambiar el rubro.
 * - Margen y costos (la instantánea del cálculo de cada ítem): sólo con `configurar` o
 *   `verDinero` (Global Constraints). Quien no los tiene recibe los ítems sin el cálculo.
 *
 * `orders` NO se suma a `MODULOS_DE_PLATA` (daría `verDinero` a todo el que vea Pedidos).
 */
export const ORDERS_MODULE_KEY = "orders";

/** Mismo contexto que Consultas y Presupuestos. */
export type CtxPedidos = CtxConsultas;

export function puedeVerPedidos(ctx: CtxPedidos): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "ver", ORDERS_MODULE_KEY);
}

export function puedeGestionarPedidos(ctx: CtxPedidos): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "operar", ORDERS_MODULE_KEY);
}

/** Margen y costos: `configurar` (dueño y administradores) o `verDinero` (Caja o Cuotas). */
export function veCostosDePedido(ctx: CtxPedidos): boolean {
  return ctx.userId !== null && (puedeEnContexto(ctx, "configurar") || puedeEnContexto(ctx, "verDinero"));
}

export const MENSAJES_PEDIDO = {
  sinPermiso: "No tenés permiso para hacer esto.",
  datosInvalidos: "Los datos no son válidos.",
  noExiste: "No encontramos ese pedido.",
  presupuesto: "No encontramos ese presupuesto.",
  noAceptado: "Sólo se confirma un presupuesto aceptado.",
  yaTienePedido: "Ya tiene pedido",
  contacto: "No encontramos ese contacto.",
  producto: "Uno de los ítems no es un producto de tu catálogo.",
  sinItems: "Cargá al menos un ítem.",
  calculo: "En un pedido cargado a mano los ítems van con precio de lista.",
  cuotas: "La cantidad de cuotas tiene que ser un número entero entre 1 y 60.",
  opcion: "Elegí contado o una cantidad de cuotas.",
  fecha: "La fecha del evento no es válida.",
  etiqueta: "La descripción del evento puede tener hasta 200 caracteres.",
  medio: "El medio sugerido de una cuota no es válido.",
  transicion: "El pedido no puede pasar a ese estado.",
  motivo: "Para cancelar el pedido escribí el motivo.",
  motivoLargo: "El motivo puede tener hasta 1000 caracteres.",
  cancelado: "El pedido está cancelado: no se puede cambiar.",
  cuotaAjena: "Una de las cuotas no es de este pedido.",
  cuotaConCobros: "Una cuota con cobros no se puede quitar.",
  menosQueImputado: "Una cuota con cobros no puede quedar por debajo de lo cobrado.",
  rubro: "Elegí un rubro de ingreso de Caja.",
  cambio: "El pedido cambió mientras tanto. Volvé a abrirlo.",
  fallo: "No se pudo guardar el pedido.",
} as const;
