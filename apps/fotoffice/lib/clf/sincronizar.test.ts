import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MpPaymentFacts } from "@/lib/payments/mp/payment-facts";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/payments/connect/collector", () => ({ resolveWorkspaceCollector: vi.fn() }));
vi.mock("./conexion", () => ({ leerLlave: vi.fn() }));

const { sincronizarEspacio, MENSAJE_LLAVE_RECHAZADA } = await import("./sincronizar");

const WS = "ws-dnx";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const P = B.prisma as Record<string, any>;

function venta(orderId: number, p: Record<string, unknown> = {}) {
  return {
    orderId,
    mpPaymentId: `mp-${orderId}`,
    estado: "PAID",
    motivo: null,
    pagadoEl: "2026-11-07T15:40:00.000Z",
    actualizadoEl: "2026-11-07T15:43:00.000Z",
    album: { id: 1283, titulo: "Colación 7°" },
    detalle: "Pack: 5 digitales + 5 copias",
    pagoFamilia: 20000,
    comisionPlataforma: 2609,
    descuentoReferidos: 0,
    comisionOrganizador: 0,
    retenidoEsperadoMp: 2609,
    netoFotografo: 17391,
    cobrador: "PHOTOGRAPHER",
    cobradorMpUserId: "97484805",
    ...p,
  };
}

function facts(id: string, p: Partial<MpPaymentFacts> = {}): MpPaymentFacts {
  return {
    id, status: "approved", statusDetail: null, externalReference: id.replace("mp-", ""), grossMinor: 2_000_000, mpFeeMinor: 120_000,
    platformFeeMinor: 260_900, refundedMinor: 0, approvedAt: new Date("2026-11-07T15:40:00Z"), lastUpdatedAt: new Date("2026-11-07T15:41:00Z"),
    paymentMethodId: null, feeSource: "fee_details", ...p,
  };
}

const respuesta = (status: number, cuerpo: unknown) => new Response(JSON.stringify(cuerpo), { status });

function deps(paginas: Array<() => Response>, pago: (id: string) => MpPaymentFacts | Error = (id) => facts(id)) {
  let i = 0;
  const fetchFalso = vi.fn(async () => (paginas[i++] ?? (() => respuesta(200, { ventas: [], siguiente: null })))());
  return {
    fetch: fetchFalso as unknown as typeof fetch,
    baseUrl: "https://clf.test",
    ahora: new Date("2026-11-07T18:00:00Z"),
    leerLlave: async () => "clf_fo_llave",
    cobros: async () => ({ accessToken: "tok", providerUserId: "97484805" }),
    leerPago: async (_t: string, id: string) => {
      const r = pago(id);
      if (r instanceof Error) throw r;
      return r;
    },
    fetchFalso,
  };
}

beforeEach(async () => {
  await P.fotofficeClfVenta.deleteMany({});
  await P.fotofficeClfConexion.deleteMany({});
  await P.fotofficeClfConexion.create({ data: { workspaceId: WS, clfUserId: 79, clfCuentaNombre: "DNX" } });
});

describe("sincronizarEspacio", () => {
  it("dos páginas: guarda las ventas, el cursor final y las valida", async () => {
    const d = deps([
      () => respuesta(200, { ventas: [venta(5974)], siguiente: "c1", hayMas: true }),
      () => respuesta(200, { ventas: [venta(5978)], siguiente: "c2", hayMas: false }),
    ]);
    const r = await sincronizarEspacio(WS, d);
    expect(r).toMatchObject({ ok: true, nuevas: 2, validadas: 2, error: null });
    const ventas = await P.fotofficeClfVenta.findMany({ where: { workspaceId: WS } });
    expect(ventas.map((v: { validacion: string }) => v.validacion)).toEqual(["VALIDADA", "VALIDADA"]);
    const c = await P.fotofficeClfConexion.findUnique({ where: { workspaceId: WS } });
    expect(c.cursor).toBe("c2");
    expect(d.fetchFalso).toHaveBeenCalledTimes(2);
    expect(c.ultimaSincronizacionEl).toEqual(new Date("2026-11-07T18:00:00Z"));
  });

  it("una venta que vuelve reintegrada pasa a pendiente y queda REINTEGRADA", async () => {
    await sincronizarEspacio(WS, deps([() => respuesta(200, { ventas: [venta(5978)], siguiente: null })]));
    const d = deps(
      [() => respuesta(200, { ventas: [venta(5978, { estado: "REFUNDED", motivo: "reintegro" })], siguiente: null })],
      (id) => facts(id, { status: "refunded", refundedMinor: 2_000_000, lastUpdatedAt: new Date("2026-11-20T12:00:00Z") }),
    );
    const r = await sincronizarEspacio(WS, d);
    expect(r).toMatchObject({ nuevas: 0, actualizadas: 1 });
    const v = await P.fotofficeClfVenta.findFirst({ where: { workspaceId: WS, clfOrderId: 5978 } });
    expect(v).toMatchObject({ validacion: "REINTEGRADA", estadoClf: "REFUNDED", reintegradoEl: new Date("2026-11-20T12:00:00Z") });
  });

  it("CLF rechaza la llave: guarda el error y no borra nada", async () => {
    await sincronizarEspacio(WS, deps([() => respuesta(200, { ventas: [venta(5978)], siguiente: null })]));
    const r = await sincronizarEspacio(WS, deps([() => respuesta(401, {})]));
    expect(r.error).toBe(MENSAJE_LLAVE_RECHAZADA);
    expect(await P.fotofficeClfVenta.count({ where: { workspaceId: WS } })).toBe(1);
    const c = await P.fotofficeClfConexion.findUnique({ where: { workspaceId: WS } });
    expect(c.ultimoError).toBe(MENSAJE_LLAVE_RECHAZADA);
  });

  it("Mercado Pago caído: la venta queda pendiente para la próxima corrida", async () => {
    await sincronizarEspacio(WS, deps([() => respuesta(200, { ventas: [venta(5978)], siguiente: null })], () => new Error("timeout")));
    const v = await P.fotofficeClfVenta.findFirst({ where: { workspaceId: WS } });
    expect(v.validacion).toBe("PENDIENTE");
  });

  it("el pago no es de la cuenta del espacio", async () => {
    const noEs = Object.assign(new Error("404"), { status: 404 });
    await sincronizarEspacio(WS, deps([() => respuesta(200, { ventas: [venta(5978)], siguiente: null })], () => noEs));
    const v = await P.fotofficeClfVenta.findFirst({ where: { workspaceId: WS } });
    expect(v.validacion).toBe("NO_EN_TU_MP");
  });

  it("no escribe nunca en la Caja", async () => {
    await sincronizarEspacio(WS, deps([() => respuesta(200, { ventas: [venta(5974), venta(5978)], siguiente: null })]));
    expect(await P.cashMovement.count({})).toBe(0);
  });

  it("con la conexión cerrada no hace nada", async () => {
    await P.fotofficeClfConexion.update({ where: { workspaceId: WS }, data: { cerradaEl: new Date() } });
    const d = deps([() => respuesta(200, { ventas: [venta(5978)], siguiente: null })]);
    expect((await sincronizarEspacio(WS, d)).ok).toBe(false);
    expect(d.fetchFalso).not.toHaveBeenCalled();
  });
});
