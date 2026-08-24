import { describe, expect, it } from "vitest";
import {
  FOTOFFICE_PRODUCT_KEY,
  parseWorkspaceOrganizationRef,
  workspaceOrganizationRef,
} from "./constants";
import { readMpConnectConfig } from "./config";

describe("identidad del producto", () => {
  it("la clave de producto es fotoffice, nunca clickaton", () => {
    expect(FOTOFFICE_PRODUCT_KEY).toBe("fotoffice");
  });

  it("la referencia de organización incluye el workspace", () => {
    expect(workspaceOrganizationRef("ws-sfpr")).toBe("fotoffice-workspace:ws-sfpr");
  });

  it("se puede volver del ref al workspace", () => {
    expect(parseWorkspaceOrganizationRef("fotoffice-workspace:ws-sfpr")).toBe("ws-sfpr");
  });

  /**
   * Un ref de otro producto no debe interpretarse como propio: la identidad financiera de
   * un laboratorio o de Clickatón no es la de una institución de FotoOffice.
   */
  it.each(["lab:123", "clickaton:partners-production:mp-owner", "ws-sfpr", "", "fotoffice-workspace:"])(
    "no reconoce %s como ref de FotoOffice",
    (ref) => {
      expect(parseWorkspaceOrganizationRef(ref)).toBeNull();
    },
  );

  it("ida y vuelta para cualquier id", () => {
    for (const id of ["ws-1", "cljx8s0000abc", "UPPER-case_123"]) {
      expect(parseWorkspaceOrganizationRef(workspaceOrganizationRef(id))).toBe(id);
    }
  });
});

describe("readMpConnectConfig", () => {
  const full = {
    FOTOFFICE_MP_CLIENT_ID: "cid",
    FOTOFFICE_MP_CLIENT_SECRET: "csec",
    FOTOFFICE_MP_REDIRECT_URI: "https://fotoffice.com/api/payments/mercadopago/connect/callback",
  };

  it("con todo presente queda configurado", () => {
    const c = readMpConnectConfig(full as NodeJS.ProcessEnv);
    expect(c.configured).toBe(true);
    expect(c.missing).toEqual([]);
    expect(c.clientId).toBe("cid");
    expect(c.clientSecret).toBe("csec");
  });

  it.each([
    ["FOTOFFICE_MP_CLIENT_ID"],
    ["FOTOFFICE_MP_CLIENT_SECRET"],
    ["FOTOFFICE_MP_REDIRECT_URI"],
  ])("sin %s no queda configurado y lo nombra", (key) => {
    const env = { ...full, [key]: "" } as NodeJS.ProcessEnv;
    const c = readMpConnectConfig(env);
    expect(c.configured).toBe(false);
    expect(c.missing).toContain(key);
  });

  it("ignora espacios en blanco alrededor", () => {
    const c = readMpConnectConfig({
      ...full,
      FOTOFFICE_MP_CLIENT_ID: "  cid  ",
    } as NodeJS.ProcessEnv);
    expect(c.clientId).toBe("cid");
  });

  it("con el entorno vacío nombra las tres variables faltantes", () => {
    const c = readMpConnectConfig({} as NodeJS.ProcessEnv);
    expect(c.missing).toHaveLength(3);
    expect(c.configured).toBe(false);
  });

  /** No debe tomar por error las credenciales de otro producto del monorepo. */
  it("no usa las variables de Clickatón", () => {
    const c = readMpConnectConfig({
      CLICKATON_MP_CLIENT_ID: "ajeno",
      CLICKATON_MP_CLIENT_SECRET: "ajeno",
    } as NodeJS.ProcessEnv);
    expect(c.configured).toBe(false);
    expect(c.clientId).toBeNull();
  });
});
