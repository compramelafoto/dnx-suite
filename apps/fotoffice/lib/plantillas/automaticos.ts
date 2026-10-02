import "server-only";
import { prisma } from "@repo/db";
import { moduloDeRegistroEncendido } from "@/lib/campos/modulos";
import { VENTANA_UNA_AUTORESPUESTA_MS } from "./constantes";
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
  | "YA_RESPONDIDO"
  | "NO_ENCONTRADA"
  | "PLANTILLA_CON_ERRORES"
  | "NO_ENVIADO"
  | "ERROR";

/**
 * ¿Ya salió (o se intentó) una respuesta automática a esta dirección en las últimas 24 h? Cuenta
 * también las fallidas: un proveedor que rechaza no habilita reintentos en cadena.
 */
async function yaRespondida(workspaceId: string, email: string, ahora: Date): Promise<boolean> {
  const previo = await prisma.fotofficeMessage.findFirst({
    where: {
      workspaceId,
      channel: "EMAIL",
      automatic: true,
      toAddress: { equals: email.trim(), mode: "insensitive" },
      createdAt: { gte: new Date(ahora.getTime() - VENTANA_UNA_AUTORESPUESTA_MS) },
    },
    select: { id: true },
  });
  return previo !== null;
}

/** El sistema envía: sin usuario. `enviarCorreo` registra "Automático" como autor. */
function ctxDelSistema(workspaceId: string): CtxEnvio {
  return { workspaceId, userId: null, userLabel: null, userName: null, userEmail: null, role: null };
}

/**
 * Responde una consulta recién creada (ya numerada) con la plantilla `CONSULTA_AUTORESPUESTA`,
 * si está encendida, el módulo Captación está activo y la consulta trae un correo válido.
 *
 * Contra el abuso del formulario público (que es abierto): a una misma dirección se le responde
 * una sola vez cada 24 h por organización, y los automáticos tienen su propio tope diario
 * (`TOPE_AUTOMATICOS_DIA`, lo mira `enviarCorreo`; al llegar no se envía ni se registra) que no
 * consume el de los envíos manuales. Una falla del proveedor queda registrada como "Falló".
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
    // Con Captación apagada la consulta no se ve en ningún lado: no se responde.
    if (!(await moduloDeRegistroEncendido(workspaceId, def.tipo))) return "APAGADA";

    // Primero lo barato: sin correo no hace falta cargar la organización ni la firma.
    const destino = await destinoDe(workspaceId, "CONSULTA", leadId);
    if (!destino) return "NO_ENCONTRADA";
    if (!correoValido(destino.email)) return "SIN_CORREO";
    if (await yaRespondida(workspaceId, destino.email, (deps.ahora ?? (() => new Date()))())) return "YA_RESPONDIDO";

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
