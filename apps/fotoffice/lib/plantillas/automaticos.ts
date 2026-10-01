import "server-only";
import { AUTOMATICOS, leerAutomatico } from "./definiciones";
import { contextoDe, correoValido, destinoDe } from "./contexto";
import { completarTextos, enviarCorreo, type CtxEnvio, type DepsEnvio } from "./envio";

/**
 * Mensajes que salen solos (spec §3.5). Hoy, uno: la respuesta automática a una consulta nueva
 * que llega por el formulario público. Nunca lanza y nunca loguea datos personales: sólo códigos.
 */

/** Qué pasó con la respuesta automática (para las pruebas y el log; nunca lleva datos). */
export type ResultadoAutomatico =
  | "ENVIADO"
  | "APAGADA"
  | "SIN_CORREO"
  | "NO_ENCONTRADA"
  | "PLANTILLA_CON_ERRORES"
  | "NO_ENVIADO"
  | "ERROR";

/** El sistema envía: sin usuario. `enviarCorreo` registra "Automático" como autor. */
function ctxDelSistema(workspaceId: string): CtxEnvio {
  return { workspaceId, userId: null, userLabel: null, userName: null, userEmail: null, role: null };
}

/**
 * Responde una consulta recién creada (ya numerada) con la plantilla `CONSULTA_AUTORESPUESTA`,
 * si está encendida y la consulta trae un correo válido. El tope diario lo mira `enviarCorreo`
 * (al llegar no se envía ni se registra). Una falla del proveedor queda registrada como "Falló".
 *
 * Se llama sólo desde el alta del formulario público (`app/actions/service-lead.ts`): nunca desde
 * las altas manuales ni desde la inscripción presencial.
 */
export async function responderConsultaNueva(
  workspaceId: string,
  leadId: string,
  deps: DepsEnvio = {},
): Promise<ResultadoAutomatico> {
  try {
    const def = AUTOMATICOS.CONSULTA_AUTORESPUESTA;
    const auto = await leerAutomatico(workspaceId, "CONSULTA_AUTORESPUESTA");
    if (!auto || !auto.enabled || auto.channel !== def.canal) return "APAGADA";

    // Primero lo barato: sin correo no hace falta cargar la organización ni la firma.
    const destino = await destinoDe(workspaceId, "CONSULTA", leadId);
    if (!destino) return "NO_ENCONTRADA";
    if (!correoValido(destino.email)) return "SIN_CORREO";

    const contexto = await contextoDe(workspaceId, "CONSULTA", leadId, { nombre: null, email: null });
    if (!contexto) return "NO_ENCONTRADA";
    const textos = completarTextos(contexto, "CONSULTA", auto.subject, auto.body);
    if (!textos.ok) {
      console.warn("[plantillas] la respuesta automática tiene variables inválidas", { codigo: "PLANTILLA_CON_ERRORES" });
      return "PLANTILLA_CON_ERRORES";
    }

    const r = await enviarCorreo(
      ctxDelSistema(workspaceId),
      { entityType: "CONSULTA", entityId: leadId, templateId: auto.id, asunto: textos.asunto, cuerpo: textos.cuerpo, automatico: true },
      deps,
    );
    if (r.ok) return "ENVIADO";
    // El motivo (tope, proveedor, etc.) ya lo registró o lo logueó `enviarCorreo` con su código.
    console.warn("[plantillas] la respuesta automática no salió", { codigo: r.registrado ? "REGISTRADO_FALLIDO" : "NO_ENVIADO" });
    return "NO_ENVIADO";
  } catch (e) {
    // Sólo el código: el mensaje de Prisma puede repetir datos de la persona.
    console.error("[plantillas] falló la respuesta automática", { codigo: (e as { code?: unknown })?.code ?? "desconocido" });
    return "ERROR";
  }
}
