import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import SimulatorShell from "@/components/simulator/SimulatorShell";
import Stars from "@/components/camofduty/course/Stars";
import { getAuthUser } from "@/lib/auth";
import { LESSONS, LEVELS, lessonById, lessonTaskHref, lessonsOfLevel } from "@/lib/camofduty/course/lessons";
import { isUnlocked } from "@/lib/camofduty/course/progress";
import { loadCourseProgress } from "@/lib/camofduty/course/progress-db";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ leccion: string }> }): Promise<Metadata> {
  const lesson = lessonById((await params).leccion);
  return { title: lesson ? `${lesson.title} — Curso Cam Of Duty` : "Curso Cam Of Duty", description: lesson?.summary };
}

export default async function LeccionPage({ params }: { params: Promise<{ leccion: string }> }) {
  const lesson = lessonById((await params).leccion);
  if (!lesson) notFound();
  const user = await getAuthUser();
  const progress = user ? await loadCourseProgress(user.id) : [];
  const mine = progress.find((p) => p.lessonId === lesson.id);
  const open = isUnlocked(lesson.id, progress);
  const level = LEVELS.find((l) => l.id === lesson.level)!;
  const index = LESSONS.findIndex((l) => l.id === lesson.id);
  const prev = LESSONS[index - 1] ?? null;
  const next = LESSONS[index + 1] ?? null;
  const previousInLevel = lessonsOfLevel(lesson.level).find((l) => l.number === lesson.number - 1);
  const required = lesson.criteria.filter((c) => c.required);
  const bonus = lesson.criteria.filter((c) => !c.required);

  return (
    <SimulatorShell variant="landing">
      <main className="cod-course cod-course--lesson">
        <nav className="cod-course__crumbs" aria-label="Ubicación">
          <Link href="/camofduty/curso">Curso</Link> · <span>{level.title}</span> · <span>Lección {lesson.number}</span>
        </nav>
        <header className="cod-lesson__head">
          <p className="cod-section-label">
            {level.title} · Lección {lesson.number} de 10
          </p>
          <h1 className="cod-section-title">{lesson.title}</h1>
          {mine ? (
            <p className="cod-lesson__mine">
              <Stars value={mine.stars} /> {mine.stars > 0 ? "Aprobada" : "Todavía sin aprobar"} · {mine.attempts} {mine.attempts === 1 ? "intento" : "intentos"}
            </p>
          ) : null}
        </header>

        <section className="cod-lesson__text">
          {lesson.explanation.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </section>

        <section className="cod-lesson__task" aria-labelledby="tarea">
          <h2 id="tarea">La tarea</h2>
          <p className="cod-lesson__task-text">{lesson.task}</p>
          <div className="cod-lesson__criteria">
            <div>
              <h3>Para aprobar</h3>
              <ul>
                {required.map((c) => (
                  <li key={c.label}>{c.label}</li>
                ))}
              </ul>
            </div>
            {bonus.length ? (
              <div>
                <h3>Para más estrellas</h3>
                <ul>
                  {bonus.map((c) => (
                    <li key={c.label}>{c.label}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <p className="cod-lesson__tip">
            <strong>Consejo:</strong> {lesson.tip}
          </p>
          {open ? (
            <Link href={lessonTaskHref(lesson.id, lesson.simulator)} className="cod-btn cod-btn--primary cod-lesson__go">
              Hacer la tarea en {lesson.simulator === "calle" ? "el simulador de la calle" : "el Estudio Fotográfico"}
            </Link>
          ) : (
            <p className="cod-lesson__locked">
              Esta tarea se habilita al aprobar la lección anterior
              {previousInLevel ? (
                <>
                  : <Link href={`/camofduty/curso/${previousInLevel.id}`}>{previousInLevel.title}</Link>
                </>
              ) : null}
              .
            </p>
          )}
        </section>

        <nav className="cod-lesson__nav" aria-label="Otras lecciones">
          {prev ? <Link href={`/camofduty/curso/${prev.id}`}>← {prev.title}</Link> : <span />}
          {next ? <Link href={`/camofduty/curso/${next.id}`}>{next.title} →</Link> : <span />}
        </nav>
      </main>
    </SimulatorShell>
  );
}
