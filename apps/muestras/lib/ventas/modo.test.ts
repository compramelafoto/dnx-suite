import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configVerificada } from "./modo";
import { olvidarCuentaDelToken } from "./mp";

/** Revisión de las tareas 1 a 5: el modo se confirma con GET /users/me. */
const fetchFalso = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const completo: Record<string, string> = {
  MUESTRAS_MP_ENV: "sandbox",
  MUESTRAS_MP_ACCESS_TOKEN: "TEST-1111111111-aaaaaa-token-de-ejemplo",
  MUESTRAS_MP_PUBLIC_KEY: "TEST-publica",
  MUESTRAS_MP_OWNER_USER_ID: "123456",
  MUESTRAS_PEDIDOS_SECRET: "s",
  MUESTRAS_CERT_PRIVATE_KEY: "k",
  MUESTRAS_CERT_KEY_ID: "mf-2026-10",
  MUESTRAS_R2_PRIVATE_BUCKET: "privado",
};

beforeEach(async () => {
  fetchFalso.mockReset();
  vi.stubGlobal("fetch", fetchFalso);
  for (const [k, v] of Object.entries(completo)) vi.stubEnv(k, v);
  await olvidarCuentaDelToken();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("configVerificada", () => {
  it("en prueba con un usuario de prueba que es el owner → TEST", async () => {
    fetchFalso.mockResolvedValue(json({ id: 123456, tags: ["test_user", "normal"] }));
    expect((await configVerificada()).modo).toBe("TEST");
    expect(String(fetchFalso.mock.calls[0]![0])).toBe("https://api.mercadopago.com/users/me");
  });
  it("en prueba con una cuenta real → OFF", async () => {
    fetchFalso.mockResolvedValue(json({ id: 123456, tags: ["normal"] }));
    const c = await configVerificada();
    expect(c).toMatchObject({ modo: "OFF", motivo: "El token de prueba no es de un usuario de prueba de Mercado Pago." });
  });
  it("en vivo con un usuario de prueba → OFF", async () => {
    vi.stubEnv("MUESTRAS_MP_ENV", "production");
    vi.stubEnv("MUESTRAS_MP_ACCESS_TOKEN", "APP_USR-2222-bbbb-token-de-ejemplo");
    vi.stubEnv("MUESTRAS_VENTAS_EN_VIVO", "true");
    vi.stubEnv("DNX_MP_ORDERS_1N_PRODUCTION_ENABLED", "true");
    fetchFalso.mockResolvedValue(json({ id: 123456, tags: ["test_user"] }));
    expect(await configVerificada()).toMatchObject({ modo: "OFF", motivo: "El token de producción es de un usuario de prueba de Mercado Pago." });
  });
  it("el owner tiene que ser la cuenta del token", async () => {
    fetchFalso.mockResolvedValue(json({ id: 999, tags: ["test_user"] }));
    expect((await configVerificada()).modo).toBe("OFF");
  });
  it("si Mercado Pago no responde → OFF (y se guarda la cuenta para no preguntar en cada pedido)", async () => {
    fetchFalso.mockResolvedValue(json({ message: "error" }, 500));
    expect((await configVerificada()).modo).toBe("OFF");
    await olvidarCuentaDelToken();
    fetchFalso.mockReset();
    fetchFalso.mockResolvedValue(json({ id: 123456, tags: ["test_user"] }));
    await configVerificada();
    await configVerificada();
    expect(fetchFalso).toHaveBeenCalledTimes(1);
  });
  it("con la venta apagada ni pregunta", async () => {
    vi.stubEnv("MUESTRAS_MP_ACCESS_TOKEN", "");
    expect((await configVerificada()).modo).toBe("OFF");
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
