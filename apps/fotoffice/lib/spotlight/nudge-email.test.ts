import { describe, expect, it } from "vitest";
import {
  buildSpotlightNudgeEmail,
  missingProfileItems,
  needsNudge,
  type ProfileFacts,
} from "./nudge-email";

const VACIO: ProfileFacts = {
  hasAccount: false,
  hasPhoto: false,
  aboutAnswers: 0,
  featuredPhotos: 0,
  hasProfessionalProfile: false,
  portfolioPhotos: 0,
  portfolioEnabled: true,
  hasPhone: true,
  hasCity: true,
};

const COMPLETO: ProfileFacts = {
  hasAccount: true,
  hasPhoto: true,
  aboutAnswers: 5,
  featuredPhotos: 2,
  hasProfessionalProfile: true,
  portfolioPhotos: 8,
  portfolioEnabled: true,
  hasPhone: true,
  hasCity: true,
};

describe("qué le falta al socio de la semana", () => {
  it("sin cuenta ni nada cargado, le falta todo, empezando por activar la cuenta", () => {
    expect(missingProfileItems(VACIO)).toEqual([
      "ACCOUNT",
      "PHOTO",
      "ABOUT",
      "FEATURED_PHOTOS",
      "PROFESSIONAL",
      "PORTFOLIO",
    ]);
    expect(needsNudge(VACIO)).toBe(true);
  });

  it("con la tarjeta completa no se le escribe", () => {
    expect(missingProfileItems(COMPLETO)).toEqual([]);
    expect(needsNudge(COMPLETO)).toBe(false);
  });

  it("le falta sólo el portfolio: se lo nombra, pero no justifica un correo", () => {
    const f = { ...COMPLETO, portfolioPhotos: 0 };
    expect(missingProfileItems(f)).toEqual(["PORTFOLIO"]);
    expect(needsNudge(f)).toBe(false);
  });

  it("sin el módulo de portfolios, no se le pide armarlo", () => {
    expect(missingProfileItems({ ...VACIO, portfolioEnabled: false })).not.toContain("PORTFOLIO");
  });

  it("sin «Más sobre mí» sí se le escribe, aunque tenga lo demás", () => {
    expect(needsNudge({ ...COMPLETO, aboutAnswers: 0 })).toBe(true);
  });
});

describe("el correo", () => {
  const base = {
    firstName: "Eduardo",
    institution: "SFPR",
    weekLabel: "del viernes 2 al jueves 8 de octubre",
    signature: null,
  };

  it("sin cuenta, el botón activa la cuenta y explica cómo seguir", () => {
    const m = buildSpotlightNudgeEmail({
      ...base,
      missing: missingProfileItems(VACIO),
      hasAccount: false,
      ctaUrl: "https://fotoffice.com/invitacion/abc",
    });
    expect(m.subject).toBe("¡Sos el Socio de la semana de SFPR! Completá tu perfil");
    expect(m.text).toContain("Hola Eduardo,");
    expect(m.text).toContain("Activar mi cuenta:\nhttps://fotoffice.com/invitacion/abc");
    expect(m.text).toContain("• Activar tu cuenta del portal");
    expect(m.text).toContain("• Armar tu portfolio");
    expect(m.text).toContain("red fuerte");
    expect(m.text).toContain("Mi perfil → Más sobre mí");
  });

  it("con cuenta, lleva a «Más sobre mí» y no habla de activar nada", () => {
    const m = buildSpotlightNudgeEmail({
      ...base,
      missing: ["ABOUT"],
      hasAccount: true,
      ctaUrl: "https://fotoffice.com/portal/perfil/sobre-mi",
    });
    expect(m.text).toContain("Completar mi perfil:\nhttps://fotoffice.com/portal/perfil/sobre-mi");
    expect(m.text).not.toContain("Activar");
  });

  it("escapa lo que llega de afuera en el HTML", () => {
    const m = buildSpotlightNudgeEmail({
      ...base,
      firstName: "<b>Ed</b>",
      missing: ["ABOUT"],
      hasAccount: true,
      ctaUrl: "https://fotoffice.com/portal/perfil/sobre-mi",
    });
    expect(m.html).not.toContain("<b>Ed</b>");
  });
});
