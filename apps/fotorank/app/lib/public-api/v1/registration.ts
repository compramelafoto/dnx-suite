/**
 * Extensión pública de inscripción (Etapa 09A).
 * Stub honesto hasta existir config administrativa persistida y checkout (09B).
 *
 * No leer economy/rulesData simulados como precio real.
 * No crear preferencias MP ni órdenes aquí.
 */

import type {
  FotorankPublicCapabilitiesV1,
  FotorankPublicRegistrationStatusV1,
  FotorankPublicRegistrationV1,
} from "./contracts";

export type BuildPublicRegistrationV1Input = {
  registrationStatus: FotorankPublicRegistrationStatusV1;
  capabilities: Pick<FotorankPublicCapabilitiesV1, "canRegister">;
};

/**
 * Stub público: free, sin precio, sin merch, sin checkoutUrl.
 * Reemplazar en 09B cuando exista `registrationPricing` persistido.
 */
export function buildPublicRegistrationStubV1(
  input: BuildPublicRegistrationV1Input,
): FotorankPublicRegistrationV1 {
  return {
    mode: "free",
    status: input.registrationStatus,
    canRegister: input.capabilities.canRegister,
    displayPrice: null,
    hasOptionalMerchandise: false,
    checkoutUrl: null,
  };
}
