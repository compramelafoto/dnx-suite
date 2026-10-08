"use server";

import { revalidatePath } from "next/cache";
import { MENSAJES_PRESUPUESTO } from "@/lib/presupuestos/acceso";
import { guardarAjustes, type ResultadoAjustes } from "@/lib/presupuestos/ajustes";
import { contextoDePresupuestos } from "@/lib/presupuestos/contexto";
import {
  crearPresupuesto,
  guardarBorrador,
  marcarVencidos,
  rechazarPresupuesto,
  type Resultado,
  type ResultadoCreacion,
} from "@/lib/presupuestos/presupuestos";
import { crearNuevaVersion, type ResultadoVersionNueva } from "@/lib/presupuestos/versiones";
import { enviarPresupuesto, type ResultadoEnvioPresupuesto } from "@/lib/presupuestos/envio";

// Archivo "use server": sólo exporta funciones async. Cada acción, en este orden: revisa la forma
// de lo que llega, arma el contexto (sesión + workspace de la sesión + módulo `quotes` encendido
// + el nivel en Presupuestos) y recién ahí lee o escribe. Cada id se valida contra el workspace
// en `lib/presupuestos`. Ninguna devuelve costos: las lecturas con costos son de las páginas.

const SIN_ACCESO = { ok: false as const, error: MENSAJES_PRESUPUESTO.sinPermiso };
const INVALIDO = { ok: false as const, error: MENSAJES_PRESUPUESTO.datosInvalidos };

function esObjeto(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function esId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 64;
}

function revalidar(presupuestoId?: string, leadId?: string): void {
  revalidatePath("/presupuestos");
  if (presupuestoId) revalidatePath(`/presupuestos/${presupuestoId}`);
  if (leadId) revalidatePath(`/consultas/${leadId}`);
}

/** "Nuevo presupuesto": de una consulta, o creando la consulta con su contacto. */
export async function crearPresupuestoAction(datos: {
  consultaLeadId?: string | null;
  nuevaConsulta?: { contacto: unknown; categoriaId: string } | null;
  ownerUserId?: number | null;
}): Promise<ResultadoCreacion> {
  if (!esObjeto(datos)) return INVALIDO;
  if (datos.consultaLeadId != null && !esId(datos.consultaLeadId)) return INVALIDO;
  if (datos.nuevaConsulta != null && (!esObjeto(datos.nuevaConsulta) || !esObjeto(datos.nuevaConsulta.contacto))) return INVALIDO;
  if (datos.ownerUserId != null && typeof datos.ownerUserId !== "number") return INVALIDO;
  const ctx = await contextoDePresupuestos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await crearPresupuesto(ctx, {
    consultaLeadId: datos.consultaLeadId ?? null,
    nuevaConsulta: datos.nuevaConsulta
      ? { contacto: datos.nuevaConsulta.contacto as never, categoriaId: String(datos.nuevaConsulta.categoriaId ?? "") }
      : null,
    ownerUserId: datos.ownerUserId ?? null,
  });
  if (r.ok) revalidar(r.presupuestoId, r.leadId);
  return r;
}

/** Guarda el borrador (ítems, descuento global, condiciones, propuesta y opciones de pago). */
export async function guardarBorradorAction(datos: {
  presupuestoId: string;
  items: unknown[];
  descuento?: unknown;
  condiciones?: string | null;
  propuestaPago?: string | null;
  opcionesPago?: unknown;
}): Promise<Resultado> {
  if (!esObjeto(datos) || !esId(datos.presupuestoId) || !Array.isArray(datos.items)) return INVALIDO;
  const ctx = await contextoDePresupuestos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await guardarBorrador(ctx, datos.presupuestoId, {
    items: datos.items,
    descuento: datos.descuento,
    condiciones: datos.condiciones,
    propuestaPago: datos.propuestaPago,
    opcionesPago: datos.opcionesPago,
  });
  if (r.ok) revalidar(datos.presupuestoId);
  return r;
}

/** "Editar" un presupuesto enviado: crea (o devuelve) el borrador de la versión siguiente. */
export async function crearNuevaVersionAction(presupuestoId: string): Promise<ResultadoVersionNueva> {
  if (!esId(presupuestoId)) return INVALIDO;
  const ctx = await contextoDePresupuestos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await crearNuevaVersion(ctx, presupuestoId);
  if (r.ok) revalidar(presupuestoId);
  return r;
}

export async function rechazarPresupuestoAction(presupuestoId: string): Promise<Resultado> {
  if (!esId(presupuestoId)) return INVALIDO;
  const ctx = await contextoDePresupuestos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await rechazarPresupuesto(ctx, presupuestoId);
  if (r.ok) revalidar(presupuestoId);
  return r;
}

/** Lote "marcar vencidos" (todos, o los tildados). */
export async function marcarVencidosAction(ids?: string[] | null): Promise<{ ok: true; marcados: number } | { ok: false; error: string }> {
  if (ids != null && (!Array.isArray(ids) || ids.length > 500 || !ids.every(esId))) return INVALIDO;
  const ctx = await contextoDePresupuestos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await marcarVencidos(ctx, ids ?? undefined);
  if (r.ok) revalidar();
  return r;
}

/** Configuración → Presupuestos. Exige `configurar` (lo revisa `guardarAjustes`). */
export async function guardarAjustesPresupuestosAction(datos: {
  validezDias: number;
  condiciones: string | null;
  propuestaPago: string | null;
  seguimientoDias: number;
  seguimientoActivo: boolean;
}): Promise<ResultadoAjustes> {
  if (!esObjeto(datos)) return INVALIDO;
  const ctx = await contextoDePresupuestos("ver");
  if (!ctx) return SIN_ACCESO;
  const r = await guardarAjustes(ctx, datos);
  if (r.ok) revalidatePath("/workspace/configuracion/presupuestos");
  return r;
}

/**
 * "Enviar" (o "Reenviar") por correo o WhatsApp. El texto llega con variables y lo completa el
 * servidor; el workspace, el responsable y el enlace salen del servidor, nunca de acá.
 */
export async function enviarPresupuestoAction(datos: {
  presupuestoId: string;
  canal: string;
  templateId?: string | null;
  asunto?: string | null;
  cuerpo?: string | null;
  reenviar?: boolean;
}): Promise<ResultadoEnvioPresupuesto> {
  if (!esObjeto(datos) || !esId(datos.presupuestoId) || typeof datos.canal !== "string") return INVALIDO;
  if (datos.templateId != null && !esId(datos.templateId)) return INVALIDO;
  if (datos.asunto != null && typeof datos.asunto !== "string") return INVALIDO;
  if (datos.cuerpo != null && typeof datos.cuerpo !== "string") return INVALIDO;
  if (datos.reenviar != null && typeof datos.reenviar !== "boolean") return INVALIDO;
  const ctx = await contextoDePresupuestos("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await enviarPresupuesto(ctx, datos.presupuestoId, {
    canal: datos.canal,
    templateId: datos.templateId ?? null,
    asunto: datos.asunto ?? null,
    cuerpo: datos.cuerpo ?? null,
    reenviar: datos.reenviar === true,
  });
  if (r.ok || r.enviado) revalidar(datos.presupuestoId);
  return r;
}
