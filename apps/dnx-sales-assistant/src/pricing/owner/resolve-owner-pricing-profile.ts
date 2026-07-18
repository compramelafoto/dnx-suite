import path from "node:path";
import { loadPricingProfileFromPath } from "../config/load-pricing-profile.js";
import { loadServiceTemplatesFromPath } from "../config/load-service-templates.js";
import {
  defaultProfileLocalPath,
  defaultTemplatesLocalPath,
  resolveSalesAssistantRoot,
} from "../config/paths.js";
import type { PricingProfile, PricingServiceTemplateCatalog } from "../models.js";
import {
  assertProductionSafePricingProfile,
  isExamplePricingPath,
} from "../profile/user-facing-profile-guard.js";
import {
  loadOwnerIdentityConfig,
  ownerEmailSlug,
  type OwnerIdentityConfig,
} from "./owner-identity.js";

export type OwnerPricingResolveInput = {
  channel: "TELEGRAM";
  telegramUserId: string;
  telegramChatId: string;
  ownerEmail?: string;
};

export type OwnerPricingResolveResult =
  | {
      status: "READY";
      profile: PricingProfile;
      catalog: PricingServiceTemplateCatalog;
      source: "LOCAL_FILE";
      ownerEmail: string;
    }
  | {
      status: "NOT_FOUND";
      reason: string;
      ownerEmail?: string;
    }
  | {
      status: "INCOMPLETE";
      missingFields: string[];
      reason: string;
      ownerEmail: string;
    }
  | {
      status: "IDENTITY_MISMATCH";
      reason: string;
    }
  | {
      status: "SYNTHETIC_BLOCKED";
      reason: string;
    };

function candidateProfilePaths(identity: OwnerIdentityConfig): string[] {
  const root = resolveSalesAssistantRoot();
  const slug = identity.ownerEmail
    ? ownerEmailSlug(identity.ownerEmail)
    : "owner";
  const paths: string[] = [];
  if (identity.profilePath) paths.push(path.resolve(identity.profilePath));
  paths.push(
    path.join(root, "config", "pricing", "owners", `${slug}.local.json`),
  );
  paths.push(defaultProfileLocalPath(root));
  return [...new Set(paths)];
}

function candidateTemplatePaths(identity: OwnerIdentityConfig): string[] {
  const root = resolveSalesAssistantRoot();
  const paths: string[] = [];
  if (identity.templatesPath) paths.push(path.resolve(identity.templatesPath));
  paths.push(defaultTemplatesLocalPath(root));
  return [...new Set(paths)];
}

/**
 * Resuelve el perfil económico del propietario autorizado.
 * No usa fixtures ni el “primer archivo disponible” sin identidad.
 */
export function resolveOwnerPricingProfile(
  input: OwnerPricingResolveInput,
  identity: OwnerIdentityConfig = loadOwnerIdentityConfig(),
): OwnerPricingResolveResult {
  const email = (input.ownerEmail ?? identity.ownerEmail).trim().toLowerCase();

  if (!identity.telegramOwnerUserId || !identity.telegramOwnerChatId) {
    return {
      status: "IDENTITY_MISMATCH",
      reason: "Faltan DNX_TELEGRAM_OWNER_USER_ID / DNX_TELEGRAM_OWNER_CHAT_ID.",
    };
  }

  if (
    input.telegramUserId !== identity.telegramOwnerUserId ||
    input.telegramChatId !== identity.telegramOwnerChatId
  ) {
    return {
      status: "IDENTITY_MISMATCH",
      reason: "Telegram ID no coincide con el propietario configurado.",
    };
  }

  if (!email) {
    return {
      status: "IDENTITY_MISMATCH",
      reason: "Falta DNX_OWNER_EMAIL (correo propietario explícito).",
    };
  }

  if (identity.ownerEmail && email !== identity.ownerEmail) {
    return {
      status: "IDENTITY_MISMATCH",
      reason: "El correo solicitado no coincide con DNX_OWNER_EMAIL.",
    };
  }

  let lastIncomplete: OwnerPricingResolveResult | undefined;

  for (const profilePath of candidateProfilePaths({ ...identity, ownerEmail: email })) {
    if (isExamplePricingPath(profilePath)) {
      continue;
    }

    const loaded = loadPricingProfileFromPath(profilePath);
    if (loaded.status === "NOT_FOUND") continue;

    if (loaded.status === "INVALID" || loaded.status === "NOT_CONFIGURED") {
      const missing = loaded.issues.map((i) => i.path || i.code);
      lastIncomplete = {
        status: "INCOMPLETE",
        missingFields: missing.slice(0, 20),
        reason: `Perfil en ${path.basename(profilePath)} incompleto o inválido.`,
        ownerEmail: email,
      };
      continue;
    }

    const safe = assertProductionSafePricingProfile(loaded.value);
    if (!safe.ok) {
      return {
        status: "SYNTHETIC_BLOCKED",
        reason: safe.message,
      };
    }

    let catalog: PricingServiceTemplateCatalog | undefined;
    for (const templatesPath of candidateTemplatePaths(identity)) {
      if (isExamplePricingPath(templatesPath)) continue;
      const cat = loadServiceTemplatesFromPath(templatesPath);
      if (cat.status === "READY") {
        catalog = cat.value;
        break;
      }
      if (cat.status === "NOT_CONFIGURED" || cat.status === "INVALID") {
        lastIncomplete = {
          status: "INCOMPLETE",
          missingFields: cat.issues.map((i) => i.path || i.code).slice(0, 20),
          reason: "Plantillas de servicio incompletas o inválidas.",
          ownerEmail: email,
        };
      }
    }

    if (!catalog) {
      return (
        lastIncomplete ?? {
          status: "NOT_FOUND",
          reason: "No hay plantillas locales listas (.local.json).",
          ownerEmail: email,
        }
      );
    }

    return {
      status: "READY",
      profile: loaded.value,
      catalog,
      source: "LOCAL_FILE",
      ownerEmail: email,
    };
  }

  return (
    lastIncomplete ?? {
      status: "NOT_FOUND",
      reason:
        "No existe perfil económico local utilizable para el propietario configurado.",
      ownerEmail: email,
    }
  );
}
