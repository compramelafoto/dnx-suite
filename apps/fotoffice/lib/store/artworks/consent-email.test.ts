import { describe, expect, it } from "vitest";

import { buildConsentUrl, renderArtworkConsentEmail, royaltyPercentLabel, type ArtworkConsentEmail } from "./consent-email";

const BASE: ArtworkConsentEmail = {
  basis: "RULES",
  institution: "Foto Club Santa Fe",
  authorName: "Ana",
  contestTitle: "Salón 2026",
  artworkTitle: "Río quieto",
  previewUrl: null,
  royaltyBps: 2000,
  formats: [{ name: "Impresión mate", widthCm: 30, heightCm: 45, priceMinor: 2500000 }],
  url: "https://fotoffice.test/w/fcsf/obras/permiso/abc",
  expiresAt: new Date("2026-12-04T15:00:00Z"),
};

describe("correo de permiso al autor", () => {
  it("RULES: avisa, explica la regalía y que puede retirarla", () => {
    const r = renderArtworkConsentEmail(BASE);
    expect(r.subject).toBe("Foto Club Santa Fe: tu obra «Río quieto» va a estar en nuestra tienda");
    expect(r.text).toContain("20 %");
    expect(r.text).toContain("sin contar el envío");
    expect(r.text).toContain("Impresión mate (30 × 45 cm): $ 25.000,00");
    expect(r.text).toContain("retirarla cuando quieras");
    expect(r.text).toContain(BASE.url);
    expect(r.text).toContain("4 de diciembre de 2026");
  });

  it("EXPLICIT: pide permiso", () => {
    const r = renderArtworkConsentEmail({ ...BASE, basis: "EXPLICIT" });
    expect(r.subject).toBe("Foto Club Santa Fe quiere ofrecer tu obra «Río quieto» en su tienda");
    expect(r.text).toContain("necesitamos tu permiso");
    expect(r.text).toContain("Ver la obra y responder");
  });

  it("escapa todo lo que viene de afuera", () => {
    const r = renderArtworkConsentEmail({
      ...BASE,
      institution: "<b>Club</b>",
      authorName: `Ana "<script>"`,
      contestTitle: "Salón & <i>",
      artworkTitle: "<img src=x onerror=alert(1)>",
      formats: [{ name: "<u>mate</u>", widthCm: 30, heightCm: 45, priceMinor: 100 }],
      previewUrl: `https://cdn.test/a.jpg"onerror="x`,
    });
    expect(r.html).not.toMatch(/<script|<b>Club|<i>|<u>mate|<img src=x/);
    expect(r.html).toContain("&lt;b&gt;Club&lt;/b&gt;");
    expect(r.html).toContain("&lt;img src=x onerror=alert(1)&gt;");
    expect(r.html).toContain(`src="https://cdn.test/a.jpg&quot;onerror=&quot;x"`);
  });

  it("imagen sólo con una vista previa https guardada", () => {
    expect(renderArtworkConsentEmail(BASE).html).not.toContain("<img");
    expect(renderArtworkConsentEmail({ ...BASE, previewUrl: "http://x.test/a.jpg" }).html).not.toContain("<img");
    expect(renderArtworkConsentEmail({ ...BASE, previewUrl: "https://cdn.test/a.jpg" }).html).toContain(
      `<img src="https://cdn.test/a.jpg"`,
    );
  });

  it("sin nombre, saludo genérico; sin formatos, sin lista", () => {
    const r = renderArtworkConsentEmail({ ...BASE, authorName: null, formats: [] });
    expect(r.text.startsWith("Hola,")).toBe(true);
    expect(r.text).not.toContain("Cómo se ofrecería");
  });

  it("porcentaje con coma decimal", () => {
    expect(royaltyPercentLabel(2000)).toBe("20 %");
    expect(royaltyPercentLabel(1250)).toBe("12,5 %");
  });
});

describe("dirección del enlace", () => {
  it("dominio propio conectado → en el dominio, sin /w/<slug>", () => {
    expect(buildConsentUrl({ customDomain: "sfpr.com.ar", appOrigin: "https://fo.test", slug: "sfpr", token: "t" })).toBe(
      "https://sfpr.com.ar/obras/permiso/t",
    );
  });
  it("sin dominio → FOTOFFICE con /w/<slug>", () => {
    expect(buildConsentUrl({ customDomain: null, appOrigin: "https://fo.test", slug: "sfpr", token: "t" })).toBe(
      "https://fo.test/w/sfpr/obras/permiso/t",
    );
  });
  it("sin dirección pública → null", () => {
    expect(buildConsentUrl({ customDomain: null, appOrigin: "", slug: "sfpr", token: "t" })).toBeNull();
    expect(buildConsentUrl({ customDomain: null, appOrigin: "https://fo.test", slug: null, token: "t" })).toBeNull();
  });
});
