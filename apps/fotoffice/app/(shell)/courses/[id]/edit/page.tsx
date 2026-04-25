import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { requireCoursesSalesContext } from "@/lib/workspace";
import { PageHeader } from "@/components/page-header";
import { CourseFormWizard, type CourseWizardInitial } from "@/components/course-form-wizard";
import { decimalToString } from "@/lib/format";
import { parseFaqFromLandingBlocks } from "@/lib/courses-sales/landing-json";

export default async function EditCoursePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { workspace } = await requireCoursesSalesContext();

  const course = await prisma.courseSalesCourse.findFirst({
    where: { id, workspaceId: workspace.id },
    include: {
      sections: {
        orderBy: { sortOrder: "asc" },
        include: {
          lessons: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!course) notFound();

  const teachers = await prisma.courseSalesTeacher.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { fullName: "asc" },
    select: { id: true, fullName: true },
  });

  const initial: CourseWizardInitial = {
    id: course.id,
    title: course.title,
    subtitle: course.subtitle,
    slug: course.slug,
    teacherId: course.teacherId,
    shortDescription: course.shortDescription,
    longDescription: course.longDescription,
    modality: course.modality,
    level: course.level,
    category: course.category,
    targetAudience: course.targetAudience,
    prerequisites: course.prerequisites,
    objectives: course.objectives,
    durationText: course.durationText,
    scheduleText: course.scheduleText,
    startDate: course.startDate,
    endDate: course.endDate,
    seats: course.seats,
    price: decimalToString(course.price),
    currency: course.currency,
    discountPrice: course.discountPrice ? decimalToString(course.discountPrice) : null,
    includesCertificate: course.includesCertificate,
    includesRecordings: course.includesRecordings,
    includesDownloadables: course.includesDownloadables,
    coverImageUrl: course.coverImageUrl,
    galleryImages: course.galleryImages,
    status: course.status,
    seoTitle: course.seoTitle,
    seoDescription: course.seoDescription,
    sections: course.sections.map((s) => ({
      title: s.title,
      lessons: s.lessons.map((l) => ({ title: l.title, summary: l.summary })),
    })),
    faq: parseFaqFromLandingBlocks(course.landingBlocksJson),
  };

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { workspaceId: workspace.id },
    select: { publicSlug: true },
  });

  return (
    <div className="space-y-10">
      <PageHeader
        title={`Editar curso`}
        description={course.title}
        actions={
          <div className="flex flex-wrap gap-2">
            {branding && course.status === "PUBLISHED" ? (
              <Link
                href={`/w/${branding.publicSlug}/cursos/${course.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="fo-btn fo-btn-secondary text-sm"
              >
                Ver landing
              </Link>
            ) : null}
            <Link href="/courses" className="fo-btn fo-btn-ghost text-sm">
              Volver al listado
            </Link>
          </div>
        }
      />
      {sp.created === "1" ? (
        <p className="text-sm text-[var(--fo-success)]" role="status">
          Curso creado. Revisá el programa y publicá cuando esté listo.
        </p>
      ) : null}
      <CourseFormWizard mode="edit" teachers={teachers} initial={initial} />
    </div>
  );
}
