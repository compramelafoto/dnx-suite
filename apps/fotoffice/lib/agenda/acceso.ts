import { puedeEnContexto } from "@/lib/access/policy";
import type { CtxConsultas } from "@/lib/consultas/catalogo";

/**
 * Permisos de la Agenda (Etapa 4, Entrega B) sobre el adaptador de main (`lib/access/policy.ts`),
 * igual que `lib/proyectos/acceso.ts`. Sin base ni sesión.
 *
 * - Módulo `agenda`: "Ver" para leer; "Gestionar" para crear, editar, mover y anular citas.
 * - Los tipos de cita y los ajustes se configuran con `configurar` (dueño o administrador).
 * - Las reglas "Cita que genera" de cada producto se editan con `sales.catalog`; eso lo exige la
 *   acción, no este archivo.
 */
export const AGENDA_MODULE_KEY = "agenda";

/** Mismo contexto que Consultas, Presupuestos, Pedidos y Proyectos. */
export type CtxAgenda = CtxConsultas;

export function puedeVerAgenda(ctx: CtxAgenda): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "ver", AGENDA_MODULE_KEY);
}

export function puedeGestionarAgenda(ctx: CtxAgenda): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "operar", AGENDA_MODULE_KEY);
}

export function puedeConfigurarAgenda(ctx: CtxAgenda): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "configurar");
}

export const MENSAJES_AGENDA = {
  sinPermiso: "No tenés permiso para hacer esto.",
  datosInvalidos: "Los datos no son válidos.",
  titulo: "Escribí el título de la cita (hasta 200 caracteres).",
  fechas: "Elegí un inicio y un fin válidos.",
  finAnterior: "El fin tiene que ser posterior al inicio.",
  estado: "El estado de la cita no es válido.",
  tipo: "Ese tipo de cita no existe o está dado de baja.",
  responsable: "El responsable tiene que ser parte del equipo.",
  contacto: "No encontramos ese contacto.",
  proyecto: "No encontramos ese proyecto.",
  pedido: "No encontramos ese pedido.",
  consulta: "No encontramos esa consulta.",
  lugar: "El lugar puede tener hasta 300 caracteres.",
  notas: "Las notas pueden tener hasta 5000 caracteres.",
  noExiste: "No encontramos esa cita.",
  guardar: "No se pudo guardar el cambio.",
  participante: "Elegí un integrante del equipo o un contacto (uno solo).",
  integrante: "Esa persona no es del equipo.",
  rol: "Ese rol no existe o está dado de baja.",
  nota: "La nota puede tener hasta 500 caracteres.",
  participanteRepetido: "Esa persona ya participa con ese rol.",
  participanteNoExiste: "No encontramos a ese participante.",
  tipoNombre: "Escribí el nombre del tipo (hasta 80 caracteres).",
  tipoRepetido: "Ya hay un tipo con ese nombre.",
  tipoColor: "El color tiene que ser un código como #2563eb.",
  tipoNoExiste: "No encontramos ese tipo de cita.",
  citaCerrada: "No se puede mover una cita anulada o realizada. Reactivala primero.",
  moduloApagado: "El módulo Agenda está apagado.",
} as const;
