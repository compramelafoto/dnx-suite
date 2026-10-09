import "server-only";
import { prisma } from "@repo/db";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { sendTransactionalEmail, type OutboundEmail } from "@/lib/communications/send-email";
import { CARACTER_MARCADOR, TOPE_AUTOMATICOS_DIA, type ClaveAutomatico } from "@/lib/plantillas/constantes";
import { correoValido, type ContextoMensaje } from "@/lib/plantillas/contexto";
import { AUTOMATICOS, leerAutomatico } from "@/lib/plantillas/definiciones";
import { armarCorreoFinal, completarTextos, correosEnviadosHoy, type DepsEnvio } from "@/lib/plantillas/envio";
import { CLAVES_AUTOMATICO_CONTRATO, type ClaveAutomaticoContrato } from "./constantes";

/**
 * Correos del circuito de firma (etapa 5): enlace, código, recordatorio y contrato firmado. Salen con las
 * plantillas automáticas `CONTRATO_*` de la organización (se crean solas, encendidas, la primera vez).
 *
 * - Son transaccionales: van a quien tiene que firmar, no cuentan en la regla de una respuesta por
 *   dirección cada 24 h; sí cuentan en el tope diario de correos automáticos.
 * - Nunca lanzan ni loguean direcciones, nombres, textos ni códigos: sólo un código de resultado.
 * - EL CÓDIGO DE VERIFICACIÓN NO SE REGISTRA: el mensaje que queda en el historial (`FotofficeMessage`)
 *   se arma con asterisco en lugar del código, tanto en el asunto como en el cuerpo.
 */

export const TEXTOS_CONTRATO_INICIALES: Record<ClaveAutomaticoContrato, { asunto: string; cuerpo: string }> = {
  CONTRATO_ENVIO: {
    asunto: "Contrato [contrato_numero] para firmar",
    cuerpo: `Hola[si:firmante_nombre], [firmante_nombre][/si]:

Te enviamos el contrato [contrato_numero] de [organizacion] para que lo leas y lo firmes desde tu celular o tu computadora.

Para firmar:
1. Abrí este enlace: [contrato_enlace]
2. Leé el contrato con calma.
3. Te vamos a mandar un código por correo para confirmar que sos vos.
4. Firmá con tu nombre y tu trazo.

El enlace es personal: no lo compartas. Si tenés alguna duda antes de firmar, respondé este correo[si:organizacion_whatsapp] o escribinos por WhatsApp al [organizacion_whatsapp][/si].

[firma]`,
  },
  CONTRATO_CODIGO: {
    asunto: "Tu código para firmar el contrato [contrato_numero]",
    cuerpo: `Hola[si:firmante_nombre], [firmante_nombre][/si]:

Tu código para firmar el contrato [contrato_numero] es:

[contrato_codigo]

Vale 15 minutos. Si no lo pediste vos, ignorá este correo y no se lo des a nadie.

[firma]`,
  },
  CONTRATO_RECORDATORIO: {
    asunto: "Te falta firmar el contrato [contrato_numero]",
    cuerpo: `Hola[si:firmante_nombre], [firmante_nombre][/si]:

Te recordamos que el contrato [contrato_numero] de [organizacion] todavía está esperando tu firma.

Podés leerlo y firmarlo desde acá: [contrato_enlace]

Si ya lo firmaste o tenés alguna duda, respondé este correo[si:organizacion_whatsapp] o escribinos por WhatsApp al [organizacion_whatsapp][/si].

[firma]`,
  },
  CONTRATO_FIRMADO: {
    asunto: "El contrato [contrato_numero] quedó firmado",
    cuerpo: `Hola[si:firmante_nombre], [firmante_nombre][/si]:

El contrato [contrato_numero] de [organizacion] ya está firmado por todas las partes. Te adjuntamos el PDF con las firmas y la constancia de cada una: guardalo, es tu copia.

Gracias por confiar en nosotros.

[firma]`,
  },
};

export function esClaveAutomaticoContrato(v: unknown): v is ClaveAutomaticoContrato {
  return typeof v === "string" && (CLAVES_AUTOMATICO_CONTRATO as readonly string[]).includes(v);
}

/** Crea las plantillas automáticas del contrato que falten (encendidas). Idempotente y sin lanzar por carreras. */
export async function asegurarPlantillasContrato(workspaceId: string): Promise<void> {
  const existentes = await prisma.fotofficeMessageTemplate.findMany({
    where: { workspaceId, systemKey: { in: [...CLAVES_AUTOMATICO_CONTRATO] } },
    select: { systemKey: true },
  });
  const tiene = new Set(existentes.map((e) => e.systemKey));
  let orden = 10;
  for (const clave of CLAVES_AUTOMATICO_CONTRATO) {
    orden++;
    if (tiene.has(clave)) continue;
    const def = AUTOMATICOS[clave];
    try {
      await prisma.fotofficeMessageTemplate.create({
        data: {
          workspaceId, systemKey: clave, channel: def.canal, entityType: def.tipo, name: def.nombre,
          subject: TEXTOS_CONTRATO_INICIALES[clave].asunto, body: TEXTOS_CONTRATO_INICIALES[clave].cuerpo, enabled: true, order: orden,
        },
        select: { id: true },
      });
    } catch (e) {
      if ((e as { code?: unknown })?.code !== "P2002") throw e;
    }
  }
}

export type ResultadoCorreoContrato =
  | "ENVIADO" | "APAGADA" | "SIN_CORREO" | "PLANTILLA_CON_ERRORES" | "TOPE" | "NO_ENVIADO" | "ERROR";

export type DatosCorreoContrato = {
  workspaceId: string;
  clave: ClaveAutomaticoContrato;
  contratoId: string;
  /** Dirección del firmante (la congelada al enviar). */
  para: string;
  nombre: string;
  numero: string;
  enlace?: string | null;
  /** Sólo CONTRATO_CODIGO. Nunca se guarda. */
  codigo?: string | null;
};

const CODIGO_OCULTO = "******";

function codigoDeError(r: Exclude<Awaited<ReturnType<typeof sendTransactionalEmail>>, { status: "SENT" }>): string {
  if (r.status !== "PROVIDER_REJECTED") return r.status;
  const m = r.detail.match(/^HTTP (\d{3})(?: · ([a-z_]{1,60}))?/);
  return ["PROVIDER_REJECTED", m?.[1], m?.[2]].filter(Boolean).join(":");
}

/** Envía uno de los correos del contrato a un firmante y lo registra. Nunca lanza. */
export async function enviarCorreoContrato(d: DatosCorreoContrato, deps: DepsEnvio = {}): Promise<ResultadoCorreoContrato> {
  try {
    if (!esClaveAutomaticoContrato(d.clave)) return "ERROR";
    if (!correoValido(d.para)) return "SIN_CORREO";
    await asegurarPlantillasContrato(d.workspaceId);
    const auto = await leerAutomatico(d.workspaceId, d.clave as ClaveAutomatico);
    if (!auto || !auto.enabled || auto.channel !== AUTOMATICOS[d.clave].canal) return "APAGADA";

    const ahora = (deps.ahora ?? (() => new Date()))();
    if ((await correosEnviadosHoy(d.workspaceId, ahora, true)) >= TOPE_AUTOMATICOS_DIA) {
      console.warn("[contratos] tope de correos automáticos alcanzado", { codigo: "TOPE_AUTOMATICOS" });
      return "TOPE";
    }

    const org = await loadWorkspaceEmailContext(d.workspaceId);
    const contacto = org.contact ?? { email: null, phone: null, whatsapp: null, website: null, instagram: null, city: null };
    const contexto = (codigo: string | null): ContextoMensaje => ({
      variables: {
        persona: { nombreCompleto: d.nombre, email: d.para, telefono: null },
        organizacion: {
          nombre: org.organizationName, email: contacto.email, telefono: contacto.phone, whatsapp: contacto.whatsapp,
          web: contacto.website, instagram: contacto.instagram, ciudad: contacto.city,
        },
        usuario: { nombre: null, email: null },
        hoy: ahora,
        campos: {},
        contrato: { numero: d.numero, enlace: d.enlace ?? null, codigo, firmante: d.nombre },
      },
      firma: { html: org.signature?.html ?? "", texto: org.signature?.text ?? "" },
      destino: { email: d.para, telefono: null },
      remitente: { nombre: org.organizationName, replyTo: contacto.email },
      camposActivos: [],
    });

    const real = contexto(d.codigo ?? null);
    const textos = completarTextos(real, "CONTRATO", auto.subject, auto.body);
    if (!textos.ok) return "PLANTILLA_CON_ERRORES";
    const correo = armarCorreoFinal(textos.asunto, textos.cuerpo, real.firma);
    if (!correo.ok) return "PLANTILLA_CON_ERRORES";

    // Lo que queda en el historial: el mismo texto pero con el código tapado.
    const oculto = d.codigo ? completarTextos(contexto(CODIGO_OCULTO), "CONTRATO", auto.subject, auto.body) : textos;
    const paraRegistro = oculto.ok ? oculto : textos;

    const enviar = deps.enviar ?? ((m: OutboundEmail) => sendTransactionalEmail(m));
    const resultado = await enviar({
      to: d.para,
      subject: correo.asunto,
      html: correo.html,
      text: correo.texto,
      fromName: real.remitente.nombre,
      ...(correoValido(real.remitente.replyTo) ? { replyTo: real.remitente.replyTo } : {}),
    });
    const fallo = resultado.status === "SENT" ? null : resultado;
    try {
      await prisma.fotofficeMessage.create({
        data: {
          workspaceId: d.workspaceId,
          channel: "EMAIL",
          entityType: "CONTRATO",
          entityId: d.contratoId,
          templateId: auto.id,
          toAddress: d.para,
          subject: d.codigo ? paraRegistro.asunto : correo.asunto,
          body: d.codigo ? sinFirma(paraRegistro.cuerpo) : sinFirma(textos.cuerpo),
          status: fallo ? "FAILED" : "SENT",
          automatic: true,
          providerId: resultado.status === "SENT" ? resultado.providerId : null,
          errorCode: fallo ? codigoDeError(fallo) : null,
          actorUserId: null,
          actorLabel: "Automático",
        },
        select: { id: true },
      });
    } catch (e) {
      console.error("[contratos] no se pudo registrar el correo", { codigo: (e as { code?: unknown })?.code ?? "desconocido" });
    }
    if (fallo) {
      console.warn("[contratos] falló el envío de un correo", { codigo: codigoDeError(fallo) });
      return "NO_ENVIADO";
    }
    return "ENVIADO";
  } catch (e) {
    console.error("[contratos] falló un correo del contrato", { codigo: (e as { code?: unknown })?.code ?? "desconocido" });
    return "ERROR";
  }
}

function sinFirma(cuerpo: string): string {
  return cuerpo.split(CARACTER_MARCADOR).join("");
}
