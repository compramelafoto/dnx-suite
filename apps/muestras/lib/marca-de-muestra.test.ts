import { describe, expect, it, vi } from "vitest";

const redirigido = vi.hoisted(() => ({ a: null as string | null }));
vi.mock("next/navigation", () => ({
  permanentRedirect: (url: string) => {
    redirigido.a = url;
    throw new Error("NEXT_REDIRECT");
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

const { asegurarCasa, canonicalDe, decidirCasa } = await import("./marca-de-muestra");

const PROD = { VERCEL_ENV: "production" };
const LOCAL = { APP_URL: "http://localhost:3031" };

describe("decidirCasa", () => {
  it("pintura pedida en fotografía redirige al dominio de arte", () =>
    expect(decidirCasa("FOTOGRAFIA", "PINTURA", PROD)).toEqual({ tipo: "redirigir", destino: "https://muestrasdearte.com" }));
  it("fotografía pedida en arte se muestra con canonical a fotografía", () =>
    expect(decidirCasa("ARTE", "FOTOGRAFIA", PROD)).toEqual({ tipo: "mostrar", canonical: "https://muestrasfotograficas.com" }));
  it("pintura en arte se muestra con canonical propio", () =>
    expect(decidirCasa("ARTE", "PINTURA", PROD)).toEqual({ tipo: "mostrar", canonical: "https://muestrasdearte.com" }));
  it("fotografía en fotografía se muestra con canonical propio", () =>
    expect(decidirCasa("FOTOGRAFIA", "FOTOGRAFIA", PROD)).toEqual({ tipo: "mostrar", canonical: "https://muestrasfotograficas.com" }));
  it("fuera de producción usa los orígenes locales", () => {
    expect(decidirCasa("FOTOGRAFIA", "ESCULTURA", LOCAL)).toEqual({ tipo: "redirigir", destino: "http://muestrasdearte.localhost:3031" });
    expect(decidirCasa("ARTE", "FOTOGRAFIA", LOCAL)).toEqual({ tipo: "mostrar", canonical: "http://localhost:3031" });
  });
});

describe("canonicalDe", () => {
  it("dominio de casa más la ruta", () => {
    expect(canonicalDe("FOTOGRAFIA", "/m/silos", PROD)).toBe("https://muestrasfotograficas.com/m/silos");
    expect(canonicalDe("PINTURA", "/m/oleos/o/w1", PROD)).toBe("https://muestrasdearte.com/m/oleos/o/w1");
  });
});

describe("asegurarCasa", () => {
  it("en la casa equivocada redirige (308) a la misma ruta y búsqueda en la casa", () => {
    redirigido.a = null;
    expect(() => asegurarCasa("fotografia", "PINTURA", "/m/oleos/libro", "?t=1", PROD)).toThrow("NEXT_REDIRECT");
    expect(redirigido.a).toBe("https://muestrasdearte.com/m/oleos/libro?t=1");
  });
  it("en una casa válida no hace nada", () => {
    redirigido.a = null;
    asegurarCasa("arte", "FOTOGRAFIA", "/m/silos", "", PROD);
    asegurarCasa("fotografia", "FOTOGRAFIA", "/m/silos", "", PROD);
    asegurarCasa("arte", "PINTURA", "/m/oleos", "", PROD);
    expect(redirigido.a).toBeNull();
  });
});
