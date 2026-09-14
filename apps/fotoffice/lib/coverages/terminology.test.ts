import { describe, expect, it } from "vitest";
import { DEFAULT_COVERAGE_SETTINGS } from "./settings";
import { terminologyFor } from "./terminology";

/**
 * Es lo que hace que el módulo no sea "el módulo de FOTOPOSITIVA".
 *
 * Donde una ONG lee "Voluntario/a", un estudio lee "Fotógrafo" y una cooperativa "Socio". Por
 * dentro es la misma tabla; lo único que cambia es la etiqueta, y cambia por configuración y
 * no por un `if` con el nombre de una organización adentro.
 */
describe("terminologyFor", () => {
  it("sin configurar nada, usa palabras neutras", () => {
    const t = terminologyFor(DEFAULT_COVERAGE_SETTINGS);
    expect(t.request).toBe("Solicitud");
    expect(t.collaborator).toBe("Colaborador/a");
    expect(t.requester).toBe("Solicitante");
    expect(t.call).toBe("Convocatoria");
  });

  it("FOTOPOSITIVA habla de voluntarios y organizaciones", () => {
    const t = terminologyFor({
      ...DEFAULT_COVERAGE_SETTINGS,
      termCollaborator: "Voluntario/a",
      termRequester: "Organización",
    });
    expect(t.collaborator).toBe("Voluntario/a");
    expect(t.requester).toBe("Organización");
    // Lo que no se configuró sigue en su valor neutro.
    expect(t.request).toBe("Solicitud");
  });

  it("una etiqueta vacía o de espacios no pisa la de por omisión", () => {
    // Un campo que alguien vació en el formulario no puede dejar la pantalla sin la palabra.
    const t = terminologyFor({
      ...DEFAULT_COVERAGE_SETTINGS,
      termCollaborator: "",
      termRequester: "   ",
    });
    expect(t.collaborator).toBe("Colaborador/a");
    expect(t.requester).toBe("Solicitante");
  });
});
