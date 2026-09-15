import { describe, expect, it } from "vitest";
import {
  acotarEntero,
  ASSIGNMENT_MODE_LABELS,
  ASSIGNMENT_MODES,
  DEFAULT_COVERAGE_SETTINGS,
  normalizarAssignmentMode,
} from "./settings";

/**
 * Los valores por omisión no son arbitrarios: son decisiones deliberadas de privacidad,
 * performance y coordinación que guardan las relaciones entre partes del sistema.
 * Un cambio accidental aquí tiene consecuencias en cascada.
 */
describe("DEFAULT_COVERAGE_SETTINGS", () => {
  it("publicFormEnabled es false por omisión: es una decisión de privacidad deliberada", () => {
    // Un formulario público que junta datos de terceros no abre por encender un módulo.
    // Tiene que ser un acto deliberado del administrador. Si alguien cambia esto a true
    // en un refactor, es una violación de privacidad, no un detalle de configuración.
    expect(DEFAULT_COVERAGE_SETTINGS.publicFormEnabled).toBe(false);
  });

  it("reinforcementThresholdMinutes es 180 y recommendedCollaborators es 2: valores acordados", () => {
    // FOTOPOSITIVA acordó una ventana de refuerzo de 3 horas. reinforcement.ts depende
    // de estos valores para decidir si un colaborador postulado llega a tiempo.
    // recommendedCollaborators es el piso para avisar que faltan voluntarios.
    expect(DEFAULT_COVERAGE_SETTINGS.reinforcementThresholdMinutes).toBe(180);
    expect(DEFAULT_COVERAGE_SETTINGS.recommendedCollaborators).toBe(2);
  });

  it("requiresApproval y requiresCoordinatorConfirmation son true: no hay responsabilidad automática", () => {
    // Una postulación no convierte a nadie en responsable del trabajo.
    // Hace falta que alguien (el coordinador) confirme la asignación.
    // Si ambas son false, un Click sin supervisión enlaza a la gente a trabajos reales.
    expect(DEFAULT_COVERAGE_SETTINGS.requiresApproval).toBe(true);
    expect(DEFAULT_COVERAGE_SETTINGS.requiresCoordinatorConfirmation).toBe(true);
  });

  it("assignmentMode es MIXTA y está dentro de ASSIGNMENT_MODES", () => {
    expect(DEFAULT_COVERAGE_SETTINGS.assignmentMode).toBe("MIXTA");
    expect(ASSIGNMENT_MODES).toContain(DEFAULT_COVERAGE_SETTINGS.assignmentMode as never);
  });

  it("ASSIGNMENT_MODE_LABELS tiene una etiqueta para cada modo, ninguna vacía", () => {
    // Recorre cada modo definido y verifica que tiene una etiqueta no vacía.
    // Así si alguien agrega un modo a ASSIGNMENT_MODES, el test falla hasta que
    // añada la etiqueta en ASSIGNMENT_MODE_LABELS.
    for (const mode of ASSIGNMENT_MODES) {
      expect(ASSIGNMENT_MODE_LABELS[mode]).toBeDefined();
      expect(ASSIGNMENT_MODE_LABELS[mode]).toBeTruthy();
      expect(typeof ASSIGNMENT_MODE_LABELS[mode]).toBe("string");
    }
  });

  it("los cuatro vocabularios arrancan vacíos: la configuración los llena", () => {
    // roleTemplates, specialties, zones y notifyEmails son extensiones que
    // cada institución carga. La suma puede variar mucho: una startup tiene 3 roles,
    // una ONG tiene 50. Arrancan en [], nunca preconfigurados.
    expect(DEFAULT_COVERAGE_SETTINGS.roleTemplates).toEqual([]);
    expect(DEFAULT_COVERAGE_SETTINGS.specialties).toEqual([]);
    expect(DEFAULT_COVERAGE_SETTINGS.zones).toEqual([]);
    expect(DEFAULT_COVERAGE_SETTINGS.notifyEmails).toEqual([]);
  });

  it("consentTextVersion es v1 y trackingLinkTtlDays es 120", () => {
    // consentTextVersion es un selector para la versión del consentimiento.
    // trackingLinkTtlDays es cuántos días viven los links de seguimiento.
    // Ambos son líneas en la arena que pueden cambiar con el tiempo,
    // pero tienen valores semilla y son auditables.
    expect(DEFAULT_COVERAGE_SETTINGS.consentTextVersion).toBe("v1");
    expect(DEFAULT_COVERAGE_SETTINGS.trackingLinkTtlDays).toBe(120);
  });
});

/**
 * Extraída de `saveCoverageSettingsAction` para poder probarla sin un `FormData` ni la
 * autorización de coordinador. `Number("")` es `0`, un valor finito: sin el corte previo por
 * vacío, borrar el campo no restauraba el valor por omisión sino que lo acotaba al mínimo.
 */
describe("acotarEntero", () => {
  it("vacío devuelve el valor por omisión", () => {
    expect(acotarEntero("", 30, 24 * 60, 180)).toBe(180);
  });

  it("sólo espacios devuelve el valor por omisión", () => {
    expect(acotarEntero("   ", 30, 24 * 60, 180)).toBe(180);
  });

  it("texto no numérico devuelve el valor por omisión", () => {
    expect(acotarEntero("no es un número", 30, 24 * 60, 180)).toBe(180);
  });

  it("un valor por debajo del mínimo se acota al mínimo", () => {
    expect(acotarEntero("5", 30, 24 * 60, 180)).toBe(30);
  });

  it("un valor por encima del máximo se acota al máximo", () => {
    expect(acotarEntero("999999", 30, 24 * 60, 180)).toBe(24 * 60);
  });

  it("un valor válido en el medio se respeta, redondeado", () => {
    expect(acotarEntero("90.4", 30, 24 * 60, 180)).toBe(90);
  });
});

/**
 * El `<select>` del formulario es una comodidad para quien lo llena, no el control: quien
 * manda el `FormData` puede escribir cualquier cosa ahí. Lo que no se reconoce cae en
 * `"MIXTA"`, el modo más conservador.
 */
describe("normalizarAssignmentMode", () => {
  for (const modo of ASSIGNMENT_MODES) {
    it(`reconoce "${modo}" como válido`, () => {
      expect(normalizarAssignmentMode(modo)).toBe(modo);
    });
  }

  it("un valor inventado cae en MIXTA", () => {
    expect(normalizarAssignmentMode("INVENTADO")).toBe("MIXTA");
  });

  it("vacío cae en MIXTA", () => {
    expect(normalizarAssignmentMode("")).toBe("MIXTA");
  });

  it("null cae en MIXTA", () => {
    expect(normalizarAssignmentMode(null)).toBe("MIXTA");
  });
});
