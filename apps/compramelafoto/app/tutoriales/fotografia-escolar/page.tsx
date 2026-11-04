import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import EscolarCoursePlayer from "@/components/tutorials/EscolarCoursePlayer";
import {
  ESCOLAR_COURSE_LESSON_COUNT,
  ESCOLAR_COURSE_SETTINGS_KEY,
  ESCOLAR_COURSE_TAGLINE,
  parseEscolarCourseVideos,
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

export default async function EscolarCoursePage() {
  const videos = await getVideos();
  const published = Object.keys(videos).length;

  return (
    <section className="bg-[#f9fafb] pb-20 pt-10 md:pt-14">
      <div className="container-custom">
        <header className="mb-10 flex flex-col gap-6 md:mb-12 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <Link href="/tutoriales" className="text-sm text-[#9a5c2a] hover:underline">
              Todos los tutoriales
            </Link>
            <h1 className="mt-3 text-4xl font-semibold leading-[1.05] tracking-tight text-[#1a1a1a] md:text-5xl">
              Curso de fotografía escolar
            </h1>
            <p className="mt-4 text-lg text-[#4b5563]">{ESCOLAR_COURSE_TAGLINE}.</p>
            <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
              {ESCOLAR_COURSE_LESSON_COUNT} clases cortas, grabadas sobre las pantallas reales de ComprameLaFoto con una
              demo: el colegio, los chicos y las familias son inventados y los pagos son de prueba.
              {published > 0 && published < ESCOLAR_COURSE_LESSON_COUNT
                ? ` Ya hay ${published} ${published === 1 ? "clase disponible" : "clases disponibles"}; las demás se suman pronto.`
                : ""}
            </p>
          </div>
          <Link href={REGISTER_ROUTE} className="clf-btn clf-btn--primary shrink-0 self-start md:self-auto">
            Creá tu cuenta de fotógrafo gratis
          </Link>
        </header>

        <EscolarCoursePlayer videos={videos} />

        <div className="mt-16 flex flex-col gap-6 rounded-2xl bg-[#1a1a1a] p-8 text-white md:flex-row md:items-center md:justify-between md:p-10">
          <div className="max-w-xl">
            <h2 className="text-2xl font-semibold">Probalo con tu primer colegio</h2>
            <p className="mt-2 text-white/75">
              Primero se vende y se cobra, después se saca la foto. Creá tu cuenta y armá la preventa por la plataforma.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={REGISTER_ROUTE} className="clf-btn clf-btn--primary">
              Creá tu cuenta de fotógrafo gratis
            </Link>
            <Link href="/landescolar" className="clf-btn bg-white text-[#1a1a1a] hover:bg-white/90">
              Conocé el sistema escolar
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
