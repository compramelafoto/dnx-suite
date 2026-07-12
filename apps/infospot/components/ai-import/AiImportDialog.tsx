"use client";

import { useEffect, useMemo, useState } from "react";
import type {
  AiImportContext,
  AiImportMergeMode,
  AiImportParseResult,
  ArticleFormImportValues,
  CategoryOption,
  EventFormImportValues,
} from "@/lib/ai-import";
import { getCsvExample, getImportPrompt } from "@/lib/ai-import";
import { analyzeArticleCsv } from "@/lib/ai-import/article-import";
import { analyzeEventCsv } from "@/lib/ai-import/event-import";
import {
  buildSimilarEventsQuery,
  type SimilarEventHit,
} from "@/lib/ai-import/similar-events";
import Papa from "papaparse";
import { AiImportCsvInput } from "./AiImportCsvInput";
import { AiImportInstructions } from "./AiImportInstructions";
import { AiImportPreview } from "./AiImportPreview";
import { AiImportPrompt } from "./AiImportPrompt";
import { AiImportPrivacyWarning } from "./AiImportWarnings";

type Step = 1 | 2 | 3 | 4;

type Props = {
  open: boolean;
  onClose: () => void;
  context: AiImportContext;
  categories: CategoryOption[];
  hasExistingValues: boolean;
  onApply: (payload: {
    mode: AiImportMergeMode;
    articleValues?: ArticleFormImportValues;
    eventValues?: EventFormImportValues;
    selectedSimilarEvent?: SimilarEventHit | null;
  }) => void;
};

const STEPS = [
  { n: 1 as const, label: "Preparar" },
  { n: 2 as const, label: "Prompt" },
  { n: 3 as const, label: "Pegar CSV" },
  { n: 4 as const, label: "Revisar" },
];

export function AiImportDialog({
  open,
  onClose,
  context,
  categories,
  hasExistingValues,
  onApply,
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [copied, setCopied] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<AiImportParseResult | null>(null);
  const [mergeMode, setMergeMode] = useState<AiImportMergeMode>("empty_only");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [similarEvents, setSimilarEvents] = useState<SimilarEventHit[]>([]);
  const [similarLoading, setSimilarLoading] = useState(false);
  const [selectedSimilarKey, setSelectedSimilarKey] = useState<string | null>(null);

  const prompt = useMemo(() => getImportPrompt(context), [context]);
  const example = useMemo(() => getCsvExample(context), [context]);
  const contextLabel = context === "EVENT" ? "evento" : "artículo";

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || step !== 4 || !result?.ok || context !== "ARTICLE") {
      return;
    }
    const v = result.articleValues;
    const q = buildSimilarEventsQuery({
      eventName: v?.eventName,
      city: v?.city,
      province: v?.province,
    });
    if (!v?.eventName || q.length < 2) {
      setSimilarEvents([]);
      return;
    }

    let cancelled = false;
    setSimilarLoading(true);
    const params = new URLSearchParams({ q });
    if (v.eventDate) params.set("eventDate", v.eventDate);

    void fetch(`/api/redaccion/ai-import/similar-events?${params}`)
      .then(async (res) => {
        const data = (await res.json()) as { events?: SimilarEventHit[] };
        if (!cancelled) setSimilarEvents(data.events ?? []);
      })
      .catch(() => {
        if (!cancelled) setSimilarEvents([]);
      })
      .finally(() => {
        if (!cancelled) setSimilarLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, step, result, context]);

  if (!open) return null;

  function resetAndClose() {
    setStep(1);
    setCopied(false);
    setCsvText("");
    setParseError(null);
    setResult(null);
    setConfirmOpen(false);
    setMergeMode("empty_only");
    setSimilarEvents([]);
    setSelectedSimilarKey(null);
    onClose();
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function analyze() {
    setParseError(null);
    setSelectedSimilarKey(null);
    setSimilarEvents([]);
    const analyzed =
      context === "EVENT"
        ? analyzeEventCsv({
            rawCsv: csvText,
            categories,
            Papa,
            expectedContext: "EVENT",
          })
        : analyzeArticleCsv({
            rawCsv: csvText,
            categories,
            Papa,
            expectedContext: "ARTICLE",
          });
    setResult(analyzed);
    if (!analyzed.ok) {
      setParseError(analyzed.error);
      return;
    }
    setStep(4);
  }

  function apply() {
    if (!result || !result.ok) return;
    if (hasExistingValues && !confirmOpen) {
      setConfirmOpen(true);
      return;
    }
    const selected =
      selectedSimilarKey == null
        ? null
        : (similarEvents.find((e) => `${e.source}:${e.id}` === selectedSimilarKey) ?? null);
    onApply({
      mode: mergeMode,
      articleValues: result.articleValues,
      eventValues: result.eventValues,
      selectedSimilarEvent: selected,
    });
    resetAndClose();
  }

  const detected = result?.ok ? result.preview.filter((f) => f.status === "detected") : [];
  const missing = result?.ok ? result.preview.filter((f) => f.status === "missing") : [];
  const review = result?.ok ? result.preview.filter((f) => f.status === "review") : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-import-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) resetAndClose();
      }}
    >
      <div className="flex max-h-[100dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[var(--is-radius-md)] border border-[var(--is-border)] bg-white shadow-xl sm:max-h-[90vh] sm:rounded-[var(--is-radius-md)]">
        <div className="border-b border-[var(--is-border)] px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--is-accent)]">
                Herramienta editorial
              </p>
              <h2 id="ai-import-title" className="mt-1 text-xl font-semibold text-[var(--is-text)]">
                Importar con IA
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--is-muted)]">
                Convertí un flyer o texto en datos editables para un {contextLabel}. La IA se usa
                fuera de Info Spot.
              </p>
            </div>
            <button
              type="button"
              onClick={resetAndClose}
              className="inline-flex size-10 items-center justify-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] text-lg"
              aria-label="Cerrar"
            >
              ×
            </button>
          </div>

          <ol className="mt-4 flex flex-wrap gap-2">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className={`inline-flex min-h-9 items-center rounded-full px-3 text-xs font-semibold ${
                  step === s.n
                    ? "bg-[var(--is-accent)] text-white"
                    : step > s.n
                      ? "bg-[var(--is-accent)]/15 text-[var(--is-accent)]"
                      : "bg-[var(--is-surface)] text-[var(--is-muted)]"
                }`}
              >
                {s.n}. {s.label}
              </li>
            ))}
          </ol>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <AiImportPrivacyWarning />

          {step === 1 ? <AiImportInstructions /> : null}
          {step === 2 ? (
            <AiImportPrompt
              prompt={prompt}
              copied={copied}
              onCopy={() => void copyPrompt()}
            />
          ) : null}
          {step === 3 ? (
            <AiImportCsvInput
              value={csvText}
              onChange={setCsvText}
              example={example}
              parseError={parseError}
            />
          ) : null}
          {step === 4 && result?.ok ? (
            <AiImportPreview
              warnings={result.warnings}
              detected={detected}
              missing={missing}
              review={review}
              confirmOpen={confirmOpen}
              mergeMode={mergeMode}
              onMergeModeChange={setMergeMode}
              similarEvents={context === "ARTICLE" ? similarEvents : []}
              similarLoading={context === "ARTICLE" ? similarLoading : false}
              selectedSimilarKey={selectedSimilarKey}
              onSelectSimilar={context === "ARTICLE" ? setSelectedSimilarKey : undefined}
            />
          ) : null}
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--is-border)] bg-white px-5 py-4 sm:px-6">
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] border border-[var(--is-border)] px-4 text-sm font-medium"
            onClick={() => {
              if (step === 1) resetAndClose();
              else if (step === 4 && confirmOpen) setConfirmOpen(false);
              else setStep((s) => (s - 1) as Step);
            }}
          >
            {step === 1 ? "Cancelar" : "Atrás"}
          </button>

          {step < 3 ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white"
              onClick={() => setStep((s) => (s + 1) as Step)}
            >
              Siguiente
            </button>
          ) : null}

          {step === 3 ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white disabled:opacity-50"
              disabled={!csvText.trim()}
              onClick={analyze}
            >
              Analizar información
            </button>
          ) : null}

          {step === 4 ? (
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-[var(--is-radius-sm)] bg-[var(--is-accent)] px-4 text-sm font-semibold text-white"
              onClick={apply}
            >
              {confirmOpen ? "Confirmar y completar" : "Completar formulario"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
