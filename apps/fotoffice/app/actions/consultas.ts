"use server";

import { revalidatePath } from "next/cache";
import { contextoDeConsultas } from "@/lib/consultas/acceso";
import {
  agregarParticipante,
  crearConsultaManual,
  crearConsultaRapida,
  editarConsulta,
  MENSAJES_EDICION,
  quitarParticipante,
  veContactos,
  type FormAltaRapida,
  type FormEdicion,
  type FormNuevaConsulta,
  type Resultado,
  type ResultadoCreacion,
} from "@/lib/consultas/edicion";
import { buscarContactos, type ContactoEncontrado } from "@/lib/consultas/ficha";

// Archivo "use server": sólo exporta funciones async. Cada acción arma primero el contexto
// (sesión + workspace de la sesión + módulo encendido + "Gestionar" en Consultas) y recién ahí
// lee o escribe. Cada id que llega del navegador lo valida contra el workspace `lib/consultas`.

const SIN_ACCESO = { ok: false as const, error: "No tenés permiso para hacer esto." };

function esObjeto(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function revalidarConsulta(leadId: string): void {
  revalidatePath("/consultas");
  revalidatePath("/consultas/lista");
  revalidatePath(`/consultas/${leadId}`);
}

/**
 * Buscador de contactos del formulario: nombre, correo o teléfono (2 caracteres o más, hasta 20).
 * Además de "Gestionar" en Consultas pide "Ver" en Clientes (R10): es el padrón de clientes.
 */
export async function buscarContactosAction(texto: string): Promise<{ ok: true; contactos: ContactoEncontrado[] } | { ok: false; error: string }> {
  const ctx = await contextoDeConsultas("operar");
  if (!ctx) return SIN_ACCESO;
  if (!veContactos(ctx)) return { ok: false, error: MENSAJES_EDICION.sinContactos };
  return { ok: true, contactos: await buscarContactos(ctx.workspaceId, texto) };
}

/** "Nueva consulta". */
export async function crearConsultaAction(form: FormNuevaConsulta): Promise<ResultadoCreacion> {
  const ctx = await contextoDeConsultas("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await crearConsultaManual(ctx, form);
  if (r.ok) revalidarConsulta(r.leadId);
  return r;
}

/** Alta rápida en la primera columna del tablero. */
export async function altaRapidaAction(form: FormAltaRapida): Promise<ResultadoCreacion> {
  const ctx = await contextoDeConsultas("operar");
  if (!ctx) return SIN_ACCESO;
  const r = await crearConsultaRapida(ctx, form);
  if (r.ok) revalidarConsulta(r.leadId);
  return r;
}

/** Columna de datos de la ficha. */
export async function editarConsultaAction(datos: { leadId: string; form: FormEdicion }): Promise<Resultado> {
  const ctx = await contextoDeConsultas("operar");
  if (!ctx) return SIN_ACCESO;
  if (!esObjeto(datos) || typeof datos.leadId !== "string") return { ok: false, error: "Los datos no son válidos." };
  const r = await editarConsulta(ctx, datos.leadId, datos.form);
  if (r.ok) revalidarConsulta(datos.leadId);
  return r;
}

export async function agregarParticipanteAction(datos: { leadId: string; clientId: string; roleId: string; nota?: string }): Promise<Resultado> {
  const ctx = await contextoDeConsultas("operar");
  if (!ctx) return SIN_ACCESO;
  if (!esObjeto(datos) || typeof datos.leadId !== "string") return { ok: false, error: "Los datos no son válidos." };
  const r = await agregarParticipante(ctx, datos.leadId, { clientId: datos.clientId, roleId: datos.roleId, nota: datos.nota });
  if (r.ok) revalidarConsulta(datos.leadId);
  return r;
}

export async function quitarParticipanteAction(datos: { leadId: string; participanteId: string }): Promise<Resultado> {
  const ctx = await contextoDeConsultas("operar");
  if (!ctx) return SIN_ACCESO;
  if (!esObjeto(datos) || typeof datos.leadId !== "string") return { ok: false, error: "Los datos no son válidos." };
  const r = await quitarParticipante(ctx, datos.leadId, datos.participanteId);
  if (r.ok) revalidarConsulta(datos.leadId);
  return r;
}
