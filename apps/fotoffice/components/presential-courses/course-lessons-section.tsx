"use client";

import { useActionState } from "react";
import { crearClase, borrarClase, reordenarClases } from "@/app/actions/course-lessons";
import { LessonUploadField } from "./lesson-upload-field";

type Clase = {
  id: string;
  title: string;
  description: string | null;
  sortOrder: number;
  durationSeconds: number | null;
  videoStatus: "PENDING" | "UPLOADING" | "PROCESSING" | "READY" | "ERROR";
  isPreview: boolean;
};

const estadoInicial = { error: null as string | null };

/**
 * Las clases de un curso grabado, en el panel.
 *
 * Reemplaza a la sección de Ediciones cuando la modalidad es Grabado: un curso grabado no
 * tiene fecha ni lugar ni cupo, tiene clases y un orden.
 */
export function CourseLessonsSection({
  courseId,
  clases,
  faltaConfigurarVideo,
}: {
  courseId: string;
  clases: Clase[];
  faltaConfigurarVideo: string | null;
}) {
  const [estado, accionCrear, creando] = useActionState(crearClase, estadoInicial);

  return (
    <section className="fo-card space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Clases</h2>
        <p className="text-sm text-[var(--fo-muted)]">
          El alumno las mira en este orden, cuando quiera. Marcá una como muestra gratuita para
          que cualquiera pueda verla sin pagar.
        </p>
      </div>

      {faltaConfigurarVideo ? (
        <p className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3 text-sm text-[var(--fo-muted)]">
          {faltaConfigurarVideo} Podés cargar las clases igual: el video se sube cuando quede
          configurado.
        </p>
      ) : null}

      <form action={accionCrear} className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <input type="hidden" name="courseId" value={courseId} />
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="nueva-clase">
            Título de la clase
          </label>
          <input
            id="nueva-clase"
            name="title"
            required
            className="fo-input"
            placeholder="Ej: Revelado en Lightroom, primera parte"
          />
        </div>
        <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={creando}>
          {creando ? "Agregando…" : "Agregar clase"}
        </button>
      </form>

      {estado?.error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {estado.error}
        </p>
      ) : null}

      {clases.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">
          Este curso todavía no tiene clases. Agregá la primera para empezar.
        </p>
      ) : (
        <ol className="space-y-3">
          {clases.map((clase, i) => (
            <li
              key={clase.id}
              className="space-y-3 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-medium">
                    <span className="text-[var(--fo-muted)]">{i + 1}.</span> {clase.title}
                    {clase.isPreview ? (
                      <span className="ml-2 rounded-full border border-[var(--fo-border)] px-2 py-0.5 text-xs text-[var(--fo-muted)]">
                        Muestra gratuita
                      </span>
                    ) : null}
                  </p>
                  {clase.description ? (
                    <p className="text-sm text-[var(--fo-muted)]">{clase.description}</p>
                  ) : null}
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    className="fo-btn fo-btn-secondary text-sm"
                    disabled={i === 0}
                    onClick={() => void reordenarClases(courseId, clase.id, i - 1)}
                    aria-label={`Subir ${clase.title}`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="fo-btn fo-btn-secondary text-sm"
                    disabled={i === clases.length - 1}
                    onClick={() => void reordenarClases(courseId, clase.id, i + 1)}
                    aria-label={`Bajar ${clase.title}`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="fo-btn fo-btn-secondary text-sm"
                    onClick={() => {
                      if (confirm(`¿Borrar la clase "${clase.title}"? No se puede deshacer.`)) {
                        void borrarClase(clase.id);
                      }
                    }}
                  >
                    Borrar
                  </button>
                </div>
              </div>

              <LessonUploadField
                lessonId={clase.id}
                estadoInicial={clase.videoStatus}
                duracionSegundos={clase.durationSeconds}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
