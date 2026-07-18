import type { CalibrationCode } from "../domain/calibration-codes.js";
import type { CalibrationVerdict } from "../domain/calibration-item.js";

const FLAG_TO_CODE: Record<string, CalibrationCode> = {
  DANI_STYLE_REPEATED_QUESTION: "CALIBRATION_REPEATED_QUESTION",
  DANI_STYLE_ASKED_KNOWN_FIELD: "CALIBRATION_ASKED_KNOWN_FIELD",
  DANI_STYLE_FORM_LANGUAGE: "CALIBRATION_TOO_FORMAL",
  DANI_STYLE_TECHNICAL_LANGUAGE: "CALIBRATION_TOO_ROBOTIC",
  DANI_STYLE_TOO_LONG: "CALIBRATION_TOO_LONG",
  DANI_STYLE_MULTIPLE_QUESTIONS: "CALIBRATION_WRONG_QUESTION",
  DANI_STYLE_CHATBOT_PHRASE: "CALIBRATION_TOO_ROBOTIC",
  DANI_STYLE_EXCESSIVE_ENTHUSIASM: "CALIBRATION_EXCESSIVE_ENTHUSIASM",
  DANI_STYLE_CONTEXT_LOSS: "CALIBRATION_CONTEXT_LOSS",
};

const NOTE_HINTS: Array<{ re: RegExp; code: CalibrationCode }> = [
  { re: /formal/i, code: "CALIBRATION_TOO_FORMAL" },
  { re: /rob[oó]tic|bot|autom[aá]tic/i, code: "CALIBRATION_TOO_ROBOTIC" },
  { re: /largo|demasiado texto/i, code: "CALIBRATION_TOO_LONG" },
  { re: /corto|muy breve/i, code: "CALIBRATION_TOO_SHORT" },
  { re: /pregunt(a|ar)|orden/i, code: "CALIBRATION_WRONG_QUESTION" },
  { re: /perfecto|buenísimo|buenisimo/i, code: "CALIBRATION_UNNATURAL_CONFIRMATION" },
  { re: /entusiasmo/i, code: "CALIBRATION_EXCESSIVE_ENTHUSIASM" },
  { re: /copy|frase|variant/i, code: "CALIBRATION_BAD_COPY_VARIANT" },
  { re: /nicho|visual|foto/i, code: "CALIBRATION_VISUAL_RESPONSE_INCORRECT" },
];

export function normalizeCalibrationCode(input: {
  verdict: CalibrationVerdict;
  note?: string;
  styleFlags: string[];
  styleScore?: number;
  manualCode?: CalibrationCode;
}): { code: CalibrationCode; source: "AUTO" | "MANUAL" } {
  if (input.manualCode) {
    return { code: input.manualCode, source: "MANUAL" };
  }

  for (const flag of input.styleFlags) {
    const mapped = FLAG_TO_CODE[flag];
    if (mapped) return { code: mapped, source: "AUTO" };
  }

  if (input.note?.trim()) {
    for (const hint of NOTE_HINTS) {
      if (hint.re.test(input.note)) {
        return { code: hint.code, source: "AUTO" };
      }
    }
  }

  if (
    input.styleScore !== undefined &&
    input.styleScore >= 95 &&
    (input.verdict === "INCORRECT" || input.verdict === "NEEDS_ADJUSTMENT")
  ) {
    return { code: "CALIBRATION_HIGH_SCORE_HUMAN_REJECTED", source: "AUTO" };
  }

  if (
    input.styleScore !== undefined &&
    input.styleScore <= 85 &&
    input.verdict === "APPROVED"
  ) {
    return { code: "CALIBRATION_LOW_SCORE_HUMAN_APPROVED", source: "AUTO" };
  }

  if (input.verdict === "APPROVED") {
    return { code: "CALIBRATION_OTHER", source: "AUTO" };
  }

  return { code: "CALIBRATION_OTHER", source: "AUTO" };
}
