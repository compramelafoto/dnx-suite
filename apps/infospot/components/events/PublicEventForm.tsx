"use client";

import { useState, useTransition } from "react";
import { isRedirectError } from "next/dist/client/components/redirect-error";

type Category = { id: string; name: string };

type Props = {
  categories: Category[];
  action: (formData: FormData) => Promise<void>;
};

const fieldClass =
  "mt-2 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] bg-white px-3 py-3 text-base text-[var(--is-text)] outline-none focus:border-[var(--is-accent)] focus:ring-2 focus:ring-[var(--is-accent)]/20";

export function PublicEventForm({ categories, action }: Props) {
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  return (
    <form
      className="relative space-y-8"
      encType="multipart/form-data"
      action={(fd) => {
        if (submitted || pending) return;
        setSubmitted(true);
        startTransition(async () => {
          try {
            await action(fd);
          } catch (e) {
            if (isRedirectError(e)) throw e;
            setSubmitted(false);
          }
        });
      }}
    >
      <div
        className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0"
        aria-hidden
      >
        <label>
          Website
          <input type="text" name="website_url" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <fieldset className="space-y-4" disabled={pending || submitted}>
        <legend className="is-eyebrow mb-2">El evento</legend>
        <label className="block">
          <span className="text-sm font-medium">Nombre del evento *</span>
          <input
            required
            name="title"
            maxLength={160}
            className={fieldClass}
            placeholder="Ej. Carrera 10K Costanera"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Categoría</span>
          <select name="categoryId" className={fieldClass}>
            <option value="">Elegí una categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Resumen breve</span>
          <input
            name="summary"
            maxLength={280}
            className={fieldClass}
            placeholder="Una línea para la agenda"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Descripción *</span>
          <textarea
            required
            name="description"
            rows={6}
            maxLength={8000}
            className={fieldClass}
            placeholder="Contá de qué se trata…"
          />
        </label>
      </fieldset>

      <fieldset className="space-y-4" disabled={pending || submitted}>
        <legend className="is-eyebrow mb-2">Cuándo y dónde</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Inicio *</span>
            <input required type="datetime-local" name="startAt" className={fieldClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Fin</span>
            <input type="datetime-local" name="endAt" className={fieldClass} />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium">Lugar / venue</span>
          <input name="venueName" maxLength={160} className={fieldClass} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-medium">Ciudad *</span>
            <input required name="city" maxLength={100} className={fieldClass} />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Provincia *</span>
            <input required name="province" maxLength={100} className={fieldClass} />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-medium">Dirección</span>
          <input name="address" maxLength={240} className={fieldClass} />
        </label>
      </fieldset>

      <fieldset className="space-y-4" disabled={pending || submitted}>
        <legend className="is-eyebrow mb-2">Organizador</legend>
        <label className="block">
          <span className="text-sm font-medium">Nombre *</span>
          <input required name="organizerName" maxLength={120} className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Email *</span>
          <input required type="email" name="organizerEmail" maxLength={200} className={fieldClass} />
          <span className="mt-1 block text-xs text-[var(--is-muted)]">
            No se muestra públicamente. Solo para contacto editorial.
          </span>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Teléfono</span>
          <input name="organizerPhone" maxLength={40} className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Web o redes</span>
          <input name="organizerWebsite" type="url" placeholder="https://" className={fieldClass} />
        </label>
        <label className="block">
          <span className="text-sm font-medium">Enlace de inscripción</span>
          <input name="registrationUrl" type="url" placeholder="https://" className={fieldClass} />
        </label>
      </fieldset>

      <fieldset className="space-y-4" disabled={pending || submitted}>
        <legend className="is-eyebrow mb-2">Imagen</legend>
        <label className="block space-y-2">
          <span className="text-sm font-medium">Portada (opcional)</span>
          <input
            type="file"
            name="coverImage"
            accept="image/jpeg,image/png,image/webp"
            className="block w-full text-sm"
          />
          <span className="text-xs text-[var(--is-muted)]">JPG, PNG o WebP · máx. 5 MB</span>
        </label>
      </fieldset>

      <label className="flex items-start gap-3 text-sm">
        <input
          required
          type="checkbox"
          name="acceptTerms"
          value="on"
          className="mt-1"
          disabled={pending || submitted}
        />
        <span>
          Acepto que Info Spot revise editorialmente el envío antes de publicarlo, y que el
          email/teléfono no se muestren en la ficha pública. *
        </span>
      </label>

      <button
        type="submit"
        disabled={pending || submitted}
        className="is-btn is-btn-solid h-12 min-w-[12rem] text-sm disabled:opacity-60"
      >
        {pending || submitted ? "Enviando…" : "Enviar a revisión"}
      </button>
    </form>
  );
}
