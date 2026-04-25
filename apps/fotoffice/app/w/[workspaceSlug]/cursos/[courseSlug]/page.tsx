import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { formatMoney } from "@/lib/format";
import { computeAvailableSpots, getApprovedEnrollmentCountsByInstanceIds } from "@/lib/presential-courses/availability";
import { PublicCourseEnrollmentForm } from "@/components/presential-courses/public-course-enrollment-form";

type Props = { params: Promise<{ workspaceSlug: string; courseSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceSlug, courseSlug } = await params;
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
  });
  if (!branding) return { title: "Curso | Fotoffice" };
  const presentialCourse = await prisma.course.findFirst({
    where: {
      workspaceId: branding.workspaceId,
      slug: courseSlug,
      status: { in: ["PUBLISHED", "UPCOMING"] },
    },
    select: {
      title: true,
      shortDescription: true,
      longDescription: true,
    },
  });
  if (presentialCourse) {
    return {
      title: `${presentialCourse.title} | ${branding.commercialName}`,
      description: presentialCourse.shortDescription ?? presentialCourse.longDescription ?? undefined,
    };
  }
  return { title: "Curso | Fotoffice" };
}

export default async function PublicCourseLandingPage({ params }: Props) {
  const { workspaceSlug, courseSlug } = await params;

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
  });
  if (!branding) notFound();

  const mod = await prisma.workspaceFeatureModule.findUnique({
    where: {
      workspaceId_moduleKey: {
        workspaceId: branding.workspaceId,
        moduleKey: COURSES_SALES_MODULE_KEY,
      },
    },
  });
  if (!mod?.enabled) notFound();

  const presentialCourse = await prisma.course.findFirst({
    where: {
      workspaceId: branding.workspaceId,
      slug: courseSlug,
      status: { in: ["PUBLISHED", "UPCOMING"] },
    },
    include: {
      instances: {
        where: { status: "ACTIVE" },
        orderBy: { startDateTime: "asc" },
      },
    },
  });
  if (!presentialCourse) notFound();
  const approvedCounts = await getApprovedEnrollmentCountsByInstanceIds(
    presentialCourse.instances.map((instance) => instance.id),
  );
  const minPrice = presentialCourse.instances
    .filter((instance) => instance.status === "ACTIVE")
    .map((instance) => Number(instance.priceArs.toString()))
    .sort((a, b) => a - b)[0];
  const faqItems = Array.isArray(presentialCourse.faqJson) ? presentialCourse.faqJson : [];

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="max-w-5xl mx-auto px-4 md:px-8 py-12 md:py-16 space-y-10">
        <header className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--fo-accent)]">
            {presentialCourse.status === "UPCOMING" ? "Próximamente" : "Cursos presenciales"}
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{presentialCourse.title}</h1>
          {presentialCourse.shortDescription ? (
            <p className="text-lg text-[var(--fo-muted)] leading-relaxed max-w-3xl">
              {presentialCourse.shortDescription}
            </p>
          ) : null}
          <p className="text-sm text-[var(--fo-muted)]">
            Instructor: <span className="text-[var(--fo-text)]">{presentialCourse.instructorName ?? "A confirmar"}</span>
            {presentialCourse.level ? ` · Nivel: ${presentialCourse.level}` : ""}
          </p>
        </header>

        {presentialCourse.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={presentialCourse.coverImageUrl}
            alt=""
            className="h-[320px] w-full object-cover rounded-[var(--fo-radius)] border border-[var(--fo-border)]"
          />
        ) : null}

        {presentialCourse.longDescription ? (
          <section className="fo-card">
            <h2 className="text-xl font-semibold mb-3">Página de venta</h2>
            <p className="text-sm text-[var(--fo-muted)] whitespace-pre-line leading-relaxed">
              {presentialCourse.longDescription}
            </p>
          </section>
        ) : null}

        <section className="fo-card space-y-4">
          <h2 className="text-xl font-semibold">Ediciones activas</h2>
          {presentialCourse.instances.length === 0 ? (
            <p className="text-sm text-[var(--fo-muted)]">No hay ediciones activas cargadas todavía.</p>
          ) : (
            <ul className="space-y-3">
              {presentialCourse.instances.map((instance) => {
                const approved = approvedCounts.get(instance.id) ?? 0;
                const availableSpots = computeAvailableSpots(instance.capacity, approved);
                const soldOut = availableSpots <= 0;
                return (
                  <li key={instance.id} className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-4 space-y-1">
                    <p className="font-medium">{instance.title ?? "Edición presencial"}</p>
                    <p className="text-sm text-[var(--fo-muted)]">
                      {new Intl.DateTimeFormat("es-AR", { dateStyle: "long", timeStyle: "short" }).format(instance.startDateTime)}
                    </p>
                    <p className="text-sm text-[var(--fo-muted)]">
                      {instance.locationName}
                      {instance.locationAddress ? ` · ${instance.locationAddress}` : ""}
                    </p>
                    <p className="text-sm text-[var(--fo-muted)]">
                      {formatMoney(instance.priceArs, "ARS")} · Cupos disponibles: {availableSpots}
                    </p>
                    {presentialCourse.status === "PUBLISHED" ? (
                      soldOut ? (
                        <p className="text-sm font-medium text-[var(--fo-danger)]">Sin cupos disponibles</p>
                      ) : (
                        <details className="pt-2">
                          <summary className="cursor-pointer text-sm text-[var(--fo-accent)]">Inscribirme</summary>
                          <div className="pt-3">
                            <PublicCourseEnrollmentForm
                              workspaceSlug={workspaceSlug}
                              courseSlug={courseSlug}
                              instanceOptions={[
                                {
                                  id: instance.id,
                                  label: instance.title ?? "Edición presencial",
                                  priceArs: instance.priceArs.toString(),
                                  availableSpots,
                                  soldOut: false,
                                  disabled: false,
                                },
                              ]}
                              defaultInstanceId={instance.id}
                            />
                          </div>
                        </details>
                      )
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
          {minPrice != null ? (
            <p className="text-sm text-[var(--fo-muted)]">Precio desde {formatMoney(minPrice, "ARS")}.</p>
          ) : null}
        </section>

        {faqItems.length > 0 ? (
          <section className="fo-card space-y-4">
            <h2 className="text-xl font-semibold">Preguntas frecuentes</h2>
            {faqItems.map((item, idx) => {
              const q = item && typeof item === "object" && "q" in item ? String(item.q) : "";
              const a = item && typeof item === "object" && "a" in item ? String(item.a) : "";
              if (!q || !a) return null;
              return (
                <details key={idx} className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-4">
                  <summary className="cursor-pointer font-medium">{q}</summary>
                  <p className="text-sm text-[var(--fo-muted)] mt-2 whitespace-pre-line">{a}</p>
                </details>
              );
            })}
          </section>
        ) : null}

        <section className="fo-card space-y-4 border-[var(--fo-accent)]/40">
          <h2 className="text-xl font-semibold">Inscripción</h2>
          {presentialCourse.status === "UPCOMING" ? (
            <p className="text-sm text-[var(--fo-muted)]">Próximamente habilitaremos la inscripción para este curso.</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-[var(--fo-muted)]">
                Seleccioná una edición activa y completá el formulario para dejar tu inscripción en estado pendiente.
              </p>
              <button
                type="button"
                disabled
                className="fo-btn fo-btn-primary opacity-60 cursor-not-allowed"
              >
                Continuar al pago próximamente
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
