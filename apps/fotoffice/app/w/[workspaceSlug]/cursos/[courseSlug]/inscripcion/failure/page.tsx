import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { CourseEnrollmentPaymentButton } from "@/components/presential-courses/course-enrollment-payment-button";

export default async function CourseEnrollmentFailurePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string; courseSlug: string }>;
  searchParams: Promise<{ enrollmentId?: string }>;
}) {
  const { workspaceSlug, courseSlug } = await params;
  const { enrollmentId } = await searchParams;
  const enrollmentIdValue = enrollmentId?.trim();
  if (!enrollmentIdValue) notFound();

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true },
  });
  if (!branding) notFound();

  const enrollment = await prisma.courseEnrollment.findFirst({
    where: {
      id: enrollmentIdValue,
      workspaceId: branding.workspaceId,
      course: { slug: courseSlug },
    },
    include: {
      course: { select: { title: true } },
      courseInstance: { select: { title: true } },
    },
  });
  if (!enrollment) notFound();

  const canRetry =
    enrollment.paymentStatus === "PENDING" ||
    enrollment.paymentStatus === "REJECTED" ||
    enrollment.paymentStatus === "CANCELLED";

  const statusLabel =
    enrollment.paymentStatus === "REJECTED"
      ? "Rechazado"
      : enrollment.paymentStatus === "CANCELLED"
        ? "Cancelado"
        : enrollment.paymentStatus === "APPROVED"
          ? "Aprobado"
          : "Pendiente";

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <section className="fo-card space-y-4">
          <h1 className="text-2xl font-semibold">Tu pago no pudo confirmarse</h1>
          <p className="text-sm text-[var(--fo-muted)]">
            Estado actual: <strong className="text-[var(--fo-text)]">{statusLabel}</strong>.
          </p>
          <p className="text-sm text-[var(--fo-muted)]">
            Si el problema continúa, comunicate con el docente.
          </p>
          {canRetry ? (
            <CourseEnrollmentPaymentButton
              enrollmentId={enrollment.id}
              workspaceSlug={workspaceSlug}
              courseSlug={courseSlug}
              label="Intentar pagar nuevamente"
            />
          ) : null}
          <Link href={`/w/${workspaceSlug}/cursos/${courseSlug}`} className="fo-btn fo-btn-secondary text-sm w-fit">
            Volver al curso
          </Link>
        </section>
      </main>
    </div>
  );
}
