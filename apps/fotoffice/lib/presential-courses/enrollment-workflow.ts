import { Prisma, prisma } from "@repo/db";
import { logCourseEvent } from "./log";
import { avisarAccesoAlAula } from "@/lib/course-classroom/grant";
import { sendEnrollmentApprovedEmail } from "./email";
import { loadWorkspaceSignature } from "@/lib/communications/load-workspace-signature";
import { computeAvailableSpots, getApprovedEnrollmentCountsByInstanceIds } from "./availability";
import { ganarConsultaPorSistema } from "@/lib/circuitos/eventos";
import { marcarClienteDeConsultaGanada } from "@/lib/contactos/perfil";
import { numerarConsultaNueva } from "@/lib/service-leads/numero";

function decimalToNumber(value: Prisma.Decimal) {
  return Number(value.toString());
}

/**
 * Reparte el monto efectivamente acreditado con el porcentaje que la inscripción ya tenía
 * congelado desde que se abrió el pago.
 *
 * **No resuelve la comisión, la aplica.** Hasta el 2026-09-21 la aprobación volvía a
 * buscarla en `coursesFeePercent` —un campo deprecado, con 10% por defecto— mientras que al
 * inscribirse se había calculado con `WorkspaceModuleFee`, que por defecto es 5%. El número
 * cambiaba después de cobrado.
 *
 * El neto se obtiene restando, nunca multiplicando por el complemento: redondear dos veces
 * deja sumas que no cierran contra el total, y eso es plata que aparece o desaparece.
 */
export function recalcularReparto(input: {
  montoCobrado: Prisma.Decimal;
  feePercentCongelado: Prisma.Decimal;
  /**
   * Curso grabado: el 5% va encima de la lista, así que la comisión es un monto ya congelado y
   * no un porcentaje del total cobrado. El neto es lo cobrado menos esa comisión.
   */
  comisionFijaArs?: Prisma.Decimal;
}): { fee: Prisma.Decimal; net: Prisma.Decimal } {
  const fee = input.comisionFijaArs
    ? input.comisionFijaArs.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP)
    : input.montoCobrado
        .mul(input.feePercentCongelado)
        .div(100)
        .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return {
    fee,
    net: input.montoCobrado.minus(fee).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP),
  };
}

export async function approveCourseEnrollment(args: {
  enrollmentId: string;
  paymentRef?: string | null;
  amountArs?: number | null;
  paymentMethodId?: string | null;
}) {
  const enrollment = await prisma.courseEnrollment.findUnique({
    where: { id: args.enrollmentId },
    include: {
      workspace: true,
      course: true,
      courseInstance: true,
    },
  });
  if (!enrollment) return { ok: false, reason: "enrollment_not_found" as const };
  if (enrollment.paymentStatus === "APPROVED") return { ok: true, alreadyApproved: true as const };
  if (enrollment.paymentStatus !== "PENDING") {
    return { ok: false, reason: "enrollment_not_pending" as const };
  }

  // El cupo existe sólo cuando hay edición. Un curso grabado no tiene ediciones ni cupo: se
  // vende tantas veces como quiera el fotógrafo.
  const instancia = enrollment.courseInstance;
  if (instancia) {
    const approvedCounts = await getApprovedEnrollmentCountsByInstanceIds([instancia.id]);
    const approvedCount = approvedCounts.get(instancia.id) ?? 0;
    const availableSpots = computeAvailableSpots(instancia.capacity, approvedCount);
    if (availableSpots <= 0) {
      logCourseEvent("payment_approved_conflict_no_spots", {
        enrollmentId: enrollment.id,
        workspaceId: enrollment.workspaceId,
        courseId: enrollment.courseId,
        courseInstanceId: instancia.id,
      });
      return { ok: false, reason: "no_spots_available" as const };
    }
  }

  const amount =
    args.amountArs != null
      ? new Prisma.Decimal(args.amountArs.toFixed(2))
      : enrollment.amountArs;
  const { fee, net } = recalcularReparto({
    montoCobrado: amount,
    feePercentCongelado: enrollment.platformFeePercent,
    comisionFijaArs: enrollment.listPriceArs ? enrollment.platformFeeArs : undefined,
  });

  const updateResult = await prisma.courseEnrollment.updateMany({
    where: {
      id: enrollment.id,
      paymentStatus: "PENDING",
    },
    data: {
      paymentStatus: "APPROVED",
      paymentProvider: "MERCADO_PAGO",
      paymentRef: args.paymentRef ?? enrollment.paymentRef,
      amountArs: amount,
      // `platformFeePercent` no se toca: quedó congelado al abrir el pago.
      platformFeeArs: fee,
      netAmountArs: net,
    },
  });
  if (updateResult.count === 0) {
    return { ok: true, alreadyApproved: true as const };
  }

  logCourseEvent("payment_approved", {
    enrollmentId: enrollment.id,
    workspaceId: enrollment.workspaceId,
    paymentRef: args.paymentRef ?? null,
    paymentMethodId: args.paymentMethodId ?? null,
  });

  // Curso grabado: el acceso se da ANTES del CRM. Si algo de lo que sigue fallara, el pago ya
  // está APPROVED y el próximo aviso de Mercado Pago entra como repetido: un acceso que no se
  // creó acá no se crearía nunca. `avisarAccesoAlAula` nunca lanza.
  if (!instancia) {
    logCourseEvent("classroom_access_available", {
      enrollmentId: enrollment.id,
      workspaceId: enrollment.workspaceId,
      courseId: enrollment.courseId,
    });
    await avisarAccesoAlAula({
      enrollmentId: enrollment.id,
      workspaceId: enrollment.workspaceId,
      to: enrollment.email,
      studentName: enrollment.name,
      courseTitle: enrollment.course.title,
    });
  }

  // El CRM es un registro comercial: si falla, la inscripción aprobada, el acceso y el correo
  // siguen su curso.
  try {
    const crmPayload: Prisma.InputJsonValue = {
      source: "CURSO_PRESENCIAL",
      courseId: enrollment.courseId,
      courseTitle: enrollment.course.title,
      courseInstanceId: enrollment.courseInstanceId,
      courseInstanceTitle: instancia?.title ?? null,
      amountArs: decimalToNumber(amount),
      paidAt: new Date().toISOString(),
    };
    const existingContact = await prisma.serviceSalesLead.findFirst({
      where: {
        workspaceId: enrollment.workspaceId,
        OR: [
          { email: enrollment.email },
          { phone: enrollment.whatsapp },
        ],
      },
      orderBy: { createdAt: "desc" },
    });
    if (existingContact) {
      await prisma.serviceSalesLead.update({
        where: { id: existingContact.id },
        data: {
          status: "WON",
          eventType: "CURSO_PRESENCIAL",
          eventSubtype: enrollment.course.slug,
          message: `Inscripción aprobada para ${enrollment.course.title}`,
          metaJson: crmPayload,
        },
      });
      // La consulta quedó ganada: su recorrido de venta abierto también se cierra, para que no
      // siga abierta en el tablero. Nunca lanza ni frena la aprobación.
      const { cerrado } = await ganarConsultaPorSistema(
        enrollment.workspaceId,
        existingContact.id,
        `Inscripción aprobada para ${enrollment.course.title}`,
      );
      // Sin recorrido abierto que cerrar, el motor no pasa el contacto a "Cliente": se hace acá
      // (en su propia transacción; nunca lanza).
      if (!cerrado) await marcarClienteDeConsultaGanada(enrollment.workspaceId, existingContact.id);
      logCourseEvent("crm_contact_updated", {
        workspaceId: enrollment.workspaceId,
        enrollmentId: enrollment.id,
        leadId: existingContact.id,
      });
    } else {
      const creado = await prisma.serviceSalesLead.create({
        select: { id: true, createdAt: true },
        data: {
          workspaceId: enrollment.workspaceId,
          name: enrollment.name,
          email: enrollment.email,
          phone: enrollment.whatsapp,
          eventType: "CURSO_PRESENCIAL",
          eventSubtype: enrollment.course.slug,
          message: `Inscripción aprobada para ${enrollment.course.title}`,
          status: "WON",
          metaJson: crmPayload as Prisma.InputJsonValue,
        },
      });
      // Su número, en una transacción aparte: nunca lanza ni frena la aprobación (si falla, la
      // numera el próximo enganche al abrir Captación).
      await numerarConsultaNueva(enrollment.workspaceId, creado.id, creado.createdAt);
      logCourseEvent("crm_contact_created", {
        workspaceId: enrollment.workspaceId,
        enrollmentId: enrollment.id,
      });
    }
  } catch (error) {
    console.error("[fotoffice_courses] crm_update_failed", {
      enrollmentId: enrollment.id,
      error: error instanceof Error ? error.message : "error",
    });
  }

  // El correo de confirmación cuenta cuándo y dónde es el curso: sin edición no tiene qué
  // decir. El aviso del curso grabado, con el enlace al aula, ya salió arriba.
  if (!instancia) {
    return { ok: true, alreadyApproved: false as const };
  }

  logCourseEvent("classroom_access_available", {
    enrollmentId: enrollment.id,
    workspaceId: enrollment.workspaceId,
    courseId: enrollment.courseId,
  });

  // Firma institucional del workspace. Si el branding no está cargado, el email sale sin
  // firma en vez de fallar: confirmar una inscripción no puede depender de esto.
  const signature = await loadWorkspaceSignature(enrollment.workspaceId);

  try {
    const emailResult = await sendEnrollmentApprovedEmail({
      signature,
      to: enrollment.email,
      studentName: enrollment.name,
      courseTitle: enrollment.course.title,
      instanceLabel: instancia.title ?? "Edición presencial",
      startDateTime: instancia.startDateTime,
      endDateTime: instancia.endDateTime,
      locationName: instancia.locationName,
      locationAddress: instancia.locationAddress,
      classroomLink: enrollment.course.classroomLink,
      classroomCode: enrollment.course.classroomCode,
      classroomInstructions: enrollment.course.classroomInstructions,
    });
    if (!emailResult.sent) {
      console.warn("[fotoffice_courses] enrollment_email_not_sent", {
        enrollmentId: enrollment.id,
        reason: emailResult.reason,
      });
    }
  } catch (error) {
    console.error("[fotoffice_courses] enrollment_email_failed", {
      enrollmentId: enrollment.id,
      error,
    });
  }

  return { ok: true, alreadyApproved: false as const };
}

export async function approveEnrollmentPayment(args: {
  enrollmentId: string;
  paymentRef?: string | null;
  amountArs?: number | null;
}) {
  return approveCourseEnrollment(args);
}
