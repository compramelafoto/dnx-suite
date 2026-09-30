"use client";

import { useEffect, useState } from "react";
import { Button, FormField, FormSection, spacing, useResolvedTheme } from "@repo/design-system";
import { datetimeLocalBase, selectBase } from "../../../components/ui/form";
import { createJudgeAssignmentsBatch } from "../../../actions/judges";
import { mensajeDeAsignacion } from "../../../lib/fotorank/judges/mensajeDeAsignacion";

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
      // Un solo método: la rúbrica del concurso. El puntaje único por
      // asignación (1 a 5, 1 a 10, favoritas…) se quitó el 2026-09-24.
      methodType: "CRITERIA_BASED",
      methodConfigJson: {},
      allowVoteEdit: fd.get("allowVoteEdit") === "on",
      commentsVisibleToParticipants: fd.get("commentsVisibleToParticipants") === "on",
      // La casilla "Enviar invitación ahora" no mandaba nada y dejaba la
      // asignación trabada: el jurado no podía entrar y no había pantalla para
      // aceptarla. Se quitó el 2026-09-25; asignar a quien ya trabaja con la
      // organización no necesita invitación.
      sendInvitationNow: false,
    });

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const { created = 0, skippedExisting = 0, skippedCompite = 0 } = result.data ?? {};
    setOk(mensajeDeAsignacion({ created, skippedExisting, skippedCompite }));
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: spacing[6] }}>
      {error ? (
        <p className="fr-form-error-text rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? <p className="fr-form-success-text rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3">{ok}</p> : null}
      <FormSection title="Nueva asignación" style={{ marginBottom: 0 }}>
        <FormField label="Jurado" htmlFor="as-judge" required>
          <select id="as-judge" name="judgeAccountId" className={selectBase} required>
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
            className={selectBase}
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
          <select id="as-type" name="assignmentType" className={selectBase}>
            <option value="PRIMARY">Titular</option>
            <option value="BACKUP">Suplente</option>
          </select>
        </FormField>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
          <FormField
            label="Inicio de evaluación"
            htmlFor="as-eval-start"
            helperText="Formato local del navegador. Tocá el campo o el ícono del calendario."
          >
            <input id="as-eval-start" name="evaluationStartsAt" type="datetime-local" className={datetimeLocalBase} />
          </FormField>
          <FormField
            label="Fin de evaluación"
            htmlFor="as-eval-end"
            helperText="Debe ser posterior al inicio si ambos están definidos."
          >
            <input id="as-eval-end" name="evaluationEndsAt" type="datetime-local" className={datetimeLocalBase} />
          </FormField>
        </div>
        <label style={checkboxRowStyle}>
          <input type="checkbox" name="allowVoteEdit" defaultChecked /> Permitir editar voto
        </label>
        <label style={checkboxRowStyle}>
          <input type="checkbox" name="commentsVisibleToParticipants" /> Comentarios visibles a participantes
        </label>
      </FormSection>
      <Button type="submit" disabled={saving || !contestId || !selectedContest?.categories.length}>
        {saving ? "Guardando..." : "Crear asignaciones"}
      </Button>
    </form>
  );
}
