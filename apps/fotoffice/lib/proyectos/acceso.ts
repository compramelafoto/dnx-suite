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
  noExiste: "No encontramos ese proyecto.",
  guardar: "No se pudo guardar el cambio.",
  fechaFinal: "La fecha final no es válida.",
  descripcion: "La descripción puede tener hasta 5000 caracteres.",
  delegado: "El delegado tiene que ser parte del equipo.",
  motivo: "Escribí el motivo (hasta 1000 caracteres).",
  yaSuspendido: "El proyecto ya está suspendido.",
  noSuspendido: "El proyecto no está suspendido.",
  tareas: "Elegí tareas pendientes de este proyecto.",
  sinTareas: "No hay tareas pendientes para reasignar.",
  participante: "Elegí un integrante del equipo o un contacto (uno solo).",
  integrante: "Esa persona no es del equipo.",
  contacto: "No encontramos ese contacto.",
  rol: "Ese rol no existe o está dado de baja.",
  rolNombre: "Escribí el nombre del rol (hasta 80 caracteres).",
  rolRepetido: "Ya hay un rol con ese nombre.",
  participanteRepetido: "Esa persona ya participa con ese rol.",
  participanteNoExiste: "No encontramos a ese participante.",
  notaTexto: "Escribí la nota (hasta 5000 caracteres).",
  notaNoExiste: "No encontramos esa nota.",
  notaAjena: "Sólo puede cambiar la nota quien la escribió o un administrador.",
} as const;
