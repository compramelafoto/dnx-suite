import "server-only";
import { prisma } from "@repo/db";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { sendTransactionalEmail, type OutboundEmail } from "@/lib/communications/send-email";
import { CARACTER_MARCADOR, TOPE_AUTOMATICOS_DIA, type ClaveAutomatico } from "@/lib/plantillas/constantes";
import { correoValido, type ContextoMensaje } from "@/lib/plantillas/contexto";
import { AUTOMATICOS, leerAutomatico } from "@/lib/plantillas/definiciones";
import { armarCorreoFinal, completarTextos, correosEnviadosHoy, type DepsEnvio } from "@/lib/plantillas/envio";
import { sitioDelWorkspace } from "@/lib/presupuestos/sitio";
import { limpiarAsunto } from "./asunto";
import { CLAVES_AUTOMATICO_GALERIA, type ClaveAutomaticoGaleria } from "./constantes-correo";
import { hashDeToken, resolverClaveDeEnlace, tokenDeGaleriaCliente, urlDeGaleria } from "./enlace";
import { registrarEventoSinFallar } from "./eventos";

/**
 * Correos automáticos de la galería (etapa 7): el enlace personal al cliente (`GALERIA_ENVIO`) y la copia
 * de la selección enviada (`GALERIA_SELECCION_ENVIADA`, la manda la página del cliente). Salen con las
 * plantillas automáticas de la organización (se crean solas, encendidas, la primera vez), como los de
 * Contratos.
 *
 * - Son transaccionales: van al cliente, no cuentan en la regla de una respuesta por dirección cada 24 h; sí
 *   cuentan en el tope diario de correos automáticos.
 * - Nunca lanzan ni loguean direcciones, nombres ni textos: sólo un código de resultado.
 * - El enlace NO se guarda en el registro del mensaje (es personal y da acceso): queda un texto con el
 *   enlace tapado.
 */

export const TEXTOS_GALERIA_INICIALES: Record<ClaveAutomaticoGaleria, { asunto: string; cuerpo: string }> = {
  GALERIA_ENVIO: {
    asunto: "Elegí tus fotos: [galeria_nombre]",
    cuerpo: `Hola[si:nombre], [nombre][/si]:

Ya podés ver las fotos de "[galeria_nombre]" de [organizacion] y elegir las que más te gusten.

Para empezar, abrí este enlace: [galeria_enlace]

Marcá tus favoritas, dejá un comentario en las fotos que quieras y, cuando termines, enviá tu selección. El enlace es personal: no lo compartas.

Si tenés alguna duda, respondé este correo[si:organizacion_whatsapp] o escribinos por WhatsApp al [organizacion_whatsapp][/si].

[firma]`,
  },
  GALERIA_SELECCION_ENVIADA: {
    asunto: "Recibimos tu selección de [galeria_nombre]",
    cuerpo: `Hola[si:nombre], [nombre][/si]:

Recibimos tu selección de "[galeria_nombre]": elegiste [galeria_cantidad] fotos. Ya la estamos mirando.

Si querés cambiar algo, respondé este correo y lo vemos.

Gracias por elegir con nosotros.

[firma]`,
  },
  GALERIA_COMPRA_PAGADA: {
    asunto: "Recibimos tu pago: [galeria_nombre]",
    cuerpo: `Hola[si:nombre], [nombre][/si]:

Recibimos tu pago de [galeria_total] por [galeria_cantidad] fotos extra de "[galeria_nombre]". ¡Gracias!

Podés volver a tu galería cuando quieras con este enlace: [galeria_enlace]

Si tenés alguna duda, respondé este correo[si:organizacion_whatsapp] o escribinos por WhatsApp al [organizacion_whatsapp][/si].

[firma]`,
  },
  GALERIA_ENTREGA_ENVIO: {
    asunto: "Tus fotos ya están listas: [galeria_nombre]",
    cuerpo: `Hola[si:nombre], [nombre][/si]:

Tus fotos de "[galeria_nombre]" de [organizacion] ya están listas para ver y descargar.

Abrí este enlace: [galeria_enlace]

Podés bajar cada archivo en su calidad original o pedir que te mandemos todo junto por correo. El enlace es personal: no lo compartas.

Si tenés alguna duda, respondé este correo[si:organizacion_whatsapp] o escribinos por WhatsApp al [organizacion_whatsapp][/si].

[firma]`,
  },
  GALERIA_DESCARGA_LISTA: {
    asunto: "Tu descarga de [galeria_nombre] está lista",
    cuerpo: `Hola[si:nombre], [nombre][/si]:

Ya armamos tu descarga completa de "[galeria_nombre]" de [organizacion]. Si es grande, viene dividida en varias partes de hasta 1 GB.

Para bajarla, abrí este enlace: [galeria_enlace]

Las partes se pueden descargar hasta el [galeria_vence]. Pasada esa fecha tenés que pedirla de nuevo desde tu galería.

[firma]`,
  },
  GALERIA_ALBUM_RONDA: {
    asunto: "Hay una ronda nueva de tu álbum para revisar: [galeria_nombre]",
    cuerpo: `Hola[si:nombre], [nombre][/si]:

Preparamos la ronda [galeria_ronda] de "[galeria_nombre]" de [organizacion] con los cambios. Ya podés revisar las láminas.

[si:galeria_nota]Esto nos dejó el estudio: [galeria_nota][/si]

Para verla, abrí este enlace: [galeria_enlace]

Podés marcar un punto de cada lámina para dejar un comentario y, cuando termines, aprobar el álbum o pedir cambios. El enlace es personal: no lo compartas.

[firma]`,
  },
};

export function esClaveAutomaticoGaleria(v: unknown): v is ClaveAutomaticoGaleria {
  return typeof v === "string" && (CLAVES_AUTOMATICO_GALERIA as readonly string[]).includes(v);
}

/** Crea las plantillas automáticas de la galería que falten (encendidas). Idempotente y sin lanzar por carreras. */
export async function asegurarPlantillasGaleria(workspaceId: string): Promise<void> {
  const existentes = await prisma.fotofficeMessageTemplate.findMany({
    where: { workspaceId, systemKey: { in: [...CLAVES_AUTOMATICO_GALERIA] } },
    select: { systemKey: true },
  });
  const tiene = new Set(existentes.map((e) => e.systemKey));
  let orden = 30;
  for (const clave of CLAVES_AUTOMATICO_GALERIA) {
    orden++;
    if (tiene.has(clave)) continue;
    const def = AUTOMATICOS[clave];
    try {
      await prisma.fotofficeMessageTemplate.create({
        data: {
          workspaceId, systemKey: clave, channel: def.canal, entityType: def.tipo, name: def.nombre,
          subject: TEXTOS_GALERIA_INICIALES[clave].asunto, body: TEXTOS_GALERIA_INICIALES[clave].cuerpo, enabled: true, order: orden,
        },
        select: { id: true },
      });
    } catch (e) {
      if ((e as { code?: unknown })?.code !== "P2002") throw e;
    }
  }
}

export type ResultadoCorreoGaleria = "ENVIADO" | "APAGADA" | "SIN_CORREO" | "PLANTILLA_CON_ERRORES" | "TOPE" | "NO_ENVIADO" | "ERROR";

export type DatosCorreoGaleria = {
  workspaceId: string;
  clave: ClaveAutomaticoGaleria;
  galeriaId: string;
  para: string;
  nombre: string;
  numero: string;
  nombreGaleria: string;
  enlace?: string | null;
  /** GALERIA_SELECCION_ENVIADA y GALERIA_COMPRA_PAGADA. */
  cantidad?: number | null;
  /** Sólo GALERIA_COMPRA_PAGADA: el total pagado, ya en pesos para mostrar ("$ 4.500,00"). */
  total?: string | null;
  /** Sólo GALERIA_DESCARGA_LISTA: el día hasta el que se puede bajar la descarga, ya formateado. */
  vence?: string | null;
  /** Sólo GALERIA_ALBUM_RONDA: el número de ronda y la nota del estudio. */
  ronda?: number | null;
  nota?: string | null;
};

const ENLACE_OCULTO = "(enlace personal)";

function codigoDeError(r: Exclude<Awaited<ReturnType<typeof sendTransactionalEmail>>, { status: "SENT" }>): string {
  if (r.status !== "PROVIDER_REJECTED") return r.status;
  const m = r.detail.match(/^HTTP (\d{3})(?: · ([a-z_]{1,60}))?/);
  return ["PROVIDER_REJECTED", m?.[1], m?.[2]].filter(Boolean).join(":");
}

function sinFirma(cuerpo: string): string {
  return cuerpo.split(CARACTER_MARCADOR).join("");
}

/** Envía uno de los correos de la galería a un cliente y lo registra. Nunca lanza. */
export async function enviarCorreoGaleria(d: DatosCorreoGaleria, deps: DepsEnvio = {}): Promise<ResultadoCorreoGaleria> {
  try {
    if (!esClaveAutomaticoGaleria(d.clave)) return "ERROR";
    if (!correoValido(d.para)) return "SIN_CORREO";
    await asegurarPlantillasGaleria(d.workspaceId);
    const auto = await leerAutomatico(d.workspaceId, d.clave as ClaveAutomatico);
    if (!auto || !auto.enabled || auto.channel !== AUTOMATICOS[d.clave].canal) return "APAGADA";

    const ahora = (deps.ahora ?? (() => new Date()))();
    if ((await correosEnviadosHoy(d.workspaceId, ahora, true)) >= TOPE_AUTOMATICOS_DIA) {
      console.warn("[galerias] tope de correos automáticos alcanzado", { codigo: "TOPE_AUTOMATICOS" });
      return "TOPE";
    }

    const org = await loadWorkspaceEmailContext(d.workspaceId);
    const contacto = org.contact ?? { email: null, phone: null, whatsapp: null, website: null, instagram: null, city: null };
    const contexto = (enlace: string | null): ContextoMensaje => ({
      variables: {
        persona: { nombreCompleto: d.nombre, email: d.para, telefono: null },
        organizacion: {
          nombre: org.organizationName, email: contacto.email, telefono: contacto.phone, whatsapp: contacto.whatsapp,
          web: contacto.website, instagram: contacto.instagram, ciudad: contacto.city,
        },
        usuario: { nombre: null, email: null },
        hoy: ahora,
        campos: {},
        galeria: { numero: d.numero, nombre: d.nombreGaleria, enlace, cantidad: d.cantidad === null || d.cantidad === undefined ? null : String(d.cantidad), total: d.total ?? null, vence: d.vence ?? null, ronda: d.ronda === null || d.ronda === undefined ? null : String(d.ronda), nota: d.nota ?? null },
      },
      firma: { html: org.signature?.html ?? "", texto: org.signature?.text ?? "" },
      destino: { email: d.para, telefono: null },
      remitente: { nombre: org.organizationName, replyTo: contacto.email },
      camposActivos: [],
    });

    const real = contexto(d.enlace ?? null);
    const textos = completarTextos(real, "GALERIA", auto.subject, auto.body);
    if (!textos.ok) return "PLANTILLA_CON_ERRORES";
    const correo = armarCorreoFinal(textos.asunto, textos.cuerpo, real.firma);
    if (!correo.ok) return "PLANTILLA_CON_ERRORES";

    // Lo que queda en el historial: el mismo texto pero con el enlace personal tapado.
    const oculto = d.enlace ? completarTextos(contexto(ENLACE_OCULTO), "GALERIA", auto.subject, auto.body) : textos;
    const paraRegistro = oculto.ok ? oculto : textos;

    const enviar = deps.enviar ?? ((m: OutboundEmail) => sendTransactionalEmail(m));
    const resultado = await enviar({
      to: d.para,
      subject: limpiarAsunto(correo.asunto),
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
          entityType: "GALERIA",
          entityId: d.galeriaId,
          templateId: auto.id,
          toAddress: d.para,
          subject: paraRegistro.asunto,
          body: sinFirma(paraRegistro.cuerpo),
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
      console.error("[galerias] no se pudo registrar el correo", { codigo: (e as { code?: unknown })?.code ?? "desconocido" });
    }
    if (fallo) {
      console.warn("[galerias] falló el envío de un correo", { codigo: codigoDeError(fallo) });
      return "NO_ENVIADO";
    }
    return "ENVIADO";
  } catch (e) {
    console.error("[galerias] falló un correo de la galería", { codigo: (e as { code?: unknown })?.code ?? "desconocido" });
    return "ERROR";
  }
}

export type DepsEnlace = DepsEnvio & {
  clave?: string | null;
  appOrigin?: string;
  /** Otro correo con el enlace del cliente en lugar del de envío (el aviso de ronda nueva del álbum: `GALERIA_ALBUM_RONDA`). */
  correo?: { clave: ClaveAutomaticoGaleria; ronda?: number | null; nota?: string | null };
};

/**
 * Manda `GALERIA_ENVIO` a un cliente con su enlace vigente (la acción lo llama con `after()`) y deja el
 * resultado en el historial de la galería. Nunca lanza. Revalida acá, al momento de enviar: galería
 * publicada, enlace sin anular y token que coincide con el hash guardado.
 */
export async function enviarCorreoEnlace(workspaceId: string, galeriaClienteId: string, actorUserId: number | null, deps: DepsEnlace = {}): Promise<ResultadoCorreoGaleria> {
  let galeriaId: string | null = null;
  try {
    const clave = deps.clave !== undefined ? deps.clave : resolverClaveDeEnlace();
    if (!clave) return "ERROR";
    const c = await prisma.fotofficeGaleriaCliente.findFirst({
      where: { id: galeriaClienteId, workspaceId },
      select: { id: true, galeriaId: true, name: true, email: true, tokenHash: true, tokenIssuedAt: true, revokedAt: true },
    });
    if (!c) return "ERROR";
    galeriaId = c.galeriaId;
    const g = await prisma.fotofficeGaleria.findFirst({ where: { id: c.galeriaId, workspaceId }, select: { number: true, name: true, status: true, kind: true } });
    if (!g || c.revokedAt || g.status !== "PUBLICADA") return "ERROR";
    const token = tokenDeGaleriaCliente(c.id, c.tokenIssuedAt, clave);
    if (hashDeToken(token) !== c.tokenHash) return "ERROR";
    const sitio = await sitioDelWorkspace(workspaceId);
    if (!sitio) return "ERROR";
    const origen = (deps.appOrigin ?? (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "")).replace(/\/+$/, "");
    const enlace = urlDeGaleria({ customDomain: sitio.customDomain, appOrigin: origen, slug: sitio.slug, token });
    if (!enlace) return "ERROR";
    if (!c.email) {
      await registrarEventoSinFallar({ workspaceId, galeriaId, galeriaClienteId: c.id, tipo: "CORREO_NO_ENVIADO", actorUserId, data: { motivo: "SIN_CORREO" } });
      return "SIN_CORREO";
    }
    const r = await enviarCorreoGaleria(
      {
        workspaceId, clave: deps.correo?.clave ?? (g.kind === "ENTREGA" ? "GALERIA_ENTREGA_ENVIO" : "GALERIA_ENVIO"), galeriaId, para: c.email, nombre: c.name,
        numero: g.number, nombreGaleria: g.name, enlace, ronda: deps.correo?.ronda ?? null, nota: deps.correo?.nota ?? null,
      },
      deps,
    );
    await registrarEventoSinFallar({
      workspaceId, galeriaId, galeriaClienteId: c.id, actorUserId,
      tipo: r === "ENVIADO" ? "CORREO_ENVIADO" : "CORREO_NO_ENVIADO",
      ...(r === "ENVIADO" ? {} : { data: { motivo: r } }),
    });
    return r;
  } catch (e) {
    console.error("[galerias] falló el correo del enlace", { codigo: (e as { code?: unknown })?.code ?? "desconocido" });
    if (galeriaId) await registrarEventoSinFallar({ workspaceId, galeriaId, galeriaClienteId, tipo: "CORREO_NO_ENVIADO", actorUserId, data: { motivo: "ERROR" } });
    return "ERROR";
  }
}

/**
 * Avisa por correo (`GALERIA_ALBUM_RONDA`, con la nota del estudio y el enlace personal) a los clientes de un álbum que
 * tienen el enlace vigente y un correo cargado, cuando el estudio abre una ronda nueva. La acción lo llama con `after()`.
 * Topes: como mucho 30 clientes (el máximo de la galería), de a uno, y se corta al llegar al tope diario de correos
 * automáticos. Nunca lanza; cada resultado queda en el historial de la galería (`CORREO_ENVIADO` / `CORREO_NO_ENVIADO`).
 */
export async function avisarRondaNueva(
  workspaceId: string,
  galeriaId: string,
  ronda: number,
  nota: string | null,
  actorUserId: number | null,
  deps: DepsEnlace = {},
): Promise<{ enviados: number; fallidos: number }> {
  let enviados = 0;
  let fallidos = 0;
  try {
    const clientes = await prisma.fotofficeGaleriaCliente.findMany({
      where: { workspaceId, galeriaId, revokedAt: null },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 30,
      select: { id: true, email: true },
    });
    for (const c of clientes) {
      if (!c.email) continue;
      const r = await enviarCorreoEnlace(workspaceId, c.id, actorUserId, { ...deps, correo: { clave: "GALERIA_ALBUM_RONDA", ronda, nota } });
      if (r === "ENVIADO") enviados += 1;
      else fallidos += 1;
      if (r === "TOPE") break;
    }
  } catch (e) {
    console.error("[galerias] falló el aviso de ronda nueva", { codigo: (e as { code?: unknown })?.code ?? "desconocido" });
  }
  return { enviados, fallidos };
}
