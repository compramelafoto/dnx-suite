import "server-only";
import { prisma, type Prisma } from "@repo/db";
import { moduloDeRegistroEncendido } from "@/lib/campos/modulos";
import { AUTOR_AVISO_EQUIPO, CARACTER_MARCADOR, TOPE_AVISOS_EQUIPO_DIA, VENTANA_UNA_AUTORESPUESTA_MS } from "./constantes";
import { AUTOMATICOS, leerAutomatico } from "./definiciones";
import { conListaDePrecios, contextoDe, correoValido, destinoDe } from "./contexto";
import {
  armarCorreoFinal, completarTextos, enviarCorreo, inicioDelDiaAR, sinAvisosAlEquipo, type CtxEnvio, type DepsEnvio,
} from "./envio";
import { sendTransactionalEmail, type OutboundEmail } from "@/lib/communications/send-email";

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
  | "TOPE"
  | "ERROR";

/**
 * ¿Ya salió (o se intentó) una respuesta automática a esta dirección en las últimas 24 h? Cuenta
 * también las fallidas: un proveedor que rechaza no habilita reintentos en cadena. La usa también
 * la propuesta modelo que sale sola (`lib/presupuestos/propuesta-automatica.ts`): las dos son
 * respuestas automáticas a la misma persona y comparten la regla.
 */
export async function yaRespondida(
  workspaceId: string,
  email: string,
  ahora: Date,
  /** Dentro de una transacción (con su candado): su cliente y el filtro ya armado afuera. */
  enTransaccion?: { cliente: Pick<Prisma.TransactionClient, "fotofficeMessage">; filtro: Prisma.FotofficeMessageWhereInput },
): Promise<boolean> {
  const cliente = enTransaccion?.cliente ?? prisma;
  const previo = await cliente.fotofficeMessage.findFirst({
    where: {
      workspaceId,
      channel: "EMAIL",
      automatic: true,
      toAddress: { equals: email.trim(), mode: "insensitive" },
      createdAt: { gte: new Date(ahora.getTime() - VENTANA_UNA_AUTORESPUESTA_MS) },
      // Un aviso al equipo no es una respuesta a esta persona.
      ...(enTransaccion?.filtro ?? (await sinAvisosAlEquipo(workspaceId))),
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

    const leido = await contextoDe(workspaceId, "CONSULTA", leadId, { nombre: null, email: null });
    if (!leido) return "NO_ENCONTRADA";
    const contexto = await conListaDePrecios(workspaceId, leido, auto.subject, auto.body);
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

/**
 * Aviso interno de consulta nueva al equipo (etapa 1) con la plantilla del sistema
 * `CONSULTA_AVISO_EQUIPO`, si está encendida. Va a `para` (un usuario del equipo, ya elegido por
 * `lib/consultas/aviso.ts`) con el remitente de FOTOFFICE. Nunca lanza y nunca loguea datos.
 *
 * Tope propio (R7): `TOPE_AVISOS_EQUIPO_DIA` por día de Buenos Aires y organización; pasado el
 * tope no se manda (la tarea "Responder consulta" se crea igual). Para contarlos sin columnas ni
 * tablas nuevas, cada aviso se registra en `FotofficeMessage` (canal EMAIL, automático, ficha
 * CONSULTA, a la casilla del usuario) con el `templateId` de la plantilla del aviso: esa marca los
 * deja afuera del tope de manuales (son automáticos), del de automáticos y de la regla de una
 * respuesta por dirección cada 24 h (`sinAvisosAlEquipo`). Quedan en el historial de la consulta
 * como constancia de que se avisó al equipo.
 */
export async function avisarEquipoConsultaNueva(
  workspaceId: string,
  leadId: string,
  para: { email: string | null; nombre: string | null },
  deps: DepsEnvio = {},
): Promise<ResultadoAutomatico> {
  try {
    const auto = await leerAutomatico(workspaceId, "CONSULTA_AVISO_EQUIPO");
    if (!auto || !auto.enabled || auto.channel !== AUTOMATICOS.CONSULTA_AVISO_EQUIPO.canal) return "APAGADA";
    if (!correoValido(para.email)) return "SIN_CORREO";
    const ahora = (deps.ahora ?? (() => new Date()))();
    // Cuentan los intentos del día (enviados y fallidos): un proveedor caído no habilita más.
    const hoy = await prisma.fotofficeMessage.count({
      where: { workspaceId, channel: "EMAIL", templateId: auto.id, createdAt: { gte: inicioDelDiaAR(ahora) } },
    });
    if (hoy >= TOPE_AVISOS_EQUIPO_DIA) {
      console.warn("[plantillas] tope de avisos al equipo alcanzado", { codigo: "TOPE_AVISOS_EQUIPO" });
      return "TOPE";
    }
    const leido = await contextoDe(workspaceId, "CONSULTA", leadId, { nombre: para.nombre, email: para.email });
    if (!leido) return "NO_ENCONTRADA";
    const contexto = await conListaDePrecios(workspaceId, leido, auto.subject, auto.body);
    const textos = completarTextos(contexto, "CONSULTA", auto.subject, auto.body);
    if (!textos.ok) {
      console.warn("[plantillas] el aviso al equipo tiene variables inválidas", { codigo: "PLANTILLA_CON_ERRORES" });
      return "PLANTILLA_CON_ERRORES";
    }
    const correo = armarCorreoFinal(textos.asunto, textos.cuerpo, contexto.firma);
    if (!correo.ok) {
      console.warn("[plantillas] el aviso al equipo no se pudo armar", { codigo: "PLANTILLA_CON_ERRORES" });
      return "PLANTILLA_CON_ERRORES";
    }
    const enviar = deps.enviar ?? ((m: OutboundEmail) => sendTransactionalEmail(m));
    // Sin `fromName` ni `sender`: sale con el remitente de FOTOFFICE (el del entorno).
    const r = await enviar({ to: para.email, subject: correo.asunto, html: correo.html, text: correo.texto });
    try {
      await prisma.fotofficeMessage.create({
        data: {
          workspaceId,
          channel: "EMAIL",
          entityType: "CONSULTA",
          entityId: leadId,
          templateId: auto.id,
          toAddress: para.email,
          subject: correo.asunto,
          body: textos.cuerpo.split(CARACTER_MARCADOR).join(""),
          status: r.status === "SENT" ? "SENT" : "FAILED",
          automatic: true,
          providerId: r.status === "SENT" ? r.providerId : null,
          errorCode: r.status === "SENT" ? null : r.status,
          actorUserId: null,
          actorLabel: AUTOR_AVISO_EQUIPO,
        },
        select: { id: true },
      });
    } catch (e) {
      console.error("[plantillas] no se pudo registrar el aviso al equipo", { codigo: (e as { code?: unknown })?.code ?? "desconocido" });
    }
    if (r.status === "SENT") return "ENVIADO";
    console.warn("[plantillas] el aviso al equipo no salió", { codigo: r.status });
    return "NO_ENVIADO";
  } catch (e) {
    console.error("[plantillas] falló el aviso al equipo", { codigo: (e as { code?: unknown })?.code ?? "desconocido" });
    return "ERROR";
  }
}
