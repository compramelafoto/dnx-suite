import "server-only";

import { prisma } from "@repo/db";
import { Resend } from "resend";
import type { Aviso } from "./calendario";
import { textoDelAviso, type DatosDelAviso } from "./textos";
import { compuertaDeEnvio, direccionDeSalida, remitente } from "./transporte";

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
 * **Nada sale hasta que alguien lo enciende**, y hacen falta dos llaves distintas: la clave
 * de Resend y el interruptor propio del producto. Eso es lo que evita escribirle a gente
 * de verdad antes de tiempo, o porque alguien copió las variables de otro proyecto.
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

  const compuerta = compuertaDeEnvio();

  if (!compuerta.puede) {
    // No es un error: es la compuerta diciendo que todavía no se manda de verdad. Queda
    // anotado para poder revisar qué se habría mandado.
    await anotar("DRY_RUN", { error: compuerta.motivo });
    return { estado: "seco", motivo: compuerta.motivo };
  }

  /*
    El remitente lleva **el nombre del vendedor** sobre nuestra dirección. La dirección
    tiene que ser de un dominio verificado, pero el nombre que ve el cliente es el de quien
    le vendió el servicio: es la misma promesa de marca blanca que cumple el texto.
  */
  const from = remitente(entrada.datos.vendedor, direccionDeSalida());

  /*
    La clave de idempotencia se la damos nosotros. Resend descarta el mismo envío repetido
    durante 24 horas, así que si algo reintenta entre que mandamos y anotamos, el cliente
    no recibe dos copias. Es la segunda red después de la restricción de la base.
  */
  const { data, error } = await new Resend(compuerta.apiKey).emails.send(
    {
      from,
      to: [entrada.para],
      subject: correo.asunto,
      text: correo.texto,
    },
    { idempotencyKey: `slf-${entrada.aviso}/${entrada.eventoId}` },
  );

  // El SDK de Resend no lanza: devuelve el error. Un try/catch acá no vería nada.
  if (error) {
    await anotar("FAILED", { error: error.message });
    return { estado: "fallo", detalle: error.message };
  }

  await anotar("SENT", { providerId: data?.id });
  return { estado: "enviado" };
}
