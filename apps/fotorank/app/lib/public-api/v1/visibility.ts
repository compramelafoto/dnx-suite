import { isInternallyPublicListableStatus, type InternalContestStatus } from "./status";

export type InternalContestVisibility = "PUBLIC" | "PRIVATE" | "UNLISTED" | string;

export type PublicEventVisibilityFlags = {
  /** Aparece en listados públicos. */
  listed: boolean;
  /** Accesible por slug (landing / ficha). */
  routable: boolean;
  /** Indexable por buscadores (política de producto; hoy conservador). */
  indexable: boolean;
};

/**
 * Reglas V1 alineadas con loaders actuales + prep UNLISTED:
 * - listed: PUBLIC + status publicado/activo
 * - routable: PUBLIC o UNLISTED + status publicado/activo
 * - PRIVATE / draft: no públicos
 */
export function getPublicEventVisibility(input: {
  visibility: InternalContestVisibility;
  status: InternalContestStatus;
}): PublicEventVisibilityFlags {
  const listableStatus = isInternallyPublicListableStatus(input.status);

  if (!listableStatus) {
    return { listed: false, routable: false, indexable: false };
  }

  if (input.visibility === "PUBLIC") {
    return { listed: true, routable: true, indexable: true };
  }

  if (input.visibility === "UNLISTED") {
    return { listed: false, routable: true, indexable: false };
  }

  return { listed: false, routable: false, indexable: false };
}

export function assertCanSerializeForPublicList(input: {
  visibility: InternalContestVisibility;
  status: InternalContestStatus;
}): boolean {
  return getPublicEventVisibility(input).listed;
}

export function assertCanSerializeForPublicDetail(input: {
  visibility: InternalContestVisibility;
  status: InternalContestStatus;
}): boolean {
  return getPublicEventVisibility(input).routable;
}
