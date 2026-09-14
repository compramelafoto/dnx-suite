/**
 * La configuración del módulo para un workspace.
 *
 * Es el archivo que sostiene la promesa de que el módulo es genérico: el umbral de 3 horas, la
 * palabra "voluntario" y la confirmación obligatoria del coordinador viven acá y no en el
 * código. Si mañana una agencia necesita otro umbral, se cambia un número en una pantalla.
 *
 * Tipo estructural y no el modelo de Prisma: así lo pueden importar los tests y los
 * componentes cliente sin arrastrar el cliente de base de datos al navegador.
 */
export type CoverageSettingsShape = {
  moduleLabel: string | null;
  termRequest: string | null;
  termCollaborator: string | null;
  termRequester: string | null;
  termCall: string | null;
  assignmentMode: string;
  requiresApproval: boolean;
  requiresCoordinatorConfirmation: boolean;
  reinforcementThresholdMinutes: number;
  recommendedCollaborators: number;
  roleTemplates: string[];
  specialties: string[];
  zones: string[];
  publicFormEnabled: boolean;
  publicFormIntro: string | null;
  consentTextVersion: string;
  trackingLinkTtlDays: number;
  notifyEmails: string[];
};

/**
 * Lo que rige cuando una institución nunca tocó la configuración.
 *
 * `publicFormEnabled` arranca apagado a propósito: publicar un formulario que recibe datos de
 * terceros tiene que ser un acto deliberado, no el resultado de encender un módulo.
 */
export const DEFAULT_COVERAGE_SETTINGS: CoverageSettingsShape = {
  moduleLabel: null,
  termRequest: null,
  termCollaborator: null,
  termRequester: null,
  termCall: null,
  assignmentMode: "MIXTA",
  requiresApproval: true,
  requiresCoordinatorConfirmation: true,
  reinforcementThresholdMinutes: 180,
  recommendedCollaborators: 2,
  roleTemplates: [],
  specialties: [],
  zones: [],
  publicFormEnabled: false,
  publicFormIntro: null,
  consentTextVersion: "v1",
  trackingLinkTtlDays: 120,
  notifyEmails: [],
};

export const ASSIGNMENT_MODES = ["DIRECTA", "ABIERTA", "AUTOMATICA", "MIXTA"] as const;
export type AssignmentMode = (typeof ASSIGNMENT_MODES)[number];

export const ASSIGNMENT_MODE_LABELS: Record<AssignmentMode, string> = {
  DIRECTA: "El coordinador invita a quien elige",
  ABIERTA: "Se publica y quien quiera se postula",
  AUTOMATICA: "El sistema propone candidatos",
  MIXTA: "Se publica, se postulan y el coordinador confirma",
};
