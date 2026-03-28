"use client";

import { useEffect, useState } from "react";
import { Button, FormField, FormSection, radius, spacing, useResolvedTheme } from "@repo/design-system";
import {
  createJudgeAssignmentsBatch,
  type JudgeMethodType,
} from "../../../actions/judges";

interface AssignmentsPageClientProps {
  judges: Array<{ id: string; label: string }>;
  contests: Array<{ id: string; title: string; categories: Array<{ id: string; name: string }> }>;
}

export function AssignmentsPageClient({ judges, contests }: AssignmentsPageClientProps) {
  const theme = useResolvedTheme();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [contestId, setContestId] = useState("");
  const [allCategoriesMode, setAllCategoriesMode] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(() => new Set());

  const selectedContest = contests.find((c) => c.id === contestId);

  useEffect(() => {
    setAllCategoriesMode(false);
    setSelectedCategoryIds(new Set());
  }, [contestId]);

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

  const checkboxRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: spacing[2],
    marginBottom: spacing[2],
    fontSize: "0.95rem",
    color: theme.text.primary,
  };

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    setError(null);
    setOk(null);

    const methodType = String(fd.get("methodType") ?? "SCORE_1_10") as JudgeMethodType;
    const quota = Number(fd.get("quota") ?? 0);

    if (!allCategoriesMode && selectedCategoryIds.size === 0) {
      setSaving(false);
      setError("Seleccioná al menos una categoría o marcá «Todas las categorías del concurso».");
      return;
    }

    const result = await createJudgeAssignmentsBatch({
      judgeAccountId: String(fd.get("judgeAccountId") ?? ""),
      contestId,
      allCategories: allCategoriesMode,
      categoryIds: allCategoriesMode ? [] : [...selectedCategoryIds],
      assignmentType: String(fd.get("assignmentType") ?? "PRIMARY") as "PRIMARY" | "BACKUP",
      evaluationStartsAt: String(fd.get("evaluationStartsAt") ?? "") || undefined,
      evaluationEndsAt: String(fd.get("evaluationEndsAt") ?? "") || undefined,
      methodType,
      methodConfigJson: methodType === "SELECTION_WITH_QUOTA" ? { quota: Math.max(1, quota || 1) } : {},
      allowVoteEdit: fd.get("allowVoteEdit") === "on",
      commentsVisibleToParticipants: fd.get("commentsVisibleToParticipants") === "on",
      sendInvitationNow: fd.get("sendInvitationNow") === "on",
    });

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const { created = 0, skippedExisting = 0 } = result.data ?? {};
    if (created === 0 && skippedExisting > 0) {
      setOk(
        `No se crearon asignaciones nuevas: las ${skippedExisting} categorías elegidas ya tenían asignación para este jurado y concurso.`,
      );
    } else if (skippedExisting > 0) {
      setOk(
        `Se crearon ${created} asignación${created === 1 ? "" : "es"}. Se omitieron ${skippedExisting} por duplicado (jurado + concurso + categoría).`,
      );
    } else {
      setOk(`Se crearon ${created} asignación${created === 1 ? "" : "es"}.`);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: spacing[6] }}>
      {error ? <p style={{ color: "#fca5a5" }}>{error}</p> : null}
      {ok ? <p style={{ color: "#86efac" }}>{ok}</p> : null}
      <FormSection title="Nueva asignación" style={{ marginBottom: 0 }}>
        <FormField label="Jurado" htmlFor="as-judge" required>
          <select id="as-judge" name="judgeAccountId" style={controlStyle} required>
            <option value="">Seleccionar</option>
            {judges.map((j) => (
              <option key={j.id} value={j.id}>
                {j.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Concurso" htmlFor="as-contest" required>
          <select
            id="as-contest"
            name="contestId"
            style={controlStyle}
            required
            value={contestId}
            onChange={(e) => setContestId(e.target.value)}
          >
            <option value="">Seleccionar</option>
            {contests.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </FormField>

        {!contestId ? (
          <p style={{ fontSize: "0.875rem", color: theme.text.secondary }}>Elegí un concurso para ver sus categorías.</p>
        ) : !selectedContest || selectedContest.categories.length === 0 ? (
          <p style={{ fontSize: "0.875rem", color: "#fca5a5" }}>
            Este concurso no tiene categorías. Creá categorías en la configuración del concurso antes de asignar jurados.
          </p>
        ) : (
          <FormField
            label="Categorías"
            htmlFor="as-all-cats"
            helperText="Podés asignar una, varias o todas. Cada categoría genera una asignación independiente (trazabilidad)."
          >
            <div style={{ marginTop: spacing[2] }}>
              <label style={{ ...checkboxRowStyle, fontWeight: 600 }}>
                <input
                  id="as-all-cats"
                  type="checkbox"
                  checked={allCategoriesMode}
                  onChange={(e) => {
                    setAllCategoriesMode(e.target.checked);
                    if (e.target.checked) setSelectedCategoryIds(new Set());
                  }}
                />
                Todas las categorías del concurso
              </label>
              {!allCategoriesMode ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: spacing[1],
                    paddingLeft: spacing[2],
                    borderLeft: `2px solid ${theme.border.subtle}`,
                  }}
                >
                  {selectedContest.categories.map((cat) => (
                    <label key={cat.id} style={checkboxRowStyle}>
                      <input
                        type="checkbox"
                        checked={selectedCategoryIds.has(cat.id)}
                        onChange={() => toggleCategory(cat.id)}
                      />
                      {cat.name}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          </FormField>
        )}

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
        <label style={checkboxRowStyle}>
          <input type="checkbox" name="allowVoteEdit" defaultChecked /> Permitir editar voto
        </label>
        <label style={checkboxRowStyle}>
          <input type="checkbox" name="commentsVisibleToParticipants" /> Comentarios visibles a participantes
        </label>
        <label style={checkboxRowStyle}>
          <input type="checkbox" name="sendInvitationNow" /> Enviar invitación ahora
        </label>
      </FormSection>
      <Button type="submit" disabled={saving || !contestId || !selectedContest?.categories.length}>
        {saving ? "Guardando..." : "Crear asignaciones"}
      </Button>
    </form>
  );
}
