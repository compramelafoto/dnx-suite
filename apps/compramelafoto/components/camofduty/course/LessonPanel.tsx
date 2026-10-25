"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Stars from "@/components/camofduty/course/Stars";
import { gradeShot } from "@/lib/camofduty/course/grade";
import { nextLesson } from "@/lib/camofduty/course/lessons";
import type { GradeResult, Lesson, Shot } from "@/lib/camofduty/course/types";

/** Evento con una toma lista para corregir (la arma cada simulador). */
export const COD_LESSON_SHOT_EVENT = "cod-lesson-shot";

export interface CodLessonShotDetail {
  shot: Shot;
}

/**
 * Tarea del curso dentro del simulador: muestra la consigna, corrige cada toma
 * al instante (y la guarda en el progreso) y dice qué faltó.
 */
export default function LessonPanel({ lesson, placement = "calle" }: { lesson: Lesson; placement?: "calle" | "estudio" }) {
  const [open, setOpen] = useState(true);
  const [grade, setGrade] = useState<GradeResult | null>(null);
  const [best, setBest] = useState<number | null>(null);
  const [saveError, setSaveError] = useState(false);
  const next = nextLesson(lesson.id);

  const submit = useCallback(
    async (shot: Shot) => {
      const local = gradeShot(lesson, shot);
      setGrade(local);
      setOpen(true);
      setSaveError(false);
      try {
        const res = await fetch("/api/camofduty/curso", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lessonId: lesson.id, shot }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { best: number };
        setBest(data.best);
      } catch {
        setSaveError(true);
      }
    },
    [lesson],
  );

  useEffect(() => {
    const onShot = (e: Event) => void submit((e as CustomEvent<CodLessonShotDetail>).detail.shot);
    window.addEventListener(COD_LESSON_SHOT_EVENT, onShot);
    return () => window.removeEventListener(COD_LESSON_SHOT_EVENT, onShot);
  }, [submit]);

  if (!open) {
    return (
      <button type="button" className={`cod-lesson-chip cod-lesson-chip--${placement}`} onClick={() => setOpen(true)}>
        Tarea · {lesson.title}
        {grade ? <Stars value={grade.stars} size="sm" /> : null}
      </button>
    );
  }

  // Sin repetir: dos requisitos de exposición pueden dar la misma explicación.
  const failed = [...new Map((grade?.results.filter((r) => !r.ok) ?? []).map((r) => [r.hint, r])).values()];
  return (
    <aside className={`cod-lesson-panel cod-lesson-panel--${placement}`} aria-label="Tarea del curso">
      <header className="cod-lesson-panel__head">
        <span className="cod-lesson-panel__kicker">
          Curso · {lesson.level === "inicial" ? "Inicial" : "Avanzado"} {lesson.number}
        </span>
        <button type="button" className="cod-lesson-panel__close" onClick={() => setOpen(false)} aria-label="Minimizar la tarea">
          –
        </button>
      </header>
      <p className="cod-lesson-panel__task">{lesson.task}</p>
      <ul className="cod-lesson-panel__list">
        {lesson.criteria.map((c, i) => {
          const r = grade?.results[i];
          return (
            <li key={c.label} className={r ? (r.ok ? "is-ok" : "is-bad") : ""}>
              <span aria-hidden="true">{r ? (r.ok ? "✓" : "✗") : c.required ? "•" : "☆"}</span> {c.label}
            </li>
          );
        })}
      </ul>
      {grade ? (
        <div className={`cod-lesson-panel__result${grade.passed ? " is-passed" : ""}`} role="status" aria-live="polite">
          <div className="cod-lesson-panel__verdict">
            <Stars value={grade.stars} size="md" />
            <strong>{grade.passed ? (grade.stars === 3 ? "¡Perfecta!" : "¡Aprobada!") : "Todavía no"}</strong>
          </div>
          {failed.slice(0, 3).map((r) => (
            <p key={r.label} className="cod-lesson-panel__hint">
              {r.hint}
            </p>
          ))}
          {best != null && best > grade.stars ? <p className="cod-lesson-panel__note">Tu mejor nota en esta lección sigue siendo {best} ★.</p> : null}
          {saveError ? <p className="cod-lesson-panel__note">No se pudo guardar la nota (¿sin conexión?). La próxima toma se vuelve a intentar.</p> : null}
        </div>
      ) : (
        <p className="cod-lesson-panel__note">Sacá la foto cuando quieras: se corrige sola.</p>
      )}
      <footer className="cod-lesson-panel__actions">
        <Link href={`/camofduty/curso/${lesson.id}`} className="cod-btn cod-btn--ghost cod-btn--sm">
          Ver la lección
        </Link>
        {grade?.passed && next ? (
          <Link href={`/camofduty/curso/${next.id}`} className="cod-btn cod-btn--primary cod-btn--sm">
            Siguiente lección
          </Link>
        ) : (
          <Link href="/camofduty/curso" className="cod-btn cod-btn--ghost cod-btn--sm">
            Volver al curso
          </Link>
        )}
      </footer>
    </aside>
  );
}
