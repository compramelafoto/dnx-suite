import { describe, expect, it } from "vitest";
import {
  SPONSOR_LOGO_KEY_PATTERN,
  buildSponsorLogoKey,
  extensionForSponsorLogo,
  validateSponsorLogo,
} from "./logo-rules";

describe("validateSponsorLogo", () => {
  it("acepta PNG, JPG y WebP de hasta 4 MB", () => {
    expect(validateSponsorLogo({ type: "image/png", size: 1000 })).toEqual({ ok: true });
    expect(validateSponsorLogo({ type: "IMAGE/JPEG", size: 3.9 * 1024 * 1024 })).toEqual({ ok: true });
    expect(validateSponsorLogo({ type: "image/webp", size: 1 })).toEqual({ ok: true });
  });

  it("rechaza SVG, vacíos y pesados", () => {
    expect(validateSponsorLogo({ type: "image/svg+xml", size: 10 }).ok).toBe(false);
    expect(validateSponsorLogo({ type: "image/png", size: 0 }).ok).toBe(false);
    expect(validateSponsorLogo({ type: "image/png", size: 4 * 1024 * 1024 }).ok).toBe(false);
  });
});

describe("buildSponsorLogoKey", () => {
  it("arma la misma forma de clave que el panel de Clickatón", () => {
    const key = buildSponsorLogoKey(
      extensionForSponsorLogo("image/jpeg"),
      new Date("2026-10-06T12:00:00Z"),
      "8F14E45F-CEEA-467A-9575-0A2B5A0E8D1F",
    );
    expect(key).toBe("clickaton/partners/logos/2026-10-06/8f14e45f-ceea-467a-9575-0a2b5a0e8d1f.jpg");
    expect(SPONSOR_LOGO_KEY_PATTERN.test(key)).toBe(true);
  });

  it("el patrón no deja salir de la carpeta de logos", () => {
    expect(SPONSOR_LOGO_KEY_PATTERN.test("clickaton/private/x/2026-10-06/a.png")).toBe(false);
    expect(SPONSOR_LOGO_KEY_PATTERN.test("clickaton/partners/logos/../../a.png")).toBe(false);
  });
});
