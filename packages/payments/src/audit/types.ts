import type { AuditEvent } from "../contracts/entities.js";

export type AuditEventInput = Omit<AuditEvent, "id" | "occurredAt"> & {
  id?: string;
  occurredAt?: string;
};

/** Contract only — no sink implementation in Etapa 02. */
export interface AuditPort {
  append(event: AuditEvent): Promise<void>;
}
