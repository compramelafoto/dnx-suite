"use client";

import { useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import { es } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { Button, FormField, FormSection, radius, spacing, useResolvedTheme } from "@repo/design-system";
import { updateContestDatesFromModal } from "../../../../../actions/contests";
import { getDisplayStatus } from "../../../../../lib/contest-permissions";

type Contest = NonNullable<
  Awaited<ReturnType<typeof import("../../../../../lib/fotorank/contests").getFotorankContestById>>
>;

interface FechasModalContentProps {
  contest: Contest;
  onSuccess: () => void;
  onCancel: () => void;
  readOnly?: boolean;
  restrictionMessage?: string | null;
}

function formatDate(d: Date | string | null): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function parseToDate(d: Date | string | null): Date | null {
  if (!d) return null;
  const date = typeof d === "string" ? new Date(d) : d;
  return isNaN(date.getTime()) ? null : date;
}

function toIsoString(d: Date | null): string {
  if (!d) return "";
  return d.toISOString();
}

function validateDates(params: {
  startAt: Date | null;
  submissionDeadline: Date | null;
  judgingStartAt: Date | null;
  judgingEndAt: Date | null;
  resultsAt: Date | null;
}) {
  const { startAt, submissionDeadline, judgingStartAt, judgingEndAt, resultsAt } = params;

  if (startAt && submissionDeadline && submissionDeadline < startAt) {
    return "El cierre de inscripciones no puede ser anterior al inicio.";
  }
  if (submissionDeadline && judgingStartAt && judgingStartAt < submissionDeadline) {
    return "El inicio de evaluación debe ser posterior al cierre de inscripciones.";
  }
  if (judgingStartAt && judgingEndAt && judgingEndAt < judgingStartAt) {
    return "El fin de evaluación debe ser posterior al inicio de evaluación.";
  }
  if (judgingEndAt && resultsAt && resultsAt < judgingEndAt) {
    return "La fecha de resultados debe ser posterior al fin de evaluación.";
  }

  return null;
}

export function FechasModalContent({ contest, onSuccess, onCancel, readOnly, restrictionMessage }: FechasModalContentProps) {
  const theme = useResolvedTheme();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const status = getDisplayStatus(contest.status);
  const onlyFutureDates = status === "PUBLISHED";
  const minDate = onlyFutureDates ? new Date() : undefined;

  const [startAt, setStartAt] = useState<Date | null>(parseToDate(contest.startAt));
  const [submissionDeadline, setSubmissionDeadline] = useState<Date | null>(parseToDate(contest.submissionDeadline));
  const [judgingStartAt, setJudgingStartAt] = useState<Date | null>(parseToDate(contest.judgingStartAt));
  const [judgingEndAt, setJudgingEndAt] = useState<Date | null>(parseToDate(contest.judgingEndAt));
  const [resultsAt, setResultsAt] = useState<Date | null>(parseToDate(contest.resultsAt));

  const pickerStyle: React.CSSProperties = useMemo(
    () => ({
      width: "100%",
      boxSizing: "border-box",
      borderRadius: radius.button,
      border: `1px solid ${theme.border.subtle}`,
      background: theme.surface.base,
      color: theme.text.primary,
      padding: `${spacing[3]} ${spacing[4]}`,
      fontSize: "0.95rem",
      outline: "none",
    }),
    [theme, radius.button],
  );

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (readOnly) return;

    const timelineError = validateDates({
      startAt,
      submissionDeadline,
      judgingStartAt,
      judgingEndAt,
      resultsAt,
    });
    if (timelineError) {
      setError(timelineError);
      return;
    }

    setError(null);
    setSaving(true);

    const formData = new FormData();
    formData.set("contestId", contest.id);
    if (startAt) formData.set("startAt", toIsoString(startAt));
    if (submissionDeadline) formData.set("submissionDeadline", toIsoString(submissionDeadline));
    if (judgingStartAt) formData.set("judgingStartAt", toIsoString(judgingStartAt));
    if (judgingEndAt) formData.set("judgingEndAt", toIsoString(judgingEndAt));
    if (resultsAt) formData.set("resultsAt", toIsoString(resultsAt));

    const result = await updateContestDatesFromModal(formData);
    setSaving(false);

    if (result.ok) onSuccess();
    else setError(result.error ?? "Error al guardar fechas");
  };

  if (readOnly) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: spacing[6] }}>
        {restrictionMessage ? (
          <div
            style={{
              borderRadius: radius.button,
              border: `1px solid ${theme.border.default}`,
              background: theme.surface.elevated,
              color: theme.text.secondary,
              padding: spacing[4],
              fontSize: "0.875rem",
            }}
          >
            {restrictionMessage}
          </div>
        ) : null}

        <dl style={{ display: "grid", gap: spacing[3] }}>
          {[
            { label: "Inicio", value: contest.startAt },
            { label: "Cierre inscripciones", value: contest.submissionDeadline },
            { label: "Inicio evaluación", value: contest.judgingStartAt },
            { label: "Fin evaluación", value: contest.judgingEndAt },
            { label: "Resultados", value: contest.resultsAt },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: spacing[4],
                border: `1px solid ${theme.border.subtle}`,
                borderRadius: radius.button,
                padding: `${spacing[2]} ${spacing[3]}`,
                background: theme.surface.base,
              }}
            >
              <dt style={{ color: theme.text.secondary, fontSize: "0.875rem" }}>{label}</dt>
              <dd style={{ color: theme.text.primary, fontSize: "0.875rem", fontWeight: 600 }}>{formatDate(value)}</dd>
            </div>
          ))}
        </dl>

        <div style={{ display: "flex", gap: spacing[3] }}>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cerrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: spacing[6] }}>
      {restrictionMessage ? (
        <div
          style={{
            borderRadius: radius.button,
            border: `1px solid ${theme.border.default}`,
            background: theme.surface.elevated,
            color: theme.text.secondary,
            padding: spacing[4],
            fontSize: "0.875rem",
          }}
        >
          {restrictionMessage}
        </div>
      ) : null}

      {onlyFutureDates ? (
        <div
          style={{
            borderRadius: radius.button,
            border: `1px solid ${theme.border.subtle}`,
            background: theme.surface.base,
            color: theme.text.tertiary,
            padding: spacing[3],
            fontSize: "0.8125rem",
          }}
        >
          Este concurso está publicado: solo se permiten fechas desde hoy en adelante.
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          style={{
            borderRadius: radius.button,
            border: "1px solid rgba(239, 68, 68, 0.35)",
            background: "rgba(239, 68, 68, 0.1)",
            color: "#fca5a5",
            padding: spacing[4],
            fontSize: "0.875rem",
          }}
        >
          {error}
        </div>
      ) : null}

      <FormSection
        title="Cronograma"
        description="Definí las fechas en orden. La validación evita inconsistencias entre etapas."
        style={{ marginBottom: 0 }}
      >
        <div style={{ display: "grid", gap: spacing[6], gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <FormField label="Inicio" htmlFor="date-startAt" helperText="Apertura del concurso.">
            <DatePicker
              id="date-startAt"
              selected={startAt}
              onChange={(d: Date | null) => setStartAt(d)}
              showTimeSelect
              timeIntervals={15}
              dateFormat="d MMM yyyy, HH:mm"
              locale={es}
              minDate={minDate}
              className="fr-date-picker"
              placeholderText="Seleccionar fecha y hora"
              customInput={<input style={pickerStyle} />}
            />
          </FormField>

          <FormField label="Cierre inscripciones" htmlFor="date-submission" helperText="Último momento para registrarse.">
            <DatePicker
              id="date-submission"
              selected={submissionDeadline}
              onChange={(d: Date | null) => setSubmissionDeadline(d)}
              showTimeSelect
              timeIntervals={15}
              dateFormat="d MMM yyyy, HH:mm"
              locale={es}
              minDate={startAt ?? minDate}
              className="fr-date-picker"
              placeholderText="Seleccionar fecha y hora"
              customInput={<input style={pickerStyle} />}
            />
          </FormField>

          <FormField label="Inicio evaluación" htmlFor="date-judgingStart" helperText="Comienzo de revisión del jurado.">
            <DatePicker
              id="date-judgingStart"
              selected={judgingStartAt}
              onChange={(d: Date | null) => setJudgingStartAt(d)}
              showTimeSelect
              timeIntervals={15}
              dateFormat="d MMM yyyy, HH:mm"
              locale={es}
              minDate={submissionDeadline ?? minDate}
              className="fr-date-picker"
              placeholderText="Seleccionar fecha y hora"
              customInput={<input style={pickerStyle} />}
            />
          </FormField>

          <FormField label="Fin evaluación" htmlFor="date-judgingEnd" helperText="Cierre de puntuación.">
            <DatePicker
              id="date-judgingEnd"
              selected={judgingEndAt}
              onChange={(d: Date | null) => setJudgingEndAt(d)}
              showTimeSelect
              timeIntervals={15}
              dateFormat="d MMM yyyy, HH:mm"
              locale={es}
              minDate={judgingStartAt ?? minDate}
              className="fr-date-picker"
              placeholderText="Seleccionar fecha y hora"
              customInput={<input style={pickerStyle} />}
            />
          </FormField>

          <div style={{ gridColumn: "1 / -1", maxWidth: "calc(50% - 12px)" }}>
            <FormField label="Resultados" htmlFor="date-results" helperText="Publicación de resultados finales.">
              <DatePicker
                id="date-results"
                selected={resultsAt}
                onChange={(d: Date | null) => setResultsAt(d)}
                showTimeSelect
                timeIntervals={15}
                dateFormat="d MMM yyyy, HH:mm"
                locale={es}
                minDate={judgingEndAt ?? minDate}
                className="fr-date-picker"
                placeholderText="Seleccionar fecha y hora"
                customInput={<input style={pickerStyle} />}
              />
            </FormField>
          </div>
        </div>
      </FormSection>

      <div style={{ display: "flex", gap: spacing[3] }}>
        <Button type="submit" disabled={readOnly || saving}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
