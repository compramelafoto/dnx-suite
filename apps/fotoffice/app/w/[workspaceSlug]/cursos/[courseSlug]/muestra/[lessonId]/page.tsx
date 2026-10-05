// app/w/[workspaceSlug]/cursos/[courseSlug]/muestra/[lessonId]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { buscarAcuerdoDeVitrina } from "@/lib/course-marketplace/vitrina";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import {
  DURACION_PERMISO_SEGUNDOS,
  playbackIframeUrl,
  signPlaybackToken,
  StreamError,
} from "@/lib/courses-video/stream";
import { LessonPlayer } from "@/components/course-classroom/lesson-player";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string; courseSlug: string; lessonId: string }> };

/**
 * Una clase marcada como muestra: se ve sin pagar. Sin marca de agua (no hay alumno que
 * identificar) y sin avance. Sólo clases `isPreview` de cursos grabados publicados.
 */
export default async function MuestraPage({ params }: Props) {
  const { workspaceSlug, courseSlug, lessonId } = await params;
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true },
  });
  if (!branding) notFound();

  const mod = await prisma.workspaceFeatureModule.findUnique({
    where: { workspaceId_moduleKey: { workspaceId: branding.workspaceId, moduleKey: COURSES_SALES_MODULE_KEY } },
  });
  if (!mod?.enabled) notFound();

  const acuerdo = await buscarAcuerdoDeVitrina(branding.workspaceId, courseSlug);
  const leccion = await prisma.courseLesson.findFirst({
    where: {
      id: lessonId,
      isPreview: true,
      videoStatus: "READY",
      videoUid: { not: null },
      course: {
        slug: courseSlug,
        status: "PUBLISHED",
        deliveryMode: "RECORDED",
        OR: [{ workspaceId: branding.workspaceId }, ...(acuerdo ? [{ id: acuerdo.courseId }] : [])],
      },
    },
    select: { title: true, description: true, videoUid: true, course: { select: { title: true } } },
  });
  if (!leccion?.videoUid) notFound();

  let iframeUrl: string | null = null;
  try {
    iframeUrl = playbackIframeUrl(
      signPlaybackToken({ videoUid: leccion.videoUid, ttlSeconds: DURACION_PERMISO_SEGUNDOS }),
    );
  } catch (error) {
    if (!(error instanceof StreamError)) throw error;
  }

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8 md:px-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--fo-accent)]">
        Clase de muestra · {leccion.course.title}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">{leccion.title}</h1>
      {iframeUrl ? (
        <LessonPlayer iframeUrl={iframeUrl} marca={null} reporte={null} />
      ) : (
        <div className="fo-card text-sm text-[var(--fo-muted)]">El video no está disponible en este momento.</div>
      )}
      {leccion.description ? (
        <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--fo-muted)]">{leccion.description}</p>
      ) : null}
      <Link href={`/w/${workspaceSlug}/cursos/${courseSlug}`} className="fo-btn fo-btn-primary text-sm">
        Ver el curso completo
      </Link>
    </main>
  );
}
