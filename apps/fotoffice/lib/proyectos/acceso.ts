import { puedeEnContexto } from "@/lib/access/policy";
import type { CtxConsultas } from "@/lib/consultas/catalogo";

/**
 * Permisos de Proyectos (Etapa 4, Entrega A) sobre el adaptador de main (`lib/access/policy.ts`),
 * igual que `lib/pedidos/acceso.ts`. Sin base ni sesión.
 *
 * - Módulo `projects`: "Ver" para leer; "Gestionar" para crear, editar y mover proyectos.
 * - Las reglas "Proyecto que genera" de cada producto se editan con `sales.catalog` (como los
 *   costos-plantilla); eso lo exige la acción, no este archivo.
 */
export const PROJECTS_MODULE_KEY = "projects";

/** Mismo contexto que Consultas, Presupuestos y Pedidos. */
export type CtxProyectos = CtxConsultas;

export function puedeVerProyectos(ctx: CtxProyectos): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "ver", PROJECTS_MODULE_KEY);
}

export function puedeGestionarProyectos(ctx: CtxProyectos): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "operar", PROJECTS_MODULE_KEY);
}

export const MENSAJES_PROYECTO = {
  sinPermiso: "No tenés permiso para hacer esto.",
  datosInvalidos: "Los datos no son válidos.",
  pedido: "No encontramos ese pedido.",
  pedidoCancelado: "El pedido está cancelado: no se le agregan proyectos.",
  flujo: "Elegí un flujo de trabajo activo.",
  flujoSinEtapas: "Ese flujo no tiene etapas: agregale al menos una en Configuración → Circuitos.",
  nombre: "Escribí el nombre del proyecto (hasta 200 caracteres).",
  responsable: "El responsable tiene que ser parte del equipo.",
  moduloApagado: "El módulo Proyectos está apagado.",
  fallo: "No se pudo crear el proyecto.",
} as const;
