"use client";

import { useMemo, useState, useTransition } from "react";
import { updateFotorankContest } from "../../../../../actions/contests";
import { inputBase, textareaWizard } from "../../../../../components/ui/form";

type Contest = NonNullable<
  Awaited<ReturnType<typeof import("../../../../../lib/fotorank/contests").getFotorankContestById>>
>;

type Props = {
  contest: Contest;
  onSuccess: () => void;
  onCancel: () => void;
  readOnly?: boolean;
  restrictionMessage?: string | null;
};

type ChecklistItem = { label: string; ok: boolean; critical?: boolean };

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Borrador" },
  { value: "READY_TO_PUBLISH", label: "Listo para publicar" },
  { value: "PUBLISHED", label: "Publicado" },
  { value: "CLOSED", label: "Cerrado" },
  { value: "ARCHIVED", label: "Archivado" },
] as const;

const VISIBILITY_OPTIONS = [
  { value: "PUBLIC", label: "Público abierto" },
  { value: "UNLISTED", label: "Solo con link (invitación)" },
  { value: "PRIVATE", label: "Privado / interno" },
] as const;

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function PublicacionModalContent({ contest, onSuccess, onCancel, readOnly, restrictionMessage }: Props) {
  const [title, setTitle] = useState(contest.title ?? "");
  const [slug, setSlug] = useState(contest.slug ?? "");
  const [shortDescription, setShortDescription] = useState(contest.shortDescription ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(contest.coverImageUrl ?? "");
  const [rulesText, setRulesText] = useState(contest.rulesText ?? "");
  const [prizesSummary, setPrizesSummary] = useState(contest.prizesSummary ?? "");
  const [sponsorsText, setSponsorsText] = useState(contest.sponsorsText ?? "");
  const [status, setStatus] = useState<"DRAFT" | "READY_TO_PUBLISH" | "PUBLISHED" | "CLOSED" | "ARCHIVED">(
    contest.status === "ACTIVE" ? "PUBLISHED" : (contest.status as "DRAFT" | "READY_TO_PUBLISH" | "PUBLISHED" | "CLOSED" | "ARCHIVED")
  );
  const [visibility, setVisibility] = useState<"PUBLIC" | "UNLISTED" | "PRIVATE">(contest.visibility);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const checklist = useMemo<ChecklistItem[]>(() => {
    return [
      { label: "Título público", ok: title.trim().length >= 6, critical: true },
      { label: "Slug válido", ok: isValidSlug(slug.trim()), critical: true },
      { label: "Descripción breve (hero)", ok: shortDescription.trim().length >= 20, critical: true },
      { label: "Portada (URL)", ok: coverImageUrl.trim().length > 8, critical: true },
      { label: "Bases y condiciones", ok: rulesText.trim().length >= 30, critical: true },
      { label: "Fecha de cierre", ok: Boolean(contest.submissionDeadline), critical: true },
      { label: "Fecha de inicio", ok: Boolean(contest.startAt), critical: true },
      { label: "Categorías activas", ok: contest.categories.some((c) => c.status === "ACTIVE"), critical: true },
      { label: "Premios (recomendado)", ok: prizesSummary.trim().length >= 8, critical: false },
      { label: "Sponsors / aliados (opcional)", ok: sponsorsText.trim().length >= 8, critical: false },
    ];
  }, [title, slug, shortDescription, coverImageUrl, rulesText, contest.submissionDeadline, contest.startAt, contest.categories, prizesSummary, sponsorsText]);

  const criticalPending = checklist.filter((i) => i.critical && !i.ok).length;
  const allCriticalReady = criticalPending === 0;

  const onSave = (publishNow: boolean) => {
    if (readOnly) return;
    setError(null);
    setSuccessMsg(null);
    if (publishNow && !allCriticalReady) {
      setError("Faltan campos críticos en el checklist. Completalos antes de publicar.");
      return;
    }
    start(async () => {
      const result = await updateFotorankContest(contest.id, {
        title: title.trim(),
        slug: slug.trim(),
        shortDescription: shortDescription.trim(),
        coverImageUrl: coverImageUrl.trim(),
        rulesText: rulesText.trim(),
        prizesSummary: prizesSummary.trim(),
        sponsorsText: sponsorsText.trim(),
        visibility,
        status: publishNow ? "PUBLISHED" : status,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccessMsg(publishNow ? "Concurso publicado correctamente." : "Cambios de publicación guardados.");
      onSuccess();
    });
  };

  const itemCls = (ok: boolean, critical?: boolean) =>
    ok
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
      : critical
        ? "border-red-500/30 bg-red-500/10 text-red-200"
        : "border-amber-500/30 bg-amber-500/10 text-amber-200";

  return (
    <div className="space-y-6">
      {restrictionMessage ? (
        <div className="rounded-lg border border-gold/30 bg-gold/10 px-4 py-3 text-sm text-gold">{restrictionMessage}</div>
      ) : null}
      {error ? <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div> : null}
      {successMsg ? <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">{successMsg}</div> : null}

      <section className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-fr-muted">Checklist de publicación</h3>
        <div className="grid gap-2">
          {checklist.map((it) => (
            <div key={it.label} className={`rounded-lg border px-3 py-2 text-xs ${itemCls(it.ok, it.critical)}`}>
              {it.ok ? "Completo" : it.critical ? "Incompleto" : "Pendiente"} · {it.label}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-fr-muted">Datos públicos</h3>
        <div className="fr-field-stack">
          <label className="text-sm font-medium text-fr-primary">Título público</label>
          <input className={inputBase} value={title} onChange={(e) => setTitle(e.target.value)} disabled={readOnly || pending} />
        </div>
        <div className="fr-field-stack">
          <label className="text-sm font-medium text-fr-primary">Slug</label>
          <input className={inputBase} value={slug} onChange={(e) => setSlug(e.target.value)} disabled={readOnly || pending} placeholder="mi-concurso-2026" />
          <p className="text-xs text-fr-muted">URL pública: /concursos/{slug || "slug"}</p>
        </div>
        <div className="fr-field-stack">
          <label className="text-sm font-medium text-fr-primary">Bajada comercial (hero)</label>
          <textarea className={textareaWizard} rows={3} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} disabled={readOnly || pending} />
        </div>
        <div className="fr-field-stack">
          <label className="text-sm font-medium text-fr-primary">Portada (URL)</label>
          <input className={inputBase} value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} disabled={readOnly || pending} placeholder="https://..." />
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-fr-muted">Publicación y visibilidad</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="fr-field-stack">
            <span className="text-sm font-medium text-fr-primary">Estado</span>
            <select className={inputBase} value={status} onChange={(e) => setStatus(e.target.value as typeof status)} disabled={readOnly || pending}>
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="fr-field-stack">
            <span className="text-sm font-medium text-fr-primary">Visibilidad</span>
            <select className={inputBase} value={visibility} onChange={(e) => setVisibility(e.target.value as typeof visibility)} disabled={readOnly || pending}>
              {VISIBILITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-fr-muted">Contenido de conversión</h3>
        <div className="fr-field-stack">
          <label className="text-sm font-medium text-fr-primary">Premios destacados</label>
          <textarea className={textareaWizard} rows={4} value={prizesSummary} onChange={(e) => setPrizesSummary(e.target.value)} disabled={readOnly || pending} />
        </div>
        <div className="fr-field-stack">
          <label className="text-sm font-medium text-fr-primary">Sponsors / apoyos</label>
          <textarea className={textareaWizard} rows={3} value={sponsorsText} onChange={(e) => setSponsorsText(e.target.value)} disabled={readOnly || pending} />
        </div>
        <div className="fr-field-stack">
          <label className="text-sm font-medium text-fr-primary">Bases y condiciones</label>
          <textarea className={textareaWizard} rows={8} value={rulesText} onChange={(e) => setRulesText(e.target.value)} disabled={readOnly || pending} />
        </div>
      </section>

      <div className="fr-form-actions flex flex-wrap gap-2">
        <button type="button" className="fr-btn fr-btn-primary" disabled={readOnly || pending} onClick={() => onSave(false)}>
          Guardar publicación
        </button>
        <button type="button" className="fr-btn fr-btn-primary" disabled={readOnly || pending || !allCriticalReady} onClick={() => onSave(true)}>
          Publicar concurso
        </button>
        <button type="button" className="fr-btn fr-btn-secondary" onClick={onCancel}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
