import { puedeEnContexto } from "@/lib/access/policy";
import type { CtxConsultas } from "@/lib/consultas/catalogo";

/**
 * Permisos de Contratos (Etapa 5) sobre el adaptador de main (`lib/access/policy.ts`), igual que
 * `lib/agenda/acceso.ts`. Sin base ni sesión.
 *
 * - Módulo `contracts`: "Ver" para leer; "Gestionar" para generar, editar, enviar, anular y marcar
 *   un contrato como firmado en papel, y para elegir los contratantes de un pedido.
 * - Las plantillas y los ajustes (empresa, cláusula de consentimiento, recordatorios, firma de la
 *   empresa) se configuran con `configurar` (dueño o administrador).
 */
export const CONTRACTS_MODULE_KEY = "contracts";

/** Mismo contexto que Consultas, Presupuestos, Pedidos, Proyectos y Agenda. */
export type CtxContratos = CtxConsultas;

export function puedeVerContratos(ctx: CtxContratos): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "ver", CONTRACTS_MODULE_KEY);
}

export function puedeGestionarContratos(ctx: CtxContratos): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "operar", CONTRACTS_MODULE_KEY);
}

export function puedeConfigurarContratos(ctx: CtxContratos): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "configurar");
}

export const MENSAJES_CONTRATO = {
  sinPermiso: "No tenés permiso para hacer esto.",
  datosInvalidos: "Los datos no son válidos.",
  moduloApagado: "El módulo Contratos está apagado.",
  guardar: "No se pudo guardar el cambio.",
  // Plantillas
  plantillaNombre: "Escribí el nombre de la plantilla (hasta 120 caracteres).",
  plantillaCuerpo: "Escribí el texto del contrato (hasta 100.000 caracteres).",
  plantillaRepetida: "Ya hay una plantilla con ese nombre.",
  plantillaNoExiste: "No encontramos esa plantilla.",
  plantillaTope: "Llegaste al máximo de 50 plantillas. Borrá alguna que no uses.",
  plantillaOrden: "El orden tiene que ser un número entero de 0 a 9999.",
  plantillaVariables: "El texto tiene variables que no existen o bloques mal cerrados:",
  // Ajustes
  empresaNombre: "El nombre de la empresa puede tener hasta 120 caracteres.",
  empresaCuit: "El CUIT puede tener hasta 30 caracteres.",
  empresaDomicilio: "El domicilio puede tener hasta 200 caracteres.",
  clausula: "La cláusula de consentimiento puede tener hasta 3000 caracteres.",
  recordatorioDias: "Los días del recordatorio tienen que ser un número entero de 1 a 30.",
  firmaTipo: "La firma de la empresa tiene que ser una imagen PNG o JPG.",
  firmaTamano: "La imagen de la firma pesa más de 1 MB.",
  firmaVacia: "El archivo está vacío.",
  firmaSinAlmacen: "No se pudo guardar la imagen en este momento. Probá de nuevo en un rato.",
  // Contratantes
  pedido: "No encontramos ese pedido.",
  contacto: "No encontramos ese contacto.",
  orden: "El contratante tiene que ser el 1 o el 2.",
  contratanteRepetido: "El contratante 2 tiene que ser una persona distinta del contratante 1.",
  contratante1Obligatorio: "El contratante 1 no se puede quitar: volvé a poner el contacto del pedido.",
  sinContratante2: "El pedido no tiene contratante 2.",
  buscarClientes: "Para buscar contactos necesitás permiso para ver Clientes.",
} as const;
