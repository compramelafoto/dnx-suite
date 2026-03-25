"use client";

import { useState } from "react";
import { updateContestFromFormModal } from "../../../../../actions/contests";
import { inputBase, textareaWizard } from "../../../../../components/ui/form";
import { getDisplayStatus } from "../../../../../lib/contest-rules";

type Contest = NonNullable<
  Awaited<ReturnType<typeof import("../../../../../lib/fotorank/contests").getFotorankContestById>>
>;

const STATUS_OPTIONS = [
  { value: "DRAFT", label: "Borrador" },
  { value: "READY_TO_PUBLISH", label: "Listo para publicar" },
  { value: "PUBLISHED", label: "Publicado" },
  { value: "CLOSED", label: "Cerrado" },
  { value: "ARCHIVED", label: "Archivado" },
] as const;

interface DatosModalContentProps {
  contest: Contest;
  onSuccess: () => void;
  onCancel: () => void;
  readOnly?: boolean;
  restrictionMessage?: string | null;
}

export function DatosModalContent({ contest, onSuccess, onCancel, readOnly, restrictionMessage }: DatosModalContentProps) {
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (readOnly) return;
    setError(null);
    setSaving(true);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await updateContestFromFormModal(formData);
    setSaving(false);
    if (result.ok) {
      onSuccess();
    } else {
      setError(result.error ?? "Error al guardar");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <input type="hidden" name="contestId" value={contest.id} />
      {restrictionMessage && (
        <div className="rounded-lg border border-gold/30 bg-gold/5 px-4 py-3 text-sm text-gold">
          {restrictionMessage}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
          {error}
        </div>
      )}
      <div className="flex flex-col gap-[var(--fr-comp-between-fields)]">
        <div className="fr-field-stack">
          <label htmlFor="modal-title" className="block text-sm font-medium text-fr-primary">Título *</label>
          <input id="modal-title" name="title" type="text" required defaultValue={contest.title} className={inputBase} placeholder="Nombre del concurso" disabled={readOnly} />
        </div>
        <div className="fr-field-stack">
          <label htmlFor="modal-shortDesc" className="block text-sm font-medium text-fr-primary">Descripción breve</label>
          <input id="modal-shortDesc" name="shortDescription" type="text" defaultValue={contest.shortDescription ?? ""} className={inputBase} placeholder="Resumen para listados" disabled={readOnly} />
        </div>
        <div className="fr-field-stack">
          <label htmlFor="modal-fullDesc" className="block text-sm font-medium text-fr-primary">Descripción completa</label>
          <textarea id="modal-fullDesc" name="fullDescription" defaultValue={contest.fullDescription ?? ""} className={textareaWizard} placeholder="Descripción detallada" rows={4} disabled={readOnly} />
        </div>
        <div className="fr-field-stack">
          <label htmlFor="modal-status" className="block text-sm font-medium text-fr-primary">Estado</label>
          <select id="modal-status" name="status" defaultValue={
            getDisplayStatus(contest.status) === "READY"
              ? "READY_TO_PUBLISH"
              : contest.status === "ACTIVE"
                ? "PUBLISHED"
                : contest.status === "SETUP_IN_PROGRESS"
                  ? "DRAFT"
                  : contest.status
          } className="block w-full rounded-lg border border-[#262626] bg-[#0a0a0a] px-5 py-3 text-fr-primary" disabled={readOnly}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="fr-form-actions">
        <button type="submit" className="fr-btn fr-btn-primary" disabled={readOnly || saving}>{saving ? "Guardando…" : "Guardar"}</button>
        <button type="button" onClick={onCancel} className="fr-btn fr-btn-secondary">Cancelar</button>
      </div>
    </form>
  );
}
