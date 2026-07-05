type ErrorCategory =
  | "missing_original_r2"
  | "rekognition_bytes_too_large_legacy"
  | "invalid_image"
  | "no_original_key"
  | "other";

const ERROR_PATTERNS: Array<{ category: ErrorCategory; patterns: string[] }> = [
  {
    category: "missing_original_r2",
    patterns: ["does not exist", "nosuchkey", "missing key", "r2"],
  },
  {
    category: "rekognition_bytes_too_large_legacy",
    patterns: ["image.bytes", "5242880", "rekognition"],
  },
  {
    category: "invalid_image",
    patterns: ["imagen inválida", "invalid image", "decoder", "unsupported", "corrupt", "sin dimensiones"],
  },
  {
    category: "no_original_key",
    patterns: ["foto sin originalkey", "sin originalkey", "originalkey"],
  },
];

export function classifyAnalysisError(message: string | null | undefined): ErrorCategory {
  const normalized = String(message || "").toLowerCase();
  if (!normalized) return "other";

  for (const rule of ERROR_PATTERNS) {
    if (rule.patterns.some((p) => normalized.includes(p))) {
      return rule.category;
    }
  }

  return "other";
}

export type { ErrorCategory };
