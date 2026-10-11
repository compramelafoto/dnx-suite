import { describe, expect, it } from "vitest";
import { credencialesDeVentas, leerConfigDeVentas, puedeComprar } from "./config";

const TOKEN_PRUEBA = "TEST-1234567890-abcdef-secreto-de-ejemplo";
const TOKEN_REAL = "APP_USR-9876543210-fedcba-secreto-de-ejemplo";

const completo = {
  MUESTRAS_MP_ENV: "sandbox",
  MUESTRAS_MP_ACCESS_TOKEN: TOKEN_PRUEBA,
  MUESTRAS_MP_PUBLIC_KEY: "TEST-clave-publica",
  MUESTRAS_MP_OWNER_USER_ID: "123456",
  MUESTRAS_PEDIDOS_SECRET: "secreto-de-pedidos",
  MUESTRAS_CERT_PRIVATE_KEY: "Y2xhdmUtZGUtcHJ1ZWJh",
  MUESTRAS_CERT_KEY_ID: "mf-2026-10",
  MUESTRAS_R2_PRIVATE_BUCKET: "muestras-privado",
  MUESTRAS_VENTAS_PROBADORES: "7, 9,abc,,12",
} satisfies Record<string, string>;

describe("configuración de la venta", () => {
  it("sin variables → OFF con la lista de lo que falta", () => {
    const c = leerConfigDeVentas({});
    expect(c.modo).toBe("OFF");
    expect(c.faltan).toEqual(expect.arrayContaining(["MUESTRAS_MP_ENV", "MUESTRAS_MP_ACCESS_TOKEN", "MUESTRAS_CERT_PRIVATE_KEY", "MUESTRAS_R2_PRIVATE_BUCKET"]));
    expect(c.motivo).toContain("MUESTRAS_PEDIDOS_SECRET");
    expect(c.ambienteCuenta).toBe("SANDBOX");
  });
  it("sandbox completo → TEST, aunque la llave en vivo esté encendida", () => {
    expect(leerConfigDeVentas(completo).modo).toBe("TEST");
    expect(leerConfigDeVentas({ ...completo, MUESTRAS_VENTAS_EN_VIVO: "true", DNX_MP_ORDERS_1N_PRODUCTION_ENABLED: "true" }).modo).toBe("TEST");
  });
  it("producción completa con las dos llaves → LIVE", () => {
    const prod = { ...completo, MUESTRAS_MP_ENV: "production", MUESTRAS_MP_ACCESS_TOKEN: TOKEN_REAL };
    expect(leerConfigDeVentas(prod).modo).toBe("OFF");
    expect(leerConfigDeVentas({ ...prod, MUESTRAS_VENTAS_EN_VIVO: "true" }).motivo).toMatch(/Mercado Pago todavía no habilitó/);
    const vivo = leerConfigDeVentas({ ...prod, MUESTRAS_VENTAS_EN_VIVO: "true", DNX_MP_ORDERS_1N_PRODUCTION_ENABLED: "1" });
    expect(vivo).toMatchObject({ modo: "LIVE", ambienteCuenta: "PRODUCTION", mpEnv: "production" });
    expect(leerConfigDeVentas({ ...prod, MUESTRAS_MP_ACCESS_TOKEN: TOKEN_PRUEBA, MUESTRAS_VENTAS_EN_VIVO: "true", DNX_MP_ORDERS_1N_PRODUCTION_ENABLED: "1" }).modo).toBe("OFF");
  });
  it("un ambiente desconocido falta", () => {
    expect(leerConfigDeVentas({ ...completo, MUESTRAS_MP_ENV: "prod" }).faltan).toContain("MUESTRAS_MP_ENV");
  });
  it("nunca devuelve un valor secreto", () => {
    const texto = JSON.stringify({ ...leerConfigDeVentas(completo), probadores: [...leerConfigDeVentas(completo).probadores] });
    for (const v of ["TEST-1234567890", "secreto-de-pedidos", "Y2xhdmUtZGUtcHJ1ZWJh", "123456"]) expect(texto).not.toContain(v);
  });
  it("probadores, aviso y cron", () => {
    const c = leerConfigDeVentas({ ...completo, CRON_SECRET: "x" });
    expect([...c.probadores]).toEqual([7, 9, 12]);
    expect(c.cronConfigurado).toBe(true);
    expect(c.avisoConfigurado).toBe(false);
  });
  it("quién compra", () => {
    const c = leerConfigDeVentas(completo);
    expect(puedeComprar(null, c)).toBe(false);
    expect(puedeComprar({ id: 7, esSuperAdmin: false }, c)).toBe(true);
    expect(puedeComprar({ id: 8, esSuperAdmin: false }, c)).toBe(false);
    expect(puedeComprar({ id: 8, esSuperAdmin: true }, c)).toBe(true);
    expect(puedeComprar({ id: 8, esSuperAdmin: true }, leerConfigDeVentas({}))).toBe(false);
  });
  it("las credenciales salen de un solo lugar", () => {
    expect(credencialesDeVentas(completo)).toMatchObject({ accessToken: TOKEN_PRUEBA, ownerUserId: "123456", privateBucket: "muestras-privado" });
    expect(credencialesDeVentas({}).accessToken).toBeNull();
  });
});

describe("valores con forma inválida (revisión de las tareas 1 a 5)", () => {
  it("un owner que no es sólo dígitos cuenta como faltante", () => {
    const c = leerConfigDeVentas({ ...completo, MUESTRAS_MP_OWNER_USER_ID: "12a" });
    expect(c.modo).toBe("OFF");
    expect(c.faltan).toContain("MUESTRAS_MP_OWNER_USER_ID");
  });
  it("el bucket privado no puede ser el público", () => {
    const c = leerConfigDeVentas({ ...completo, R2_BUCKET_NAME: "muestras-privado" });
    expect(c.modo).toBe("OFF");
    expect(c.faltan).toContain("MUESTRAS_R2_PRIVATE_BUCKET");
  });
});
