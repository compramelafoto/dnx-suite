// app/portal/cursos/[courseId]/clase/[lessonId]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { requireAuth } from "@/lib/auth";
import { cargarAccesoVigente } from "@/lib/course-classroom/mis-cursos";
import { numeroDeInscripcion } from "@/lib/course-classroom/access-rules";
import { armarAula } from "@/lib/course-classroom/aula";
import { textoDeMarca } from "@/lib/course-classroom/watermark";
import { DURACION_PERMISO_SEGUNDOS, playbackIframeUrl, signPlaybackToken, StreamError } from "@/lib/courses-video/stream";
import { clientIp } from "@/lib/geocode/rate-limit";
import { logCourseEvent } from "@/lib/presential-courses/log";
import { LessonPlayer } from "@/components/course-classroom/lesson-player";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clase",
  robots: { index: false, follow: false },
  referrer: "strict-origin",
};

/** Sin acceso se muestra el mensaje acá: nunca se redirige a `/portal` (armaría un bucle). */
export default async function ClasePage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const { courseId, lessonId } = await params;
  const user = await requireAuth();
  const acceso = await cargarAccesoVigente(user.id, courseId);
  const volver = (
    <Link href="/portal/cursos" className="text-sm text-[var(--fo-accent)] underline">
      Volver a mis cursos
    </Link>
  );

  if (!acceso) {
    return (
      <div className="fo-card space-y-3 text-center">
        <p className="font-semibold">No tenés acceso a este curso.</p>
        {volver}
      </div>
    );
  }

  const { clases } = armarAula(acceso.course.lessons, acceso.progress);
  const indice = clases.findIndex((c) => c.id === lessonId);
  const leccion = acceso.course.lessons.find((l) => l.id === lessonId);
  if (indice === -1 || !leccion?.videoUid) {
    return (
      <div className="fo-card space-y-3 text-center">
        <p className="font-semibold">Esta clase no está disponible.</p>
        {volver}
      </div>
    );
  }
  const clase = clases[indice];
  const anterior = clases[indice - 1];
  const siguiente = clases[indice + 1];

  let iframeUrl: string | null = null;
  try {
    iframeUrl = playbackIframeUrl(
      signPlaybackToken({ videoUid: leccion.videoUid, ttlSeconds: DURACION_PERMISO_SEGUNDOS }),
      { startSeconds: clase.retomarDesde },
    );
  } catch (error) {
    if (!(error instanceof StreamError)) throw error;
    console.error("[fotoffice][cursos] no se pudo firmar la reproducción", { lessonId, motivo: error.message });
  }

  // Registro de reproducciones. El origen va hasheado para no escribir la IP en claro en el
  // log; sirve para contar lugares distintos, no es anonimización fuerte (SHA-256 sin sal).
  const origen = createHash("sha256").update(clientIp(new Headers(await headers()))).digest("hex").slice(0, 12);
  logCourseEvent("aula_reproduccion_autorizada", { accessId: acceso.id, lessonId, origen, firmada: iframeUrl !== null });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        {volver}
        <p className="text-sm text-[var(--fo-muted)]">
          {acceso.course.title} · Clase {indice + 1} de {clases.length}
        </p>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight">{clase.title}</h1>

      {iframeUrl ? (
        <LessonPlayer
          key={lessonId}
          iframeUrl={iframeUrl}
          marca={textoDeMarca({
            nombre: acceso.enrollment.name,
            dni: acceso.enrollment.dni,
            numero: numeroDeInscripcion(acceso.enrollment.id),
          })}
          reporte={{ url: "/api/portal/cursos/avance", lessonId, courseId }}
        />
      ) : (
        <div className="fo-card text-sm text-[var(--fo-muted)]">El video no está disponible en este momento.</div>
      )}

      {leccion.description ? (
        <section className="fo-card">
          <p className="whitespace-pre-line text-sm leading-relaxed">{leccion.description}</p>
        </section>
      ) : null}

      <nav className="flex justify-between gap-3">
        {anterior ? (
          <Link href={`/portal/cursos/${courseId}/clase/${anterior.id}`} prefetch={false} className="fo-btn fo-btn-secondary text-sm">
            ← {anterior.title}
          </Link>
        ) : (
          <span />
        )}
        {siguiente ? (
          <Link href={`/portal/cursos/${courseId}/clase/${siguiente.id}`} prefetch={false} className="fo-btn fo-btn-primary text-sm">
            {siguiente.title} →
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
