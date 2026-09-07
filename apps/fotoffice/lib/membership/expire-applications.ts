import "server-only";
import { prisma } from "@repo/db";
import { revokeMemberInvitation, updateMember } from "@repo/db/fotoffice-members";
import { PRINTED_CARD_PERIOD } from "./approve";
import { applicationDeadlineStage, APPLICATION_REMINDER_DAYS, daysUntil } from "./application-lifecycle";
import { buildApplicationExpiredEmail, buildApplicationReminderEmail } from "./application-emails";
import { completeApplicationIfPaid } from "./complete-application";
import { fechaLegible } from "./charge-labels";
import { decimalArsToMinor, formatMinorArs } from "./money";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { MEMBERSHIP_EMAIL_KEYS } from "@/lib/communications/constants";
import { inviteOneMember } from "@/lib/members/invite-member";
import { appUrl } from "@/lib/app-url";

/**
 * Los plazos de las solicitudes aprobadas e impagas, aplicados.
 *
 * Al aprobar, la persona queda con 30 días para pagar su ingreso. Hasta ahora esa fecha se
 * guardaba y no la leía nadie: quien no pagaba quedaba como socio activo con deuda para
 * siempre, y quien se olvidaba no recibía ningún recordatorio.
 *
 * Corre una vez por día. Hace dos cosas: **recordar** a quien entra en la última semana y
 * **vencer** a quien se le cumplió el plazo.
 *
 * Nada de esto se hace en lote a ciegas: cada solicitud se resuelve por separado y un fallo no
 * corta el resto. Lo que se pierde en una corrida se retoma en la siguiente, porque el
 * disparador —la solicitud en «aprobada e impaga»— sigue ahí hasta que el ciclo se completa.
 */

export type DeadlineReport = {
  revisadas: number;
  /** Las que estaban pagas y nadie había cerrado. */
  completadas: number;
  recordadas: number;
  vencidas: number;
  /** Vencidas que NO se tocaron porque hay dinero de por medio. */
  derivadas: number;
  fallidas: number;
};

const LOTE_MAX = 500;
const DIA_MS = 24 * 60 * 60 * 1000;

export async function processApplicationDeadlines(now = new Date()): Promise<DeadlineReport> {
  const reporte: DeadlineReport = {
    revisadas: 0,
    completadas: 0,
    recordadas: 0,
    vencidas: 0,
    derivadas: 0,
    fallidas: 0,
  };

  // Solo las que están en la ventana de interés: las que vencen dentro de la última semana o
  // ya vencieron. Traer todas las aprobadas impagas del mundo para descartarlas en memoria
  // sería pedirle a la base el padrón entero cada mañana.
  const limite = new Date(now.getTime() + APPLICATION_REMINDER_DAYS * DIA_MS);
  const solicitudes = await prisma.membershipApplication.findMany({
    where: {
      status: "APROBADA_IMPAGA",
      memberId: { not: null },
      expiresAt: { not: null, lte: limite },
    },
    orderBy: { expiresAt: "asc" },
    take: LOTE_MAX,
    select: { id: true, workspaceId: true, memberId: true, expiresAt: true },
  });

  for (const solicitud of solicitudes) {
    const memberId = solicitud.memberId;
    if (!memberId) continue;
    reporte.revisadas += 1;

    const etapa = applicationDeadlineStage({ expiresAt: solicitud.expiresAt, now });
    try {
      /*
       * Antes que nada: cerrar las que ya están pagas.
       *
       * El cierre normal viaja pegado a la acreditación del pago, pero eso deja afuera a
       * quien pagó cuando ese cierre todavía no existía —y a cualquiera cuya acreditación se
       * haya interrumpido justo ahí—. Sin esta pasada quedarían para siempre en «aprobada e
       * impaga»: sin carnet, sin bienvenida y apareciendo cada día como pendientes.
       */
      if (await cerrarSiEstaPaga(memberId)) {
        reporte.completadas += 1;
        continue;
      }

      if (etapa === "VENCIDA") {
        const r = await expireApplication({ ...solicitud, memberId }, now);
        if (r === "VENCIDA") reporte.vencidas += 1;
        if (r === "DERIVADA") reporte.derivadas += 1;
      } else if (etapa === "RECORDAR") {
        if (await remindApplication({ ...solicitud, memberId }, now)) reporte.recordadas += 1;
      }
    } catch (error) {
      reporte.fallidas += 1;
      console.error("[fotoffice][alta] no se pudo resolver el plazo de una solicitud", {
        applicationId: solicitud.id,
        etapa,
        detalle: error instanceof Error ? error.message : "error desconocido",
      });
    }
  }

  return reporte;
}

type Solicitud = { id: string; workspaceId: string; memberId: string; expiresAt: Date | null };

/** Cierra el ingreso si ya no debe nada. Devuelve si efectivamente lo cerró. */
async function cerrarSiEstaPaga(memberId: string): Promise<boolean> {
  const r = await completeApplicationIfPaid(memberId);
  return r.completed;
}

/** Lo que se le cobró al ingresar: las cuotas de ingreso y, si la pidió, la credencial. */
const CARGOS_DEL_ALTA = {
  OR: [{ concept: "INGRESO" as const }, { concept: "OTRO" as const, period: PRINTED_CARD_PERIOD }],
};

/**
 * Vence una solicitud que nadie pagó.
 *
 * Los pasos van en un orden pensado para que una interrupción sea recuperable: primero la baja
 * del socio, después el cambio de estado que apaga el disparador, y al final los avisos. Si
 * algo corta en el medio, la solicitud sigue en «aprobada e impaga» y mañana se retoma desde
 * el principio. Al revés —marcar la solicitud primero— dejaría un socio activo que ya nadie
 * volvería a mirar.
 *
 * **Si hubo algún pago imputado, no se toca nada.** Alguien que pagó dos de sus tres cuotas de
 * ingreso no puede quedar dado de baja por una tarea automática: se lo deja para que la
 * Secretaría decida, que es lo que corresponde cuando hay plata de por medio.
 */
async function expireApplication(
  solicitud: Solicitud,
  now: Date,
): Promise<"VENCIDA" | "DERIVADA" | "OMITIDA"> {
  const cargos = await prisma.membershipCharge.findMany({
    where: { memberId: solicitud.memberId, ...CARGOS_DEL_ALTA },
    select: { id: true, balanceArs: true, amountArs: true, _count: { select: { allocations: true } } },
  });

  const huboPago = cargos.some(
    (c) =>
      c._count.allocations > 0 ||
      decimalArsToMinor(c.balanceArs) !== decimalArsToMinor(c.amountArs),
  );
  if (huboPago) {
    // Se repite cada día hasta que alguien la resuelva, y está bien que así sea: la bandeja de
    // solicitudes la muestra con el plazo cumplido, y este es el caso que necesita una persona.
    console.warn("[fotoffice][alta] solicitud vencida con pagos parciales: la resuelve la Secretaría", {
      applicationId: solicitud.id,
    });
    return "DERIVADA";
  }

  const socio = await prisma.member.findUnique({
    where: { id: solicitud.memberId },
    // Sin `updatedAt`: el control de concurrencia optimista es para una pantalla, donde hay
    // alguien que vio un estado y confirmó sobre él. Acá no hay nadie mirando.
    select: { firstName: true, email: true, status: true },
  });
  if (!socio) return "OMITIDA";

  // 1. La baja, con su auditoría, atribuida al sistema y con el motivo escrito. Si ya está
  //    dada de baja, `updateMember` no escribe nada ni inventa un evento repetido.
  if (socio.status !== "INACTIVE") {
    await updateMember(
      solicitud.workspaceId,
      solicitud.memberId,
      { status: "INACTIVE", leftAt: now },
      {
        actor: { userId: null, label: "FotoOffice" },
        action: "STATUS_CHANGED",
        source: "SYSTEM",
        reason: "Ingreso no pagado dentro del plazo: la solicitud venció",
      },
    );
  }

  /*
   * 2. El estado y los cargos, juntos.
   *
   * Los cargos se borran, no se dejan en cero: ponerles saldo cero los haría figurar como
   * pagados, y dejarlos con saldo dejaría a alguien que nunca llegó a ser socio arrastrando
   * una deuda para siempre en los reportes de morosidad. Se borran solo porque acá ya está
   * verificado que ninguno recibió un peso.
   */
  const cerradas = await prisma.$transaction(async (tx) => {
    const r = await tx.membershipApplication.updateMany({
      where: { id: solicitud.id, status: "APROBADA_IMPAGA" },
      data: { status: "VENCIDA" },
    });
    if (r.count === 0) return 0;
    /*
     * Se borran también las cuotas mensuales que le hayan corrido mientras tanto.
     *
     * La generación mensual no distingue entre un socio hecho y derecho y uno que todavía no
     * pagó su ingreso, así que a los pocos días de aprobado ya tiene una cuota del mes. Si el
     * alta queda sin efecto, esa cuota tampoco corresponde: nunca llegó a ser socio. Se borran
     * solo las que nadie tocó —sin imputaciones y con el saldo entero—, cualquier otra deja
     * todo como está y lo mira una persona.
     */
    const impagos = await tx.membershipCharge.findMany({
      where: { memberId: solicitud.memberId },
      select: { id: true, amountArs: true, balanceArs: true, _count: { select: { allocations: true } } },
    });
    const borrables = impagos
      .filter(
        (c) =>
          c._count.allocations === 0 &&
          decimalArsToMinor(c.balanceArs) === decimalArsToMinor(c.amountArs),
      )
      .map((c) => c.id);
    await tx.membershipCharge.deleteMany({ where: { id: { in: borrables } } });
    return r.count;
  });
  // Otra corrida —o un pago que entró justo— la resolvió primero.
  if (cerradas === 0) return "OMITIDA";

  // 3. El enlace de acceso que le habíamos dado ya no corresponde.
  await revocarInvitacionPendiente(solicitud.workspaceId, solicitud.memberId);

  // 4. El aviso. Es lo último: si el proveedor de correo está caído, todo lo anterior ya es
  //    cierto y no puede deshacerse.
  if (socio.email) {
    const { organizationName, signature } = await loadWorkspaceEmailContext(solicitud.workspaceId);
    await sendAndLogEmail({
      to: socio.email,
      templateKey: MEMBERSHIP_EMAIL_KEYS.EXPIRED,
      body: buildApplicationExpiredEmail({
        firstName: socio.firstName,
        institution: organizationName,
        applyUrl: await urlDelFormulario(solicitud.workspaceId),
        signature,
      }),
    });
  }

  return "VENCIDA";
}

/**
 * Recordatorio de la última semana.
 *
 * A quien todavía no activó su cuenta se le manda un **enlace nuevo**, no el mismo aviso: el
 * de la aprobación dura 14 días y para cuando toca recordar ya venció siempre. Ese es el
 * motivo por el que este recordatorio existe como algo más que un texto.
 */
async function remindApplication(solicitud: Solicitud, now: Date): Promise<boolean> {
  const socio = await prisma.member.findUnique({
    where: { id: solicitud.memberId },
    select: { firstName: true, email: true, userId: true, status: true },
  });
  if (!socio?.email || socio.status !== "ACTIVE") return false;

  const cargos = await prisma.membershipCharge.findMany({
    where: { memberId: solicitud.memberId, ...CARGOS_DEL_ALTA },
    select: { balanceArs: true },
  });
  const pendienteMinor = cargos.reduce((t, c) => t + decimalArsToMinor(c.balanceArs), 0);
  // Sin saldo no hay nada que recordar: el cierre del alta lo resuelve la acreditación.
  if (pendienteMinor <= 0) return false;

  const { organizationName, signature } = await loadWorkspaceEmailContext(solicitud.workspaceId);
  const comun = {
    firstName: socio.firstName,
    institution: organizationName,
    totalLabel: formatMinorArs(pendienteMinor),
    daysLeft: daysUntil(solicitud.expiresAt ?? now, now),
    deadlineLabel: solicitud.expiresAt ? fechaLegible(solicitud.expiresAt) : "",
    signature,
  };

  if (socio.userId !== null) {
    const base = appUrl();
    if (!base) return false;
    const salida = await sendAndLogEmail({
      to: socio.email,
      templateKey: MEMBERSHIP_EMAIL_KEYS.REMINDER,
      userId: socio.userId,
      body: buildApplicationReminderEmail({
        ...comun,
        access: { kind: "PORTAL", url: `${base}/portal/cuotas` },
      }),
    });
    return salida.status === "SENT";
  }

  const invitacion = await inviteOneMember(
    { id: solicitud.workspaceId },
    { kind: "SYSTEM", label: "FotoOffice" },
    solicitud.memberId,
    {
      buildBody: ({ invitationUrl }) =>
        buildApplicationReminderEmail({
          ...comun,
          access: { kind: "INVITACION", url: invitationUrl },
        }),
    },
  );
  return Boolean(invitacion.ok);
}

async function revocarInvitacionPendiente(workspaceId: string, memberId: string): Promise<void> {
  const pendiente = await prisma.memberInvitation.findFirst({
    where: { workspaceId, memberId, acceptedAt: null, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (!pendiente) return;

  await revokeMemberInvitation(
    workspaceId,
    memberId,
    pendiente.id,
    { userId: null, label: "FotoOffice" },
    { source: "SYSTEM", reason: "La solicitud venció sin pago: el acceso queda sin efecto" },
  );
}

/** Dirección pública del formulario, para ofrecerle volver a intentarlo. */
async function urlDelFormulario(workspaceId: string): Promise<string | null> {
  const base = appUrl();
  if (!base) return null;
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId },
    select: { publicSlug: true },
  });
  return branding?.publicSlug ? `${base}/w/${branding.publicSlug}/asociarse` : null;
}
