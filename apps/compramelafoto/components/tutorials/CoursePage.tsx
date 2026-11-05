import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CoursePlayer from "@/components/tutorials/CoursePlayer";
import { parseCourseVideos, type TutorialCourse } from "@/lib/tutorials/course";

// El ?ref= del link de un referidor lo guarda el middleware en la cookie clf_ref,
// y el registro la lee: el botón de registro no necesita llevar el código.
const REGISTER_ROUTE = "/fotografo/registro";

async function getVideos(course: TutorialCourse) {
  const row = await prisma.systemSettings.findUnique({ where: { key: course.settingsKey } });
  return parseCourseVideos(row?.value, course.lessonCount);
}

export default async function CoursePage({ course }: { course: TutorialCourse }) {
  const videos = await getVideos(course);
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
              {course.title}
            </h1>
            <p className="mt-4 text-lg text-[#4b5563]">{course.tagline}.</p>
            <p className="mt-2 text-sm leading-relaxed text-[#6b7280]">
              {course.lessonCount} clases cortas, {course.intro}
              {published > 0 && published < course.lessonCount
                ? ` Ya hay ${published} ${published === 1 ? "clase disponible" : "clases disponibles"}; las demás se suman pronto.`
                : ""}
            </p>
          </div>
          <Link href={REGISTER_ROUTE} className="clf-btn clf-btn--primary shrink-0 self-start md:self-auto">
            Creá tu cuenta de fotógrafo gratis
          </Link>
        </header>

        <CoursePlayer
          course={{ blocks: course.blocks, details: course.details, lessonCount: course.lessonCount, extras: course.extras }}
          videos={videos}
        />

        <div className="mt-16 flex flex-col gap-6 rounded-2xl bg-[#1a1a1a] p-8 text-white md:flex-row md:items-center md:justify-between md:p-10">
          <div className="max-w-xl">
            <h2 className="text-2xl font-semibold">{course.closing.title}</h2>
            <p className="mt-2 text-white/75">{course.closing.text}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href={REGISTER_ROUTE} className="clf-btn clf-btn--primary">
              Creá tu cuenta de fotógrafo gratis
            </Link>
            {course.secondaryCta && (
              <Link
                href={course.secondaryCta.href}
                className="clf-btn bg-white text-[#1a1a1a] hover:bg-white/90"
              >
                {course.secondaryCta.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
