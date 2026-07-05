import type { CuantoCobroWizardState } from "@/lib/cuantocobro/types";
import type { CuantoCobroProfileInput, CuantoCobroQuoteInput } from "@/lib/cuantocobro/types";
import { getCuantoCobroStorage } from "@/lib/cuantocobro/storage/get-cuanto-cobro-storage";
import {
  hydrateWizardStorageUserId,
  resolveWizardStorageUserId,
} from "@/lib/cuantocobro/storage/wizard-user-id";

export { hydrateWizardStorageUserId, resolveWizardStorageUserId };

export async function loadCuantoCobroWizardState(
  userId: number | null = resolveWizardStorageUserId(),
): Promise<CuantoCobroWizardState> {
  const storage = getCuantoCobroStorage(userId);
  const [profile, quote] = await Promise.all([storage.loadProfile(), Promise.resolve(storage.loadQuote())]);
  return { profile, quote };
}

export async function saveCuantoCobroProfile(
  profile: CuantoCobroProfileInput,
  userId: number | null = resolveWizardStorageUserId(),
): Promise<void> {
  await getCuantoCobroStorage(userId).saveProfile(profile);
}

export function saveCuantoCobroQuote(
  quote: CuantoCobroQuoteInput,
  userId: number | null = resolveWizardStorageUserId(),
): void {
  getCuantoCobroStorage(userId).saveQuote(quote);
}

export async function saveCuantoCobroWizardState(
  state: CuantoCobroWizardState,
  userId: number | null = resolveWizardStorageUserId(),
): Promise<void> {
  const storage = getCuantoCobroStorage(userId);
  await storage.saveProfile(state.profile);
  storage.saveQuote(state.quote);
}

export {
  loadWizardDomainBlob,
  persistWizardDomainBlob,
  serializeWizardDomainBlob,
} from "@/lib/cuantocobro/wizard-blob-persistence";

export type { WizardBlobKind, WizardStorageAdapter } from "@/lib/cuantocobro/wizard-storage-keys";
export { getWizardStorageKey } from "@/lib/cuantocobro/wizard-storage-keys";

export type { CuantoCobroStorageAdapter } from "@/lib/cuantocobro/storage/cuanto-cobro-storage-adapter";
export { getCuantoCobroStorage } from "@/lib/cuantocobro/storage/get-cuanto-cobro-storage";
export { LocalStorageCuantoCobroStorageAdapter } from "@/lib/cuantocobro/storage/local-storage-adapter";
