"use client";

import { useMemo, useState, useTransition } from "react";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { AiImportButton, AiImportDialog } from "@/components/ai-import";
import type { AiImportMergeMode, EventFormImportValues } from "@/lib/ai-import";
import { EventLocationPanel } from "@/components/geolocation/event-location-panel";
import type { EventLocationPanelValue } from "@/components/geolocation/event-location-panel";
import { defaultLocationValue } from "@/components/geolocation/event-location-form-fields";

type Category = { id: string; name: string; slug?: string };

type Props = {
  categories: Category[];
  action: (formData: FormData) => Promise<void>;
};

const fieldClass =
  "mt-2 w-full rounded-[var(--is-radius-sm)] border border-[var(--is-border-strong)] bg-white px-3 py-3 text-base text-[var(--is-text)] outline-none focus:border-[var(--is-accent)] focus:ring-2 focus:ring-[var(--is-accent)]/20";

type FormState = {
  title: string;
  categoryId: string;
  summary: string;
  description: string;
  startAt: string;
  endAt: string;
  venueName: string;
  city: string;
  province: string;
  address: string;
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string;
  organizerWebsite: string;
  registrationUrl: string;
};

const EMPTY: FormState = {
  title: "",
  categoryId: "",
  summary: "",
  description: "",
  startAt: "",
  endAt: "",
  venueName: "",
  city: "",
  province: "",
  address: "",
  organizerName: "",
  organizerEmail: "",
  organizerPhone: "",
  organizerWebsite: "",
  registrationUrl: "",
};

export function PublicEventForm({ categories, action }: Props) {
  const [pending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [values, setValues] = useState<FormState>(EMPTY);
  const [aiOpen, setAiOpen] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [wantPhotographers, setWantPhotographers] = useState(false);
  const [location, setLocation] = useState<EventLocationPanelValue>(
    defaultLocationValue({}),
  );

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug ?? c.name })),
    [categories],
  );

  const hasExisting = Object.values(values).some((v) => Boolean(v.trim()));

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function applyImport(payload: {
    mode: AiImportMergeMode;
    eventValues?: EventFormImportValues;
  }) {
    const v = payload.eventValues;
    if (!v) return;
    const replace = payload.mode === "replace_all";
    const take = (current: string, next?: string) => {
      if (!next?.trim()) return current;
      if (replace || !current.trim()) return next;
      return current;
    };
    setValues((cur) => ({
      title: take(cur.title, v.title),
      categoryId: take(cur.categoryId, v.categoryId),
      summary: take(cur.summary, v.summary),
      description: take(cur.description, v.description),
      startAt: take(cur.startAt, v.startAt),
      endAt: take(cur.endAt, v.endAt),
      venueName: take(cur.venueName, v.venueName),
      city: take(cur.city, v.city),
      province: take(cur.province, v.province),
      address: take(cur.address, v.address),
      organizerName: take(cur.organizerName, v.organizerName),
      organizerEmail: take(cur.organizerEmail, v.organizerEmail),
      organizerPhone: take(cur.organizerPhone, v.organizerPhone),
      organizerWebsite: take(cur.organizerWebsite, v.organizerWebsite),
      registrationUrl: take(cur.registrationUrl, v.registrationUrl ?? v.sourceUrl),
    }));
    setLocation((cur) => ({
      ...cur,
      venueName: v.venueName?.trim() || cur.venueName,
      city: v.city?.trim() || cur.city,
      province: v.province?.trim() || cur.province,
      address: v.address?.trim() || cur.address,
      geocodingStatus: "NEEDS_REVIEW",
      locationConfirmedAt: null,
    }));
    setBanner(
      v.notesForEditor
        ? `Importación aplicada. Revisá: ${v.notesForEditor}`
        : "Importación aplicada. Revisá los datos antes de enviar.",
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--is-muted)]">
          ¿Tenés un flyer o comunicado? Importá los datos con IA y después revisalos.
        </p>
        <AiImportButton onClick={() => setAiOpen(true)} />
      </div>

      {banner ? (
        <p
          className="rounded-[var(--is-radius-sm)] border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
          role="status"
        >
          {banner}
        </p>
      ) : null}

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
            Company fax
            <input
              type="text"
              name="company_fax_url"
              tabIndex={-1}
              autoComplete="off"
              defaultValue=""
            />
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
              value={values.title}
              onChange={(e) => setField("title", e.target.value)}
              placeholder="Ej. Carrera 10K Costanera"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Categoría</span>
            <select
              name="categoryId"
              className={fieldClass}
              value={values.categoryId}
              onChange={(e) => setField("categoryId", e.target.value)}
            >
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
              value={values.summary}
              onChange={(e) => setField("summary", e.target.value)}
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
              value={values.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="Contá de qué se trata…"
            />
          </label>
        </fieldset>

        <fieldset className="space-y-4" disabled={pending || submitted}>
          <legend className="is-eyebrow mb-2">Cuándo y dónde</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium">Inicio *</span>
              <input
                required
                type="datetime-local"
                name="startAt"
                className={fieldClass}
                value={values.startAt}
                onChange={(e) => setField("startAt", e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium">Fin</span>
              <input
                type="datetime-local"
                name="endAt"
                className={fieldClass}
                value={values.endAt}
                onChange={(e) => setField("endAt", e.target.value)}
              />
            </label>
          </div>
          <EventLocationPanel
            mode="public"
            value={location}
            searchEndpoint="/api/geocode"
            reverseEndpoint="/api/geocode/reverse"
            disabled={pending || submitted}
            onChange={(patch) => {
              setLocation((prev) => ({ ...prev, ...patch }));
              setValues((v) => ({
                ...v,
                ...(patch.city !== undefined ? { city: patch.city } : {}),
                ...(patch.province !== undefined ? { province: patch.province } : {}),
                ...(patch.address !== undefined ? { address: patch.address } : {}),
                ...(patch.venueName !== undefined ? { venueName: patch.venueName } : {}),
              }));
            }}
          />
        </fieldset>

        <fieldset className="space-y-4" disabled={pending || submitted}>
          <legend className="is-eyebrow mb-2">Fotógrafos</legend>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="wantPhotographers"
              value="true"
              className="mt-1 size-4"
              onChange={(e) => setWantPhotographers(e.target.checked)}
            />
            <span>
              <span className="font-semibold">¿Querés conseguir fotógrafos?</span>
              <span className="block text-[var(--is-muted)]">
                La redacción revisará tu pedido. La inscripción se gestiona en ComprameLaFoto
                después de aprobar.
              </span>
            </span>
          </label>
          {wantPhotographers ? (
            <div className="space-y-4 border-t border-[var(--is-border)] pt-4">
              <label className="block">
                <span className="text-sm font-medium">Modalidad</span>
                <select name="photographerJoinPolicy" className={fieldClass} defaultValue="OPEN">
                  <option value="OPEN">Ingreso abierto</option>
                  <option value="REQUEST">Con aprobación</option>
                </select>
              </label>
              <label className="block">
                <span className="text-sm font-medium">Cupo aproximado (opcional)</span>
                <input
                  name="photographerMax"
                  type="number"
                  min={1}
                  className={fieldClass}
                  placeholder="Ilimitado"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium">Condiciones básicas</span>
                <textarea name="photographerTerms" rows={3} className={fieldClass} />
              </label>
            </div>
          ) : null}
        </fieldset>

        <fieldset className="space-y-4" disabled={pending || submitted}>
          <legend className="is-eyebrow mb-2">Organizador</legend>
          <label className="block">
            <span className="text-sm font-medium">Nombre *</span>
            <input
              required
              name="organizerName"
              maxLength={120}
              className={fieldClass}
              value={values.organizerName}
              onChange={(e) => setField("organizerName", e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Email *</span>
            <input
              required
              type="email"
              name="organizerEmail"
              maxLength={200}
              className={fieldClass}
              value={values.organizerEmail}
              onChange={(e) => setField("organizerEmail", e.target.value)}
            />
            <span className="mt-1 block text-xs text-[var(--is-muted)]">
              No se muestra públicamente. Solo para contacto editorial.
            </span>
          </label>
          <label className="block">
            <span className="text-sm font-medium">Teléfono</span>
            <input
              name="organizerPhone"
              maxLength={40}
              className={fieldClass}
              value={values.organizerPhone}
              onChange={(e) => setField("organizerPhone", e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Web o redes</span>
            <input
              name="organizerWebsite"
              type="url"
              placeholder="https://"
              className={fieldClass}
              value={values.organizerWebsite}
              onChange={(e) => setField("organizerWebsite", e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Enlace de inscripción</span>
            <input
              name="registrationUrl"
              type="url"
              placeholder="https://"
              className={fieldClass}
              value={values.registrationUrl}
              onChange={(e) => setField("registrationUrl", e.target.value)}
            />
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

      <AiImportDialog
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        context="EVENT"
        categories={categoryOptions}
        hasExistingValues={hasExisting}
        onApply={applyImport}
      />
    </div>
  );
}
