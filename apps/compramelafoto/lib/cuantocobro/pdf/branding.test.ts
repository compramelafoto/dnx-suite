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

import {
  CC_PDF_ACCENT_FALLBACK,
  collectPdfLogoCandidates,
  normalizePdfLogoCandidateUrl,
  resolvePdfPhotographerAccentHex,
} from "./branding";

describe("resolvePdfPhotographerAccentHex", () => {
  it("usa brandColor del snapshot cuando existe", () => {
    expect(resolvePdfPhotographerAccentHex({ primaryColor: "#c27b3d" })).toBe("#c27b3d");
  });

  it("usa primaryColor si no hay otro valor", () => {
    expect(resolvePdfPhotographerAccentHex({ primaryColor: "#2563eb" })).toBe("#2563eb");
  });

  it("cae al color institucional CLF si no hay color", () => {
    expect(resolvePdfPhotographerAccentHex(null)).toBe(CC_PDF_ACCENT_FALLBACK);
    expect(resolvePdfPhotographerAccentHex({ tradeName: "DNX" })).toBe(CC_PDF_ACCENT_FALLBACK);
    expect(CC_PDF_ACCENT_FALLBACK).toBe("#c27b3d");
  });
});

describe("collectPdfLogoCandidates", () => {
  it("recolecta photographerLogoUrl y logoUrl sin duplicar", () => {
    const candidates = collectPdfLogoCandidates({
      logoUrl: "https://cdn.example/logo.png",
      photographerLogoUrl: "https://cdn.example/logo.png",
    });

    expect(candidates).toEqual(["https://cdn.example/logo.png"]);
  });

  it("resuelve rutas relativas con base pública", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://compramelafoto.com";

    try {
      expect(normalizePdfLogoCandidateUrl("/logos/dnx.png")).toBe(
        "https://compramelafoto.com/logos/dnx.png",
      );
    } finally {
      process.env.NEXT_PUBLIC_APP_URL = prev;
    }
  });
});
