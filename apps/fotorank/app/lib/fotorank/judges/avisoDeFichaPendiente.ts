import { prisma } from "@repo/db";

import { enqueueTransactionalEmail } from "../notifications/outbox";

/**
 * Avisa por correo a quienes revisan que una ficha nueva espera.
 *
 * Existe porque enterarse dependía de que alguien entrara a mirar la cola: dos
 * fotógrafos se postularon el 21/09 y nadie lo supo hasta que se buscó a mano.
 * El atajo en el menú resuelve la mitad —verlo cuando ya estás adentro—; esto
 * resuelve la otra: enterarse sin entrar.
 *
 * Sale cuando la ficha **entra a revisión**, o sea al confirmarse el correo, y
 * no al postularse. Antes de ese paso no hay nada que revisar, y avisar de
 * fichas que quizá nunca se confirmen llenaría la casilla de trabajo
 * inexistente.
 */
export async function avisarFichaPendienteDeRevision(input: {
  email: string;
  nombre: string;
  baseUrl: string;
}): Promise<{ avisados: number }> {
  try {
    const revisores = await prisma.user.findMany({
      where: { globalRole: "SUPER_ADMIN" },
      select: { email: true },
    });

    const destinatarios = revisores
      .map((r) => r.email?.trim())
      .filter((e): e is string => !!e);

    if (destinatarios.length === 0) return { avisados: 0 };

    for (const to of destinatarios) {
      await enqueueTransactionalEmail({
        kind: "JUDGE_SIGNUP_PENDING_REVIEW",
        toEmail: to,
        payload: {
          nombre: input.nombre,
          colaUrl: `${input.baseUrl.replace(/\/+$/, "")}/super-admin/jurados`,
        },
      });
    }

    return { avisados: destinatarios.length };
  } catch (err: unknown) {
    /*
     * El aviso no puede voltear la verificación del correo.
     *
     * Quien se postuló ya hizo su parte: si esto falla, su ficha igual queda
     * en la cola y el atajo del menú la muestra. Lo que se pierde es la
     * comodidad de enterarse sin entrar, no el trámite.
     */
    console.error("FOTORANK AVISO FICHA PENDIENTE ERROR", err);
    return { avisados: 0 };
  }
}
