import { describe, expect, it } from "vitest";
import {
  APPLICATION_STATUSES,
  applicationStatusLabel,
  applicationStatusPortalLabel,
} from "./states";

/**
 * Las dos lecturas del mismo estado.
 *
 * Quien coordina lee una lista de veinte postulaciones y necesita una etiqueta corta. Quien se
 * ofreció un sábado lee UNA, la suya. La misma palabra no sirve para los dos.
 */
describe("applicationStatusPortalLabel", () => {
  it("a quien se anotó no se le dice «no seleccionada»", () => {
    // El panel puede decirlo: es una etiqueta de gestión. En el portal es un veredicto sobre
    // una persona que ofreció su tiempo gratis, y no es lo que pasó — el equipo se completó.
    expect(applicationStatusPortalLabel("NO_SELECCIONADA")).toBe(
      "Esta vez no hizo falta. Gracias por anotarte.",
    );
    expect(applicationStatusPortalLabel("NO_SELECCIONADA")).not.toContain("No seleccionada");
  });

  it("agradece, en vez de explicar un descarte", () => {
    expect(applicationStatusPortalLabel("NO_SELECCIONADA").toLowerCase()).toContain("gracias");
  });

  it("donde las dos lecturas coinciden, no se inventa una segunda palabra", () => {
    // El mapa es parcial a propósito: una copia entera habría que mantenerla al lado de la otra
    // y se desincroniza el día que alguien toque una sola de las dos.
    for (const estado of ["RECIBIDA", "EN_REVISION", "PRESELECCIONADA", "SELECCIONADA"]) {
      expect(applicationStatusPortalLabel(estado)).toBe(applicationStatusLabel(estado));
    }
  });

  it("todos los estados tienen algo que mostrar", () => {
    for (const estado of APPLICATION_STATUSES) {
      expect(applicationStatusPortalLabel(estado).trim().length).toBeGreaterThan(0);
    }
  });

  it("un estado inventado se muestra tal cual, sin romper la pantalla", () => {
    expect(applicationStatusPortalLabel("EN_VUELO")).toBe("EN_VUELO");
  });
});
