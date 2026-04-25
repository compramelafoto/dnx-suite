import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { formatMoney } from "@/lib/format";

type Props = { params: Promise<{ workspaceSlug: string }> };

export default async function PublicWorkspaceCoursesPage({ params }: Props) {
  const { workspaceSlug } = await params;
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true, commercialName: true },
  });
  if (!branding) notFound();

  const courses = await prisma.course.findMany({
    where: {
      workspaceId: branding.workspaceId,
      status: { in: ["PUBLISHED", "UPCOMING"] },
    },
    include: {
      instances: {
        where: { status: "ACTIVE" },
        orderBy: { priceArs: "asc" },
        take: 1,
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="max-w-5xl mx-auto px-4 md:px-8 py-12 md:py-16 space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-[var(--fo-accent)]">
            {branding.commercialName}
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Cursos</h1>
        </header>

        {courses.length === 0 ? (
          <section className="fo-card">
            <p className="text-sm text-[var(--fo-muted)]">Todavía no hay cursos publicados.</p>
          </section>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {courses.map((course) => (
              <li key={course.id} className="fo-card space-y-3">
                {course.thumbnailImageUrl || course.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={course.thumbnailImageUrl ?? course.coverImageUrl ?? ""}
                    alt=""
                    className="h-40 w-full object-cover rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)]"
                  />
                ) : null}
                <p className="text-xs uppercase tracking-wide text-[var(--fo-muted-soft)]">
                  {course.status === "UPCOMING" ? "Próximamente" : "Publicado"}
                </p>
                <h2 className="text-lg font-semibold">{course.title}</h2>
                {course.shortDescription ? (
                  <p className="text-sm text-[var(--fo-muted)] line-clamp-3">{course.shortDescription}</p>
                ) : null}
                <p className="text-sm text-[var(--fo-muted)]">
                  {course.instances[0] ? `Desde ${formatMoney(course.instances[0].priceArs, "ARS")}` : "Sin ediciones activas"}
                </p>
                <Link href={`/w/${workspaceSlug}/cursos/${course.slug}`} className="fo-btn fo-btn-secondary text-sm w-fit">
                  Ver curso
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
