import { describe, expect, it } from "vitest";
import { portfolioVisibility, type PortfolioVisibilityFacts } from "./visibility";

/** Un portfolio que cumple las siete condiciones. Cada test rompe una sola. */
const alAire: PortfolioVisibilityFacts = {
  moduleEnabled: true,
  hiddenByAdminAt: null,
  memberStatus: "ACTIVE",
  directoryOptIn: true,
  photoCount: 5,
  memberPublished: true,
  overdueCount: 0,
  adminForcePublish: false,
};

describe("portfolioVisibility", () => {
  it("con las siete condiciones cumplidas, se ve", () => {
    expect(portfolioVisibility(alAire)).toEqual({ visible: true });
  });

  it("módulo apagado: no se ve", () => {
    expect(portfolioVisibility({ ...alAire, moduleEnabled: false })).toEqual({
      visible: false,
      reason: "MODULE_DISABLED",
    });
  });

  it("bajado por la institución: no se ve", () => {
    expect(portfolioVisibility({ ...alAire, hiddenByAdminAt: new Date() })).toEqual({
      visible: false,
      reason: "HIDDEN_BY_ADMIN",
    });
  });

  it("socio dado de baja: no se ve", () => {
    expect(portfolioVisibility({ ...alAire, memberStatus: "INACTIVE" })).toEqual({
      visible: false,
      reason: "MEMBER_NOT_ACTIVE",
    });
  });

  it("socio suspendido: no se ve", () => {
    expect(portfolioVisibility({ ...alAire, memberStatus: "SUSPENDED" })).toEqual({
      visible: false,
      reason: "MEMBER_NOT_ACTIVE",
    });
  });

  it("sin consentimiento: no se ve, aunque el socio lo haya publicado", () => {
    expect(portfolioVisibility({ ...alAire, directoryOptIn: false })).toEqual({
      visible: false,
      reason: "NO_CONSENT",
    });
  });

  it("sin fotos: no se ve", () => {
    expect(portfolioVisibility({ ...alAire, photoCount: 0 })).toEqual({
      visible: false,
      reason: "NO_PHOTOS",
    });
  });

  it("el socio no lo publicó: no se ve", () => {
    expect(portfolioVisibility({ ...alAire, memberPublished: false })).toEqual({
      visible: false,
      reason: "NOT_PUBLISHED_BY_MEMBER",
    });
  });

  it("con 3 cargos vencidos: no se ve", () => {
    expect(portfolioVisibility({ ...alAire, overdueCount: 3 })).toEqual({
      visible: false,
      reason: "OVERDUE_DUES",
    });
  });

  it("con 2 cargos vencidos todavía se ve: el umbral es 3", () => {
    expect(portfolioVisibility({ ...alAire, overdueCount: 2 })).toEqual({ visible: true });
  });

  it("la institución puede publicarlo igual pese a la deuda", () => {
    expect(portfolioVisibility({ ...alAire, overdueCount: 9, adminForcePublish: true })).toEqual({
      visible: true,
    });
  });

  it("publicar igual NO saltea nada más que la deuda", () => {
    expect(
      portfolioVisibility({ ...alAire, directoryOptIn: false, adminForcePublish: true }),
    ).toEqual({ visible: false, reason: "NO_CONSENT" });
  });

  it("lo decidido por la institución se informa antes que lo que depende del socio", () => {
    // Le falta todo, pero además la institución lo bajó: decirle "subí una foto" sería mentira.
    expect(
      portfolioVisibility({
        ...alAire,
        hiddenByAdminAt: new Date(),
        directoryOptIn: false,
        photoCount: 0,
        memberPublished: false,
      }),
    ).toEqual({ visible: false, reason: "HIDDEN_BY_ADMIN" });
  });

  it("entre las del socio, primero la que desbloquea: consentimiento, después fotos", () => {
    expect(portfolioVisibility({ ...alAire, directoryOptIn: false, photoCount: 0 })).toEqual({
      visible: false,
      reason: "NO_CONSENT",
    });
  });

  it("la deuda se informa última: es la más probable de ser un falso positivo", () => {
    expect(portfolioVisibility({ ...alAire, photoCount: 0, overdueCount: 5 })).toEqual({
      visible: false,
      reason: "NO_PHOTOS",
    });
  });
});
