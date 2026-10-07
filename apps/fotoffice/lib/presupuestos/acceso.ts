import { puedeEnContexto } from "@/lib/access/policy";
import type { CtxConsultas } from "@/lib/consultas/catalogo";

/**
 * Permisos de Presupuestos sobre el adaptador de main (`lib/access/policy.ts`). Sin base ni
 * sesión: la guarda que arma el contexto está en `./contexto.ts`.
 *
 * - Módulo `quotes`: "Ver" para leer; "Gestionar" para armar, editar, rechazar y enviar.
 * - Costo y margen (la instantánea del cálculo, `costSnapshot`): SÓLO con `configurar` (dueño y
 *   administradores), R4. `verDinero` no alcanza: un rol de Tesorería con Caja o Cuotas no ve los
 *   costos de los presupuestos. Quien no los tiene recibe los ítems sin el cálculo y la versión
 *   sin costos: el servidor los saca antes de devolver nada.
 * - El costo del catálogo sigue con `sales.catalog`, como en main (R3).
 *
 * `quotes` NO se suma a `MODULOS_DE_PLATA` (daría `verDinero` a todo el que vea Presupuestos).
 */
export const QUOTES_MODULE_KEY = "quotes";

/** Mismo contexto que Consultas: el alta de la consulta que falta usa el mismo. */
export type CtxPresupuestos = CtxConsultas;

export function puedeVerPresupuestos(ctx: CtxPresupuestos): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "ver", QUOTES_MODULE_KEY);
}

export function puedeGestionarPresupuestos(ctx: CtxPresupuestos): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "operar", QUOTES_MODULE_KEY);
}

/** Costo y margen: sólo `configurar` (dueño y administradores), R4. */
export function veCostos(ctx: CtxPresupuestos): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "configurar");
}

/** Ajustes de presupuestos (Configuración → Presupuestos). */
export function puedeConfigurarPresupuestos(ctx: CtxPresupuestos): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "configurar");
}

export const MENSAJES_PRESUPUESTO = {
  sinPermiso: "No tenés permiso para hacer esto.",
  sinPermisoAjustes: "Sólo un administrador puede configurar los presupuestos.",
  datosInvalidos: "Los datos no son válidos.",
  noExiste: "No encontramos ese presupuesto.",
  consulta: "No encontramos esa consulta.",
  consultaSinContacto: "Esa consulta todavía no tiene contacto: abrila y completala antes de presupuestar.",
  elegirConsulta: "Elegí una consulta o cargá el contacto para crear una.",
  sinContactos: "No tenés permiso para ver los contactos.",
  responsable: "El responsable tiene que ser alguien del equipo con permiso para gestionar Presupuestos.",
  producto: "Uno de los ítems no es un producto de tu catálogo.",
  calculoFaltante: "Volvé a calcular el ítem con ¿Cuánto Cobro?: no tenemos sus datos.",
  calculoInvalido: "Los datos del cálculo de ¿Cuánto Cobro? no son válidos.",
  texto: "Las condiciones y la propuesta de pago pueden tener hasta 4000 caracteres.",
  yaEnviado: "Esta versión ya se envió: creá una versión nueva para cambiarla.",
  aceptado: "El presupuesto ya fue aceptado: no se puede cambiar.",
  sinBorrador: "No hay un borrador para editar.",
  transicion: "El presupuesto no puede pasar a ese estado.",
  cambio: "El presupuesto cambió mientras tanto. Volvé a abrirlo.",
  fallo: "No se pudo guardar el presupuesto.",
  falloConConsulta: "La consulta se creó, pero el presupuesto no. Abrila y creá el presupuesto desde ahí.",
} as const;
