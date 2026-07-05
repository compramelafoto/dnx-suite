import type { CuantoCobroBusinessProfile } from "@/lib/cuantocobro/business-profile";
import type { CuantoCobroStorageAdapter } from "@/lib/cuantocobro/storage/cuanto-cobro-storage-adapter";
import type { DatabaseCuantoCobroProfileStorage } from "@/lib/cuantocobro/storage/database-storage-adapter";
import type { LocalStorageCuantoCobroStorageAdapter } from "@/lib/cuantocobro/storage/local-storage-adapter";
import {
  persistFinancialProfile,
  resolveFinancialProfileLoad,
} from "@/lib/cuantocobro/storage/resolve-financial-profile-load";
import type {
  CuantoCobroProductServiceTemplate,
  CuantoCobroProfileInput,
  CuantoCobroQuoteInput,
} from "@/lib/cuantocobro/types";

export type CompositeCuantoCobroStorageAdapterOptions = {
  getUserId: () => number | null;
  database: DatabaseCuantoCobroProfileStorage;
  local: LocalStorageCuantoCobroStorageAdapter;
};

/**
 * Perfil financiero → base de datos (con migración automática desde localStorage).
 * Presupuesto, perfil comercial y plantillas → localStorage.
 */
export class CompositeCuantoCobroStorageAdapter implements CuantoCobroStorageAdapter {
  private readonly getUserId: () => number | null;
  private readonly database: DatabaseCuantoCobroProfileStorage;
  private readonly local: LocalStorageCuantoCobroStorageAdapter;

  constructor(options: CompositeCuantoCobroStorageAdapterOptions) {
    this.getUserId = options.getUserId;
    this.database = options.database;
    this.local = options.local;
  }

  async loadProfile(): Promise<CuantoCobroProfileInput> {
    return resolveFinancialProfileLoad({
      userId: this.getUserId(),
      loadRemote: () => this.database.loadProfile(),
      loadLocal: () => this.local.loadProfile(),
      saveRemote: (profile) => this.database.saveProfile(profile),
    });
  }

  async saveProfile(profile: CuantoCobroProfileInput): Promise<void> {
    await persistFinancialProfile({
      userId: this.getUserId(),
      profile,
      saveRemote: (value) => this.database.saveProfile(value),
      saveLocal: (value) => this.local.saveProfile(value),
    });
  }

  loadQuote(): CuantoCobroQuoteInput {
    return this.local.loadQuote();
  }

  saveQuote(quote: CuantoCobroQuoteInput): void {
    this.local.saveQuote(quote);
  }

  loadBusinessProfile(): CuantoCobroBusinessProfile | null {
    return this.local.loadBusinessProfile();
  }

  saveBusinessProfile(profile: CuantoCobroBusinessProfile): void {
    this.local.saveBusinessProfile(profile);
  }

  loadProductServiceTemplates(): CuantoCobroProductServiceTemplate[] {
    return this.local.loadProductServiceTemplates();
  }

  saveProductServiceTemplates(templates: CuantoCobroProductServiceTemplate[]): void {
    this.local.saveProductServiceTemplates(templates);
  }
}
