/**
 * EditorialAssistantEngine — orquesta proveedores de sugerencias.
 * No escribe en el documento; solo analiza.
 */

import { RuleBasedSuggestionProvider } from "./providers/rule-based";
import type {
  EditorialAssistantResult,
  EditorialDraftSnapshot,
  EditorialSuggestionProvider,
} from "./types";

export class EditorialAssistantEngine {
  private provider: EditorialSuggestionProvider;

  constructor(provider?: EditorialSuggestionProvider) {
    this.provider = provider ?? new RuleBasedSuggestionProvider();
  }

  /** Permite swap futuro a OpenAI / Claude / Gemini / Llama. */
  setProvider(provider: EditorialSuggestionProvider): void {
    this.provider = provider;
  }

  getProviderId(): string {
    return this.provider.id;
  }

  async analyze(draft: EditorialDraftSnapshot): Promise<EditorialAssistantResult> {
    return this.provider.analyze(draft);
  }

  /** Sync helper para UI React sin await cuando el provider es sync. */
  analyzeSync(draft: EditorialDraftSnapshot): EditorialAssistantResult {
    const result = this.provider.analyze(draft);
    if (result instanceof Promise) {
      throw new Error(
        "El proveedor actual es async; usá analyze() o un provider síncrono.",
      );
    }
    return result;
  }
}

/** Instancia default rule-based (apps pueden crear la suya). */
export function createEditorialAssistantEngine(
  provider?: EditorialSuggestionProvider,
): EditorialAssistantEngine {
  return new EditorialAssistantEngine(provider);
}
