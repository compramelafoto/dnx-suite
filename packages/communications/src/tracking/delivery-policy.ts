import type { CommunicationDeliveryPolicyHandler } from "./persistence/contracts";

/**
 * Stub de política de entregabilidad.
 * Imp06: no-op. Futuro: hard bounce / complained → exclusion list durable.
 */
export function createNoopDeliveryPolicyHandler(): CommunicationDeliveryPolicyHandler {
  return {
    async onBounced() {},
    async onComplained() {},
    async onFailed() {},
    async onSuppressed() {},
  };
}
