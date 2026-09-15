import "server-only";

import { prisma } from "@repo/db";
import { createResendProviderFromEnvironment } from "@repo/communications/email/resend-runtime";
import type { Aviso } from "./calendario";
import { textoDelAviso, type DatosDelAviso } from "./textos";

/**
 * Manda un aviso a un cliente, una sola vez.
 *
 * **La fila se crea antes de enviar.** La restricción de unicidad de `(eventId, aviso)` es
 * lo que impide el duplicado: si dos ejecuciones del worker llegan juntas, la segunda
 * choca contra la base y se va. Mirar un registro antes de enviar no alcanza — entre la
 * consulta y el envío entra la otra.
 *
 * Si el envío falla, **la fila queda igual** con el error anotado. Es preferible perder un
 * aviso a mandarlo dos veces: el cliente que recibe cinco correos iguales deja de abrir
 * los que importan.
 *
 * Usa el runtime controlado de `@repo/communications`, que sale en seco mientras no esté
 * habilitado el envío real. Eso es lo que evita escribirle a gente de verdad antes de
 * tiempo.
 */

export type ResultadoDelAviso =
  | { estado: "enviado" }
  | { estado: "seco"; motivo: string }
  | { estado: "ya-enviado" }
  | { estado: "fallo"; detalle: string };

export async function enviarAviso(entrada: {
  eventoId: string;
  aviso: Aviso;
  para: string;
  datos: DatosDelAviso;
}): Promise<ResultadoDelAviso> {
  const correo = textoDelAviso(entrada.datos);

  // La reserva. Si ya existe, la base rechaza y no se manda nada.
  try {
    await prisma.subilafotoEmailSent.create({
      data: {
        eventId: entrada.eventoId,
        aviso: entrada.aviso,
        to: entrada.para,
        status: "QUEUED",
      },
    });
  } catch {
    // El único motivo esperable es la unicidad: otro proceso ya lo tomó.
    return { estado: "ya-enviado" };
  }

  const anotar = (status: string, extra: { providerId?: string; error?: string } = {}) =>
    prisma.subilafotoEmailSent
      .update({
        where: { eventId_aviso: { eventId: entrada.eventoId, aviso: entrada.aviso } },
        data: { status, providerId: extra.providerId ?? null, error: extra.error?.slice(0, 400) },
      })
      .catch(() => null);

  const runtime = createResendProviderFromEnvironment();

  if (!runtime.canLiveSend) {
    // No es un error: es la compuerta del paquete diciendo que todavía no se manda de
    // verdad. Queda anotado para poder revisar qué se habría mandado.
    await anotar("DRY_RUN", { error: runtime.blockMessage });
    return { estado: "seco", motivo: runtime.blockMessage ?? "envío real deshabilitado" };
  }

  try {
    const resultado = await runtime.provider.send({
      to: [{ email: entrada.para }],
      subject: correo.asunto,
      text: correo.texto,
    });

    await anotar("SENT", { providerId: resultado.providerMessageId ?? undefined });
    return { estado: "enviado" };
  } catch (error) {
    const detalle = error instanceof Error ? error.message : "error desconocido";
    await anotar("FAILED", { error: detalle });
    return { estado: "fallo", detalle };
  }
}
