import "server-only";

import { Resend } from "resend";
import { prisma } from "@repo/db";
import { compuertaDeEnvio, direccionDeSalida } from "@/lib/correos/transporte";
import { correoParaElTitular, correoParaQuienPide } from "./aviso-arrepentimiento";
import { EMAIL_LEGAL } from "./contenido";
import type { DatosDelAvisoLegal } from "./aviso-arrepentimiento";

/**
 * Manda la constancia a quien pidió y el aviso al titular.
 *
 * **Nunca rompe la solicitud.** Si el correo falla, el pedido ya está guardado y la
 * constancia ya se mostró en pantalla: perder el correo es molesto, perder la solicitud
 * sería negarle un derecho a alguien por un problema de infraestructura.
 *
 * Por eso tampoco se hace esperar a quien está mirando la pantalla: se llama después de
 * responder.
 */
export async function enviarConstancia(id: string, datos: DatosDelAvisoLegal): Promise<void> {
  const anotar = (campos: { noticeSentAt?: Date; noticeError?: string }) =>
    prisma.subilafotoRetractionRequest
      .update({ where: { id }, data: { noticeError: null, ...campos } })
      .catch(() => null);

  const compuerta = compuertaDeEnvio();
  if (!compuerta.puede) {
    // Queda anotado el motivo: sin esto, "no se envió" y "no se pudo enviar" se ven igual.
    await anotar({ noticeError: `No se envió — ${compuerta.motivo}` });
    return;
  }

  const resend = new Resend(compuerta.apiKey);
  const desde = `SubiLaFoto <${direccionDeSalida()}>`;

  const aQuienPide = correoParaQuienPide(datos);
  const { error } = await resend.emails.send(
    {
      from: desde,
      to: [datos.email],
      subject: aQuienPide.asunto,
      text: aQuienPide.texto,
      // Contestar el correo tiene que llegar a una persona, no al buzón de salida.
      replyTo: EMAIL_LEGAL,
    },
    { idempotencyKey: `slf-constancia/${id}` },
  );

  if (error) {
    await anotar({ noticeError: error.message.slice(0, 400) });
  } else {
    await anotar({ noticeSentAt: new Date() });
  }

  /*
    El aviso al titular va después y no se anota en la fila: lo que la norma pide registrar
    es la constancia a quien pidió. Si este falla, el pedido igual aparece en el panel.
  */
  const alTitular = correoParaElTitular(datos);
  await resend.emails
    .send(
      { from: desde, to: [EMAIL_LEGAL], subject: alTitular.asunto, text: alTitular.texto },
      { idempotencyKey: `slf-constancia-titular/${id}` },
    )
    .catch(() => null);
}
