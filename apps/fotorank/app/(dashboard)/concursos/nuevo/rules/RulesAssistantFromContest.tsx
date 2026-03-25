"use client";

import { useState } from "react";
import type { RulesData } from "../../../../lib/fotorank/rules/types";
import { generateRulesFromContest } from "../../../../lib/fotorank/rules/generateRulesFromContest";
import { RuleBlockForm } from "./RuleBlockForm";
import {
  DERECHOS_FIELDS,
  LEGAL_FIELDS,
  DATOS_PERSONALES_FIELDS,
  DISPOSICIONES_FINALES_FIELDS,
  FORMATO_FIELDS,
  JURADO_FIELDS,
  PREMIOS_FIELDS,
  PARTICIPACION_FIELDS,
  OBRAS_FIELDS,
} from "./blockConfigs";
import { inputBase } from "../../../../components/ui/form";
import { updateContestRules } from "../../../../actions/contests";

type Contest = NonNullable<
  Awaited<ReturnType<typeof import("../../../../lib/fotorank/contests").getFotorankContestById>>
>;

type AssistantPhase = "blocks" | "preview";

/** Bloques que el asistente pregunta (no vienen del concurso) */
const ASSISTANT_BLOCKS = [
  { id: "derechos" as const, label: "Derechos de autor", fields: DERECHOS_FIELDS },
  { id: "legal" as const, label: "Aspectos legales", fields: LEGAL_FIELDS },
  { id: "datosPersonales" as const, label: "Datos personales", fields: DATOS_PERSONALES_FIELDS },
  { id: "disposicionesFinales" as const, label: "Disposiciones finales", fields: DISPOSICIONES_FINALES_FIELDS },
] as const;

/** Bloques opcionales (formato, jurado, premios, participacion extras, obras extras) */
const OPTIONAL_BLOCKS = [
  { id: "formato" as const, label: "Formato técnico", fields: FORMATO_FIELDS },
  { id: "jurado" as const, label: "Jurado", fields: JURADO_FIELDS },
  { id: "premios" as const, label: "Premios", fields: PREMIOS_FIELDS },
  { id: "participacion" as const, label: "Participación (extras)", fields: PARTICIPACION_FIELDS },
  { id: "obras" as const, label: "Obras (extras)", fields: OBRAS_FIELDS },
] as const;

interface RulesAssistantFromContestProps {
  contest: Contest;
  onAccept: () => void;
  onCancel: () => void;
}

function blockToValues(block: Record<string, string> | undefined): Record<string, string> {
  return block ? { ...block } : {};
}

export function RulesAssistantFromContest({
  contest,
  onAccept,
  onCancel,
}: RulesAssistantFromContestProps) {
  const [phase, setPhase] = useState<AssistantPhase>("blocks");
  const [assistantData, setAssistantData] = useState<Partial<RulesData>>(() => {
    const stored = contest.rulesData as Partial<RulesData> | null;
    return stored ?? {};
  });
  const [previewText, setPreviewText] = useState(contest.rulesText ?? "");
  const [expandedBlock, setExpandedBlock] = useState<string | null>("derechos");
  const [showOptional, setShowOptional] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateBlock = (
    blockId: keyof RulesData,
    key: string,
    value: string
  ) => {
    setAssistantData((prev) => ({
      ...prev,
      [blockId]: {
        ...(prev[blockId] as Record<string, string> ?? {}),
        [key]: value,
      },
    }));
  };

  const handleGenerate = () => {
    const contestForRules = {
      title: contest.title,
      shortDescription: contest.shortDescription,
      fullDescription: contest.fullDescription,
      organization: { name: contest.organization.name },
      categories: contest.categories.map((c) => ({
        name: c.name,
        maxFiles: c.maxFiles,
        description: c.description,
      })),
      startAt: contest.startAt,
      submissionDeadline: contest.submissionDeadline,
      judgingStartAt: contest.judgingStartAt,
      judgingEndAt: contest.judgingEndAt,
      resultsAt: contest.resultsAt,
    };
    const generated = generateRulesFromContest(contestForRules, assistantData);
    setPreviewText(generated || "");
    setPhase("preview");
  };

  const handleAccept = async () => {
    setSaving(true);
    setError(null);
    const result = await updateContestRules(
      contest.id,
      previewText,
      assistantData as Record<string, unknown>
    );
    setSaving(false);
    if (result.ok) {
      onAccept();
    } else {
      setError(result.error ?? "Error al guardar las bases.");
    }
  };

  const handleBackToBlocks = () => {
    setPhase("blocks");
  };

  return (
    <div className="space-y-8">
      {phase === "blocks" ? (
        <>
          <p className="text-sm text-fr-muted">
            Las bases se generan automáticamente con los datos del concurso (organización, fechas, categorías).
            Completá solo lo que falta: derechos de uso, aspectos legales, datos personales y disposiciones finales.
          </p>

          <div className="space-y-4">
            {ASSISTANT_BLOCKS.map(({ id, label, fields }) => {
              const blockData = assistantData[id] as Record<string, string> | undefined;
              const isExpanded = expandedBlock === id;

              return (
                <div
                  key={id}
                  className="overflow-hidden rounded-lg border border-[#262626] bg-[#0a0a0a]"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedBlock(isExpanded ? null : id)}
                    className="flex w-full items-center justify-between px-8 py-4 text-left transition-colors hover:bg-[#141414]"
                  >
                    <span className="font-medium text-fr-primary">{label}</span>
                    <svg
                      className={`h-5 w-5 text-fr-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isExpanded && (
                    <div className="border-t border-[#262626] px-8 py-6">
                      <RuleBlockForm
                        title={label}
                        fields={fields}
                        values={blockToValues(blockData)}
                        onChange={(key, value) => updateBlock(id, key, value)}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {/* Bloques opcionales */}
            <div className="rounded-lg border border-dashed border-[#262626] bg-[#0a0a0a]">
              <button
                type="button"
                onClick={() => setShowOptional(!showOptional)}
                className="flex w-full items-center justify-between px-8 py-4 text-left transition-colors hover:bg-[#141414]"
              >
                <span className="font-medium text-fr-muted">
                  Más opciones (formato, jurado, premios…)
                </span>
                <svg
                  className={`h-5 w-5 text-fr-muted transition-transform ${showOptional ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showOptional && (
                <div className="border-t border-[#262626] space-y-4 p-6">
                  {OPTIONAL_BLOCKS.map(({ id, label, fields }) => {
                    const blockData = assistantData[id] as Record<string, string> | undefined;
                    const isExpanded = expandedBlock === `opt-${id}`;

                    return (
                      <div
                        key={id}
                        className="overflow-hidden rounded-lg border border-[#262626] bg-[#0c0c0c]"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedBlock(isExpanded ? null : `opt-${id}`)
                          }
                          className="flex w-full items-center justify-between px-6 py-3 text-left transition-colors hover:bg-[#141414]"
                        >
                          <span className="text-sm font-medium text-fr-primary">{label}</span>
                          <svg
                            className={`h-4 w-4 text-fr-muted transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        {isExpanded && (
                          <div className="border-t border-[#262626] px-6 py-4">
                            <RuleBlockForm
                              title={label}
                              fields={fields}
                              values={blockToValues(blockData)}
                              onChange={(key, value) => updateBlock(id, key, value)}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="fr-content-to-actions mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-[#262626] pt-8">
            <button
              type="button"
              onClick={onCancel}
              className="fr-btn fr-btn-secondary"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              className="fr-btn fr-btn-primary"
            >
              Generar bases
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-fr-muted">
            Revisá el texto generado y editá lo que necesites antes de guardar.
          </p>

          <div>
            <label className="mb-2 block text-sm font-medium text-fr-primary">
              Vista previa y edición
            </label>
            <textarea
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              rows={14}
              className={`${inputBase} min-h-[16rem] resize-y font-mono text-sm`}
              placeholder="El texto de las bases aparecerá aquí..."
            />
          </div>

          {error && (
            <p className="text-sm text-red-500">{error}</p>
          )}

          <div className="fr-content-to-actions mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-[#262626] pt-8">
            <button
              type="button"
              onClick={handleBackToBlocks}
              className="fr-btn fr-btn-secondary"
            >
              Volver a editar respuestas
            </button>
            <div className="flex gap-3">
              <button type="button" onClick={onCancel} className="fr-btn fr-btn-secondary">
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleAccept}
                disabled={saving}
                className="fr-btn fr-btn-primary"
              >
                {saving ? "Guardando…" : "Guardar bases"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
