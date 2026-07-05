import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/photographer/perfil-datos-utils", () => ({
  pickContactPhone: (...phones: string[]) => phones.find(Boolean) ?? "",
  splitTitularName: (name: string | null, owner?: string | null) => {
    const full = (name || "").trim();
    if (!full) return { firstName: "", lastName: (owner || "").trim() };
    const parts = full.split(/\s+/);
    return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
  },
}));

import {
  PHOTOGRAPHER_VISUAL_IDENTITY_DEFAULTS,
  buildPhotographerVisualIdentityCssVars,
  mapUserToPhotographerVisualIdentity,
} from "./visual-identity";

describe("mapUserToPhotographerVisualIdentity", () => {
  it("usa los mismos defaults que la landing pública de CLF", () => {
    const identity = mapUserToPhotographerVisualIdentity({
      email: "foto@test.com",
      name: "Ana García",
      companyName: "",
      companyOwner: null,
      logoUrl: null,
      primaryColor: null,
      secondaryColor: null,
      tertiaryColor: null,
      fontColor: null,
      headerBackgroundColor: null,
      footerBackgroundColor: null,
      heroBackgroundColor: null,
      pageBackgroundColor: null,
      phone: null,
      whatsapp: null,
      website: null,
      instagram: null,
    });

    expect(identity.primaryColor).toBe(PHOTOGRAPHER_VISUAL_IDENTITY_DEFAULTS.primaryColor);
    expect(identity.accentColor).toBe(PHOTOGRAPHER_VISUAL_IDENTITY_DEFAULTS.primaryColor);
    expect(identity.buttonColor).toBe(PHOTOGRAPHER_VISUAL_IDENTITY_DEFAULTS.primaryColor);
  });

  it("expone el color configurado en User.primaryColor", () => {
    const identity = mapUserToPhotographerVisualIdentity({
      email: "foto@test.com",
      name: "Ana",
      companyName: "Estudio",
      companyOwner: null,
      logoUrl: "https://cdn.example/logo.png",
      primaryColor: "#7c3aed",
      secondaryColor: "#111827",
      tertiaryColor: null,
      fontColor: null,
      headerBackgroundColor: null,
      footerBackgroundColor: null,
      heroBackgroundColor: null,
      pageBackgroundColor: null,
      phone: null,
      whatsapp: null,
      website: null,
      instagram: null,
    });

    expect(identity.primaryColor).toBe("#7c3aed");
    expect(identity.logoUrl).toBe("https://cdn.example/logo.png");
    expect(buildPhotographerVisualIdentityCssVars(identity)["--cc-color-primary"]).toBe("#7c3aed");
  });
});
