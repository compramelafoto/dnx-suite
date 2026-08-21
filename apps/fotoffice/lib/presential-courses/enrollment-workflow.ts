import { Prisma, prisma } from "@repo/db";
import { logCourseEvent } from "./log";
import { sendEnrollmentApprovedEmail } from "./email";
import { loadWorkspaceSignature } from "@/lib/communications/load-workspace-signature";
import { computeAvailableSpots, getApprovedEnrollmentCountsByInstanceIds } from "./availability";

function decimalToNumber(value: Prisma.Decimal) {
  return Number(value.toString());
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

  const approvedCounts = await getApprovedEnrollmentCountsByInstanceIds([enrollment.courseInstanceId]);
  const approvedCount = approvedCounts.get(enrollment.courseInstanceId) ?? 0;
  const availableSpots = computeAvailableSpots(enrollment.courseInstance.capacity, approvedCount);
  if (availableSpots <= 0) {
    logCourseEvent("payment_approved_conflict_no_spots", {
      enrollmentId: enrollment.id,
      workspaceId: enrollment.workspaceId,
      courseId: enrollment.courseId,
      courseInstanceId: enrollment.courseInstanceId,
    });
    return { ok: false, reason: "no_spots_available" as const };
  }

  const settings = await prisma.courseSalesWorkspaceSettings.findUnique({
    where: { workspaceId: enrollment.workspaceId },
    select: { coursesFeePercent: true },
  });
  const percent = settings?.coursesFeePercent ?? new Prisma.Decimal(10);
  const amount =
    args.amountArs != null
      ? new Prisma.Decimal(args.amountArs.toFixed(2))
      : enrollment.amountArs;
  const fee = amount.mul(percent).div(100).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  const net = amount.minus(fee).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

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
      platformFeePercent: percent,
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

  const crmPayload: Prisma.InputJsonValue = {
    source: "CURSO_PRESENCIAL",
    courseId: enrollment.courseId,
    courseTitle: enrollment.course.title,
    courseInstanceId: enrollment.courseInstanceId,
    courseInstanceTitle: enrollment.courseInstance.title,
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
    logCourseEvent("crm_contact_updated", {
      workspaceId: enrollment.workspaceId,
      enrollmentId: enrollment.id,
      leadId: existingContact.id,
    });
  } else {
    await prisma.serviceSalesLead.create({
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
    logCourseEvent("crm_contact_created", {
      workspaceId: enrollment.workspaceId,
      enrollmentId: enrollment.id,
    });
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
      instanceLabel: enrollment.courseInstance.title ?? "Edición presencial",
      startDateTime: enrollment.courseInstance.startDateTime,
      endDateTime: enrollment.courseInstance.endDateTime,
      locationName: enrollment.courseInstance.locationName,
      locationAddress: enrollment.courseInstance.locationAddress,
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
