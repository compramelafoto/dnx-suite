"use client";

import { useState, useTransition, type FormEvent } from "react";
import {
  createCourseAction,
  updateCourseAction,
  type CourseFormState,
} from "@/app/actions/courses";
import { toDatetimeLocalInput } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";

export type ProgramLesson = { title: string; summary: string };
export type ProgramSection = { title: string; lessons: ProgramLesson[] };

type TeacherOpt = { id: string; fullName: string };

export type CourseWizardInitial = {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  teacherId: string;
  shortDescription: string | null;
  longDescription: string | null;
  modality: string;
  level: string;
  category: string | null;
  targetAudience: string | null;
  prerequisites: string | null;
  objectives: string | null;
  durationText: string | null;
  scheduleText: string | null;
  startDate: Date | null;
  endDate: Date | null;
  seats: number | null;
  price: string;
  currency: string;
  discountPrice: string | null;
  includesCertificate: boolean;
  includesRecordings: boolean;
  includesDownloadables: boolean;
  coverImageUrl: string | null;
  galleryImages: string[];
  status: string;
  seoTitle: string | null;
  seoDescription: string | null;
  sections: { title: string; lessons: { title: string; summary: string | null }[] }[];
  faq: { q: string; a: string }[];
};

function defaultProgram(): ProgramSection[] {
  return [{ title: "", lessons: [{ title: "", summary: "" }] }];
}

export function CourseFormWizard({
  mode,
  teachers,
  initial,
}: {
  mode: "create" | "edit";
  teachers: TeacherOpt[];
  initial?: CourseWizardInitial;
}) {
  const [program, setProgram] = useState<ProgramSection[]>(() => {
    if (initial?.sections?.length) {
      return initial.sections.map((s) => ({
        title: s.title,
        lessons: s.lessons.map((l) => ({
          title: l.title,
          summary: l.summary ?? "",
        })),
      }));
    }
    return defaultProgram();
  });
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const steps = ["General", "Programa", "Comercial", "SEO y FAQ"];

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSaved(false);
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("sectionsJson", JSON.stringify(program));
    startTransition(async () => {
      const fn = mode === "create" ? createCourseAction : updateCourseAction;
      const res: CourseFormState = await fn(undefined, fd);
      if (res?.error) {
        setError(res.error);
        setFieldErrors(res.fieldErrors ?? {});
      } else if (mode === "edit") {
        setSaved(true);
      }
    });
  }

  function updateSection(i: number, title: string) {
    setProgram((p) => p.map((s, idx) => (idx === i ? { ...s, title } : s)));
  }

  function updateLesson(si: number, li: number, field: "title" | "summary", value: string) {
    setProgram((p) =>
      p.map((s, idx) => {
        if (idx !== si) return s;
        const lessons = s.lessons.map((lesson, j) =>
          j === li ? { ...lesson, [field]: value } : lesson,
        );
        return { ...s, lessons };
      }),
    );
  }

  function addSection() {
    setProgram((p) => [...p, { title: "", lessons: [{ title: "", summary: "" }] }]);
  }

  function addLesson(si: number) {
    setProgram((p) =>
      p.map((s, idx) =>
        idx === si ? { ...s, lessons: [...s.lessons, { title: "", summary: "" }] } : s,
      ),
    );
  }

  function removeLesson(si: number, li: number) {
    setProgram((p) =>
      p.map((s, idx) => {
        if (idx !== si) return s;
        if (s.lessons.length <= 1) return s;
        return { ...s, lessons: s.lessons.filter((_, j) => j !== li) };
      }),
    );
  }

  function removeSection(si: number) {
    setProgram((p) => (p.length <= 1 ? p : p.filter((_, idx) => idx !== si)));
  }

  const fe = fieldErrors;

  const faqInitial = initial?.faq ?? [];
  const faqSlots = [0, 1, 2, 3, 4, 5].map((i) => ({
    q: faqInitial[i]?.q ?? "",
    a: faqInitial[i]?.a ?? "",
  }));

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {mode === "edit" && initial ? <input type="hidden" name="id" value={initial.id} /> : null}

      <div className="flex flex-wrap gap-2">
        {steps.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={
              step === i
                ? "fo-btn fo-btn-primary text-xs min-h-9 px-3"
                : "fo-btn fo-btn-secondary text-xs min-h-9 px-3"
            }
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 ? (
        <div className="fo-card space-y-6">
          <h2 className="text-lg font-semibold text-[var(--fo-text)]">Datos generales</h2>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="title">
              Título del curso
            </label>
            <input
              id="title"
              name="title"
              required
              defaultValue={initial?.title}
              className="fo-input"
            />
            {fe.title ? <p className="text-xs text-[var(--fo-danger)]">{fe.title}</p> : null}
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="subtitle">
              Subtítulo
            </label>
            <input
              id="subtitle"
              name="subtitle"
              defaultValue={initial?.subtitle ?? ""}
              className="fo-input"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="slug">
              Slug (URL)
            </label>
            <input
              id="slug"
              name="slug"
              defaultValue={initial?.slug}
              className="fo-input font-mono text-sm"
              placeholder="se-genera-del-título si lo dejás vacío"
            />
            <p className="fo-helper">Público: /w/[tu-workspace]/cursos/[slug]</p>
            {fe.slug ? <p className="text-xs text-[var(--fo-danger)]">{fe.slug}</p> : null}
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="teacherId">
                Docente
              </label>
              <select
                id="teacherId"
                name="teacherId"
                required
                className="fo-input"
                defaultValue={initial?.teacherId}
              >
                <option value="">Elegí…</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName}
                  </option>
                ))}
              </select>
              {fe.teacherId ? <p className="text-xs text-[var(--fo-danger)]">{fe.teacherId}</p> : null}
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="category">
                Categoría
              </label>
              <input
                id="category"
                name="category"
                defaultValue={initial?.category ?? ""}
                className="fo-input"
              />
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="modality">
                Modalidad
              </label>
              <select
                id="modality"
                name="modality"
                required
                className="fo-input"
                defaultValue={initial?.modality ?? "LIVE"}
              >
                <option value="LIVE">En vivo</option>
                <option value="RECORDED">Grabado</option>
                <option value="HYBRID">Híbrido</option>
              </select>
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="level">
                Nivel
              </label>
              <select
                id="level"
                name="level"
                required
                className="fo-input"
                defaultValue={initial?.level ?? "BEGINNER"}
              >
                <option value="BEGINNER">Principiante</option>
                <option value="INTERMEDIATE">Intermedio</option>
                <option value="ADVANCED">Avanzado</option>
              </select>
            </div>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="shortDescription">
              Descripción corta
            </label>
            <textarea
              id="shortDescription"
              name="shortDescription"
              rows={3}
              defaultValue={initial?.shortDescription ?? ""}
              className="fo-input"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="longDescription">
              Descripción completa
            </label>
            <textarea
              id="longDescription"
              name="longDescription"
              rows={8}
              defaultValue={initial?.longDescription ?? ""}
              className="fo-input"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="targetAudience">
              Público objetivo
            </label>
            <textarea
              id="targetAudience"
              name="targetAudience"
              rows={3}
              defaultValue={initial?.targetAudience ?? ""}
              className="fo-input"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="prerequisites">
              Requisitos previos
            </label>
            <textarea
              id="prerequisites"
              name="prerequisites"
              rows={3}
              defaultValue={initial?.prerequisites ?? ""}
              className="fo-input"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="objectives">
              Objetivos (uno por línea o texto libre)
            </label>
            <textarea
              id="objectives"
              name="objectives"
              rows={5}
              defaultValue={initial?.objectives ?? ""}
              className="fo-input"
            />
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="fo-card space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--fo-text)]">Programa del curso</h2>
              <p className="text-sm text-[var(--fo-muted)] mt-2 leading-relaxed max-w-2xl">
                Organizá el contenido en módulos y clases. Esto se muestra en la landing pública.
              </p>
            </div>
            <button type="button" onClick={addSection} className="fo-btn fo-btn-secondary text-sm min-h-9">
              <Plus className="size-4" />
              Módulo
            </button>
          </div>
          <div className="space-y-8">
            {program.map((section, si) => (
              <div
                key={si}
                className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-4 space-y-4 bg-[var(--fo-bg-elevated)]"
              >
                <div className="flex flex-wrap gap-2 items-start justify-between">
                  <div className="flex-1 min-w-[12rem] fo-field-stack">
                    <label className="fo-label">Módulo {si + 1}</label>
                    <input
                      value={section.title}
                      onChange={(e) => updateSection(si, e.target.value)}
                      className="fo-input"
                      placeholder="Título del módulo"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeSection(si)}
                    className="fo-btn fo-btn-ghost text-sm min-h-9 text-[var(--fo-danger)]"
                    disabled={program.length <= 1}
                    aria-label="Eliminar módulo"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="space-y-4 pl-0 sm:pl-4 border-l-2 border-[var(--fo-border-muted)]">
                  {section.lessons.map((lesson, li) => (
                    <div key={li} className="space-y-2">
                      <div className="flex flex-wrap gap-2 justify-between items-start">
                        <span className="text-xs font-medium text-[var(--fo-muted-soft)]">
                          Clase {li + 1}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeLesson(si, li)}
                          className="fo-btn fo-btn-ghost text-xs min-h-8 text-[var(--fo-danger)]"
                          disabled={section.lessons.length <= 1}
                        >
                          Quitar
                        </button>
                      </div>
                      <input
                        value={lesson.title}
                        onChange={(e) => updateLesson(si, li, "title", e.target.value)}
                        className="fo-input"
                        placeholder="Título de la clase"
                      />
                      <textarea
                        value={lesson.summary}
                        onChange={(e) => updateLesson(si, li, "summary", e.target.value)}
                        className="fo-input"
                        rows={2}
                        placeholder="Resumen breve (opcional)"
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addLesson(si)}
                    className="fo-btn fo-btn-secondary text-sm min-h-9"
                  >
                    <Plus className="size-4" />
                    Agregar clase
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="fo-card space-y-6">
          <h2 className="text-lg font-semibold text-[var(--fo-text)]">Comercial y calendario</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="durationText">
                Duración (texto libre)
              </label>
              <input
                id="durationText"
                name="durationText"
                defaultValue={initial?.durationText ?? ""}
                className="fo-input"
                placeholder="Ej. 8 horas — 4 encuentros"
              />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="scheduleText">
                Horarios
              </label>
              <input
                id="scheduleText"
                name="scheduleText"
                defaultValue={initial?.scheduleText ?? ""}
                className="fo-input"
              />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="startDate">
                Fecha de inicio
              </label>
              <input
                id="startDate"
                name="startDate"
                type="datetime-local"
                defaultValue={toDatetimeLocalInput(initial?.startDate ?? null)}
                className="fo-input"
              />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="endDate">
                Fecha de fin
              </label>
              <input
                id="endDate"
                name="endDate"
                type="datetime-local"
                defaultValue={toDatetimeLocalInput(initial?.endDate ?? null)}
                className="fo-input"
              />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="seats">
                Cupos
              </label>
              <input
                id="seats"
                name="seats"
                type="number"
                min={0}
                defaultValue={initial?.seats ?? ""}
                className="fo-input"
              />
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="price">
                Precio
              </label>
              <input
                id="price"
                name="price"
                required
                defaultValue={initial?.price ?? ""}
                className="fo-input"
              />
              {fe.price ? <p className="text-xs text-[var(--fo-danger)]">{fe.price}</p> : null}
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="currency">
                Moneda
              </label>
              <input
                id="currency"
                name="currency"
                defaultValue={initial?.currency ?? "ARS"}
                className="fo-input"
              />
            </div>
            <div className="fo-field-stack">
              <label className="fo-label" htmlFor="discountPrice">
                Precio promocional
              </label>
              <input
                id="discountPrice"
                name="discountPrice"
                defaultValue={initial?.discountPrice ?? ""}
                className="fo-input"
                placeholder="Opcional"
              />
            </div>
          </div>
          <div className="space-y-3">
            <p className="fo-label">Incluye</p>
            <label className="flex items-center gap-2 text-sm text-[var(--fo-muted)]">
              <input
                type="checkbox"
                name="includesCertificate"
                defaultChecked={initial?.includesCertificate ?? false}
                className="size-4 rounded border-[var(--fo-border)]"
              />
              Certificado
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--fo-muted)]">
              <input
                type="checkbox"
                name="includesRecordings"
                defaultChecked={initial?.includesRecordings ?? false}
                className="size-4 rounded border-[var(--fo-border)]"
              />
              Grabaciones
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--fo-muted)]">
              <input
                type="checkbox"
                name="includesDownloadables"
                defaultChecked={initial?.includesDownloadables ?? false}
                className="size-4 rounded border-[var(--fo-border)]"
              />
              Materiales descargables
            </label>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="coverImageUrl">
              Imagen de portada (URL)
            </label>
            <input
              id="coverImageUrl"
              name="coverImageUrl"
              defaultValue={initial?.coverImageUrl ?? ""}
              className="fo-input"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="galleryImages">
              Galería (una URL por línea)
            </label>
            <textarea
              id="galleryImages"
              name="galleryImages"
              rows={4}
              defaultValue={initial?.galleryImages?.join("\n") ?? ""}
              className="fo-input"
            />
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="fo-card space-y-6">
          <h2 className="text-lg font-semibold text-[var(--fo-text)]">Publicación y SEO</h2>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="status">
              Estado
            </label>
            <select
              id="status"
              name="status"
              className="fo-input"
              defaultValue={initial?.status ?? "DRAFT"}
            >
              <option value="DRAFT">Borrador</option>
              <option value="PUBLISHED">Publicado</option>
              <option value="PAUSED">Pausado</option>
            </select>
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="seoTitle">
              Título SEO
            </label>
            <input
              id="seoTitle"
              name="seoTitle"
              defaultValue={initial?.seoTitle ?? ""}
              className="fo-input"
            />
          </div>
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="seoDescription">
              Meta descripción
            </label>
            <textarea
              id="seoDescription"
              name="seoDescription"
              rows={3}
              defaultValue={initial?.seoDescription ?? ""}
              className="fo-input"
            />
          </div>
          <div>
            <p className="fo-label mb-2">Preguntas frecuentes (hasta 6)</p>
            <p className="fo-helper mb-4">
              Se muestran en la landing pública. Dejá vacías las filas que no uses.
            </p>
            <div className="space-y-4">
              {faqSlots.map((slot, i) => (
                <div key={i} className="grid gap-2 sm:grid-cols-2">
                  <input
                    name={`faq_q_${i + 1}`}
                    defaultValue={slot.q}
                    className="fo-input"
                    placeholder={`Pregunta ${i + 1}`}
                  />
                  <textarea
                    name={`faq_a_${i + 1}`}
                    defaultValue={slot.a}
                    className="fo-input"
                    rows={2}
                    placeholder="Respuesta"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-[var(--fo-success)]" role="status">
          Cambios guardados correctamente.
        </p>
      ) : null}

      <div className="fo-form-actions flex-wrap">
        <button
          type="button"
          className="fo-btn fo-btn-secondary text-sm"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
        >
          Anterior
        </button>
        {step < steps.length - 1 ? (
          <button
            type="button"
            className="fo-btn fo-btn-primary text-sm"
            onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
          >
            Siguiente
          </button>
        ) : null}
        <button type="submit" className="fo-btn fo-btn-primary text-sm ml-auto" disabled={pending}>
          {pending
            ? "Guardando…"
            : mode === "create"
              ? "Crear curso"
              : "Guardar curso"}
        </button>
      </div>
    </form>
  );
}
