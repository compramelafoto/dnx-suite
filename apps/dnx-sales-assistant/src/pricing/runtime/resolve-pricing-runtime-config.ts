import { loadPricingProfileFromPath } from "../config/load-pricing-profile.js";
import { loadServiceTemplatesFromPath } from "../config/load-service-templates.js";
import {
  defaultProfileLocalPath,
  defaultTemplatesLocalPath,
} from "../config/paths.js";
import type { PricingProfile, PricingServiceTemplateCatalog } from "../models.js";

export type PricingRuntimeConfigResolution =
  | {
      status: "READY";
      profile: PricingProfile;
      catalog: PricingServiceTemplateCatalog;
    }
  | {
      status: "UNAVAILABLE";
      reason: string;
    };

export type PricingRuntimeConfigResolver = () =>
  | PricingRuntimeConfigResolution
  | Promise<PricingRuntimeConfigResolution>;

/** Carga profile + catálogo locales. Sin throw. */
export function resolvePricingRuntimeConfigFromDisk(
  paths?: { profilePath?: string; templatesPath?: string },
): PricingRuntimeConfigResolution {
  const profilePath = paths?.profilePath ?? defaultProfileLocalPath();
  const templatesPath = paths?.templatesPath ?? defaultTemplatesLocalPath();

  const profileLoad = loadPricingProfileFromPath(profilePath);
  if (profileLoad.status !== "READY") {
    return {
      status: "UNAVAILABLE",
      reason: `profile:${profileLoad.status}`,
    };
  }

  const catalogLoad = loadServiceTemplatesFromPath(templatesPath);
  if (catalogLoad.status !== "READY") {
    return {
      status: "UNAVAILABLE",
      reason: `catalog:${catalogLoad.status}`,
    };
  }

  return {
    status: "READY",
    profile: profileLoad.value,
    catalog: catalogLoad.value,
  };
}

export function createInlinePricingRuntimeConfigResolver(input: {
  profile: PricingProfile;
  catalog: PricingServiceTemplateCatalog;
}): PricingRuntimeConfigResolver {
  return () => ({
    status: "READY",
    profile: input.profile,
    catalog: input.catalog,
  });
}
