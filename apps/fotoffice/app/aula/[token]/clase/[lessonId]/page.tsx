import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { createHash } from "node:crypto";
import { buscarAccesoPorToken } from "@/lib/course-classroom/lookup";
import { estadoDelAcceso, numeroDeInscripcion } from "@/lib/course-classroom/access-rules";
import { armarAula } from "@/lib/course-classroom/aula";
import { textoDeMarca } from "@/lib/course-classroom/watermark";
import {
  DURACION_PERMISO_SEGUNDOS,
  playbackIframeUrl,
  signPlaybackToken,
  StreamError,
} from "@/lib/courses-video/stream";
import { clientIp } from "@/lib/geocode/rate-limit";
import { logCourseEvent } from "@/lib/presential-courses/log";
import { LessonPlayer } from "@/components/course-classroom/lesson-player";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Clase",
  robots: { index: false, follow: false },
  referrer: "strict-origin",
};

export default async function ClasePage({
  params,
}: {
  params: Promise<{ token: string; lessonId: string }>;
}) {
  const { token, lessonId } = await params;
  const acceso = await buscarAccesoPorToken(token);
  const volver = (
    <Link href={`/aula/${token}`} className="text-sm text-[var(--fo-accent)] underline">
      Volver al aula
    </Link>
  );

  if (!acceso || estadoDelAcceso(acceso, new Date()) !== "VIGENTE") {
    return (
      <main className="mx-auto max-w-md px-5 py-12 text-center space-y-3">
        <p className="font-semibold">No podés ver esta clase con este enlace.</p>
        {volver}
      </main>
    );
  }

  const { clases } = armarAula(acceso.course.lessons, acceso.progress);
  const indice = clases.findIndex((c) => c.id === lessonId);
  const leccion = acceso.course.lessons.find((l) => l.id === lessonId);
  if (indice === -1 || !leccion?.videoUid) {
    return (
      <main className="mx-auto max-w-md px-5 py-12 text-center space-y-3">
        <p className="font-semibold">Esta clase no está disponible.</p>
        {volver}
      </main>
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

  // Registro de reproducciones (spec, sección 4, capa 4). El origen va hasheado: sirve para ver
  // un mismo acceso desde muchos lugares a la vez sin guardar direcciones IP.
  const origen = createHash("sha256").update(clientIp(new Headers(await headers()))).digest("hex").slice(0, 12);
  logCourseEvent("aula_reproduccion_autorizada", {
    accessId: acceso.id,
    lessonId,
    origen,
    firmada: iframeUrl !== null,
  });

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-8 md:px-8">
      <div className="flex items-center justify-between gap-3">
        {volver}
        <p className="text-sm text-[var(--fo-muted)]">
          Clase {indice + 1} de {clases.length}
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
          reporte={{ url: `/api/aula/${token}/avance`, lessonId }}
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
          <Link href={`/aula/${token}/clase/${anterior.id}`} className="fo-btn fo-btn-secondary text-sm">
            ← {anterior.title}
          </Link>
        ) : (
          <span />
        )}
        {siguiente ? (
          <Link href={`/aula/${token}/clase/${siguiente.id}`} className="fo-btn fo-btn-primary text-sm">
            {siguiente.title} →
          </Link>
        ) : null}
      </nav>
    </main>
  );
}
