import { loadWizardDomainBlob, persistWizardDomainBlob } from "../wizard-blob-persistence";
import type { WizardStorageAdapter } from "../wizard-storage-keys";

export type WizardBlobNormalizers<TProfile, TQuote> = {
  normalizeProfile: (raw: unknown) => TProfile;
  normalizeQuote: (raw: unknown) => TQuote;
  initialProfile: TProfile;
  initialQuote: TQuote;
};

/** Profile + quote sobre local/session storage (sin dependencias de business-profile). */
export class LocalStorageWizardBlobStorage<TProfile, TQuote> {
  constructor(
    private readonly lowLevel: WizardStorageAdapter | null,
    private readonly getUserId: () => number | null,
    private readonly normalizers: WizardBlobNormalizers<TProfile, TQuote>,
  ) {}

  loadProfile(): TProfile {
    if (!this.lowLevel) return this.normalizers.initialProfile;
    return loadWizardDomainBlob(
      this.lowLevel,
      this.getUserId(),
      "profile",
      this.normalizers.normalizeProfile,
      this.normalizers.initialProfile,
    ).value;
  }

  saveProfile(profile: TProfile): void {
    if (!this.lowLevel) return;
    persistWizardDomainBlob(
      this.lowLevel,
      this.getUserId(),
      "profile",
      profile as Record<string, unknown>,
    );
  }

  loadQuote(): TQuote {
    if (!this.lowLevel) return this.normalizers.initialQuote;
    return loadWizardDomainBlob(
      this.lowLevel,
      this.getUserId(),
      "quote",
      this.normalizers.normalizeQuote,
      this.normalizers.initialQuote,
    ).value;
  }

  saveQuote(quote: TQuote): void {
    if (!this.lowLevel) return;
    persistWizardDomainBlob(
      this.lowLevel,
      this.getUserId(),
      "quote",
      quote as Record<string, unknown>,
    );
  }
}
