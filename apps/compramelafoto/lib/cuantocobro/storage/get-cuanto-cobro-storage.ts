import type { CuantoCobroStorageAdapter } from "@/lib/cuantocobro/storage/cuanto-cobro-storage-adapter";
import { createBrowserWizardStorageAdapter } from "@/lib/cuantocobro/storage/browser-wizard-storage-adapter";
import { CompositeCuantoCobroStorageAdapter } from "@/lib/cuantocobro/storage/composite-storage-adapter";
import { DatabaseCuantoCobroProfileStorage } from "@/lib/cuantocobro/storage/database-storage-adapter";
import { LocalStorageCuantoCobroStorageAdapter } from "@/lib/cuantocobro/storage/local-storage-adapter";
import { resolveWizardStorageUserId } from "@/lib/cuantocobro/storage/wizard-user-id";

/**
 * Perfil financiero → base de datos (vía API).
 * Presupuesto, perfil comercial y plantillas → localStorage.
 */
export function getCuantoCobroStorage(userId?: number | null): CuantoCobroStorageAdapter {
  const getUserId =
    userId !== undefined ? () => userId : resolveWizardStorageUserId;

  const local = new LocalStorageCuantoCobroStorageAdapter({
    lowLevel: createBrowserWizardStorageAdapter(),
    getUserId,
  });

  return new CompositeCuantoCobroStorageAdapter({
    getUserId,
    database: new DatabaseCuantoCobroProfileStorage(),
    local,
  });
}
