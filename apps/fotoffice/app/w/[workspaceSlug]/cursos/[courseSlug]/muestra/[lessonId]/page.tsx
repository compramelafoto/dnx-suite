import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { buscarAcuerdoDeVitrina, existeCursoPropio } from "@/lib/course-marketplace/vitrina";
import { COURSES_SALES_MODULE_KEY } from "@/lib/courses-sales/constants";
import {
  DURACION_PERMISO_SEGUNDOS,
  playbackIframeUrl,
  signPlaybackToken,
  StreamError,
} from "@/lib/courses-video/stream";
import { esCursoGratuito, PROVEEDOR_YOUTUBE, urlDeInsercionDeYoutube } from "@/lib/courses-video/youtube";
import { LessonPlayer } from "@/components/course-classroom/lesson-player";
import { YoutubeLessonPlayer } from "@/components/course-classroom/youtube-lesson-player";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ workspaceSlug: string; courseSlug: string; lessonId: string }> };

/**
 * Una clase que se ve sin pagar: la marcada como muestra de un curso pago, o cualquiera de un
 * curso gratuito. Sin marca de agua (no hay alumno que identificar) y sin avance. Sólo cursos
 * grabados publicados.
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

  const acuerdo = (await existeCursoPropio(branding.workspaceId, courseSlug))
    ? null
    : await buscarAcuerdoDeVitrina(branding.workspaceId, courseSlug);
  const leccion = await prisma.courseLesson.findFirst({
    where: {
      id: lessonId,
      videoStatus: "READY",
      videoUid: { not: null },
      course: {
        slug: courseSlug,
        status: "PUBLISHED",
        deliveryMode: "RECORDED",
        OR: [{ workspaceId: branding.workspaceId }, ...(acuerdo ? [{ id: acuerdo.courseId }] : [])],
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      isPreview: true,
      videoUid: true,
      videoProvider: true,
      course: { select: { id: true, title: true, deliveryMode: true, priceArs: true } },
    },
  });
  if (!leccion?.videoUid) notFound();
  const gratuito = esCursoGratuito(leccion.course);
  if (!gratuito && !leccion.isPreview) notFound();

  // En un curso gratuito se recorre entero desde acá: anterior y siguiente.
  const clases = gratuito
    ? await prisma.courseLesson.findMany({
        where: { courseId: leccion.course.id, videoStatus: "READY", videoUid: { not: null } },
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true },
      })
    : [];
  const indice = clases.findIndex((c) => c.id === leccion.id);
  const anterior = indice > 0 ? clases[indice - 1] : null;
  const siguiente = indice >= 0 ? (clases[indice + 1] ?? null) : null;

  const esYoutube = leccion.videoProvider === PROVEEDOR_YOUTUBE;
  let iframeUrl: string | null = null;
  if (!esYoutube) {
    try {
      iframeUrl = playbackIframeUrl(
        signPlaybackToken({ videoUid: leccion.videoUid, ttlSeconds: DURACION_PERMISO_SEGUNDOS }),
      );
    } catch (error) {
      if (!(error instanceof StreamError)) throw error;
    }
  }
  const base = `/w/${workspaceSlug}/cursos/${courseSlug}`;

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8 md:px-8">
      <p className="text-xs font-semibold uppercase tracking-widest text-[var(--fo-accent)]">
        {gratuito
          ? `Curso gratuito · ${leccion.course.title}${indice >= 0 ? ` · Clase ${indice + 1} de ${clases.length}` : ""}`
          : `Clase de muestra · ${leccion.course.title}`}
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">{leccion.title}</h1>
      {esYoutube ? (
        <YoutubeLessonPlayer src={urlDeInsercionDeYoutube(leccion.videoUid)} titulo={leccion.title} />
      ) : iframeUrl ? (
        <LessonPlayer iframeUrl={iframeUrl} marca={null} reporte={null} />
      ) : (
        <div className="fo-card text-sm text-[var(--fo-muted)]">El video no está disponible en este momento.</div>
      )}
      {leccion.description ? (
        <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--fo-muted)]">{leccion.description}</p>
      ) : null}
      {gratuito ? (
        <nav className="flex flex-wrap justify-between gap-3">
          {anterior ? (
            <Link href={`${base}/muestra/${anterior.id}`} className="fo-btn fo-btn-secondary text-sm">
              ← {anterior.title}
            </Link>
          ) : (
            <Link href={base} className="fo-btn fo-btn-secondary text-sm">
              Todas las clases
            </Link>
          )}
          {siguiente ? (
            <Link href={`${base}/muestra/${siguiente.id}`} className="fo-btn fo-btn-primary text-sm">
              {siguiente.title} →
            </Link>
          ) : (
            <Link href={base} className="fo-btn fo-btn-primary text-sm">
              Volver al curso
            </Link>
          )}
        </nav>
      ) : (
        <Link href={base} className="fo-btn fo-btn-primary text-sm">
          Ver el curso completo
        </Link>
      )}
    </main>
  );
}
