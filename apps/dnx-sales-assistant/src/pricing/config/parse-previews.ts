import type { PricingProfile, PricingServiceTemplateCatalog } from "../models.js";
import { pricingProfileSchema } from "../profile/profile-schema.js";
import { pricingServiceTemplateCatalogSchema } from "../templates/template-schema.js";
import { loadJsonFile } from "./load-json-file.js";

export function tryParseProfilePreview(filePath: string): PricingProfile | undefined {
  const raw = loadJsonFile(filePath);
  if (raw.status !== "OK") return undefined;
  const parsed = pricingProfileSchema.safeParse(raw.value);
  return parsed.success ? parsed.data : undefined;
}

export function tryParseCatalogPreview(
  filePath: string,
): PricingServiceTemplateCatalog | undefined {
  const raw = loadJsonFile(filePath);
  if (raw.status !== "OK") return undefined;
  const parsed = pricingServiceTemplateCatalogSchema.safeParse(raw.value);
  return parsed.success ? (parsed.data as PricingServiceTemplateCatalog) : undefined;
}
