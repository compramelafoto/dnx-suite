"use server";

import { revalidatePath } from "next/cache";
import { puedeEnContexto } from "@/lib/access/policy";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { SERVICE_LEADS_MODULE_KEY } from "@/lib/service-leads/constants";
import { registroDelWorkspace } from "@/lib/campos/valores";
import { contextoDePlantillas } from "@/lib/plantillas/acceso";
import { MAX_ASUNTO, MAX_CUERPO } from "@/lib/plantillas/constantes";
import { esTipoFichaMensaje, type TipoFichaMensaje } from "@/lib/plantillas/contexto";
import { esCanal } from "@/lib/plantillas/definiciones";
import {
  abrirWhatsapp, enviarCorreo, MENSAJES_ENVIO, prepararMensaje,
  type MensajePreparado, type ResultadoEnvio, type ResultadoWhatsapp,
} from "@/lib/plantillas/envio";

// Archivo "use server": sólo exporta funciones async. Cada acción valida la forma de lo que
// recibe, arma el contexto (sesión + workspace), verifica que el módulo del tipo esté
// encendido, exige `operar` y que el registro sea del workspace; la plantilla (del workspace,
// activa, del canal y de la ficha o GENERAL) la valida `lib/plantillas/envio.ts`.

type Falla = { ok: false; error: string };

const DATOS_INVALIDOS: Falla = { ok: false, error: MENSAJES_ENVIO.datosInvalidos };
const SIN_ACCESO: Falla = { ok: false, error: MENSAJES_ENVIO.sinPermiso };
const MODULO_APAGADO: Falla = { ok: false, error: "Ese módulo no está activo." };
const NO_ENCONTRADO: Falla = { ok: false, error: MENSAJES_ENVIO.noEncontrado };

const MODULO: Record<TipoFichaMensaje, string> = {
  CLIENTE: CLIENTS_MODULE_KEY,
  SOCIO: MEMBERS_MODULE_KEY,
  CONSULTA: SERVICE_LEADS_MODULE_KEY,
};

function rutaFicha(entityType: TipoFichaMensaje, id: string): string {
  const seguro = encodeURIComponent(id);
  if (entityType === "CLIENTE") return `/clientes/${seguro}`;
  if (entityType === "SOCIO") return `/members/${seguro}`;
  return `/consultas/${seguro}`;
}

function idValido(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 100;
}
function plantillaValida(v: unknown): v is string | null | undefined {
  return v === undefined || v === null || v === "" || idValido(v);
}
function esObjeto(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function textoValido(v: unknown, max: number): v is string {
  return typeof v === "string" && v.length <= max + 1_000;
}

/** Contexto, módulo, `operar` y registro del workspace, en ese orden. */
async function acceso(entityType: TipoFichaMensaje, entityId: string) {
  const ctx = await contextoDePlantillas();
  if (!ctx) return { ok: false as const, falla: SIN_ACCESO };
  if (!(await isModuleEnabledForWorkspace(ctx.workspaceId, MODULO[entityType]))) return { ok: false as const, falla: MODULO_APAGADO };
  if (!puedeEnContexto(ctx, "operar", MODULO[entityType])) return { ok: false as const, falla: SIN_ACCESO };
  if (!(await registroDelWorkspace(ctx.workspaceId, entityType, entityId))) return { ok: false as const, falla: NO_ENCONTRADO };
  return { ok: true as const, ctx };
}

export async function prepararMensajeAction(datos: {
  canal: string;
  entityType: string;
  entityId: string;
  templateId?: string | null;
}): Promise<MensajePreparado | Falla> {
  if (
    !esObjeto(datos) || !esCanal(datos.canal) || !esTipoFichaMensaje(datos.entityType) || !idValido(datos.entityId)
    || !plantillaValida(datos.templateId)
  ) {
    return DATOS_INVALIDOS;
  }
  const a = await acceso(datos.entityType, datos.entityId);
  if (!a.ok) return a.falla;
  return prepararMensaje(a.ctx, {
    canal: datos.canal, entityType: datos.entityType, entityId: datos.entityId, templateId: datos.templateId ?? null,
  });
}

export async function enviarCorreoAction(datos: {
  entityType: string;
  entityId: string;
  templateId?: string | null;
  asunto: string;
  cuerpo: string;
}): Promise<ResultadoEnvio> {
  if (
    !esObjeto(datos) || !esTipoFichaMensaje(datos.entityType) || !idValido(datos.entityId) || !plantillaValida(datos.templateId)
    || !textoValido(datos.asunto, MAX_ASUNTO) || !textoValido(datos.cuerpo, MAX_CUERPO.EMAIL)
  ) {
    return DATOS_INVALIDOS;
  }
  const a = await acceso(datos.entityType, datos.entityId);
  if (!a.ok) return a.falla;
  const r = await enviarCorreo(a.ctx, {
    entityType: datos.entityType,
    entityId: datos.entityId,
    templateId: datos.templateId ?? null,
    asunto: datos.asunto,
    cuerpo: datos.cuerpo,
  });
  // Enviado o fallido-y-registrado: el historial de la ficha cambió.
  if (r.ok || r.registrado) revalidatePath(rutaFicha(datos.entityType, datos.entityId));
  return r;
}

export async function abrirWhatsappAction(datos: {
  entityType: string;
  entityId: string;
  templateId?: string | null;
  cuerpo: string;
}): Promise<ResultadoWhatsapp> {
  if (
    !esObjeto(datos) || !esTipoFichaMensaje(datos.entityType) || !idValido(datos.entityId) || !plantillaValida(datos.templateId)
    || !textoValido(datos.cuerpo, MAX_CUERPO.WHATSAPP)
  ) {
    return DATOS_INVALIDOS;
  }
  const a = await acceso(datos.entityType, datos.entityId);
  if (!a.ok) return a.falla;
  const r = await abrirWhatsapp(a.ctx, {
    entityType: datos.entityType,
    entityId: datos.entityId,
    templateId: datos.templateId ?? null,
    cuerpo: datos.cuerpo,
  });
  if (r.ok) revalidatePath(rutaFicha(datos.entityType, datos.entityId));
  return r;
}
