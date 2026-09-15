import type { CoverageSettingsShape } from "./settings";

export type Terminology = {
  module: string;
  request: string;
  collaborator: string;
  requester: string;
  call: string;
};

/** Neutras a propósito: no son de una ONG ni de un estudio. */
const POR_OMISION: Terminology = {
  module: "Solicitudes y Coberturas",
  request: "Solicitud",
  collaborator: "Colaborador/a",
  requester: "Solicitante",
  call: "Convocatoria",
};

/** Una etiqueta vacía no pisa la de por omisión: dejaría la pantalla sin la palabra. */
function usar(configurada: string | null | undefined, porOmision: string): string {
  return configurada?.trim() || porOmision;
}

export function terminologyFor(settings: CoverageSettingsShape): Terminology {
  return {
    module: usar(settings.moduleLabel, POR_OMISION.module),
    request: usar(settings.termRequest, POR_OMISION.request),
    collaborator: usar(settings.termCollaborator, POR_OMISION.collaborator),
    requester: usar(settings.termRequester, POR_OMISION.requester),
    call: usar(settings.termCall, POR_OMISION.call),
  };
}
