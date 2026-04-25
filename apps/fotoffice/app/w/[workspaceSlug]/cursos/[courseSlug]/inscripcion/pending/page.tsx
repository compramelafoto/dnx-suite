import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { CourseEnrollmentPaymentButton } from "@/components/presential-courses/course-enrollment-payment-button";

export default async function CourseEnrollmentPendingPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string; courseSlug: string }>;
  searchParams: Promise<{ enrollmentId?: string }>;
}) {
  const { workspaceSlug, courseSlug } = await params;
  const { enrollmentId } = await searchParams;
  if (!enrollmentId) notFound();

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true, commercialName: true },
  });
  if (!branding) notFound();

  const enrollment = await prisma.courseEnrollment.findFirst({
    where: {
      id: enrollmentId,
      workspaceId: branding.workspaceId,
      course: {
        slug: courseSlug,
      },
    },
    include: {
      course: { select: { title: true, slug: true } },
      courseInstance: {
        select: {
          title: true,
          startDateTime: true,
          endDateTime: true,
          locationName: true,
          locationAddress: true,
          priceArs: true,
        },
      },
    },
  });
  if (!enrollment) notFound();

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <section className="fo-card space-y-5">
          <h1 className="text-2xl font-semibold">Recibimos tu inscripción. Falta confirmar el pago.</h1>
          <p className="text-sm text-[var(--fo-muted)]">
            Guardamos tus datos en estado pendiente. Ya podés continuar al checkout para completar el pago.
          </p>
          <div className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-4 space-y-2 text-sm">
            <p>
              Curso: <span className="text-[var(--fo-text)] font-medium">{enrollment.course.title}</span>
            </p>
            <p>
              Edición:{" "}
              <span className="text-[var(--fo-text)] font-medium">
                {enrollment.courseInstance.title ?? "Edición presencial"}
              </span>
            </p>
            <p>
              Fecha y hora:{" "}
              <span className="text-[var(--fo-text)] font-medium">
                {new Intl.DateTimeFormat("es-AR", {
                  dateStyle: "long",
                  timeStyle: "short",
                }).format(enrollment.courseInstance.startDateTime)}
              </span>
            </p>
            <p>
              Ubicación:{" "}
              <span className="text-[var(--fo-text)] font-medium">
                {enrollment.courseInstance.locationName}
                {enrollment.courseInstance.locationAddress ? ` · ${enrollment.courseInstance.locationAddress}` : ""}
              </span>
            </p>
            <p>
              Monto:{" "}
              <span className="text-[var(--fo-text)] font-medium">
                {new Intl.NumberFormat("es-AR", {
                  style: "currency",
                  currency: "ARS",
                  maximumFractionDigits: 0,
                }).format(Number(enrollment.amountArs.toString()))}
              </span>
            </p>
          </div>
          {enrollment.paymentStatus === "APPROVED" ? (
            <p className="text-sm text-[var(--fo-muted)]">
              Tu pago ya fue aprobado. Podés ingresar a la página de confirmación para ver los datos actualizados.
            </p>
          ) : (
            <CourseEnrollmentPaymentButton
              enrollmentId={enrollment.id}
              workspaceSlug={workspaceSlug}
              courseSlug={courseSlug}
            />
          )}
          <Link href={`/w/${workspaceSlug}/cursos/${courseSlug}`} className="fo-btn fo-btn-secondary text-sm w-fit">
            Volver al curso
          </Link>
        </section>
      </main>
    </div>
  );
}
