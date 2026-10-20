import { MAX_ASUNTO, MAX_CUERPO, type Canal } from "@/lib/plantillas/constantes";
import { analizar, tieneMarcadorSinCompletar } from "@/lib/plantillas/motor";
import { clavesPermitidas } from "@/lib/plantillas/variables";
import { cifrasDelTexto } from "./cifras";
import { redactarMensajeDelCliente } from "./redactar";

/**
 * El texto que propone DNX Bot para el cliente (spec §6.3, `preparar_mensaje`). PURO. Se escribe
 * CON variables (`[nombre]`, `[presupuesto_enlace]`, `[presupuesto_total]`): las completa el
 * servidor recién al enviar, fuera del bot. Acá se controla que:
 * - las variables existan para ese destino (el mismo motor de plantillas que el envío);
 * - con destino presupuesto vaya `[presupuesto_enlace]`;
 * - no haya montos ni porcentajes escritos a mano (van como `[presupuesto_total]`);
 * - no haya correos, teléfonos ni enlaces escritos (el contacto lo pone el envío);
 * - el largo entre en el canal; el correo lleve asunto.
 */
export type DestinoMensaje = "PRESUPUESTO" | "CONSULTA";

export type ResultadoMensaje = { ok: true; avisos: string[] } | { ok: false; errores: string[] };

export function validarMensajeDelBot(m: { destino: DestinoMensaje; canal: Canal; asunto?: string; cuerpo: string }): ResultadoMensaje {
  const errores: string[] = [];
  const cuerpo = m.cuerpo.trim();
  const asunto = (m.asunto ?? "").trim();
  if (!cuerpo) errores.push("El mensaje está vacío.");
  if (cuerpo.length > MAX_CUERPO[m.canal]) errores.push(`El mensaje es muy largo para ${m.canal === "EMAIL" ? "un correo" : "WhatsApp"}.`);
  if (m.canal === "EMAIL" && !asunto) errores.push("Un correo necesita asunto.");
  if (asunto.length > MAX_ASUNTO) errores.push("El asunto es muy largo.");

  const permitidas = clavesPermitidas(m.destino, []);
  for (const [nombre, texto] of [["asunto", asunto], ["mensaje", cuerpo]] as const) {
    if (!texto) continue;
    const r = analizar(texto, permitidas);
    if (!r.ok) errores.push(`El ${nombre} tiene una variable que no existe para este envío: ${r.errores.map((e) => e.mensaje).join("; ")}`);
  }
  if (m.destino === "PRESUPUESTO" && !cuerpo.includes("[presupuesto_enlace]")) {
    errores.push("Falta el enlace al presupuesto: poné [presupuesto_enlace].");
  }
  const todo = `${asunto}\n${cuerpo}`;
  if (cifrasDelTexto(todo).length > 0) {
    errores.push("No escribas montos ni porcentajes en el mensaje: para el total usá [presupuesto_total].");
  }
  if (redactarMensajeDelCliente(todo) !== todo.trim()) {
    errores.push("No escribas correos, teléfonos ni enlaces en el mensaje: el envío usa los datos del contacto.");
  }
  if (errores.length) return { ok: false, errores };
  const avisos = tieneMarcadorSinCompletar(todo) ? ["Quedó un texto entre corchetes para completar a mano antes de enviar."] : [];
  return { ok: true, avisos };
}
