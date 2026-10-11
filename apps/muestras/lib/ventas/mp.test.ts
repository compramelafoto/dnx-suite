import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { devolverTotal, invitarAReparto, leerConsentimiento, leerOrden } from "./mp";

const TOKEN = "TEST-1111111111-aaaaaa-token-de-ejemplo";
const fetchFalso = vi.fn<typeof fetch>();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  fetchFalso.mockReset();
  vi.stubGlobal("fetch", fetchFalso);
  vi.stubEnv("MUESTRAS_MP_ENV", "sandbox");
  vi.stubEnv("MUESTRAS_MP_ACCESS_TOKEN", TOKEN);
  vi.stubEnv("MUESTRAS_MP_OWNER_USER_ID", "999");
  vi.stubEnv("DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED", "");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const orden = {
  id: "ORD01ABC",
  status: "processed",
  status_detail: "accredited",
  external_reference: "muestras-venta-abcd1234abcd1234",
  total_amount: "1500.00",
  splits: [
    { receiver_id: "999", receiver_type: "owner", amount: "225.00" },
    { receiver_id: "r-foto", receiver_type: "partner", amount: "1275.5" },
  ],
  transactions: { payments: [{ id: "PAY1", status: "processed", status_detail: "accredited", amount: "1500.00" }] },
};

describe("leerOrden", () => {
  it("lee GET /v1/orders/{id} y lo traduce", async () => {
    fetchFalso.mockResolvedValue(json(orden));
    expect(await leerOrden("ORD01ABC")).toEqual({
      providerOrderId: "ORD01ABC",
      status: "PROCESSED_ACCREDITED",
      statusDetail: "accredited",
      externalReference: "muestras-venta-abcd1234abcd1234",
      totalCents: 150_000,
      splits: [
        { receiverId: "999", type: "owner", cents: 22_500 },
        { receiverId: "r-foto", type: "partner", cents: 127_550 },
      ],
      paymentStatus: "processed",
      liveMode: null,
    });
    const [url, init] = fetchFalso.mock.calls[0]!;
    expect(String(url)).toBe("https://api.mercadopago.com/v1/orders/ORD01ABC");
    expect(init?.method).toBe("GET");
  });
  it("un id raro no sale a la red", async () => {
    expect(await leerOrden("../v1/payments")).toBeNull();
    expect(fetchFalso).not.toHaveBeenCalled();
  });
  it("un error de red devuelve null sin registrar el token", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchFalso.mockRejectedValue(new TypeError(`fetch failed for ${TOKEN}`));
    expect(await leerOrden("ORD01ABC")).toBeNull();
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls)).not.toContain(TOKEN);
  });
  it("sin token no hay lectura", async () => {
    vi.stubEnv("MUESTRAS_MP_ACCESS_TOKEN", "");
    expect(await leerOrden("ORD01ABC")).toBeNull();
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});

describe("consentimiento de reparto", () => {
  it("en sandbox invita y devuelve el enlace", async () => {
    fetchFalso.mockResolvedValue(json({ succeeded: [{ receiver_id: "r-1", seller_email: "ana@testuser.com", status: "PENDING", invite_url: "https://mp.test/aceptar" }] }));
    expect(await invitarAReparto("ana@testuser.com")).toEqual({ receiverId: "r-1", status: "PENDING", inviteUrl: "https://mp.test/aceptar" });
    const [url, init] = fetchFalso.mock.calls[0]!;
    expect(String(url)).toBe("https://api.mercadopago.com/v1/split-consent");
    expect(JSON.parse(String(init?.body))).toEqual({ invites: [{ seller_email: "ana@testuser.com" }] });
  });
  it("en producción sin la llave de la suite no invita", async () => {
    vi.stubEnv("MUESTRAS_MP_ENV", "production");
    vi.stubEnv("MUESTRAS_MP_ACCESS_TOKEN", "APP_USR-2222-bbbb-token-de-ejemplo");
    expect(await invitarAReparto("ana@example.com")).toEqual({ error: "Mercado Pago todavía no habilitó esta función." });
    expect(fetchFalso).not.toHaveBeenCalled();
  });
  it("Mercado Pago no devuelve a nadie → error claro", async () => {
    fetchFalso.mockResolvedValue(json({ succeeded: [], failed: [{ seller_email: "x@testuser.com" }] }));
    expect(await invitarAReparto("x@testuser.com")).toEqual({ error: "Mercado Pago no pudo invitar a ese email. Revisá que sea el de tu cuenta." });
  });
  it("lee el estado de un consentimiento", async () => {
    fetchFalso.mockResolvedValue(json({ results: [{ receiver_id: "r-1", seller_email: "ana@testuser.com", status: "ACTIVE" }] }));
    expect(await leerConsentimiento("r-1")).toEqual({ receiverId: "r-1", status: "ACTIVE", inviteUrl: null });
    expect(String(fetchFalso.mock.calls[0]![0])).toContain("receiver_id=r-1");
  });
});

describe("devolución total", () => {
  it("POST /v1/orders/{id}/refund con la llave de idempotencia", async () => {
    fetchFalso.mockResolvedValue(json({ id: "ORD01ABC", status: "refunded", transactions: { refunds: [{ id: "REF1", status: "processed" }] } }));
    const r = await devolverTotal("ORD01ABC", "8d3c1f6e-1d2b-4a5c-9e7f-0a1b2c3d4e5f");
    expect(r).toEqual({ ok: true, orderStatus: "refunded" });
    const [url, init] = fetchFalso.mock.calls[0]!;
    expect(String(url)).toBe("https://api.mercadopago.com/v1/orders/ORD01ABC/refund");
    expect(init?.method).toBe("POST");
    expect((init?.headers as Record<string, string>)["X-Idempotency-Key"]).toBe("8d3c1f6e-1d2b-4a5c-9e7f-0a1b2c3d4e5f");
  });
  it("en producción sin modo en vivo no devuelve", async () => {
    vi.stubEnv("MUESTRAS_MP_ENV", "production");
    vi.stubEnv("MUESTRAS_MP_ACCESS_TOKEN", "APP_USR-2222-bbbb-token-de-ejemplo");
    const r = await devolverTotal("ORD01ABC", "8d3c1f6e-1d2b-4a5c-9e7f-0a1b2c3d4e5f");
    expect(r.ok).toBe(false);
    expect(fetchFalso).not.toHaveBeenCalled();
  });
});
