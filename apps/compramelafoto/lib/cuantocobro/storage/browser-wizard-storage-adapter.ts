import type { WizardStorageAdapter } from "@/lib/cuantocobro/wizard-storage-keys";

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

/** Adaptador de bajo nivel (local + session) usado solo por LocalStorageCuantoCobroStorageAdapter. */
export function createBrowserWizardStorageAdapter(): WizardStorageAdapter | null {
  if (!canUseLocalStorage() || !canUseSessionStorage()) {
    return null;
  }

  return {
    getLocalItem: (key) => window.localStorage.getItem(key),
    setLocalItem: (key, value) => {
      window.localStorage.setItem(key, value);
    },
    getSessionItem: (key) => window.sessionStorage.getItem(key),
  };
}
