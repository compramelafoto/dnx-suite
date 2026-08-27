/**
 * Elección del logo del partner para las placas de agradecimiento.
 *
 * La placa pone el logo sobre una plancha clara, así que se prefiere la
 * variante pensada para fondo claro y se cae al logo general. El campo suelto
 * `logoUrl` del partner queda como último recurso.
 */
import { resolvePartnerLogoSlot } from "./assets-resolve";
import type { PartnerBrandAssetRecord, ResolvedPartnerImage } from "./assets-types";

export type SponsorCardLogoCandidate = {
  url: string;
  source: ResolvedPartnerImage["source"];
  assetId: string | null;
};

/**
 * Devuelve los candidatos en orden de preferencia; el llamador se queda con el
 * primero que logre descargar. Sin candidatos, la placa se arma sin logo.
 */
export function resolveSponsorCardLogoCandidates(input: {
  assets: readonly PartnerBrandAssetRecord[];
  logoUrl?: string | null;
  now?: Date;
}): SponsorCardLogoCandidate[] {
  const candidates: SponsorCardLogoCandidate[] = [];
  const seen = new Set<string>();

  const push = (resolved: ResolvedPartnerImage) => {
    const url = resolved.url?.trim();
    if (!url || seen.has(url)) return;
    seen.add(url);
    candidates.push({ url, source: resolved.source, assetId: resolved.assetId });
  };

  // La plancha del logo es clara: LOGO_DARK es la variante para fondo claro.
  push(
    resolvePartnerLogoSlot({
      assets: input.assets,
      type: "LOGO_DARK",
      backgroundType: "LIGHT",
      logoUrl: null,
      now: input.now,
    })
  );
  push(
    resolvePartnerLogoSlot({
      assets: input.assets,
      type: "LOGO_GENERAL",
      backgroundType: "COLOR",
      logoUrl: null,
      now: input.now,
    })
  );
  push(
    resolvePartnerLogoSlot({
      assets: input.assets,
      type: "LOGO_PRIMARY",
      backgroundType: "COLOR",
      logoUrl: null,
      now: input.now,
    })
  );

  const fallback = input.logoUrl?.trim();
  if (fallback && !seen.has(fallback)) {
    seen.add(fallback);
    candidates.push({ url: fallback, source: "logo_url", assetId: null });
  }

  return candidates;
}
