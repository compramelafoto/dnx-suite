import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { CourseEditorForm } from "@/components/presential-courses/course-editor-form";
import { CourseInstanceForm } from "@/components/presential-courses/course-instance-form";
import { CourseInstanceEditForm } from "@/components/presential-courses/course-instance-edit-form";
import { formatMoney } from "@/lib/format";
import {
  getCourseForEdit,
  getCourseInstancesWithAvailability,
} from "@/app/actions/presential-courses";

export default async function DashboardCourseDetailPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  let course: Awaited<ReturnType<typeof getCourseForEdit>> | null = null;
  try {
    course = await getCourseForEdit(courseId);
  } catch {
    notFound();
  }
  if (!course) notFound();
  const instances = await getCourseInstancesWithAvailability(course.id);

  return (
    <div className="space-y-10">
      <PageHeader
        title="Editar curso"
        description="Información general, Página de venta, Preguntas frecuentes, Acceso al aula y Ediciones."
        actions={
          <Link href="/dashboard/courses" className="fo-btn fo-btn-secondary text-sm">
            Volver al listado
          </Link>
        }
      />

      <CourseEditorForm
        mode="edit"
        initial={{
          id: course.id,
          title: course.title,
          slug: course.slug,
          shortDescription: course.shortDescription,
          longDescription: course.longDescription,
          coverImageUrl: course.coverImageUrl,
          thumbnailImageUrl: course.thumbnailImageUrl,
          instructorName: course.instructorName,
          level: course.level,
          status: course.status,
          faqJson: course.faqJson,
          classroomLink: course.classroomLink,
          classroomCode: course.classroomCode,
          classroomInstructions: course.classroomInstructions,
        }}
      />

      <section className="fo-card space-y-6">
        <h2 className="text-lg font-semibold">Ediciones</h2>
        <CourseInstanceForm courseId={course.id} />
        {instances.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Este curso todavía no tiene ediciones.</p>
        ) : (
          <ul className="space-y-3">
            {instances.map((instance) => (
              <li key={instance.id} className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-4">
                <p className="font-medium">{instance.title ?? "Edición presencial"}</p>
                <p className="text-sm text-[var(--fo-muted)]">
                  {new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(instance.startDateTime)} -{" "}
                  {new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(instance.endDateTime)}
                </p>
                <p className="text-sm text-[var(--fo-muted)]">
                  {instance.locationName}
                  {instance.locationAddress ? ` · ${instance.locationAddress}` : ""}
                </p>
                <p className="text-sm text-[var(--fo-muted)]">
                  {formatMoney(instance.priceArs, "ARS")} · Cupos disponibles: {instance.availableSpots}/{instance.capacity}
                </p>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-[var(--fo-accent)]">Editar edición</summary>
                  <div className="mt-3">
                    <CourseInstanceEditForm
                      courseId={course.id}
                      instance={{
                        id: instance.id,
                        title: instance.title,
                        startDateTime: instance.startDateTime,
                        endDateTime: instance.endDateTime,
                        locationName: instance.locationName,
                        locationAddress: instance.locationAddress,
                        priceArs: instance.priceArs.toString(),
                        capacity: instance.capacity,
                        status: instance.status,
                      }}
                    />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
