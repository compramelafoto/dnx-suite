import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));

const { atenderComprobanteDelBot } = await import("./auto-servidor");
const { TEXTO_COMPROBANTE_A_REVISAR } = await import("./auto-decision");
type Deps = Parameters<typeof atenderComprobanteDelBot>[3];

const AHORA = new Date("2026-11-10T19:00:00Z");
const CHAT = { id: "c1", workspaceId: "w1", waId: "549341", nombre: "Ana" };
const LEIDO = { esComprobante: true, operacion: "999", monto: 10000, fecha: "2026-11-10T18:50:00Z", origen: "Ana", destinatario: "Estudio" };
const PAGO = { id: "555", monto: 10000, estado: "approved", fecha: "2026-11-10T18:51:00Z", pagador: "Ana" };
const COMPLETO = { providerPaymentId: "555", status: "approved", amountMinor: 1_000_000, currency: "ARS", externalReference: null, rawSanitized: { status: "approved" } };
const pedido = (tipo: "IMPRESION" | "CATALOGO") => ({ tipo, id: "p1", numero: "12", creadoEn: new Date("2026-11-10T18:00:00Z"), totalCents: 2_000_000, senaCents: 1_000_000 });

function deps(extra: Partial<Deps> = {}) {
  const d = {
    pedidos: vi.fn(async () => [pedido("IMPRESION")]),
    leer: vi.fn(async () => ({ ok: true as const, leido: LEIDO, veredicto: { estado: "PROBABLE" as const, pago: PAGO } })),
    yaUsado: vi.fn(async () => false),
    autoConfirmar: vi.fn(async () => true),
    pagoCompleto: vi.fn(async () => COMPLETO),
    acreditarImpresion: vi.fn(async () => null as string | null),
    acreditarCatalogo: vi.fn(async () => null as string | null),
    responder: vi.fn(async () => "enviado" as const),
    pasar: vi.fn(async () => undefined),
    telegram: vi.fn(async () => undefined),
    sistema: vi.fn(async () => undefined),
    ...extra,
  };
  return d;
}

describe("atenderComprobanteDelBot", () => {
  it("comprobante que cierra con la seña de un pedido de copias: acredita, deja la nota y el bot no contesta", async () => {
    const d = deps();
    expect(await atenderComprobanteDelBot(CHAT, ["m1"], AHORA, d)).toBe("ACREDITADO");
    expect(d.acreditarImpresion).toHaveBeenCalledWith("w1", "p1", COMPLETO);
    expect(d.sistema).toHaveBeenCalledWith("w1", "c1", expect.stringContaining("acreditó la seña del pedido 12"));
    expect(d.responder).not.toHaveBeenCalled();
    expect(d.pasar).not.toHaveBeenCalled();
  });

  it("pedido de catálogo: acredita con el cobro del pedido y el bot le confirma al cliente", async () => {
    const d = deps({ pedidos: vi.fn(async () => [pedido("CATALOGO")]) });
    expect(await atenderComprobanteDelBot(CHAT, ["m1"], AHORA, d)).toBe("ACREDITADO");
    expect(d.acreditarCatalogo).toHaveBeenCalledWith("w1", "p1", COMPLETO);
    expect(d.responder).toHaveBeenCalledWith(expect.stringContaining("Recibimos tu pago"));
  });

  it("sin pedido esperando el pago no lee nada: el bot sigue", async () => {
    const d = deps({ pedidos: vi.fn(async () => []) });
    expect(await atenderComprobanteDelBot(CHAT, ["m1"], AHORA, d)).toBe("SEGUIR");
    expect(d.leer).not.toHaveBeenCalled();
  });

  it("si la imagen no es un comprobante, el bot sigue como siempre", async () => {
    const d = deps({ leer: vi.fn(async () => ({ ok: true as const, leido: { ...LEIDO, esComprobante: false }, veredicto: { estado: "NO_ES_COMPROBANTE" as const } })) });
    expect(await atenderComprobanteDelBot(CHAT, ["m1", "m2"], AHORA, d)).toBe("SEGUIR");
    expect(d.leer).toHaveBeenCalledTimes(2);
    expect(d.responder).not.toHaveBeenCalled();
  });

  it("no encontrado en Mercado Pago: contesta corto, pasa a una persona con el motivo y avisa por Telegram", async () => {
    const d = deps({ leer: vi.fn(async () => ({ ok: true as const, leido: LEIDO, veredicto: { estado: "NO_ENCONTRADO" as const } })) });
    expect(await atenderComprobanteDelBot(CHAT, ["m1"], AHORA, d)).toBe("A_PERSONA");
    expect(d.responder).toHaveBeenCalledWith(TEXTO_COMPROBANTE_A_REVISAR);
    expect(d.pasar).toHaveBeenCalledWith(expect.stringContaining("no aparece en Mercado Pago"));
    expect(d.telegram).toHaveBeenCalledTimes(1);
    expect(d.sistema).toHaveBeenCalledWith("w1", "c1", expect.stringContaining("Comprobante para revisar (pedido 12)"));
    expect(d.acreditarImpresion).not.toHaveBeenCalled();
  });

  it("con la confirmación automática apagada, verifica y pasa a una persona sin acreditar", async () => {
    const d = deps({ autoConfirmar: vi.fn(async () => false) });
    expect(await atenderComprobanteDelBot(CHAT, ["m1"], AHORA, d)).toBe("A_PERSONA");
    expect(d.acreditarImpresion).not.toHaveBeenCalled();
    expect(d.pasar).toHaveBeenCalledWith(expect.stringContaining("apagada"));
  });

  it("si la acreditación no se pudo hacer (pago ya usado en la transacción), pasa a una persona", async () => {
    const d = deps({ acreditarImpresion: vi.fn(async () => "ese pago de Mercado Pago ya se usó para otro pedido") });
    expect(await atenderComprobanteDelBot(CHAT, ["m1"], AHORA, d)).toBe("A_PERSONA");
    expect(d.pasar).toHaveBeenCalledWith(expect.stringContaining("ya se usó"));
  });

  it("si entró otro mensaje mientras verificaba, no pasa el chat (lo atiende la próxima ejecución)", async () => {
    const d = deps({ yaUsado: vi.fn(async () => true), responder: vi.fn(async () => "omitido" as const) });
    expect(await atenderComprobanteDelBot(CHAT, ["m1"], AHORA, d)).toBe("OMITIDO");
    expect(d.pasar).not.toHaveBeenCalled();
  });

  it("un comprobante sin poder consultar Mercado Pago pasa a una persona", async () => {
    const d = deps({ leer: vi.fn(async () => ({ ok: false as const, error: "No se pudo consultar Mercado Pago. Revisá que esté conectado en Configuración → Cobros." as const })) });
    expect(await atenderComprobanteDelBot(CHAT, ["m1"], AHORA, d)).toBe("A_PERSONA");
    expect(d.pasar).toHaveBeenCalledWith(expect.stringContaining("no se pudo consultar Mercado Pago"));
  });
});
