import type { CuantoCobroProfileInput } from "@/lib/cuantocobro/types";
import {
  fetchFinancialProfileFromApi,
  saveFinancialProfileToApi,
} from "@/lib/cuantocobro/storage/financial-profile-api-client";

/**
 * Persistencia del perfil financiero en base de datos vía API.
 * Solo implementa loadProfile / saveProfile (el resto vive en LocalStorageAdapter).
 */
export class DatabaseCuantoCobroProfileStorage {
  async loadProfile(): Promise<CuantoCobroProfileInput | null> {
    return fetchFinancialProfileFromApi();
  }

  async saveProfile(profile: CuantoCobroProfileInput): Promise<void> {
    const ok = await saveFinancialProfileToApi(profile);
    if (!ok) {
      throw new Error("No se pudo guardar el perfil financiero en el servidor");
    }
  }
}
