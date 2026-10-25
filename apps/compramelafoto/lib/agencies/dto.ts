import { bpsToPercentLabel, resolveAgencyTerms } from "./rules";

type AgencyRow = {
  id: number; name: string; description: string | null; logoUrl: string | null; defaultCommissionBps: number;
  directoryListed: boolean; directoryLat: number | null; directoryLng: number | null; directoryRadiusKm: number;
  directoryCity: string | null; notFoundSearchEnabled: boolean; termsText: string | null; termsVersion: number;
};

export function toAgencyDto(a: AgencyRow) {
  return {
    id: a.id,
    name: a.name,
    description: a.description,
    logoUrl: a.logoUrl,
    defaultCommissionBps: a.defaultCommissionBps,
    defaultCommissionLabel: bpsToPercentLabel(a.defaultCommissionBps),
    directoryListed: a.directoryListed,
    directoryLat: a.directoryLat,
    directoryLng: a.directoryLng,
    directoryRadiusKm: a.directoryRadiusKm,
    directoryCity: a.directoryCity,
    notFoundSearchEnabled: a.notFoundSearchEnabled,
    termsText: a.termsText,
    termsVersion: a.termsVersion,
    termsEffective: resolveAgencyTerms(a),
  };
}
