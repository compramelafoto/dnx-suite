"use server";

import { CASILLA_DANIEL } from "@/lib/agentes/vendedor/tipos";
import { sendTransactionalEmail } from "@/lib/communications/send-email";
import { cargarFormularioDeAlta, guardarRespuestasDeAlta, marcarAltaEnviada } from "@/lib/alta-cliente/repositorio";
import { faltantes, respuestasEnTexto } from "@/lib/alta-cliente/tipos";

/**
 * El formulario de alta se guarda solo mientras la persona escribe, y se envía al final.
 * Sin cuenta: el token del enlace es la credencial, igual que el alta de sponsors.
 */

export type ResultadoDeAlta = { ok: true; enviado?: boolean } | { ok: false; error: string; faltan?: string[] };

const TOPE_BYTES = 300_000;

function demasiadoGrande(respuestas: unknown): boolean {
  try {
    return JSON.stringify(respuestas).length > TOPE_BYTES;
  } catch {
    return true;
  }
}

export async function guardarAlta(token: string, respuestas: unknown): Promise<ResultadoDeAlta> {
  if (demasiadoGrande(respuestas)) return { ok: false, error: "Hay demasiado texto para guardar de una vez." };
  try {
    const guardado = await guardarRespuestasDeAlta(token, respuestas);
    if (!guardado) return { ok: false, error: "Este enlace ya no está disponible." };
    return { ok: true };
  } catch (error) {
    console.error("[fotoffice][alta] no se pudo guardar", { detalle: error instanceof Error ? error.message : String(error) });
    return { ok: false, error: "No se pudo guardar. Revisá la conexión; lo volvemos a intentar solo." };
  }
}

function escapar(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function enviarAlta(token: string, respuestas: unknown): Promise<ResultadoDeAlta> {
  const guardado = await guardarAlta(token, respuestas);
  if (!guardado.ok) return guardado;

  const formulario = await cargarFormularioDeAlta(token);
  if (!formulario) return { ok: false, error: "Este enlace ya no está disponible." };

  const faltan = faltantes(formulario.cuestionario, formulario.respuestas);
  if (faltan.length > 0) {
    return { ok: false, error: "Faltan algunas respuestas obligatorias.", faltan };
  }

  await marcarAltaEnviada(formulario.id);

  // El aviso es un extra: si el correo falla, las respuestas ya están guardadas y se leen igual.
  const texto = respuestasEnTexto(formulario.cuestionario, formulario.respuestas, formulario.destinatario);
  const envio = await sendTransactionalEmail({
    to: CASILLA_DANIEL,
    subject: `${formulario.destinatario} completó el formulario de alta`,
    text: texto,
    html: `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap;font-size:14px;line-height:1.5">${escapar(texto)}</pre>`,
    fromName: "FOTOFFICE",
  }).catch((error: unknown) => ({
    status: "INTERNAL_ERROR" as const,
    detail: error instanceof Error ? error.message : String(error),
  }));
  if (envio.status !== "SENT") {
    console.error("[fotoffice][alta] aviso por correo no enviado", { id: formulario.id, estado: envio.status });
  }
  return { ok: true, enviado: true };
}
