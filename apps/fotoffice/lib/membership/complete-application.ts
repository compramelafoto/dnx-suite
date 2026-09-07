import "server-only";
import { prisma } from "@repo/db";
import { PRINTED_CARD_PERIOD } from "./approve";
import { decimalArsToMinor } from "./money";
import { buildMembershipWelcomeEmail } from "./application-emails";
import { issueDigitalCard } from "@/lib/carnet/issue";
import { issuePrepaidPrintedCard } from "@/lib/carnet/prepaid-card";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { MEMBERSHIP_EMAIL_KEYS } from "@/lib/communications/constants";
import { appUrl } from "@/lib/app-url";

/**
 * Cierra el ingreso de un socio cuando termina de pagarlo.
 *
 * Es la mitad que faltaba del circuito. La solicitud quedaba en «aprobada e impaga» para
 * siempre: `COMPLETADA` existía en el enum y no la escribía nadie, así que el sistema nunca
 * sabía que alguien había terminado de asociarse.
 *
 * Se la llama después de acreditar un pago, por cualquier vía —el webhook de Mercado Pago o
 * la carga manual de un cobro en efectivo—, en el mismo lugar donde se liberan las tarjetas
 * impresas pagas. Va acá y no dentro del cobro porque es una regla del alta, no del pago.
 *
 * **Idempotente y silenciosa.** No hace nada si el socio no viene de una solicitud, si todavía
 * queda saldo, o si otra ejecución la cerró primero. Nunca lanza: un pago acreditado es un
 * hecho consumado y no puede deshacerse porque falle un email o la emisión de un carnet.
 */
export async function completeApplicationIfPaid(memberId: string): Promise<{ completed: boolean }> {
  try {
    return await completar(memberId);
  } catch (error) {
    console.error("[fotoffice][alta] no se pudo cerrar el ingreso", {
      memberId,
      detalle: error instanceof Error ? error.message : "error desconocido",
    });
    return { completed: false };
  }
}

async function completar(memberId: string): Promise<{ completed: boolean }> {
  const solicitud = await prisma.membershipApplication.findFirst({
    where: { memberId, status: "APROBADA_IMPAGA" },
    select: { id: true, workspaceId: true, wantsPrintedCard: true },
  });
  if (!solicitud) return { completed: false };

  /*
   * Qué cuenta como "ingreso pagado": exactamente lo que el email de aprobación le dijo que
   * tenía que pagar —las cuotas de ingreso y, si la pidió, la credencial impresa—. Ni las
   * cuotas mensuales que hayan corrido después, que son otra deuda y no deberían demorar el
   * cierre del alta.
   */
  const cargos = await prisma.membershipCharge.findMany({
    where: {
      memberId,
      OR: [{ concept: "INGRESO" }, { concept: "OTRO", period: PRINTED_CARD_PERIOD }],
    },
    select: { balanceArs: true },
  });
  if (cargos.length === 0) return { completed: false };
  const pendiente = cargos.some((c) => decimalArsToMinor(c.balanceArs) > 0);
  if (pendiente) return { completed: false };

  // El `status` en el where es lo que hace idempotente al cierre: si dos acreditaciones
  // llegan juntas, la segunda no encuentra nada que actualizar y no vuelve a avisar.
  const cerradas = await prisma.membershipApplication.updateMany({
    where: { id: solicitud.id, status: "APROBADA_IMPAGA" },
    data: { status: "COMPLETADA" },
  });
  if (cerradas.count === 0) return { completed: false };

  const socio = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      firstName: true,
      email: true,
      memberNumber: true,
      avatarUrl: true,
      userId: true,
    },
  });
  if (!socio) return { completed: true };

  /*
   * El carnet digital se emite acá y no al aprobar.
   *
   * Antes solo existía la emisión en tanda, a mano desde la pantalla de carnets: un socio
   * nuevo se quedaba sin carnet hasta que alguien se acordara de apretar el botón. Emitirlo
   * al pagar —y no al aprobar— es además lo correcto: la credencial acredita a un socio, y
   * hasta que el ingreso no está pago no hay tal cosa.
   *
   * `issueDigitalCard` es idempotente: si por cualquier vía ya tenía uno vigente, no crea otro.
   */
  await issueDigitalCard({ workspaceId: solicitud.workspaceId, memberId });

  /*
   * La credencial impresa que pagó con la inscripción, si ya subió su foto.
   *
   * Cubre el cruce que quedaba abierto: quien sube la foto ANTES de pagar no dispara nada
   * —el cargo todavía tenía saldo— y al pagar tampoco había ninguna tarjeta pendiente que
   * liberar, así que la credencial pagada no se emitía nunca. Los dos órdenes posibles pasan
   * ahora por esta misma función, que es idempotente y no hace nada si falta la foto o si la
   * tarjeta ya está en curso.
   */
  if (solicitud.wantsPrintedCard) {
    await issuePrepaidPrintedCard({ workspaceId: solicitud.workspaceId, memberId });
  }

  if (socio.email) {
    const { organizationName, signature } = await loadWorkspaceEmailContext(solicitud.workspaceId);
    const base = appUrl();
    await sendAndLogEmail({
      to: socio.email,
      templateKey: MEMBERSHIP_EMAIL_KEYS.WELCOME,
      userId: socio.userId,
      body: buildMembershipWelcomeEmail({
        firstName: socio.firstName,
        institution: organizationName,
        memberNumber: socio.memberNumber,
        cardUrl: `${base}/portal/carnet`,
        // La credencial impresa se emite recién cuando llega la foto: si la pagó y no la
        // subió, este es el mejor momento para pedírsela.
        needsPhotoForPrintedCard: solicitud.wantsPrintedCard && !socio.avatarUrl,
        hasAccount: socio.userId !== null,
        signature,
      }),
    });
  }

  return { completed: true };
}
