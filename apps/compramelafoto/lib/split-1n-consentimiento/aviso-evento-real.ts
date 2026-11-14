import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { avisarCobroDivididoAlSumarse, type ResultadoAviso } from "./aviso-evento";

/** Aviso con la base de CLF y Resend. Se llama después de que el fotógrafo quedó ACTIVO en el evento. */
export async function avisarCobroDivididoAlSumarseEnEvento(params: {
  eventId: number;
  userId: number;
}): Promise<ResultadoAviso> {
  const resultado = await avisarCobroDivididoAlSumarse(params, {
    buscarFotografo: (userId) =>
      prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true } }),
    async buscarEvento(eventId) {
      const e = await prisma.event.findUnique({
        where: { id: eventId },
        select: { title: true, creator: { select: { name: true } } },
      });
      return e ? { title: e.title, organizador: e.creator?.name ?? null } : null;
    },
    async tieneCobroDivididoActivo(userId) {
      const fila = await prisma.dnxSplitConsent.findFirst({
        where: {
          provider: "MERCADOPAGO",
          environment: "PRODUCTION",
          status: "ACTIVE",
          recipient: { userId },
        },
        select: { id: true },
      });
      return fila != null;
    },
    enviar: (correo) => sendEmail(correo),
  });
  if (resultado !== "evento_sin_aviso") {
    console.info("[aviso-cobro-dividido]", { ...params, resultado });
  }
  return resultado;
}
