import type { CompositionTemplate } from "../types";

/**
 * Plantillas DRAFT Etapa 15 — no productivas.
 * Etapa 16 aprobará diseños finales antes de LIVE.
 */
function draftResultsTemplate(id: string, name: string): CompositionTemplate {
  return {
    id,
    name,
    version: 0,
    platform: "CLICKATON",
    kind: "CUSTOM",
    width: 1080,
    height: 1350,
    background: "#0a0a0a",
    variables: ["anonymousCode", "categoryName", "awardLabel", "editionName"],
    blocks: [
      {
        id: "accent",
        type: "rect",
        x: 0,
        y: 0,
        width: 1080,
        height: 12,
        fill: "#f5c518",
      },
      {
        id: "title",
        type: "text",
        x: 80,
        y: 200,
        width: 920,
        fontSize: 56,
        color: "#fafafa",
        align: "center",
        content: "{{awardLabel}}",
      },
      {
        id: "note",
        type: "text",
        x: 80,
        y: 1200,
        width: 920,
        fontSize: 22,
        color: "#a1a1a1",
        align: "center",
        content: "DRAFT — no publicar LIVE",
      },
    ],
  };
}

export const CLICKATON_RESULTS_WINNER_DRAFT = draftResultsTemplate(
  "clickaton.results.winner.draft",
  "Clickatón — Ganador (draft)",
);

export const CLICKATON_RESULTS_FINALIST_DRAFT = draftResultsTemplate(
  "clickaton.results.finalist.draft",
  "Clickatón — Finalista (draft)",
);
