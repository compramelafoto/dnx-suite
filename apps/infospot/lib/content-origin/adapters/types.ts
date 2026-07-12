import type {
  OriginDirection,
  OriginExternalEntityType,
  OriginSourceType,
  OperationalPayload,
} from "../types";

export type NormalizedExternalEntity = {
  sourceType: OriginSourceType;
  externalEntityType: OriginExternalEntityType;
  externalId: string;
  externalUrl: string | null;
  sourceUpdatedAt: Date | null;
  operationalPayload: OperationalPayload;
};

export type ContentSourceAdapter = {
  sourceType: OriginSourceType;
  /** Identidad canónica string para upserts. */
  normalizeIdentity: (input: {
    externalEntityType: OriginExternalEntityType;
    externalId: string | number;
  }) => { sourceType: OriginSourceType; externalEntityType: OriginExternalEntityType; externalId: string };
  buildOperationalPayload: (raw: unknown) => OperationalPayload;
  resolveExternalUrl: (input: {
    externalEntityType: OriginExternalEntityType;
    externalId: string | number;
    payload?: OperationalPayload;
  }) => string | null;
  /** Stub: fetch real queda para etapa de importación. */
  fetch?: (query: Record<string, unknown>) => Promise<unknown[]>;
  defaultDirection: OriginDirection;
};
