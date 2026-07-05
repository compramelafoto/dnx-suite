import type { CuantoCobroBusinessProfile } from "@/lib/cuantocobro/business-profile";
import type {
  CuantoCobroProductServiceTemplate,
  CuantoCobroProfileInput,
  CuantoCobroQuoteInput,
} from "@/lib/cuantocobro/types";

/**
 * Contrato único de persistencia de ¿Cuánto Cobro?.
 * Futuro: DatabaseStorageAdapter implementará la misma interfaz.
 */
export interface CuantoCobroStorageAdapter {
  loadProfile(): Promise<CuantoCobroProfileInput>;
  saveProfile(profile: CuantoCobroProfileInput): Promise<void>;

  loadQuote(): CuantoCobroQuoteInput;
  saveQuote(quote: CuantoCobroQuoteInput): void;

  loadBusinessProfile(): CuantoCobroBusinessProfile | null;
  saveBusinessProfile(profile: CuantoCobroBusinessProfile): void;

  loadProductServiceTemplates(): CuantoCobroProductServiceTemplate[];
  saveProductServiceTemplates(templates: CuantoCobroProductServiceTemplate[]): void;
}
