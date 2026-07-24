import { resolvePhotographerCallDisplay } from "../clf-event-provisioning/call-display-status";

export function isCallOpenForNotify(input: {
  enabled: boolean;
  provisioningStatus: string;
  desiredClfStatus: string;
  clfEventId: number | null;
  publicUrl: string | null;
  eventEnded: boolean;
  missingGeoref: boolean;
}): boolean {
  const display = resolvePhotographerCallDisplay({
    enabled: input.enabled,
    provisioningStatus: input.provisioningStatus,
    desiredClfStatus: input.desiredClfStatus,
    clfEventId: input.clfEventId,
    publicUrl: input.publicUrl,
    missingGeoref: input.missingGeoref,
    eventEnded: input.eventEnded,
  });
  return display.status === "OPEN";
}
