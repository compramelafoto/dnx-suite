import type { CommunicationMetadata, CommunicationRecipient } from "../shared/types";

export type SegmentOperator = "eq" | "neq" | "in" | "not_in" | "gt" | "gte" | "lt" | "lte" | "exists";

export type SegmentRule = {
  field: string;
  operator: SegmentOperator;
  value?: string | number | boolean | Array<string | number | boolean> | null;
};

export type Segment = {
  id: string;
  key: string;
  name: string;
  rules: SegmentRule[];
  metadata?: CommunicationMetadata;
};

/**
 * Puerto de segmentos de audiencia.
 * Resolución real (DB / geo / CRM) en etapas posteriores.
 */
export interface SegmentService {
  get(idOrKey: string): Promise<Segment | undefined>;
  resolve(segment: Segment): Promise<CommunicationRecipient[]>;
}
