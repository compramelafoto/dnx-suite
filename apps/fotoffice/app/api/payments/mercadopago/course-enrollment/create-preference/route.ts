import { NextResponse } from "next/server";
import { prisma } from "@repo/db";
import { computeAvailableSpots, getApprovedEnrollmentCountsByInstanceIds } from "@/lib/presential-courses/availability";
import { createMercadoPagoPreference } from "@/lib/presential-courses/mercadopago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      enrollmentId?: string;
      workspaceSlug?: string;
      courseSlug?: string;
    };
    const enrollmentId = body.enrollmentId?.trim();
    if (!enrollmentId) {
      return NextResponse.json({ error: "enrollmentId es obligatorio." }, { status: 400 });
    }

    const enrollment = await prisma.courseEnrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        workspace: { select: { id: true } },
        course: { select: { id: true, slug: true, title: true, status: true, workspaceId: true } },
        courseInstance: {
          select: {
            id: true,
            title: true,
            status: true,
            capacity: true,
            priceArs: true,
          },
        },
      },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "Inscripción no encontrada." }, { status: 404 });
    }
    if (enrollment.paymentStatus !== "PENDING") {
      return NextResponse.json({ error: "La inscripción no está pendiente de pago." }, { status: 400 });
    }
    if (enrollment.course.status !== "PUBLISHED") {
      return NextResponse.json({ error: "El curso no está publicado." }, { status: 400 });
    }
    if (enrollment.courseInstance.status !== "ACTIVE") {
      return NextResponse.json({ error: "La edición ya no está activa." }, { status: 400 });
    }

    if (body.courseSlug && body.courseSlug !== enrollment.course.slug) {
      return NextResponse.json({ error: "courseSlug no coincide con la inscripción." }, { status: 400 });
    }

    if (body.workspaceSlug) {
      const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
        where: { publicSlug: body.workspaceSlug },
        select: { workspaceId: true },
      });
      if (!branding || branding.workspaceId !== enrollment.workspaceId) {
        return NextResponse.json({ error: "workspaceSlug no coincide con la inscripción." }, { status: 400 });
      }
    }

    const approvedCounts = await getApprovedEnrollmentCountsByInstanceIds([enrollment.courseInstanceId]);
    const approvedCount = approvedCounts.get(enrollment.courseInstanceId) ?? 0;
    const availableSpots = computeAvailableSpots(enrollment.courseInstance.capacity, approvedCount);
    if (availableSpots <= 0) {
      return NextResponse.json({ error: "No hay cupos disponibles para esta edición." }, { status: 400 });
    }

    const workspaceBranding = await prisma.fotofficeWorkspaceBranding.findUnique({
      where: { workspaceId: enrollment.workspaceId },
      select: { publicSlug: true },
    });
    const workspaceSlug = body.workspaceSlug || workspaceBranding?.publicSlug;
    if (!workspaceSlug) {
      return NextResponse.json({ error: "No se pudo resolver workspaceSlug." }, { status: 400 });
    }

    const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
    if (!appUrl) {
      return NextResponse.json({ error: "APP_URL no está configurado." }, { status: 500 });
    }

    const courseSlug = enrollment.course.slug;
    const successUrl = `${appUrl}/w/${workspaceSlug}/cursos/${courseSlug}/inscripcion/success?enrollmentId=${enrollment.id}`;
    const failureUrl = `${appUrl}/w/${workspaceSlug}/cursos/${courseSlug}/inscripcion/failure?enrollmentId=${enrollment.id}`;
    const pendingUrl = `${appUrl}/w/${workspaceSlug}/cursos/${courseSlug}/inscripcion/pending?enrollmentId=${enrollment.id}`;
    const notificationUrl = `${appUrl}/api/payments/mercadopago/webhook?enrollmentId=${enrollment.id}`;

    const preference = await createMercadoPagoPreference({
      title: `Inscripción: ${enrollment.course.title}`,
      amountArs: Number(enrollment.amountArs.toString()),
      externalReference: enrollment.id,
      payerEmail: enrollment.email,
      successUrl,
      failureUrl,
      pendingUrl,
      notificationUrl,
      metadata: {
        type: "COURSE_ENROLLMENT",
        enrollmentId: enrollment.id,
        workspaceId: enrollment.workspaceId,
        courseId: enrollment.courseId,
        courseInstanceId: enrollment.courseInstanceId,
      },
    });

    await prisma.courseEnrollment.update({
      where: { id: enrollment.id },
      data: { paymentRef: preference.preferenceId },
    });

    return NextResponse.json(
      {
        enrollmentId: enrollment.id,
        preferenceId: preference.preferenceId,
        initPoint: preference.initPoint,
        sandboxInitPoint: preference.sandboxInitPoint,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[fotoffice_courses] create_preference_error", error);
    return NextResponse.json({ error: "No se pudo crear la preferencia de pago." }, { status: 500 });
  }
}
