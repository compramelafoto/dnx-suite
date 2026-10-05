import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { CourseEditorForm } from "@/components/presential-courses/course-editor-form";
import { CourseInstanceForm } from "@/components/presential-courses/course-instance-form";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";
import { CourseInstanceEditForm } from "@/components/presential-courses/course-instance-edit-form";
import { formatMoney } from "@/lib/format";
import {
  getCourseForEdit,
  getCourseInstancesWithAvailability,
} from "@/app/actions/presential-courses";
import { prisma } from "@repo/db";
import { CourseLessonsSection } from "@/components/presential-courses/course-lessons-section";
import { explicarConfiguracionFaltante, readStreamConfig } from "@/lib/courses-video/config";
import { esGrabado } from "@/lib/presential-courses/delivery-mode";
import { cargarBeneficiarios, cargarDueno } from "@/lib/course-marketplace/cargar";
import { estadoDeVenta } from "@/lib/course-marketplace/beneficiarios";
import { BeneficiariosEditor } from "@/components/course-marketplace/beneficiarios-editor";

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

  // Un curso grabado no tiene ediciones: tiene clases. Se consulta una cosa o la otra.
  const grabado = esGrabado(course.deliveryMode);
  const instances = grabado ? [] : await getCourseInstancesWithAvailability(course.id);
  const clases = grabado
    ? await prisma.courseLesson.findMany({
        where: { courseId: course.id },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          sortOrder: true,
          durationSeconds: true,
          videoStatus: true,
          isPreview: true,
        },
      })
    : [];
  const configVideo = readStreamConfig();
  const [beneficiarios, dueno, feeBps] = grabado
    ? await Promise.all([
        cargarBeneficiarios(course.id),
        cargarDueno(course.workspaceId),
        getPlatformFeeBps(course.workspaceId, COURSES_SALES_MODULE_KEY),
      ])
    : [[], null, 500];
  const estado = dueno ? estadoDeVenta(dueno.workspaceId, beneficiarios) : null;

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
          deliveryMode: course.deliveryMode,
          priceArs: course.priceArs?.toString() ?? null,
          accessMonths: course.accessMonths,
          completionPercent: course.completionPercent,
          freeForMembers: course.freeForMembers,
          faqJson: course.faqJson,
          classroomLink: course.classroomLink,
          classroomCode: course.classroomCode,
          classroomInstructions: course.classroomInstructions,
        }}
      />

      {grabado ? (
        <CourseLessonsSection
          courseId={course.id}
          clases={clases}
          faltaConfigurarVideo={
            configVideo.ok ? null : explicarConfiguracionFaltante(configVideo.missing)
          }
        />
      ) : (
      <section className="fo-card space-y-6">
        <h2 className="text-lg font-semibold">Ediciones</h2>
        <CourseInstanceForm
          courseId={course.id}
          platformFeeBps={await getPlatformFeeBps(course.workspaceId, COURSES_SALES_MODULE_KEY)}
        />
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
      )}

      {grabado && dueno ? (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">Beneficiarios y reparto</h2>
          {estado?.tipo === "CON_REPARTO" ? (
            <div className="fo-card text-sm">
              <p className="font-medium">
                {estado.listo
                  ? "Todos aceptaron. Se va a poder vender cuando Mercado Pago habilite el reparto automático."
                  : "Para vender con reparto falta:"}
              </p>
              {!estado.listo ? (
                <ul className="list-disc pl-5">
                  {estado.faltantes.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
          <BeneficiariosEditor
            courseId={course.id}
            dueno={dueno}
            listaCentavos={Math.round(Number(course.priceArs ?? 0) * 100)}
            comisionPlataformaBps={feeBps}
            iniciales={beneficiarios}
          />
        </section>
      ) : null}
    </div>
  );
}
