import { puedeEnContexto } from "@/lib/access/policy";
import type { CtxConsultas } from "@/lib/consultas/catalogo";
import { BANDEJA_MODULE_KEY } from "./constantes";

/**
 * Permisos de la Bandeja de WhatsApp (§7 del diseño) sobre el adaptador de main. Sin base ni sesión:
 * la guarda que arma el contexto está en `./contexto.ts`.
 *
 * - Módulo `whatsapp-inbox`: "Ver" para leer y marcar como leído; "Gestionar" para responder, tomar,
 *   devolver al bot, resolver y vincular.
 * - Configuración de la conexión: `configurar` (dueño y administradores).
 */
export type CtxBandeja = CtxConsultas;

export function puedeVerBandeja(ctx: CtxBandeja): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "ver", BANDEJA_MODULE_KEY);
}

export function puedeOperarBandeja(ctx: CtxBandeja): boolean {
  return ctx.userId !== null && puedeEnContexto(ctx, "operar", BANDEJA_MODULE_KEY);
}

export const MENSAJES_BANDEJA = {
  sinPermiso: "No tenés permiso para hacer esto.",
  noExiste: "No encontramos ese chat.",
  textoVacio: "Escribí el mensaje antes de enviarlo.",
  textoLargo: "El mensaje puede tener hasta 4096 caracteres.",
  fueraDeVentana:
    "Pasaron más de 24 horas desde el último mensaje del cliente: WhatsApp sólo permite responder con una plantilla aprobada.",
  cliente: "No encontramos ese cliente.",
  yaVinculado: "Este chat ya tiene un cliente vinculado.",
  sinPermisoClientes: "Para crear un cliente necesitás permiso de gestión en Clientes.",
  falloEnvio: "No se pudo enviar el mensaje por WhatsApp. Quedó registrado como fallido.",
  fallo: "No se pudo completar la acción. Probá de nuevo.",
} as const;
