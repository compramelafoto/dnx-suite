"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Card, FormField, radius, spacing, useResolvedTheme } from "@repo/design-system";
import {
  judgeEvaluationVoteAction,
  type JudgeEvaluationVoteFormState,
} from "../../../../actions/judges";
import { parseCriteriaBasedMethodConfig } from "../../../../lib/fotorank/judges/criteriaBased";

type Entry = {
  id: string;
  imageUrl: string;
  title?: string | null;
  description?: string | null;
  currentVote?: {
    valueNumeric?: number | null;
    valueBoolean?: boolean | null;
    isFavorite?: boolean | null;
    selectedRank?: number | null;
    comment?: string | null;
    criteriaScoresJson?: unknown;
  } | null;
};

interface EvaluationClientProps {
  assignmentId: string;
  methodType: string;
  methodConfig: unknown;
  entries: Entry[];
}

function readCriteriaDefaults(criteriaScoresJson: unknown): Record<string, number> {
  if (!criteriaScoresJson || typeof criteriaScoresJson !== "object" || Array.isArray(criteriaScoresJson)) {
    return {};
  }
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(criteriaScoresJson as Record<string, unknown>)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) out[k] = n;
  }
  return out;
}

const voteFormInitialState: JudgeEvaluationVoteFormState = { error: null, okMessage: null };

function EvaluationVoteSubmitButton({ criteriaInvalid }: { criteriaInvalid: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || criteriaInvalid}
      data-testid="evaluation-submit"
      className="fr-btn fr-btn-primary"
    >
      {pending ? "Guardando..." : "Guardar"}
    </button>
  );
}

type CriteriaParseResult = ReturnType<typeof parseCriteriaBasedMethodConfig>;

type EntryVoteFormProps = {
  assignmentId: string;
  methodType: string;
  methodConfig: unknown;
  entry: Entry;
  criteriaConfig: CriteriaParseResult | null;
  criteriaDefaults: Record<string, number>;
  criteriaInvalid: boolean;
  criteriaErrorMessage: string | null;
  controlStyle: React.CSSProperties;
  range: { min: number; max: number; step: number };
  index: number;
  entriesLength: number;
  setIndex: React.Dispatch<React.SetStateAction<number>>;
};

function EvaluationEntryVoteForm({
  assignmentId,
  methodType,
  methodConfig,
  entry,
  criteriaConfig,
  criteriaDefaults,
  criteriaInvalid,
  criteriaErrorMessage,
  controlStyle,
  range,
  index,
  entriesLength,
  setIndex,
}: EntryVoteFormProps) {
  const [formState, formAction] = useActionState(judgeEvaluationVoteAction, voteFormInitialState);

  return (
    <>
      {criteriaErrorMessage ? (
        <Card>
          <p className="text-sm text-red-300">{criteriaErrorMessage}</p>
        </Card>
      ) : null}

      <form
        data-testid="evaluation-form"
        action={formAction}
        method="post"
        className="space-y-4"
      >
        <input type="hidden" name="assignmentId" value={assignmentId} />
        <input type="hidden" name="entryId" value={entry.id} />

        {["SCORE_1_5", "SCORE_1_10", "SCORE_0_100"].includes(methodType) && (
          <FormField label="Puntaje" htmlFor="vote-num" required>
            <input
              id="vote-num"
              name="valueNumeric"
              type="number"
              min={range.min}
              max={range.max}
              step={range.step}
              defaultValue={entry.currentVote?.valueNumeric ?? range.min}
              style={controlStyle}
              required
            />
          </FormField>
        )}
        {methodType === "YES_NO" && (
          <FormField label="Selección" htmlFor="vote-yesno" required>
            <select
              id="vote-yesno"
              name="valueBoolean"
              defaultValue={entry.currentVote?.valueBoolean ? "yes" : "no"}
              style={controlStyle}
            >
              <option value="yes">Sí</option>
              <option value="no">No</option>
            </select>
          </FormField>
        )}
        {methodType === "FAVORITES_SELECTION" && (
          <label className="text-sm text-fr-muted">
            <input type="checkbox" name="isFavorite" defaultChecked={Boolean(entry.currentVote?.isFavorite)} />{" "}
            Marcar como favorita
          </label>
        )}
        {methodType === "SELECTION_WITH_QUOTA" && (
          <FormField label="Ranking" htmlFor="vote-rank" helperText={`Cupo configurado: ${(methodConfig as { quota?: number })?.quota ?? 1}`}>
            <input
              id="vote-rank"
              name="selectedRank"
              type="number"
              min={1}
              max={Number((methodConfig as { quota?: number })?.quota ?? 1)}
              defaultValue={entry.currentVote?.selectedRank ?? 1}
              style={controlStyle}
            />
          </FormField>
        )}
        {methodType === "CRITERIA_BASED" && criteriaConfig?.ok ? (
          <div className="space-y-3" data-testid="evaluation-criteria">
            <p className="text-sm text-fr-muted" data-testid="evaluation-criteria-hint">
              Puntuá cada criterio en la escala {criteriaConfig.config.scale.min}–{criteriaConfig.config.scale.max}
              {criteriaConfig.config.scale.step !== 1 ? ` (paso ${criteriaConfig.config.scale.step})` : ""}. Todos tienen el mismo peso.
            </p>
            {criteriaConfig.config.criteria.map((c) => {
              const def = criteriaDefaults[c.key];
              const { min, max, step } = criteriaConfig.config.scale;
              const defaultVal = Number.isFinite(def) ? def : min;
              return (
                <FormField key={c.key} label={c.label} htmlFor={`criterion-${c.key}`} required>
                  <input
                    id={`criterion-${c.key}`}
                    data-testid={`criterion-input-${c.key}`}
                    name={`criterion_${c.key}`}
                    type="number"
                    min={min}
                    max={max}
                    step={step}
                    defaultValue={defaultVal}
                    style={controlStyle}
                    required
                  />
                </FormField>
              );
            })}
          </div>
        ) : null}
        <FormField label="Comentario (opcional)">
          <textarea name="comment" defaultValue={entry.currentVote?.comment ?? ""} style={{ ...controlStyle, minHeight: "6rem" }} />
        </FormField>

        {formState.error ? (
          <p className="text-sm text-red-300" data-testid="evaluation-error">
            {formState.error}
          </p>
        ) : null}
        {formState.okMessage ? (
          <p className="text-sm text-emerald-300" data-testid="vote-saved-message">
            {formState.okMessage}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <EvaluationVoteSubmitButton criteriaInvalid={criteriaInvalid} />
          <Button type="button" variant="outline" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setIndex((i) => Math.min(entriesLength - 1, i + 1))}
            disabled={index >= entriesLength - 1}
          >
            Siguiente
          </Button>
        </div>
      </form>
    </>
  );
}

export function EvaluationClient({ assignmentId, methodType, methodConfig, entries }: EvaluationClientProps) {
  const theme = useResolvedTheme();
  const [index, setIndex] = useState(0);

  const entry = entries[index];
  const controlStyle: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    borderRadius: radius.button,
    border: `1px solid ${theme.border.subtle}`,
    background: theme.surface.base,
    color: theme.text.primary,
    padding: `${spacing[3]} ${spacing[4]}`,
  };

  const range = useMemo(() => {
    switch (methodType) {
      case "SCORE_1_5":
        return { min: 1, max: 5, step: 1 };
      case "SCORE_1_10":
        return { min: 1, max: 10, step: 1 };
      case "SCORE_0_100":
        return { min: 0, max: 100, step: 1 };
      default:
        return { min: 1, max: 10, step: 1 };
    }
  }, [methodType]);

  const criteriaConfig = useMemo(() => {
    if (methodType !== "CRITERIA_BASED") return null;
    return parseCriteriaBasedMethodConfig(methodConfig);
  }, [methodType, methodConfig]);

  if (!entry) {
    return (
      <Card>
        <p className="text-sm text-fr-muted">No hay fotos cargadas para esta categoría.</p>
      </Card>
    );
  }

  const criteriaDefaults = readCriteriaDefaults(entry.currentVote?.criteriaScoresJson);
  const criteriaInvalid =
    methodType === "CRITERIA_BASED" && criteriaConfig !== null && !criteriaConfig.ok;
  const criteriaErrorMessage = criteriaInvalid && criteriaConfig ? criteriaConfig.error : null;

  return (
    <div className="space-y-4">
      <Card>
        <p className="text-sm text-fr-muted">
          Progreso: {index + 1} / {entries.length}
        </p>
      </Card>
      <Card>
        <div className="space-y-4">
          <img
            src={entry.imageUrl}
            alt={entry.title ?? "Foto en evaluación"}
            className="w-full max-h-[520px] rounded-lg border border-zinc-700 object-contain"
          />
          <div>
            <h2 className="text-lg font-semibold text-fr-primary">{entry.title ?? "Sin título"}</h2>
            <p className="text-sm text-fr-muted">{entry.description ?? "Sin descripción"}</p>
          </div>

          <EvaluationEntryVoteForm
            key={entry.id}
            assignmentId={assignmentId}
            methodType={methodType}
            methodConfig={methodConfig}
            entry={entry}
            criteriaConfig={criteriaConfig}
            criteriaDefaults={criteriaDefaults}
            criteriaInvalid={Boolean(criteriaInvalid)}
            criteriaErrorMessage={criteriaErrorMessage}
            controlStyle={controlStyle}
            range={range}
            index={index}
            entriesLength={entries.length}
            setIndex={setIndex}
          />
        </div>
      </Card>
    </div>
  );
}
