import { describe, expect, it } from "vitest";
import { INVITACION_A_ENSENAR, debeInvitarAEnsenar, enlaceParaEnsenarDesdeAfuera } from "./invitacion-ensenar";

describe("¿Querés enseñar?", () => {
  it("el texto es el del spec (sección 3)", () => {
    expect(INVITACION_A_ENSENAR.titulo).toBe("¿Querés enseñar?");
    expect(INVITACION_A_ENSENAR.texto).toBe("Creá tu espacio, subí tus cursos y que las instituciones los vendan.");
  });

  it("sólo se invita a quien todavía no tiene negocio", () => {
    expect(debeInvitarAEnsenar({ tieneNegocio: false })).toBe(true);
    expect(debeInvitarAEnsenar({ tieneNegocio: true })).toBe(false);
  });

  it("desde la página pública lleva a registrarse, en el dominio de FOTOFFICE", () => {
    expect(enlaceParaEnsenarDesdeAfuera("https://fotoffice.com/")).toBe("https://fotoffice.com/login?next=%2Fbienvenida");
  });
});
