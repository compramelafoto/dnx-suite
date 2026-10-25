import type { Metadata } from "next";
import Link from "next/link";
import SimulatorShell from "@/components/simulator/SimulatorShell";
import Stars from "@/components/camofduty/course/Stars";
import { getAuthUser } from "@/lib/auth";
import { LEVELS, lessonsOfLevel } from "@/lib/camofduty/course/lessons";
import { isUnlocked, summarizeLevel, type Medal } from "@/lib/camofduty/course/progress";
import { loadCourseProgress } from "@/lib/camofduty/course/progress-db";

export const metadata: Metadata = {
  title: "Curso de fotografía — Cam Of Duty",
  description: "Curso de fotografía paso a paso, de nivel inicial a avanzado, con tareas en los simuladores que se corrigen solas.",
};

export const dynamic = "force-dynamic";

const MEDAL_LABEL: Record<Medal, string> = {
  ninguna: "",
  bronce: "Medalla de bronce",
  plata: "Medalla de plata",
  oro: "Medalla de oro",
};

export default async function CursoPage() {
  const user = await getAuthUser();
  const progress = user ? await loadCourseProgress(user.id) : [];
  const starsOf = (id: string) => progress.find((p) => p.lessonId === id)?.stars ?? 0;

  return (
    <SimulatorShell variant="landing">
      <main className="cod-course">
        <section className="cod-course__hero">
          <p className="cod-section-label">Curso de fotografía</p>
          <h1 className="cod-section-title">Aprendé fotografía paso a paso</h1>
          <p className="cod-course__lead">
            Veinte lecciones ordenadas, de lo básico a la luz de estudio. Cada una tiene una explicación corta y una tarea para hacer en los simuladores: al sacar la foto, se corrige sola y te dice qué faltó. Aprobá con 1 estrella; con todo perfecto, 3.
          </p>
          {!user ? (
            <p className="cod-course__login">
              <Link href="/camofduty/ingresar?redirect=%2Fcamofduty%2Fcurso" className="cod-btn cod-btn--primary">
                Ingresá para guardar tu progreso
              </Link>
            </p>
          ) : null}
        </section>

        {LEVELS.map((level) => {
          const summary = summarizeLevel(level.id, progress);
          return (
            <section key={level.id} className="cod-course__level" aria-labelledby={`nivel-${level.id}`}>
              <header className="cod-course__level-head">
                <div>
                  <h2 id={`nivel-${level.id}`}>{level.title}</h2>
                  <p>{level.description}</p>
                </div>
                <div className="cod-course__level-stats">
                  <span>
                    {summary.passed}/{summary.total} aprobadas · {summary.stars}/{summary.maxStars} ★
                  </span>
                  {summary.medal !== "ninguna" ? <span className={`cod-medal cod-medal--${summary.medal}`}>{MEDAL_LABEL[summary.medal]}</span> : null}
                  {summary.complete ? (
                    <Link href={`/camofduty/curso/certificado/${level.id}`} className="cod-btn cod-btn--secondary cod-btn--sm">
                      Ver certificado
                    </Link>
                  ) : null}
                </div>
              </header>
              <div className="cod-course__bar" aria-hidden="true">
                <span style={{ width: `${(summary.passed / summary.total) * 100}%` }} />
              </div>
              <ol className="cod-course__lessons">
                {lessonsOfLevel(level.id).map((lesson) => {
                  const stars = starsOf(lesson.id);
                  const open = isUnlocked(lesson.id, progress);
                  return (
                    <li key={lesson.id}>
                      <Link
                        href={`/camofduty/curso/${lesson.id}`}
                        className={`cod-lesson-card${stars > 0 ? " is-passed" : ""}${open ? "" : " is-locked"}`}
                      >
                        <span className="cod-lesson-card__num">{lesson.number}</span>
                        <span className="cod-lesson-card__body">
                          <span className="cod-lesson-card__title">{lesson.title}</span>
                          <span className="cod-lesson-card__summary">{lesson.summary}</span>
                          <span className="cod-lesson-card__meta">
                            {lesson.simulator === "calle" ? "Simulador de la calle" : "Estudio Fotográfico"}
                            {open ? "" : " · se habilita al aprobar la anterior"}
                          </span>
                        </span>
                        <Stars value={stars} size="sm" />
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </main>
    </SimulatorShell>
  );
}
