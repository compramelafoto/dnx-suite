import {
  hasBusinessProfileContent,
  normalizeBusinessProfile,
  type CuantoCobroBusinessProfile,
} from "@/lib/cuantocobro/business-profile";
import type { CuantoCobroStorageAdapter } from "@/lib/cuantocobro/storage/cuanto-cobro-storage-adapter";
import {
  loadBusinessProfileFromStorage,
  saveBusinessProfileToStorage,
} from "@/lib/cuantocobro/storage/business-profile-blob-persistence";
import { LocalStorageWizardBlobStorage } from "@/lib/cuantocobro/storage/local-storage-wizard-blob-storage";
import {
  loadProductServiceTemplatesFromStorage,
  saveProductServiceTemplatesToStorage,
} from "@/lib/cuantocobro/storage/templates-blob-persistence";
import { normalizeStoredProductServiceTemplate } from "@/lib/cuantocobro/product-service-template-normalize";
import {
  INITIAL_CUANTO_COBRO_PROFILE,
  INITIAL_CUANTO_COBRO_QUOTE,
  type CuantoCobroProductServiceTemplate,
  type CuantoCobroProfileInput,
  type CuantoCobroQuoteInput,
} from "@/lib/cuantocobro/types";
import { normalizeCuantoCobroQuote } from "@/lib/cuantocobro/normalize-quote";
import { normalizeCuantoCobroProfile } from "@/lib/cuantocobro/personal-expenses";
import type { WizardStorageAdapter } from "@/lib/cuantocobro/wizard-storage-keys";

export type LocalStorageCuantoCobroStorageAdapterOptions = {
  lowLevel: WizardStorageAdapter | null;
  getUserId: () => number | null;
};

const BUSINESS_NORMALIZERS = {
  normalize: normalizeBusinessProfile,
  hasContent: hasBusinessProfileContent,
};

export class LocalStorageCuantoCobroStorageAdapter implements CuantoCobroStorageAdapter {
  private readonly lowLevel: WizardStorageAdapter | null;
  private readonly getUserId: () => number | null;
  private readonly wizard: LocalStorageWizardBlobStorage<
    CuantoCobroProfileInput,
    CuantoCobroQuoteInput
  >;

  constructor(options: LocalStorageCuantoCobroStorageAdapterOptions) {
    this.lowLevel = options.lowLevel;
    this.getUserId = options.getUserId;
    this.wizard = new LocalStorageWizardBlobStorage(this.lowLevel, this.getUserId, {
      normalizeProfile: (raw) =>
        normalizeCuantoCobroProfile(raw as Partial<typeof INITIAL_CUANTO_COBRO_PROFILE>),
      normalizeQuote: (raw) =>
        normalizeCuantoCobroQuote(raw as Partial<typeof INITIAL_CUANTO_COBRO_QUOTE>),
      initialProfile: INITIAL_CUANTO_COBRO_PROFILE,
      initialQuote: INITIAL_CUANTO_COBRO_QUOTE,
    });
  }

  loadProfile(): Promise<CuantoCobroProfileInput> {
    return Promise.resolve(this.wizard.loadProfile());
  }

  saveProfile(profile: CuantoCobroProfileInput): Promise<void> {
    this.wizard.saveProfile(profile);
    return Promise.resolve();
  }

  loadQuote(): CuantoCobroQuoteInput {
    return this.wizard.loadQuote();
  }

  saveQuote(quote: CuantoCobroQuoteInput): void {
    this.wizard.saveQuote(quote);
  }

  loadBusinessProfile(): CuantoCobroBusinessProfile | null {
    if (!this.lowLevel) return null;
    return loadBusinessProfileFromStorage(this.lowLevel, BUSINESS_NORMALIZERS);
  }

  saveBusinessProfile(profile: CuantoCobroBusinessProfile): void {
    if (!this.lowLevel) return;
    saveBusinessProfileToStorage(this.lowLevel, profile, BUSINESS_NORMALIZERS);
  }

  loadProductServiceTemplates(): CuantoCobroProductServiceTemplate[] {
    if (!this.lowLevel) return [];
    return loadProductServiceTemplatesFromStorage(this.lowLevel, normalizeStoredProductServiceTemplate);
  }

  saveProductServiceTemplates(templates: CuantoCobroProductServiceTemplate[]): void {
    if (!this.lowLevel) return;
    saveProductServiceTemplatesToStorage(this.lowLevel, templates);
  }
}
