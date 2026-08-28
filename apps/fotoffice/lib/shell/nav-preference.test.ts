import { describe, expect, it } from "vitest";
import {
  SHELL_NAV_COOKIE,
  parseShellNavPreference,
  serializeShellNavCookie,
} from "./nav-preference";

describe("parseShellNavPreference", () => {
  it("`hidden` es el único valor que oculta el menú", () => {
    expect(parseShellNavPreference("hidden")).toBe("hidden");
  });

  it("sin cookie, el menú se ve", () => {
    expect(parseShellNavPreference(undefined)).toBe("open");
    expect(parseShellNavPreference(null)).toBe("open");
  });

  it("un valor desconocido o manipulado deja el menú visible, nunca sin navegación", () => {
    expect(parseShellNavPreference("")).toBe("open");
    expect(parseShellNavPreference("HIDDEN")).toBe("open");
    expect(parseShellNavPreference("1")).toBe("open");
    expect(parseShellNavPreference("<script>")).toBe("open");
  });
});

describe("serializeShellNavCookie", () => {
  it("escribe el valor con su nombre de cookie", () => {
    expect(serializeShellNavCookie("hidden")).toContain(`${SHELL_NAV_COOKIE}=hidden`);
    expect(serializeShellNavCookie("open")).toContain(`${SHELL_NAV_COOKIE}=open`);
  });

  it("vale para toda la aplicación y sobrevive a la sesión", () => {
    const cookie = serializeShellNavCookie("hidden");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Max-Age=31536000");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("lo que se escribe es lo que se vuelve a leer", () => {
    for (const preference of ["open", "hidden"] as const) {
      const value = serializeShellNavCookie(preference).split(";")[0]!.split("=")[1];
      expect(parseShellNavPreference(value)).toBe(preference);
    }
  });
});
