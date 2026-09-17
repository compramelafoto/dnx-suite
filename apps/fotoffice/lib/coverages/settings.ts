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
import {
  DEFAULT_REQUEST_FORM_HIDDEN,
  DEFAULT_REQUEST_FORM_REQUIRED,
} from "./request-fields";

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
  /**
   * Lo que se lee al pie del formulario, antes del botón, y otra vez en la pantalla de "listo,
   * lo recibimos". Es el lugar del agradecimiento y de lo que conviene decir después de haber
   * pedido veinte datos, cuando quien completa ya hizo su parte.
   */
  publicFormOutro: string | null;
  /**
   * Qué campos del formulario público no se preguntan y cuáles son obligatorios.
   *
   * Dos listas de claves del catálogo de `./request-fields.ts`. Lo que no está en ninguna es
   * opcional, y los cinco campos fijos ignoran las dos. La regla vive allá, no acá.
   */
  requestFormHidden: string[];
  requestFormRequired: string[];
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
  publicFormOutro: null,
  // Los mismos valores que el `DEFAULT` de las dos columnas en la base: una institución sin
  // fila en `CoverageSettings` y una que nunca tocó la configuración tienen que ver el mismo
  // formulario. Por qué `contactName` empieza obligatorio está explicado en `request-fields.ts`.
  requestFormHidden: [...DEFAULT_REQUEST_FORM_HIDDEN],
  requestFormRequired: [...DEFAULT_REQUEST_FORM_REQUIRED],
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

/**
 * Acota un valor numérico que llegó como texto (de un `FormData`, por ejemplo).
 *
 * `Number("")` es `0`, un valor finito: sin el corte previo por vacío, borrar el campo no
 * restauraba el valor por omisión sino que lo acotaba al mínimo permitido. Por eso el vacío (o
 * los espacios) y lo que no es un número finito devuelven `porOmision` en vez de pasar por el
 * acotamiento.
 */
export function acotarEntero(
  raw: string | null | undefined,
  min: number,
  max: number,
  porOmision: number,
): number {
  const crudo = raw?.trim();
  if (!crudo) return porOmision;
  const n = Number(crudo);
  if (!Number.isFinite(n)) return porOmision;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Valida el modo de asignación que llegó como texto.
 *
 * El `<select>` del formulario es una comodidad para quien lo llena, no el control: quien
 * manda el `FormData` puede escribir cualquier cosa ahí. Lo que no está en `ASSIGNMENT_MODES`
 * cae en `"MIXTA"`, el modo más conservador (se publica, se postulan y el coordinador
 * confirma).
 */
export function normalizarAssignmentMode(raw: string | null | undefined): AssignmentMode {
  return (ASSIGNMENT_MODES as readonly string[]).includes(raw ?? "")
    ? (raw as AssignmentMode)
    : "MIXTA";
}
