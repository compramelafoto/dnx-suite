import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";

type Props = {
  params: Promise<{ workspaceSlug: string; courseSlug: string }>;
  searchParams: Promise<{ enrollmentId?: string; payment_id?: string; status?: string }>;
};

export default async function CourseEnrollmentSuccessPage({ params, searchParams }: Props) {
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
      course: true,
      courseInstance: true,
      workspace: true,
    },
  });
  if (!enrollment) notFound();

  const approved = enrollment.paymentStatus === "APPROVED";
  const rejected = enrollment.paymentStatus === "REJECTED";
  const cancelled = enrollment.paymentStatus === "CANCELLED";
  const title = approved
    ? "Inscripción confirmada"
    : rejected
      ? "Pago rechazado"
      : cancelled
        ? "Pago cancelado"
        : "Estamos verificando tu pago";

  const statusMessage = approved
    ? "Tu pago fue aprobado y tu inscripción quedó confirmada."
    : rejected
      ? "Mercado Pago rechazó el pago. Podés volver a intentarlo desde la inscripción pendiente."
      : cancelled
        ? "El pago fue cancelado. Podés volver a intentarlo desde la inscripción pendiente."
        : "Recibimos la notificación de éxito del checkout. En breve vas a ver la confirmación final cuando Mercado Pago termine de procesar el estado.";

  const canShowClassroom =
    approved &&
    (enrollment.course.classroomLink || enrollment.course.classroomCode || enrollment.course.classroomInstructions);

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-12 md:py-16">
        <section className="fo-card space-y-5 border-[var(--fo-accent)]/30 bg-[var(--fo-bg-elevated)]">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-[var(--fo-muted)] leading-relaxed">
            Alumno: <strong className="text-[var(--fo-text)]">{enrollment.name}</strong>
            <br />
            Curso: <strong className="text-[var(--fo-text)]">{enrollment.course.title}</strong>
          </p>
          <p className="text-sm text-[var(--fo-muted)]">{statusMessage}</p>
          {canShowClassroom ? (
            <div className="space-y-3 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-4">
              <h2 className="font-semibold">Acceso al aula</h2>
              {enrollment.course.classroomLink ? (
                <p className="text-sm">
                  Link:{" "}
                  <a
                    href={enrollment.course.classroomLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--fo-accent)] underline"
                  >
                    {enrollment.course.classroomLink}
                  </a>
                </p>
              ) : null}
              {enrollment.course.classroomCode ? (
                <p className="text-sm">
                  Código: <strong>{enrollment.course.classroomCode}</strong>
                </p>
              ) : null}
              {enrollment.course.classroomInstructions ? (
                <p className="text-sm text-[var(--fo-muted)] whitespace-pre-line">
                  {enrollment.course.classroomInstructions}
                </p>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Link href={`/w/${workspaceSlug}/cursos/${courseSlug}`} className="fo-btn fo-btn-secondary text-sm">
              Volver al curso
            </Link>
            {!approved ? (
              <Link
                href={`/w/${workspaceSlug}/cursos/${courseSlug}/inscripcion/pending?enrollmentId=${enrollment.id}`}
                className="fo-btn fo-btn-primary text-sm"
              >
                Ver estado de inscripción
              </Link>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
