export const ORGANIZER_LANDING_MODULE_IDS = [
  "hero",
  "upcomingEvents",
  "pastEvents",
  "featuredGalleries",
  "photographerCall",
  "sponsors",
  "officialPhotographers",
  "frequentPhotographers",
  "contact",
] as const;

export type OrganizerLandingModuleId = (typeof ORGANIZER_LANDING_MODULE_IDS)[number];

export type OrganizerLandingModulesConfig = Record<
  OrganizerLandingModuleId,
  { enabled: boolean; order: number }
>;

const MODULE_LABELS: Record<OrganizerLandingModuleId, string> = {
  hero: "Portada / hero",
  upcomingEvents: "Próximos eventos",
  pastEvents: "Eventos anteriores",
  featuredGalleries: "Galerías destacadas",
  photographerCall: "Convocatoria para fotógrafos",
  sponsors: "Auspiciantes",
  officialPhotographers: "Fotógrafos oficiales",
  frequentPhotographers: "Fotógrafos frecuentes",
  contact: "Contacto y redes",
};

export function getOrganizerLandingModuleLabel(id: OrganizerLandingModuleId): string {
  return MODULE_LABELS[id];
}

export function defaultOrganizerLandingModules(): OrganizerLandingModulesConfig {
  const config = {} as OrganizerLandingModulesConfig;
  ORGANIZER_LANDING_MODULE_IDS.forEach((id, index) => {
    config[id] = {
      enabled: id === "hero" || id === "upcomingEvents" || id === "contact",
      order: index,
    };
  });
  return config;
}

export function parseOrganizerLandingModules(raw: unknown): OrganizerLandingModulesConfig {
  const defaults = defaultOrganizerLandingModules();
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return defaults;
  }
  const input = raw as Record<string, unknown>;
  const result = { ...defaults };
  for (const id of ORGANIZER_LANDING_MODULE_IDS) {
    const entry = input[id];
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const e = entry as Record<string, unknown>;
      result[id] = {
        enabled: typeof e.enabled === "boolean" ? e.enabled : defaults[id].enabled,
        order: typeof e.order === "number" && Number.isFinite(e.order) ? e.order : defaults[id].order,
      };
    }
  }
  // Migración: módulo legacy "community" → "frequentPhotographers"
  const legacyCommunity = input.community;
  if (legacyCommunity && typeof legacyCommunity === "object" && !Array.isArray(legacyCommunity)) {
    const c = legacyCommunity as Record<string, unknown>;
    const current = result.frequentPhotographers;
    result.frequentPhotographers = {
      enabled: typeof c.enabled === "boolean" ? c.enabled : current.enabled,
      order: typeof c.order === "number" && Number.isFinite(c.order) ? c.order : current.order,
    };
  }
  return result;
}

/** Módulos configurables en el panel (excluye hero/contact si hiciera falta en el futuro). */
export const ORGANIZER_LANDING_MODULE_PANEL_IDS = ORGANIZER_LANDING_MODULE_IDS.filter(
  (id) => id !== "hero" && id !== "contact"
);

export function isModuleEnabled(
  modules: OrganizerLandingModulesConfig,
  id: OrganizerLandingModuleId
): boolean {
  return modules[id]?.enabled ?? false;
}
