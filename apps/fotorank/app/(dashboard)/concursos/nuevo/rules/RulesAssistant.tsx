"use client";

import { useState } from "react";
import {
  type RulesData,
  RULES_BLOCKS,
  initialRulesData,
} from "../../../../lib/fotorank/rules/types";
import { generateRulesText } from "../../../../lib/fotorank/rules/generateRulesText";
import { RuleBlockForm } from "./RuleBlockForm";
import {
  IDENTIDAD_FIELDS,
  PARTICIPACION_FIELDS,
  OBRAS_FIELDS,
  FORMATO_FIELDS,
  JURADO_FIELDS,
  PREMIOS_FIELDS,
  DERECHOS_FIELDS,
  LEGAL_FIELDS,
  DATOS_PERSONALES_FIELDS,
  DISPOSICIONES_FINALES_FIELDS,
} from "./blockConfigs";
import { inputBase } from "../../../../components/ui/form";

type AssistantPhase = "blocks" | "preview";

interface RulesAssistantProps {
  initialRulesText?: string;
  initialData?: Partial<RulesData>;
  onAccept: (rulesText: string, rulesData: RulesData) => void;
  onCancel: () => void;
}

const BLOCK_CONFIG_MAP = {
  identidad: { fields: IDENTIDAD_FIELDS, title: "Identidad del concurso" },
  participacion: { fields: PARTICIPACION_FIELDS, title: "Participación" },
  obras: { fields: OBRAS_FIELDS, title: "Obras" },
  formato: { fields: FORMATO_FIELDS, title: "Formato técnico" },
  jurado: { fields: JURADO_FIELDS, title: "Jurado" },
  premios: { fields: PREMIOS_FIELDS, title: "Premios" },
  derechos: { fields: DERECHOS_FIELDS, title: "Derechos de autor" },
  legal: { fields: LEGAL_FIELDS, title: "Aspectos legales" },
  datosPersonales: { fields: DATOS_PERSONALES_FIELDS, title: "Datos personales" },
  disposicionesFinales: {
    fields: DISPOSICIONES_FINALES_FIELDS,
    title: "Disposiciones finales",
  },
} as const;

function blockToValues(block: Record<string, string>): Record<string, string> {
  return { ...block };
}

export function RulesAssistant({
  initialRulesText = "",
  initialData,
  onAccept,
  onCancel,
}: RulesAssistantProps) {
  const [phase, setPhase] = useState<AssistantPhase>("blocks");
  const [rulesData, setRulesData] = useState<RulesData>(() =>
    Object.fromEntries(
      (Object.keys(initialRulesData) as (keyof RulesData)[]).map((key) => [
        key,
        { ...initialRulesData[key], ...(initialData?.[key] ?? {}) },
      ])
    ) as RulesData
  );
  const [previewText, setPreviewText] = useState(initialRulesText);
  const [expandedBlock, setExpandedBlock] = useState<keyof RulesData | null>("identidad");

  const updateBlock = (blockId: keyof RulesData, key: string, value: string) => {
    setRulesData((prev) => ({
      ...prev,
      [blockId]: {
        ...prev[blockId],
        [key]: value,
      },
    }));
  };

  const handleGenerate = () => {
    const generated = generateRulesText(rulesData);
    setPreviewText(generated || initialRulesText);
    setPhase("preview");
  };

  const handleAccept = () => {
    onAccept(previewText, rulesData);
  };

  const handleBackToBlocks = () => {
    setPhase("blocks");
  };

  return (
    <div className="space-y-8">
      {phase === "blocks" ? (
        <>
          <p className="text-sm text-fr-muted">
            Completá cada sección con la información del concurso. El texto se generará automáticamente.
          </p>

          <div className="space-y-4">
            {RULES_BLOCKS.map(({ id }) => {
              const config = BLOCK_CONFIG_MAP[id];
              const blockData = rulesData[id] as Record<string, string>;
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
                    <span className="font-medium text-fr-primary">{config.title}</span>
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
                        title={config.title}
                        fields={config.fields}
                        values={blockToValues(blockData)}
                        onChange={(key, value) => updateBlock(id, key, value)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
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
            Revisá el texto generado y editá lo que necesites antes de aceptar.
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
                className="fr-btn fr-btn-primary"
              >
                Aceptar bases
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
