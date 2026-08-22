import { describe, expect, it } from "vitest";
import { PORTAL_HOME, resolvePortalDestination } from "./destination";

describe("destino del socio", () => {
  it("por defecto es el portal", () => {
    expect(resolvePortalDestination()).toBe(PORTAL_HOME);
    expect(resolvePortalDestination(null)).toBe(PORTAL_HOME);
    expect(resolvePortalDestination("")).toBe(PORTAL_HOME);
  });

  it("el destino está centralizado en una constante reemplazable", () => {
    expect(PORTAL_HOME).toBe("/portal");
  });

  /** Cuando exista el módulo Pagos, este es el destino que se va a pedir. */
  it("acepta rutas internas dentro del portal", () => {
    expect(resolvePortalDestination("/portal/pagos")).toBe("/portal/pagos");
    expect(resolvePortalDestination("/portal/pagos?x=1")).toBe("/portal/pagos?x=1");
  });

  it.each([
    ["absoluta", "https://malicioso.test/robar"],
    ["protocol-relative", "//malicioso.test"],
    ["sin barra inicial", "portal/pagos"],
    ["javascript", "javascript:alert(1)"],
    ["con salto de linea", "/portal\n/x"],
  ])("rechaza una redirección %s y cae al portal", (_label, value) => {
    expect(resolvePortalDestination(value)).toBe(PORTAL_HOME);
  });

  /**
   * El socio no tiene lugar en el panel administrativo. Aunque `/workspace` sea una ruta
   * interna, permitirla acá sería una vía para empujarlo justo adonde no debe entrar.
   */
  it.each(["/workspace", "/members", "/admin", "/dashboard", "/workspace/configuracion"])(
    "rechaza %s aunque sea interna",
    (value) => {
      expect(resolvePortalDestination(value)).toBe(PORTAL_HOME);
    },
  );

  it("rechaza un intento de escaparse del portal con puntos", () => {
    expect(resolvePortalDestination("/portal/../workspace")).toBe(PORTAL_HOME);
  });

  it("no confunde un prefijo parecido con el portal", () => {
    expect(resolvePortalDestination("/portalfalso")).toBe(PORTAL_HOME);
  });
});
