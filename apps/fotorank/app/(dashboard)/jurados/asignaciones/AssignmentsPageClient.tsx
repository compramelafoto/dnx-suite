"use client";

import { useState } from "react";
import { Button, FormField, FormSection, radius, spacing, useResolvedTheme } from "@repo/design-system";
import { createJudgeAssignment } from "../../../actions/judges";

interface AssignmentsPageClientProps {
  judges: Array<{ id: string; label: string }>;
  contests: Array<{ id: string; title: string; categories: Array<{ id: string; name: string }> }>;
}

export function AssignmentsPageClient({ judges, contests }: AssignmentsPageClientProps) {
  const theme = useResolvedTheme();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const controlStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: radius.button,
    border: `1px solid ${theme.border.subtle}`,
    background: theme.surface.base,
    color: theme.text.primary,
    padding: `${spacing[3]} ${spacing[4]}`,
    fontSize: "0.95rem",
    outline: "none",
  };

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    setError(null);
    setOk(null);
    const methodType = String(fd.get("methodType") ?? "SCORE_1_10") as any;
    const quota = Number(fd.get("quota") ?? 0);
    const result = await createJudgeAssignment({
      judgeAccountId: String(fd.get("judgeAccountId") ?? ""),
      contestId: String(fd.get("contestId") ?? ""),
      categoryId: String(fd.get("categoryId") ?? ""),
      assignmentType: String(fd.get("assignmentType") ?? "PRIMARY") as any,
      evaluationStartsAt: String(fd.get("evaluationStartsAt") ?? "") || undefined,
      evaluationEndsAt: String(fd.get("evaluationEndsAt") ?? "") || undefined,
      methodType,
      methodConfigJson: methodType === "SELECTION_WITH_QUOTA" ? { quota: Math.max(1, quota || 1) } : {},
      allowVoteEdit: fd.get("allowVoteEdit") === "on",
      commentsVisibleToParticipants: fd.get("commentsVisibleToParticipants") === "on",
      sendInvitationNow: fd.get("sendInvitationNow") === "on",
    });
    setSaving(false);
    if (result.ok) setOk("Asignación creada correctamente");
    else setError(result.error);
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: spacing[6] }}>
      {error ? <p style={{ color: "#fca5a5" }}>{error}</p> : null}
      {ok ? <p style={{ color: "#86efac" }}>{ok}</p> : null}
      <FormSection title="Nueva asignación" style={{ marginBottom: 0 }}>
        <FormField label="Jurado" htmlFor="as-judge" required>
          <select id="as-judge" name="judgeAccountId" style={controlStyle} required>
            <option value="">Seleccionar</option>
            {judges.map((j) => <option key={j.id} value={j.id}>{j.label}</option>)}
          </select>
        </FormField>
        <FormField label="Concurso" htmlFor="as-contest" required>
          <select id="as-contest" name="contestId" style={controlStyle} required>
            <option value="">Seleccionar</option>
            {contests.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
        </FormField>
        <FormField label="Categoría" htmlFor="as-category" required helperText="Ingresar ID de categoría por ahora (UI dinámica próxima fase).">
          <input id="as-category" name="categoryId" style={controlStyle} placeholder="categoryId" required />
        </FormField>
        <FormField label="Tipo de asignación" htmlFor="as-type" required>
          <select id="as-type" name="assignmentType" style={controlStyle}>
            <option value="PRIMARY">Titular</option>
            <option value="BACKUP">Suplente</option>
          </select>
        </FormField>
        <FormField label="Método de calificación" htmlFor="as-method" required>
          <select id="as-method" name="methodType" style={controlStyle}>
            <option value="SCORE_1_5">1 a 5</option>
            <option value="SCORE_1_10">1 a 10</option>
            <option value="SCORE_0_100">0 a 100</option>
            <option value="YES_NO">Sí / No</option>
            <option value="FAVORITES_SELECTION">Favoritas</option>
            <option value="SELECTION_WITH_QUOTA">Selección con cupo</option>
            <option value="CRITERIA_BASED">Criterios múltiples</option>
          </select>
        </FormField>
        <FormField label="Cupo (si aplica)">
          <input name="quota" type="number" min={1} defaultValue={1} style={controlStyle} />
        </FormField>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: spacing[4] }}>
          <FormField label="Inicio de evaluación">
            <input name="evaluationStartsAt" type="datetime-local" style={controlStyle} />
          </FormField>
          <FormField label="Fin de evaluación">
            <input name="evaluationEndsAt" type="datetime-local" style={controlStyle} />
          </FormField>
        </div>
        <label><input type="checkbox" name="allowVoteEdit" defaultChecked /> Permitir editar voto</label>
        <label><input type="checkbox" name="commentsVisibleToParticipants" /> Comentarios visibles a participantes</label>
        <label><input type="checkbox" name="sendInvitationNow" /> Enviar invitación ahora</label>
      </FormSection>
      <Button type="submit" disabled={saving}>{saving ? "Guardando..." : "Crear asignación"}</Button>
    </form>
  );
}
