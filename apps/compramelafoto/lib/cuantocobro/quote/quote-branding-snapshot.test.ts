import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/photographer/perfil-datos-utils", () => ({
  joinTitularName: (first: string, last: string) => `${first} ${last}`.trim(),
  pickContactPhone: (...phones: string[]) => phones.find(Boolean) ?? "",
  splitTitularName: (name: string | null) => {
    const parts = (name || "").trim().split(/\s+/);
    return { firstName: parts[0] ?? "", lastName: parts.slice(1).join(" ") };
  },
}));

vi.mock("@/lib/cuantocobro/storage/get-cuanto-cobro-storage", () => ({
  getCuantoCobroStorage: () => ({
    getItem: vi.fn(),
    setItem: vi.fn(),
  }),
}));

import { PHOTOGRAPHER_VISUAL_IDENTITY_DEFAULTS } from "../../photographer/visual-identity";
import {
  CC_QUOTE_BRANDING_ACCENT_FALLBACK,
  collectQuoteLogoCandidatesFromSnapshot,
  mapUserRowToPhotographerBrandingSource,
  mergeQuoteBrandingSnapshot,
  resolveBrandingLogoUrl,
  resolveQuoteAccentHex,
} from "./quote-branding-snapshot";

const photographer = mapUserRowToPhotographerBrandingSource({
  email: "foto@estudio.com",
  name: "Ana García",
  companyName: "Estudio García",
  companyOwner: null,
  logoUrl: "https://cdn.example/photographer-logo.png",
  primaryColor: "#c27b3d",
  secondaryColor: "#1e293b",
  tertiaryColor: null,
  fontColor: null,
  headerBackgroundColor: null,
  footerBackgroundColor: null,
  heroBackgroundColor: null,
  pageBackgroundColor: null,
  phone: "+54 11 1111 1111",
  whatsapp: "+54 11 2222 2222",
  website: "https://estudio.com",
  instagram: "@estudiogarcia",
});

describe("mergeQuoteBrandingSnapshot", () => {
  it("usa identidad visual del User CLF aunque el perfil comercial CC tenga otros colores", () => {
    const merged = mergeQuoteBrandingSnapshot(
      {
        tradeName: "Mi Marca CC",
        commercialEmail: "cc@marca.com",
        logoUrl: "https://cdn.example/cc-logo.png",
        brandColor: "#2563eb",
        primaryColor: "#2563eb",
      },
      photographer,
    );

    expect(merged.primaryColor).toBe("#c27b3d");
    expect(merged.logoUrl).toBe("https://cdn.example/photographer-logo.png");
    expect(merged.tradeName).toBe("Mi Marca CC");
  });

  it("completa logo desde el fotógrafo si el snapshot no lo tiene", () => {
    const merged = mergeQuoteBrandingSnapshot(
      {
        tradeName: "Mi Marca CC",
        commercialEmail: "cc@marca.com",
      },
      photographer,
    );

    expect(merged.logoUrl).toBe("https://cdn.example/photographer-logo.png");
    expect(merged.photographerLogoUrl).toBe("https://cdn.example/photographer-logo.png");
  });

  it("respeta logo y color congelados en versiones ya guardadas", () => {
    const merged = mergeQuoteBrandingSnapshot(
      {
        logoUrl: "https://cdn.example/frozen.png",
        photographerLogoUrl: "https://cdn.example/frozen.png",
        primaryColor: "#7c3aed",
        commercialEmail: "a@b.com",
      },
      null,
    );

    expect(merged.logoUrl).toBe("https://cdn.example/frozen.png");
    expect(merged.primaryColor).toBe("#7c3aed");
    expect(resolveBrandingLogoUrl(merged)).toBe("https://cdn.example/frozen.png");
  });
});

describe("resolveQuoteAccentHex", () => {
  it("usa primaryColor congelado del User", () => {
    expect(resolveQuoteAccentHex({ primaryColor: "#c27b3d" })).toBe("#c27b3d");
    expect(resolveQuoteAccentHex({ primaryColor: "#7c3aed" })).toBe("#7c3aed");
  });

  it("cae al color institucional CLF si no hay color", () => {
    expect(resolveQuoteAccentHex(null)).toBe(CC_QUOTE_BRANDING_ACCENT_FALLBACK);
    expect(CC_QUOTE_BRANDING_ACCENT_FALLBACK).toBe(PHOTOGRAPHER_VISUAL_IDENTITY_DEFAULTS.primaryColor);
    expect(resolveQuoteAccentHex({ tradeName: "Solo nombre" })).toBe(CC_QUOTE_BRANDING_ACCENT_FALLBACK);
  });
});

describe("collectQuoteLogoCandidatesFromSnapshot", () => {
  it("incluye photographerLogoUrl y logoUrl sin duplicar", () => {
    const candidates = collectQuoteLogoCandidatesFromSnapshot({
      logoUrl: "https://cdn.example/logo.png",
      photographerLogoUrl: "https://cdn.example/logo.png",
    });

    expect(candidates).toEqual(["https://cdn.example/logo.png"]);
  });

  it("devuelve vacío cuando no hay logo (fallback a iniciales en PDF)", () => {
    expect(collectQuoteLogoCandidatesFromSnapshot({ tradeName: "DNX" })).toEqual([]);
    expect(resolveBrandingLogoUrl({ tradeName: "DNX" })).toBeNull();
  });
});
