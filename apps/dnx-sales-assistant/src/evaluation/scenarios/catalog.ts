import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ConversationScenario } from "../conversation-runner/conversation-scenario.js";

/**
 * Banco inicial versionado de escenarios conversacionales.
 * Los mensajes usan formulaciones naturales compatibles con clasificador + extractores actuales
 * (p. ej. «presupuesto» / «cotizar» para entrar al flujo QUOTE_REQUEST).
 */
const BASE_SCENARIOS: ConversationScenario[] = [
  {
    id: "generic-how-much-to-charge",
    description: "Consulta genérica de precio",
    messages: ["Quiero saber cuánto cobrar."],
    expectations: {
      allowedIntents: ["QUOTE_REQUEST", "GENERAL_SERVICE_INQUIRY", "UNKNOWN"],
      shouldNotReachReady: true,
      maximumAssistantQuestionsPerTurn: 2,
    },
  },
  {
    id: "incomplete-event",
    description: "Evento incompleto",
    messages: ["Quiero presupuesto para un evento social."],
    expectations: {
      expectedIntent: "QUOTE_REQUEST",
      expectedKnownFields: ["SERVICE_TYPE"],
      shouldNotReachReady: true,
      maximumAssistantQuestionsPerTurn: 1,
    },
  },
  {
    id: "wedding-complete-first-message",
    description: "Casamiento con datos completos en un mensaje",
    messages: [
      "Quiero presupuesto para un casamiento en Rosario el 20 de noviembre de 2026 y voy a cubrir ocho horas.",
    ],
    expectations: {
      expectedIntent: "QUOTE_REQUEST",
      expectedKnownFields: ["SERVICE_TYPE", "CITY", "EVENT_DATE", "DURATION_HOURS"],
      forbiddenQuestionsAbout: ["CITY", "DURATION_HOURS", "EVENT_DATE", "SERVICE_TYPE"],
      shouldReachReadyForCalculation: true,
      expectPricingReady: true,
      maximumAssistantQuestionsPerTurn: 1,
      minimumDaniStyleScore: 85,
      criticalStyleScenario: true,
      forbidFormAndTechnicalLanguage: true,
    },
  },
  {
    id: "fifteenth-birthday-request",
    description: "Cumpleaños de quince",
    messages: ["Me pidieron presupuesto para un cumpleaños de quince."],
    expectations: {
      expectedIntent: "QUOTE_REQUEST",
      expectedKnownFields: ["SERVICE_TYPE"],
      shouldNotReachReady: true,
      maximumAssistantQuestionsPerTurn: 1,
    },
  },
  {
    id: "sports-running-coverage",
    description: "Evento deportivo / running",
    messages: ["Necesito presupuesto para cubrir una carrera de running."],
    expectations: {
      expectedIntent: "QUOTE_REQUEST",
      expectedKnownFields: ["SERVICE_TYPE"],
      shouldNotReachReady: true,
      maximumAssistantQuestionsPerTurn: 1,
    },
  },
  {
    id: "family-portrait-session",
    description: "Sesión familiar / retrato",
    messages: ["Me pidieron presupuesto para una sesión familiar."],
    expectations: {
      expectedIntent: "QUOTE_REQUEST",
      expectedKnownFields: ["SERVICE_TYPE"],
      shouldNotReachReady: true,
      maximumAssistantQuestionsPerTurn: 1,
    },
  },
  {
    id: "wedding-multi-turn",
    description: "Datos distribuidos en varios turnos",
    messages: [
      "Quiero un presupuesto para un casamiento.",
      "Es en Córdoba.",
      "El 12 de diciembre de 2026.",
      "Serían diez horas.",
    ],
    expectations: {
      expectedIntent: "QUOTE_REQUEST",
      expectedKnownFields: ["SERVICE_TYPE", "CITY", "EVENT_DATE", "DURATION_HOURS"],
      shouldReachReadyForCalculation: true,
      expectPricingReady: true,
      maximumAssistantQuestionsPerTurn: 1,
      minimumDaniStyleScore: 85,
      criticalStyleScenario: true,
      forbidFormAndTechnicalLanguage: true,
    },
  },
  {
    id: "duration-correction",
    description: "Corrección de duración",
    messages: [
      "Quiero presupuesto para un casamiento en Rosario.",
      "Serían cuatro horas.",
      "Perdón, al final son seis horas.",
      "El 15/03/2026.",
    ],
    expectations: {
      expectedIntent: "QUOTE_REQUEST",
      expectedKnownFields: ["SERVICE_TYPE", "CITY", "EVENT_DATE", "DURATION_HOURS"],
      shouldReachReadyForCalculation: true,
      expectPricingReady: true,
      maximumAssistantQuestionsPerTurn: 1,
      minimumDaniStyleScore: 85,
      criticalStyleScenario: true,
      forbidFormAndTechnicalLanguage: true,
    },
  },
  {
    id: "sports-all-at-once",
    description: "Usuario aporta casi todo de una vez",
    messages: [
      "Necesito un presupuesto para un evento deportivo en Santa Fe el 10/08/2026, dura cinco horas y somos dos fotógrafos.",
    ],
    expectations: {
      expectedIntent: "QUOTE_REQUEST",
      expectedKnownFields: ["SERVICE_TYPE", "CITY", "EVENT_DATE", "DURATION_HOURS"],
      forbiddenQuestionsAbout: ["CITY", "DURATION_HOURS", "SERVICE_TYPE"],
      shouldReachReadyForCalculation: true,
      expectPricingReady: true,
      maximumAssistantQuestionsPerTurn: 1,
    },
  },
  {
    id: "direct-how-much-wedding",
    description: "Pregunta directa de precio",
    messages: ["¿Cuánto sale un casamiento?"],
    expectations: {
      expectedIntent: "QUOTE_REQUEST",
      expectedKnownFields: ["SERVICE_TYPE"],
      shouldNotReachReady: true,
      maximumAssistantQuestionsPerTurn: 1,
      minimumDaniStyleScore: 85,
      criticalStyleScenario: true,
      forbidFormAndTechnicalLanguage: true,
    },
  },
  {
    id: "album-publish-out-of-quote",
    description: "Intención no relacionada con cotización",
    messages: ["Quiero publicar un álbum."],
    expectations: {
      allowedIntents: ["OUT_OF_SCOPE", "GENERAL_SERVICE_INQUIRY", "UNKNOWN"],
      shouldNotReachReady: true,
      minimumDaniStyleScore: 85,
      criticalStyleScenario: true,
      forbidFormAndTechnicalLanguage: true,
    },
  },
  {
    id: "sell-event-photos",
    description: "Venta de fotografías",
    messages: ["Quiero vender las fotos de un evento."],
    expectations: {
      allowedIntents: [
        "QUOTE_REQUEST",
        "GENERAL_SERVICE_INQUIRY",
        "OUT_OF_SCOPE",
        "UNKNOWN",
      ],
      shouldNotReachReady: true,
    },
  },
  {
    id: "confused-user",
    description: "Usuario confuso",
    messages: ["No sé bien qué necesito, me llamaron para sacar fotos."],
    expectations: {
      allowedIntents: [
        "QUOTE_REQUEST",
        "GENERAL_SERVICE_INQUIRY",
        "UNKNOWN",
        "OUT_OF_SCOPE",
      ],
      shouldNotReachReady: true,
      maximumAssistantQuestionsPerTurn: 2,
    },
  },
  {
    id: "advanced-info-relative-date",
    description: "Información adelantada con fecha relativa",
    messages: [
      "Quiero presupuesto: el evento es en Buenos Aires, dura seis horas y es el sábado que viene.",
    ],
    expectations: {
      expectedIntent: "QUOTE_REQUEST",
      expectedKnownFields: ["CITY", "DURATION_HOURS"],
      shouldNotReachReady: true,
      maximumAssistantQuestionsPerTurn: 1,
    },
  },
  {
    id: "service-type-switch",
    description: "Cambio de tipo de servicio",
    messages: [
      "Quiero cotizar un cumpleaños en Mendoza.",
      "En realidad es un casamiento.",
      "El 01/04/2026, cuatro horas.",
    ],
    expectations: {
      expectedIntent: "QUOTE_REQUEST",
      expectedKnownFields: ["SERVICE_TYPE", "CITY", "EVENT_DATE", "DURATION_HOURS"],
      shouldReachReadyForCalculation: true,
      expectPricingReady: true,
      maximumAssistantQuestionsPerTurn: 1,
      minimumDaniStyleScore: 85,
      criticalStyleScenario: true,
      forbidFormAndTechnicalLanguage: true,
    },
  },
  {
    id: "informal-wedding-quote",
    description: "Usuario informal",
    messages: ["Che, me salió un casamiento y no sé cuánto pasarle."],
    expectations: {
      expectedIntent: "QUOTE_REQUEST",
      expectedKnownFields: ["SERVICE_TYPE"],
      shouldNotReachReady: true,
      maximumAssistantQuestionsPerTurn: 1,
      minimumDaniStyleScore: 85,
      forbidFormAndTechnicalLanguage: true,
    },
  },
  {
    id: "typo-fifteenth-rosario",
    description: "Mensaje con errores de escritura",
    messages: ["presupuesto tengo un cumple de 15 en rosario son como 7 oras"],
    expectations: {
      expectedIntent: "QUOTE_REQUEST",
      expectedKnownFields: ["SERVICE_TYPE", "CITY", "DURATION_HOURS"],
      shouldNotReachReady: true,
      maximumAssistantQuestionsPerTurn: 1,
      forbidFormAndTechnicalLanguage: true,
    },
  },
  {
    id: "minimal-city-reply",
    description: "Respuesta mínima en flujo activo",
    messages: [
      "Quiero presupuesto para un casamiento el 10/05/2026.",
      "Rosario.",
    ],
    expectations: {
      expectedIntent: "QUOTE_REQUEST",
      expectedKnownFields: ["SERVICE_TYPE", "CITY", "EVENT_DATE"],
      shouldNotReachReady: true,
      maximumAssistantQuestionsPerTurn: 1,
      forbidFormAndTechnicalLanguage: true,
    },
  },
  {
    id: "city-correction",
    description: "Corrección de ciudad",
    messages: [
      "Quiero presupuesto para un casamiento el 10/06/2026.",
      "Es en Córdoba.",
      "No, perdón, en Villa Carlos Paz.",
      "Serían seis horas.",
    ],
    expectations: {
      expectedIntent: "QUOTE_REQUEST",
      expectedKnownFields: ["SERVICE_TYPE", "CITY", "EVENT_DATE", "DURATION_HOURS"],
      shouldReachReadyForCalculation: true,
      expectPricingReady: true,
      maximumAssistantQuestionsPerTurn: 1,
      minimumDaniStyleScore: 85,
      criticalStyleScenario: true,
      forbidFormAndTechnicalLanguage: true,
    },
  },
  {
    id: "impatient-price",
    description: "Usuario impaciente",
    messages: ["Decime cuánto tengo que cobrar y listo."],
    expectations: {
      expectedIntent: "QUOTE_REQUEST",
      shouldNotReachReady: true,
      maximumAssistantQuestionsPerTurn: 1,
      minimumDaniStyleScore: 85,
      criticalStyleScenario: true,
      forbidFormAndTechnicalLanguage: true,
    },
  },
  {
    id: "dense-no-punctuation",
    description: "Múltiples datos sin puntuación",
    messages: ["presupuesto casamiento rosario sábado 8 horas dos fotógrafos"],
    expectations: {
      expectedIntent: "QUOTE_REQUEST",
      expectedKnownFields: ["SERVICE_TYPE", "CITY", "DURATION_HOURS"],
      shouldNotReachReady: true,
      maximumAssistantQuestionsPerTurn: 1,
      forbidFormAndTechnicalLanguage: true,
    },
  },
  {
    id: "visual-wedding-references",
    description: "Usuario pide referencias visuales",
    messages: ["Mostrame fotos de casamientos para tener una idea."],
    expectations: {
      shouldNotReachReady: true,
      expectVisualReference: true,
      minimumDaniStyleScore: 85,
      criticalStyleScenario: true,
      forbidFormAndTechnicalLanguage: true,
      maximumAssistantQuestionsPerTurn: 1,
    },
  },
  {
    id: "unknown-duration",
    description: "Usuario no conoce la duración",
    messages: [
      "Quiero presupuesto para un casamiento en Rosario el 11/07/2026.",
      "Todavía no sé cuántas horas va a durar.",
    ],
    expectations: {
      expectedIntent: "QUOTE_REQUEST",
      expectedKnownFields: ["SERVICE_TYPE", "CITY", "EVENT_DATE"],
      shouldNotReachReady: true,
      maximumAssistantQuestionsPerTurn: 1,
      forbidFormAndTechnicalLanguage: true,
      // Score puede bajar si hay falsos positivos de métricas; umbral suave
      minimumDaniStyleScore: 80,
    },
  },
  {
    id: "approximate-duration-range",
    description: "Usuario responde con rango aproximado",
    messages: [
      "Quiero presupuesto para un casamiento en Mendoza el 12/08/2026.",
      "Calculo que entre seis y ocho horas.",
    ],
    expectations: {
      expectedIntent: "QUOTE_REQUEST",
      expectedKnownFields: ["SERVICE_TYPE", "CITY", "EVENT_DATE", "DURATION_HOURS"],
      shouldReachReadyForCalculation: true,
      expectPricingReady: true,
      maximumAssistantQuestionsPerTurn: 1,
      forbidFormAndTechnicalLanguage: true,
    },
  },
  {
    id: "work-type-pivot",
    description: "Usuario cambia completamente el trabajo",
    messages: [
      "Quiero presupuesto para una sesión familiar en Rosario.",
      "Era una sesión familiar, pero ahora me pidieron cubrir el cumpleaños el 13/09/2026, 2 horas.",
    ],
    expectations: {
      expectedIntent: "QUOTE_REQUEST",
      expectedKnownFields: ["SERVICE_TYPE", "CITY", "EVENT_DATE", "DURATION_HOURS"],
      shouldReachReadyForCalculation: true,
      maximumAssistantQuestionsPerTurn: 1,
      forbidFormAndTechnicalLanguage: true,
    },
  },
];

function loadPromotedGoldenScenarios(): ConversationScenario[] {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "golden");
  if (!existsSync(dir)) return [];
  const out: ConversationScenario[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
    try {
      const raw = JSON.parse(readFileSync(path.join(dir, file), "utf8")) as {
        id: string;
        description: string;
        messages: string[];
        expectations?: ConversationScenario["expectations"];
      };
      if (raw.id && Array.isArray(raw.messages)) {
        out.push({
          id: raw.id,
          description: raw.description || raw.id,
          messages: raw.messages,
          expectations: raw.expectations,
        });
      }
    } catch {
      // ignore invalid golden files
    }
  }
  return out;
}

export const CONVERSATION_SCENARIOS: ConversationScenario[] = [
  ...BASE_SCENARIOS,
  ...loadPromotedGoldenScenarios(),
];

export function getScenarioById(id: string): ConversationScenario | undefined {
  return CONVERSATION_SCENARIOS.find((s) => s.id === id);
}

export function listScenarioIds(): string[] {
  return CONVERSATION_SCENARIOS.map((s) => s.id);
}
