/**
 * Catálogo central de integraciones con terceros.
 *
 * Única fuente de verdad de qué integraciones EXISTEN (metadata: nombre, permisos, qué
 * módulos las necesitan). No confundir con `WorkspaceIntegration` (en `packages/db`), que
 * es la fuente de verdad de qué cuentas tiene CONECTADAS cada workspace puntual.
 *
 * Mismo criterio que `lib/modules/registry.ts`: solo las `AVAILABLE` se le ofrecen a
 * alguien. Una `PLANNED` es una clave reservada para más adelante — aparece acá para que
 * la documentación y las dependencias entre módulos sean legibles, nunca como botón.
 */

export type IntegrationProvider = "GOOGLE";
export type IntegrationStatus = "AVAILABLE" | "PLANNED";

export type IntegrationDefinition = {
  /** Clave técnica y estable. Es el mismo valor que se usa en las rutas de conexión. */
  key: string;
  provider: IntegrationProvider;
  label: string;
  /** Qué habilita, en una línea, en el idioma del dueño del workspace. */
  description: string;
  /** Permisos que se le piden a Google. Se piden todos juntos o ninguno. */
  scopes: readonly string[];
  /** Claves de `lib/modules/registry.ts` que no funcionan sin esta integración. */
  requiredByModules: readonly string[];
  status: IntegrationStatus;
};

export const GOOGLE_CALENDAR_INTEGRATION_KEY = "google-calendar";

export const INTEGRATION_REGISTRY: readonly IntegrationDefinition[] = [
  {
    key: GOOGLE_CALENDAR_INTEGRATION_KEY,
    provider: "GOOGLE",
    label: "Google Calendar",
    description:
      "Espeja las reservas de espacios en el calendario de la institución, y toma de ahí lo que se cargue a mano.",
    // Los tres hacen falta y ninguno alcanza solo. `calendar.readonly` es para poder
    // ofrecer la lista de calendarios de la cuenta; `calendar.events` para escribir las
    // reservas en el que la institución elija; y `calendar.app.created` para poder CREAR
    // el calendario de un espacio — crear un calendario es una operación sobre la cuenta,
    // no sobre eventos, y sin este permiso Google contesta 403.
    //
    // Se usa `calendar.app.created` y no `calendar` a secas justamente para no pedir
    // acceso a los calendarios que la institución ya tenía: este permiso alcanza para los
    // que la app crea y para nada más.
    scopes: [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.app.created",
    ],
    requiredByModules: ["bookings"],
    status: "AVAILABLE",
  },

  // --- Reservadas para etapas futuras. Claves fijadas, SIN implementar. ---
  {
    key: "google-classroom",
    provider: "GOOGLE",
    label: "Google Classroom",
    description: "Crea las aulas de los cursos y mantiene la lista de alumnos.",
    scopes: [
      "https://www.googleapis.com/auth/classroom.courses",
      "https://www.googleapis.com/auth/classroom.rosters",
    ],
    requiredByModules: ["courses-sales"],
    status: "PLANNED",
  },
  {
    key: "google-drive",
    provider: "GOOGLE",
    label: "Google Drive",
    description: "Guarda documentación institucional en la unidad de la institución.",
    scopes: ["https://www.googleapis.com/auth/drive.file"],
    requiredByModules: [],
    status: "PLANNED",
  },
  {
    key: "google-contacts",
    provider: "GOOGLE",
    label: "Google Contacts",
    description: "Agenda a cada socio nuevo en los contactos de la institución.",
    scopes: ["https://www.googleapis.com/auth/contacts"],
    requiredByModules: ["members"],
    status: "PLANNED",
  },
] as const;

export function getIntegrationDefinition(key: string): IntegrationDefinition | undefined {
  return INTEGRATION_REGISTRY.find((i) => i.key === key);
}

export function listIntegrations(options?: { status?: IntegrationStatus }): IntegrationDefinition[] {
  return INTEGRATION_REGISTRY.filter(
    (i) => options?.status === undefined || i.status === options.status,
  ).slice();
}

/** Claves ofrecibles hoy. Es la whitelist real de las rutas de conexión. */
export function listAvailableIntegrationKeys(): string[] {
  return listIntegrations({ status: "AVAILABLE" }).map((i) => i.key);
}

/** Qué integraciones necesita un módulo para funcionar. Vacío es una respuesta válida. */
export function integrationsRequiredByModule(moduleKey: string): IntegrationDefinition[] {
  return INTEGRATION_REGISTRY.filter((i) => i.requiredByModules.includes(moduleKey)).slice();
}

/** Invariante de catálogo: ninguna clave puede repetirse. Usado por tests. */
export function findDuplicateIntegrationKeys(): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const i of INTEGRATION_REGISTRY) {
    if (seen.has(i.key)) dupes.add(i.key);
    seen.add(i.key);
  }
  return [...dupes];
}
