import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import Card from "@/components/ui/Card";
import {
  ESCOLAR_COURSE_BLOCKS,
  ESCOLAR_COURSE_LESSON_COUNT,
  ESCOLAR_COURSE_SETTINGS_KEY,
  ESCOLAR_COURSE_TAGLINE,
  extractYoutubeId,
  parseEscolarCourseVideos,
  type EscolarCourseLesson,
} from "@/lib/tutorials/escolar-course";

export const dynamic = "force-dynamic";

// El ?ref= del link de un referidor lo guarda el middleware en la cookie clf_ref,
// y el registro la lee: el botón de registro no necesita llevar el código.
const REGISTER_ROUTE = "/fotografo/registro";

export const metadata: Metadata = {
  title: "Curso de fotografía escolar | ComprameLaFoto",
  description: `${ESCOLAR_COURSE_TAGLINE}. ${ESCOLAR_COURSE_LESSON_COUNT} clases cortas, sobre las pantallas reales: conseguir el colegio, la preventa, la toma, la producción y la entrega.`,
  openGraph: {
    title: "Curso de fotografía escolar | ComprameLaFoto",
    description: `${ESCOLAR_COURSE_TAGLINE}. ${ESCOLAR_COURSE_LESSON_COUNT} clases cortas y gratis.`,
    type: "website",
    locale: "es_AR",
  },
};

async function getVideos() {
  const row = await prisma.systemSettings.findUnique({
    where: { key: ESCOLAR_COURSE_SETTINGS_KEY },
  });
  return parseEscolarCourseVideos(row?.value);
}

function Lesson({ lesson, youtubeUrl }: { lesson: EscolarCourseLesson; youtubeUrl?: string }) {
  const youtubeId = youtubeUrl ? extractYoutubeId(youtubeUrl) : null;
  if (!youtubeId) {
    return (
      <Card className="flex flex-col gap-2 p-5 text-left sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#c27b3d]">
            Clase {lesson.number} · {lesson.audience}
          </p>
          <h3 className="text-base font-semibold text-[#1a1a1a]">{lesson.title}</h3>
          <p className="text-sm text-[#6b7280]">{lesson.summary}</p>
        </div>
        <span className="self-start whitespace-nowrap rounded-full bg-[#f3f0eb] px-3 py-1 text-xs font-medium text-[#9a5c2a] sm:self-center">
          Próximamente
        </span>
      </Card>
    );
  }
  return (
    <Card className="p-5">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-[#f3f0eb]">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1&playsinline=1`}
            title={lesson.title}
            className="h-full w-full"
            loading="lazy"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            sandbox="allow-scripts allow-same-origin allow-presentation"
          />
        </div>
        <div className="space-y-2 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#c27b3d]">
            Clase {lesson.number} · {lesson.audience}
          </p>
          <h3 className="text-lg font-semibold text-[#1a1a1a]">{lesson.title}</h3>
          <p className="text-sm text-[#6b7280]">{lesson.summary}</p>
        </div>
      </div>
    </Card>
  );
}

export default async function EscolarCoursePage() {
  const videos = await getVideos();
  const published = Object.keys(videos).length;

  return (
    <section className="section-spacing bg-[#f9fafb]">
      <div className="container-custom">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <Link href="/tutoriales" className="text-sm text-[#c27b3d] hover:underline">
            ← Todos los tutoriales
          </Link>
          <h1 className="mt-4 mb-3 text-3xl font-semibold text-[#1a1a1a] md:text-4xl">
            Curso de fotografía escolar
          </h1>
          <p className="mb-4 text-lg text-[#6b7280]">{ESCOLAR_COURSE_TAGLINE}.</p>
          <p className="mb-8 text-sm text-[#6b7280]">
            {ESCOLAR_COURSE_LESSON_COUNT} clases cortas, grabadas sobre las pantallas reales de ComprameLaFoto con
            una demo: el colegio, los chicos y las familias son inventados y los pagos son de prueba.
            {published > 0 && published < ESCOLAR_COURSE_LESSON_COUNT
              ? ` Ya hay ${published} ${published === 1 ? "clase disponible" : "clases disponibles"}; las demás se suman pronto.`
              : ""}
          </p>
          <Link href={REGISTER_ROUTE} className="clf-btn clf-btn--primary">
            Creá tu cuenta de fotógrafo gratis
          </Link>
        </div>

        <div className="mx-auto max-w-5xl space-y-12">
          {ESCOLAR_COURSE_BLOCKS.map((block, index) => (
            <div key={block.title}>
              <h2 className="mb-5 text-xl font-semibold text-[#1a1a1a]">
                Bloque {index + 1} · {block.title}
              </h2>
              <div className="space-y-5">
                {block.lessons.map((lesson) => (
                  <Lesson key={lesson.number} lesson={lesson} youtubeUrl={videos[lesson.number]} />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-14 max-w-3xl rounded-2xl bg-white p-8 text-center shadow-sm">
          <h2 className="mb-2 text-2xl font-semibold text-[#1a1a1a]">¿Arrancamos con tu primer colegio?</h2>
          <p className="mb-6 text-[#6b7280]">
            Primero se vende y se cobra, después se saca la foto. Creá tu cuenta y armá la preventa por la
            plataforma.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href={REGISTER_ROUTE} className="clf-btn clf-btn--primary">
              Creá tu cuenta de fotógrafo gratis
            </Link>
            <Link href="/landescolar" className="clf-btn clf-btn--outline">
              Conocé el sistema escolar
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
