import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextEditionNumber } from "@repo/muestras";
import { tablaFalsa } from "./base-falsa.test-util";
import type { OrdenLeida } from "./mp";

type Fila = Record<string, unknown>;
const t = vi.hoisted(() => ({ db: null as unknown as Record<string, unknown> }));
const mp = vi.hoisted(() => ({ leerOrden: vi.fn() }));
vi.mock("@repo/db", () => ({ prisma: new Proxy({}, { get: (_x, k: string) => t.db[k] }) }));
vi.mock("./mp", () => mp);
vi.mock("next/server", () => ({ after: (fn: () => unknown) => { void fn(); } }));

const { conciliarDesdeOrden, conciliarPedido } = await import("./conciliar");
const { barrerVentas } = await import("./barrido");
const { resetRateLimit } = await import("@/lib/limite");

const ORG = "11111111-1111-4111-8111-111111111111";
const FOTO = "22222222-2222-4222-8222-222222222222";
const ahora = new Date("2026-11-14T15:00:00.000Z");
const snapshot = {
  v: 1, environment: "SANDBOX", ownerUserId: "999", ownerCents: 1_500_000,
  partners: [{ recipientId: "organizer", receiverId: ORG, cents: 2_500_000 }, { recipientId: "photographer", receiverId: FOTO, cents: 6_000_000 }],
  organizer: { userId: 7, receiverId: ORG }, photographer: { userId: 50, receiverId: FOTO },
};

let pedidos: Fila[];
let copias: Fila[];
let ofertas: Fila[];
let eventos: Fila[];

function base() {
  pedidos = [{
    id: "o1", publicId: "abcd1234abcd1234", status: "PENDING_PAYMENT", isTest: true, offerId: "of1", copyId: "c1", totalCents: 10_000_000,
    externalReference: "muestras-venta-abcd1234abcd1234", providerOrderId: "ORD01ABC", splitSnapshot: snapshot,
    createdAt: new Date(ahora.getTime() - 5 * 60_000), holdExpiresAt: new Date(ahora.getTime() + 15 * 60_000), refundRequestedAt: null,
  }];
  copias = [{ id: "c1", offerId: "of1", activityId: "a1", isTest: true, kind: "COPY", number: 1, status: "RESERVED", reservedUntil: new Date(ahora.getTime() + 15 * 60_000), orderId: "o1" }];
  ofertas = [{ id: "of1", activityId: "a1", editionSize: 2, firstSoldAt: null }];
  eventos = [];
  const db: Record<string, unknown> = {
    culturalSaleOrder: tablaFalsa(pedidos, "o"),
    culturalEditionCopy: tablaFalsa(copias, "cx"),
    culturalWorkOffer: tablaFalsa(ofertas, "of"),
    culturalSaleEvent: tablaFalsa(eventos, "e"),
    $queryRaw: async () => [],
  };
  db.$transaction = async (fn: (tx: unknown) => unknown) => fn(db);
  t.db = db;
}

const orden = (extra: Partial<OrdenLeida> = {}): OrdenLeida => ({
  providerOrderId: "ORD01ABC", status: "PROCESSED_ACCREDITED", statusDetail: "accredited", externalReference: "muestras-venta-abcd1234abcd1234",
  totalCents: 10_000_000, paymentStatus: "processed", paymentStatusDetail: "accredited", liveMode: false,
  splits: [{ receiverId: "999", type: "owner", cents: 1_500_000 }, { receiverId: FOTO, type: "partner", cents: 6_000_000 }, { receiverId: ORG, type: "partner", cents: 2_500_000 }],
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  base();
});

const cambios = () => eventos.filter((e) => e.toStatus);

describe("conciliarDesdeOrden", () => {
  it("pagado: emite la copia, marca la fecha y queda un solo evento aunque se concilie dos veces", async () => {
    expect(await conciliarDesdeOrden(orden(), "CREATE", ahora)).toEqual({ estado: "PAID", cambio: true });
    expect(await conciliarDesdeOrden(orden(), "NOTICE", ahora)).toEqual({ estado: "PAID", cambio: false });
    expect(pedidos[0]).toMatchObject({ status: "PAID", paidAt: ahora, copyId: "c1" });
    expect(copias[0]).toMatchObject({ status: "ISSUED", issuedAt: ahora, reservedUntil: null });
    expect(cambios()).toHaveLength(1);
    // Una venta de prueba no marca la primera venta de la oferta.
    expect(ofertas[0]!.firstSoldAt).toBeNull();
  });

  it("cuatro caminos a la vez: una sola emisión", async () => {
    const r = await Promise.all((["CREATE", "RETURN", "NOTICE", "SWEEP"] as const).map((o) => conciliarDesdeOrden(orden(), o, ahora)));
    expect(r.filter((x) => x?.cambio)).toHaveLength(1);
    expect(cambios()).toHaveLength(1);
    expect(copias.filter((c) => c.status === "ISSUED")).toHaveLength(1);
  });

  it("una venta real marca la primera venta de la oferta", async () => {
    pedidos[0]!.isTest = false;
    copias[0]!.isTest = false;
    await conciliarDesdeOrden(orden({ liveMode: true }), "CREATE", ahora);
    expect(ofertas[0]!.firstSoldAt).toEqual(ahora);
  });

  it("total distinto: MISMATCH y nada cambia", async () => {
    await conciliarDesdeOrden(orden({ totalCents: 9_999_999 }), "NOTICE", ahora);
    expect(pedidos[0]!.status).toBe("PENDING_PAYMENT");
    expect(copias[0]!.status).toBe("RESERVED");
    expect(eventos.map((e) => e.detail)).toEqual(["MISMATCH:total"]);
  });

  it("reparto distinto del congelado: MISMATCH, sin certificado ni copia", async () => {
    await conciliarDesdeOrden(orden({ splits: [{ receiverId: "999", type: "owner", cents: 1_000_000 }, { receiverId: FOTO, type: "partner", cents: 9_000_000 }] }), "SWEEP", ahora);
    expect(pedidos[0]!.status).toBe("PENDING_PAYMENT");
    expect(eventos.map((e) => e.detail)).toEqual(["MISMATCH:splits"]);
    // Repetir la misma alerta no la duplica.
    await conciliarDesdeOrden(orden({ splits: [] }), "SWEEP", ahora);
    await conciliarDesdeOrden(orden({ splits: [] }), "SWEEP", ahora);
    expect(eventos.map((e) => e.detail)).toEqual(["MISMATCH:splits"]);
  });

  it("referencia de otro pedido o Order de sandbox en un pedido real: MISMATCH", async () => {
    await conciliarDesdeOrden(orden({ externalReference: "muestras-venta-zzzz1234abcd1234" }), "NOTICE", ahora);
    expect(eventos.map((e) => e.detail)).toEqual(["MISMATCH:externalReference"]);
    pedidos[0]!.isTest = false;
    await conciliarDesdeOrden(orden({ liveMode: false }), "NOTICE", ahora);
    expect(eventos.map((e) => e.detail)).toContain("MISMATCH:liveMode");
    expect(pedidos[0]!.status).toBe("PENDING_PAYMENT");
  });

  it("Order real sobre un pedido de prueba: alerta, se marca para devolver y no se emite", async () => {
    await conciliarDesdeOrden(orden({ liveMode: true }), "NOTICE", ahora);
    expect(pedidos[0]).toMatchObject({ status: "PENDING_PAYMENT", refundRequestedAt: ahora });
    expect(copias[0]!.status).toBe("RESERVED");
    expect(eventos[0]!.detail).toMatch(/^ALERT_LIVE_ON_TEST/);
  });

  it("pagado con la reserva vencida y el número tomado: otro número", async () => {
    pedidos[0]!.status = "EXPIRED";
    pedidos[0]!.copyId = null;
    copias[0] = { ...copias[0]!, status: "RESERVED", orderId: "o2", reservedUntil: new Date(ahora.getTime() + 60_000) };
    pedidos.push({ id: "o2", status: "PENDING_PAYMENT", copyId: "c1", providerOrderId: null, createdAt: ahora });
    expect(await conciliarDesdeOrden(orden(), "NOTICE", ahora)).toEqual({ estado: "PAID", cambio: true });
    const nueva = copias.find((c) => c.orderId === "o1")!;
    expect(nueva).toMatchObject({ number: 2, status: "ISSUED" });
    expect(pedidos[0]!.copyId).toBe(nueva.id);
    expect(copias[0]).toMatchObject({ orderId: "o2", status: "RESERVED" });
  });

  it("pagado tarde sin números libres: PAID_NO_COPY", async () => {
    pedidos[0]!.status = "EXPIRED";
    pedidos[0]!.copyId = null;
    copias[0] = { ...copias[0]!, status: "ISSUED", orderId: "o2" };
    copias.push({ id: "c2", offerId: "of1", isTest: true, kind: "COPY", number: 2, status: "VOIDED", orderId: "o3", reservedUntil: null });
    expect(await conciliarDesdeOrden(orden(), "SWEEP", ahora)).toEqual({ estado: "PAID_NO_COPY", cambio: true });
    expect(pedidos[0]).toMatchObject({ status: "PAID_NO_COPY", copyId: null });
    expect(eventos.map((e) => e.toStatus)).toEqual(["PAID", "PAID_NO_COPY"]);
  });

  it("devuelto: la copia se anula y el número no se reutiliza", async () => {
    await conciliarDesdeOrden(orden(), "CREATE", ahora);
    expect(await conciliarDesdeOrden(orden({ status: "REFUNDED", paymentStatus: "refunded" }), "SWEEP", ahora)).toEqual({ estado: "REFUNDED", cambio: true });
    expect(copias[0]).toMatchObject({ status: "VOIDED", voidReason: "Devolución", voidedAt: ahora });
    expect(pedidos[0]!.refundedAt).toEqual(ahora);
    const siguiente = nextEditionNumber(copias as never, 2, ahora, "COPY", true);
    expect(siguiente).toEqual({ create: true, number: 2 });
  });

  it("contracargo: copia anulada con su motivo", async () => {
    await conciliarDesdeOrden(orden(), "CREATE", ahora);
    await conciliarDesdeOrden(orden({ status: "CHARGED_BACK" }), "SWEEP", ahora);
    expect(copias[0]).toMatchObject({ status: "VOIDED", voidReason: "Contracargo" });
  });

  it("devolución parcial: queda registrada como evento, sin cambiar el estado", async () => {
    await conciliarDesdeOrden(orden(), "CREATE", ahora);
    await conciliarDesdeOrden(orden({ status: "PROCESSED", statusDetail: "partially_refunded" }), "SWEEP", ahora);
    expect(pedidos[0]!.status).toBe("PAID");
    expect(eventos.some((e) => String(e.detail).startsWith("PARTIALLY_REFUNDED"))).toBe(true);
  });

  it("rechazado: la copia vuelve a estar libre", async () => {
    expect(await conciliarDesdeOrden(orden({ status: "FAILED", paymentStatus: "rejected", paymentStatusDetail: "cc_rejected_other_reason" }), "CREATE", ahora)).toEqual({ estado: "REJECTED", cambio: true });
    expect(copias[0]).toMatchObject({ status: "RELEASED", orderId: null });
    expect(pedidos[0]).toMatchObject({ status: "REJECTED", copyId: null, providerStatusDetail: "cc_rejected_other_reason" });
  });

  it("en revisión (in_process): la reserva se extiende hasta 72 horas desde el pedido", async () => {
    await conciliarDesdeOrden(orden({ status: "OPEN", statusDetail: "in_process", paymentStatus: "in_process" }), "CREATE", ahora);
    const tope = new Date((pedidos[0]!.createdAt as Date).getTime() + 72 * 3_600_000);
    expect(pedidos[0]).toMatchObject({ status: "PENDING_PAYMENT", holdExpiresAt: tope });
    expect(copias[0]!.reservedUntil).toEqual(tope);
  });

  it("una Order que no es de ningún pedido: null y nada cambia", async () => {
    expect(await conciliarDesdeOrden(orden({ providerOrderId: "ORDOTRA1", externalReference: "clf-otra-cosa" }), "NOTICE", ahora)).toBeNull();
    expect(eventos).toHaveLength(0);
  });

  it("un pedido sin id de Order guardado se encuentra por la referencia y lo guarda", async () => {
    pedidos[0]!.providerOrderId = null;
    await conciliarDesdeOrden(orden(), "NOTICE", ahora);
    expect(pedidos[0]).toMatchObject({ status: "PAID", providerOrderId: "ORD01ABC" });
  });
});

describe("certificado al pagar", () => {
  it("pagado con la clave configurada: la copia queda con código y firma; con MISMATCH, nada", async () => {
    const { generateKeyPairSync } = await import("node:crypto");
    const { privateKey } = generateKeyPairSync("ed25519");
    vi.stubEnv("MUESTRAS_CERT_PRIVATE_KEY", Buffer.from(privateKey.export({ type: "pkcs8", format: "pem" }).toString()).toString("base64"));
    vi.stubEnv("MUESTRAS_CERT_KEY_ID", "mf-test");
    Object.assign(t.db, {
      culturalActivity: { findUnique: async () => ({ title: "Silos" }) },
      culturalActivityWork: { findUnique: async () => ({ title: "Obra", authorName: "Ana" }) },
      culturalSaleFile: { findUnique: async () => ({ sha256: "a".repeat(64) }) },
    });
    ofertas[0] = { ...ofertas[0]!, format: "DIGITAL", editionKind: "LIMITED", proofCount: 0, paper: null, widthCm: null, heightCm: null, activityWorkId: "aw1" };
    pedidos[0] = { ...pedidos[0]!, buyerName: "Bea", buyerOnCertificate: true };
    await conciliarDesdeOrden(orden({ totalCents: 1 }), "CREATE", ahora);
    expect(copias[0]!.certificateCode).toBeUndefined();
    await conciliarDesdeOrden(orden(), "CREATE", ahora);
    expect(copias[0]!.certificateCode).toMatch(/^[A-Z0-9]{12}$/);
    expect(String(copias[0]!.certificatePayload)).toContain('"buyer":"Bea"');
    expect(copias[0]!.certificateKid).toBe("mf-test");
    vi.unstubAllEnvs();
  });
});

describe("conciliarPedido", () => {
  it("lee la Order en Mercado Pago; si no se puede leer, no cambia nada", async () => {
    mp.leerOrden.mockResolvedValueOnce(null);
    expect(await conciliarPedido({ publicId: "abcd1234abcd1234" }, "RETURN")).toBeNull();
    expect(pedidos[0]!.status).toBe("PENDING_PAYMENT");
    mp.leerOrden.mockResolvedValueOnce(orden());
    expect(await conciliarPedido({ providerOrderId: "ORD01ABC" }, "NOTICE")).toMatchObject({ estado: "PAID" });
    expect(mp.leerOrden).toHaveBeenLastCalledWith("ORD01ABC");
  });
});

describe("barrerVentas", () => {
  it("vence las reservas sin Order y suelta la copia", async () => {
    pedidos[0] = { ...pedidos[0]!, providerOrderId: null, holdExpiresAt: new Date(ahora.getTime() - 60_000) };
    const r = await barrerVentas(ahora);
    expect(r.vencidos).toBe(1);
    expect(pedidos[0]).toMatchObject({ status: "EXPIRED", copyId: null });
    expect(copias[0]).toMatchObject({ status: "RELEASED", orderId: null });
    expect(eventos[0]).toMatchObject({ source: "SWEEP", toStatus: "EXPIRED", detail: "Reserva vencida sin pago" });
  });

  it("un pago que quedó sin saber si se creó la Order vence con una alerta", async () => {
    pedidos[0] = { ...pedidos[0]!, providerOrderId: null, providerStatus: "UNKNOWN_CREATE", holdExpiresAt: new Date(ahora.getTime() - 60_000) };
    await barrerVentas(ahora);
    expect(eventos[0]!.detail).toMatch(/^ALERT_UNKNOWN_CREATE/);
  });

  it("pregunta por las pendientes con Order y avisa las de más de 72 horas", async () => {
    pedidos[0]!.createdAt = new Date(ahora.getTime() - 73 * 3_600_000);
    mp.leerOrden.mockResolvedValue(orden({ status: "OPEN", paymentStatus: "in_process" }));
    const r = await barrerVentas(ahora);
    expect(r).toMatchObject({ consultados: 1, alertas: 1 });
    await barrerVentas(ahora);
    expect(eventos.filter((e) => String(e.detail).startsWith("ALERT_STALE_PENDING"))).toHaveLength(1);
  });

  it("entre las 4:00 y las 4:10 repasa las pagadas", async () => {
    pedidos[0] = { ...pedidos[0]!, status: "PAID", paidAt: ahora, lastSyncedAt: ahora };
    copias[0]!.status = "ISSUED";
    mp.leerOrden.mockResolvedValue(orden({ status: "REFUNDED" }));
    const cuatro = new Date("2026-11-15T07:05:00.000Z"); // 4:05 en Argentina
    expect((await barrerVentas(cuatro)).repasados).toBe(1);
    expect(pedidos[0]!.status).toBe("REFUNDED");
    expect((await barrerVentas(ahora)).repasados).toBe(0);
  });
});

describe("rutas", () => {
  const SECRETO = "secreto-del-aviso-de-prueba";
  const cuerpo = JSON.stringify({ providerOrderId: "ORD01ABC" });

  it("aviso con firma válida → 202 y concilia; inválida → 401 sin tocar nada", async () => {
    vi.stubEnv("MUESTRAS_AVISO_PAGOS_SECRET", SECRETO);
    const { POST } = await import("@/app/api/pagos/aviso/route");
    const { firmarAviso } = await import("./aviso-firma");
    mp.leerOrden.mockResolvedValue(orden());
    const malo = await POST(new Request("http://x/api/pagos/aviso", { method: "POST", body: cuerpo, headers: { "x-dnx-aviso": firmarAviso("otro", Math.floor(Date.now() / 1000), cuerpo) } }));
    expect(malo.status).toBe(401);
    expect(mp.leerOrden).not.toHaveBeenCalled();
    const bueno = await POST(new Request("http://x/api/pagos/aviso", { method: "POST", body: cuerpo, headers: { "x-dnx-aviso": firmarAviso(SECRETO, Math.floor(Date.now() / 1000), cuerpo) } }));
    expect(bueno.status).toBe(202);
    await vi.waitFor(() => expect(pedidos[0]!.status).toBe("PAID"));
    vi.unstubAllEnvs();
  });

  it("aviso sin secreto configurado → 503; id con forma rara → 400", async () => {
    vi.stubEnv("MUESTRAS_AVISO_PAGOS_SECRET", "");
    const { POST } = await import("@/app/api/pagos/aviso/route");
    const { firmarAviso } = await import("./aviso-firma");
    expect((await POST(new Request("http://x", { method: "POST", body: cuerpo }))).status).toBe(503);
    vi.stubEnv("MUESTRAS_AVISO_PAGOS_SECRET", SECRETO);
    const raro = JSON.stringify({ providerOrderId: "../../x" });
    expect((await POST(new Request("http://x", { method: "POST", body: raro, headers: { "x-dnx-aviso": firmarAviso(SECRETO, Math.floor(Date.now() / 1000), raro) } }))).status).toBe(400);
    vi.unstubAllEnvs();
  });

  it("cron sin llave → 401 (y sin secreto → 503)", async () => {
    const { GET } = await import("@/app/api/cron/ventas/route");
    vi.stubEnv("CRON_SECRET", "llave-del-cron");
    expect((await GET(new Request("http://x", { headers: { authorization: "Bearer otra" } }))).status).toBe(401);
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(new Request("http://x"))).status).toBe(503);
    vi.unstubAllEnvs();
  });
});
