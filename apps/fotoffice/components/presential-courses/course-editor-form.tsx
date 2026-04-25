"use client";

import { useActionState } from "react";
import {
  createPresentialCourseAction,
  updatePresentialCourseAction,
  type PresentialCourseActionState,
} from "@/app/actions/presential-courses";

const initialState: PresentialCourseActionState = { error: null };

type CourseFormInitial = {
  id?: string;
  title?: string;
  slug?: string;
  shortDescription?: string | null;
  longDescription?: string | null;
  coverImageUrl?: string | null;
  thumbnailImageUrl?: string | null;
  instructorName?: string | null;
  level?: string | null;
  status?: "DRAFT" | "PUBLISHED" | "UPCOMING" | "HIDDEN";
  faqJson?: unknown;
  classroomLink?: string | null;
  classroomCode?: string | null;
  classroomInstructions?: string | null;
};

export function CourseEditorForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: CourseFormInitial;
}) {
  const action = mode === "create" ? createPresentialCourseAction : updatePresentialCourseAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const faqDefault = initial?.faqJson ? JSON.stringify(initial.faqJson, null, 2) : "";

  return (
    <form action={formAction} className="space-y-8">
      {mode === "edit" && initial?.id ? <input type="hidden" name="id" value={initial.id} /> : null}

      <section className="fo-card space-y-6">
        <h2 className="text-lg font-semibold">Información general</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="fo-field-stack md:col-span-2">
            <label className="fo-label" htmlFor="title">
              Título
            </label>
            <input id="title" name="title" required defaultValue={initial?.title ?? ""} className="fo-input" />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="slug">
              Slug (opcional)
            </label>
            <input id="slug" name="slug" defaultValue={initial?.slug ?? ""} className="fo-input font-mono text-sm" />
            <p className="fo-helper">Si lo dejás vacío, se genera automáticamente desde el título.</p>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="status">
              Estado
            </label>
            <select id="status" name="status" className="fo-input" defaultValue={initial?.status ?? "DRAFT"}>
              <option value="DRAFT">Borrador</option>
              <option value="PUBLISHED">Publicado</option>
              <option value="UPCOMING">Próximamente</option>
              <option value="HIDDEN">Oculto</option>
            </select>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="instructorName">
              Instructor/a
            </label>
            <input id="instructorName" name="instructorName" defaultValue={initial?.instructorName ?? ""} className="fo-input" />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="level">
              Nivel
            </label>
            <input id="level" name="level" defaultValue={initial?.level ?? ""} className="fo-input" placeholder="Inicial, intermedio, avanzado..." />
          </div>
          <div className="fo-field-stack md:col-span-2">
            <label className="fo-label" htmlFor="coverImageUrl">
              Portada URL
            </label>
            <input id="coverImageUrl" name="coverImageUrl" defaultValue={initial?.coverImageUrl ?? ""} className="fo-input" />
          </div>
          <div className="fo-field-stack md:col-span-2">
            <label className="fo-label" htmlFor="thumbnailImageUrl">
              Thumbnail URL
            </label>
            <input id="thumbnailImageUrl" name="thumbnailImageUrl" defaultValue={initial?.thumbnailImageUrl ?? ""} className="fo-input" />
          </div>
        </div>
      </section>

      <section className="fo-card space-y-6">
        <h2 className="text-lg font-semibold">Página de venta</h2>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="fo-field-stack md:col-span-2">
            <label className="fo-label" htmlFor="shortDescription">
              Descripción corta
            </label>
            <textarea id="shortDescription" name="shortDescription" rows={3} defaultValue={initial?.shortDescription ?? ""} className="fo-input" />
          </div>
          <div className="fo-field-stack md:col-span-2">
            <label className="fo-label" htmlFor="longDescription">
              Descripción larga
            </label>
            <textarea id="longDescription" name="longDescription" rows={7} defaultValue={initial?.longDescription ?? ""} className="fo-input" />
          </div>
        </div>
      </section>

      <section className="fo-card space-y-6">
        <h2 className="text-lg font-semibold">Preguntas frecuentes</h2>
        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="faqJson">
            FAQ (JSON)
          </label>
          <textarea id="faqJson" name="faqJson" rows={8} defaultValue={faqDefault} className="fo-input font-mono text-xs" />
          <p className="fo-helper">Ejemplo: [{"{\"q\":\"¿Qué llevo?\",\"a\":\"Tu cámara.\"}"}]</p>
        </div>
      </section>

      <section className="fo-card space-y-6">
        <h2 className="text-lg font-semibold">Acceso al aula</h2>
        <p className="text-sm text-[var(--fo-text)] font-medium">Google Classroom</p>
        <p className="text-sm text-[var(--fo-muted)]">
          Este contenido se mostrará solo después del pago aprobado.
        </p>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="fo-field-stack md:col-span-2">
            <label className="fo-label" htmlFor="classroomLink">
              Link de Classroom
            </label>
            <input id="classroomLink" name="classroomLink" defaultValue={initial?.classroomLink ?? ""} className="fo-input" />
          </div>
          <div className="fo-field-stack md:col-span-2">
            <label className="fo-label" htmlFor="classroomCode">
              Código de Classroom
            </label>
            <input id="classroomCode" name="classroomCode" defaultValue={initial?.classroomCode ?? ""} className="fo-input" />
          </div>
          <div className="fo-field-stack md:col-span-2">
            <label className="fo-label" htmlFor="classroomInstructions">
              Instrucciones del docente
            </label>
            <textarea id="classroomInstructions" name="classroomInstructions" rows={4} defaultValue={initial?.classroomInstructions ?? ""} className="fo-input" />
          </div>
        </div>
      </section>

      {state.error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="text-sm text-[var(--fo-success)]" role="status">
          {mode === "create" ? "Curso creado." : "Curso actualizado."}
        </p>
      ) : null}
      <div className="fo-form-actions">
        <button type="submit" className="fo-btn fo-btn-primary" disabled={pending}>
          {pending ? "Guardando..." : mode === "create" ? "Crear curso" : "Guardar cambios"}
        </button>
      </div>
    </form>
  );
}
