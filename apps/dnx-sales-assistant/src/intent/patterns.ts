import type { AssistantIntent } from "../models/assistant.js";

export type IntentRule = {
  intent: AssistantIntent;
  /** Coincide si alguna regex hace match sobre el texto plegado. */
  patterns: RegExp[];
};

/**
 * Orden de prioridad: de más específica a más genérica.
 * Primera coincidencia gana. Sin IA.
 */
export const INTENT_RULES: readonly IntentRule[] = [
  {
    intent: "HUMAN_HANDOFF_REQUEST",
    patterns: [
      /\b(hablar|hablarle|comunicarme|contactar)\b.*\b(persona|humano|alguien|asesor|operador)\b/,
      /\bquiero hablar con\b/,
      /\bpasame (con |a )?(un |una )?(humano|persona|asesor|[a-z]{3,})\b/,
      /\batencion humana\b/,
      /\bhablo con alguien\b/,
    ],
  },
  {
    intent: "QUOTE_REQUEST",
    patterns: [
      /\b(presupuesto|presupuest|cotiz(ar|acion|á|a)?|cotizacion)\b/,
      /\bcuanto (sale|cuesta|cobras?|valen?|pasarle|le paso)\b/,
      /\bcuanto (tengo que |me )?cobrar\b/,
      /\bno se cuanto (pasarle|cobrar|cobrarle)\b/,
      /\bque (precio|valor)\b/,
      /\bme pasas? (un |el )?precio\b/,
      /\bnecesito (un )?presupuesto\b/,
      /\bcotizame\b/,
      /\bdecime cuanto\b/,
      // Fotógrafo anunciando un trabajo concreto (laboratorio / multiturno).
      /\bme salio (un |una )?(casamiento|boda|xv|15|evento|cumple(anos|años)?|sesion|sesión)\b/,
      /\bsali[oó] (un |una )?(casamiento|boda)\b/,
      /\btengo (un |una )?(casamiento|boda|xv|15|evento|cumple(anos|años)?|sesion|sesión)\b/,
    ],
  },
  {
    intent: "GENERAL_SERVICE_INQUIRY",
    patterns: [
      /\b(servicios?|paquetes?|coberturas?)\b/,
      /\b(sesion|sesión|foto(grafia|grafias|s)?|fotografo|fotógrafa)\b/,
      /\b(boda|casamiento|xv|15|cumple(anos|años)?|evento|book|retratos?)\b/,
      /\bque (ofrecen|hacen|cubren)\b/,
      /\binformacion (de |sobre )?(sus )?servicios\b/,
    ],
  },
  {
    intent: "GREETING",
    patterns: [
      /^(hola|holis|buen(as|os)?(\s+(dias?|tardes?|noches?))?|buen dia|hey|hi|hello)([!?.\s]*)$/,
      /^(hola|buen(as|os)?)\b.{0,40}$/,
    ],
  },
  {
    intent: "NEGATIVE",
    patterns: [
      /\bno(,)? gracias\b/,
      /^(no|nop|nope|negativo|nah)([!?.\s]*)$/,
      /^no(,| )\b.{0,30}$/,
    ],
  },
  {
    intent: "THANKS",
    patterns: [
      /\b(muchas gracias|mil gracias|agradezco|thank you|thanks)\b/,
      /(?<!no(,)?\s)\bgracias\b/,
    ],
  },
  {
    intent: "AFFIRMATIVE",
    patterns: [
      /^(si|sí|ok|okay|dale|perfecto|claro|de acuerdo|va|buenisimo|buenísimo|yes|yep)([!?.\s]*)$/,
      /^(si|sí)\b.{0,20}$/,
    ],
  },
  {
    intent: "OUT_OF_SCOPE",
    patterns: [
      /\b(programacion|programación|codigo|código|javascript|python|crypto|bitcoin|receta|cocina|viaje a europa|medicina|abogado|contaduria|contaduría)\b/,
      /\b(instagram ads?|meta ads?|tiktok ads?|publicidad digital)\b/,
      /\b(alquiler de auto|plomeria|plomería|electricista)\b/,
    ],
  },
] as const;
