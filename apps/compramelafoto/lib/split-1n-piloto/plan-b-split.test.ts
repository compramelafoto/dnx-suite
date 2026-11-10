import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { prepararCobro } from "./cobro";
import type { PilotoConfig } from "./config";
import type { PedidoPiloto } from "./pedido";
import { PaymentProviderValidationError } from "@repo/payments";
import { resolverCheckoutSplit, type DepsCheckoutSplit } from "./plan-b-split";
import type { CobroPedidoPreparado } from "./preparar";
import { leerMarcaPiloto, marcarSnapshotPiloto, type MarcaPiloto } from "./snapshot";

const AHORA = new Date("2026-11-10T15:00:00Z");
const HACE_10_S = new Date(AHORA.getTime() - 10_000).toISOString();
const HACE_5_MIN = new Date(AHORA.getTime() - 5 * 60_000).toISOString();

const config: PilotoConfig = {
  enabled: true,
  albumIds: new Set([1301]),
  todosLosAlbumes: false,
  receptoresDesdeClf: false,
  planB: true,
  planBSplit: true,
  receiverByUserId: new Map(),
  ownerUserId: "97484805",
  accessToken: "APP_USR-x",
  publicKey: "APP_USR-pk",
};

function cobroOk(): Extract<CobroPedidoPreparado, { ok: true }> {
  const cobro = prepararCobro({
    estadoPedido: "PENDING",
    marca: { v: 1, estado: "PENDIENTE" },
    totalPesos: 3450,
    feePesos: 450,
    basePesos: 3000,
    porcentajeOrganizador: 20,
    receivers: { fotografo: "R-FOTO", referidor: "R-REF", organizador: "R-ORG", referidorOrganizador: null },
    payerEmail: "comprador@ejemplo.com",
    correosReceptores: [],
  });
  if (!cobro.ok) throw new Error("cobro");
  return {
    ok: true,
    clientes: {} as Extract<CobroPedidoPreparado, { ok: true }>["clientes"],
    cobro,
    quienesCobran: { referidorUserId: 53, organizadorUserId: 77, referidorOrganizadorUserId: null, reparto: cobro.reparto },
  };
}

/** Pedido en memoria: `cambiarMarca` se comporta como la escritura condicionada de la base. */
function escenario(opciones: {
  marca: Omit<MarcaPiloto, "v">;
  status?: string;
  config?: Partial<PilotoConfig>;
  estadoOrden?: string | null | Error;
  preparar?: CobroPedidoPreparado;
  crear?: { id: string | null; url: string | null } | Error;
  confirmar?: boolean;
  /** Simula que otra pestaña cambió la marca justo después de crear la orden. */
  pisarTrasCrear?: Omit<MarcaPiloto, "v">;
}) {
  let snapshot: unknown = JSON.parse(JSON.stringify(marcarSnapshotPiloto({ total: 3450 }, opciones.marca)));
  const llamadas = {
    crear: [] as Array<{ body: unknown; key: string }>,
    confirmar: 0,
    preparar: 0,
    escrituras: 0,
    canceladas: [] as string[],
  };
  const deps: DepsCheckoutSplit = {
    config: { ...config, ...opciones.config },
    baseUrl: "https://www.compramelafoto.com",
    ahora: () => AHORA,
    async cancelarOrden(id) {
      llamadas.canceladas.push(id);
    },
    async cargar() {
      return {
        order: {
          id: 4321,
          status: opciones.status ?? "PENDING",
          buyerEmail: "comprador@ejemplo.com",
          pricingSnapshot: snapshot,
          album: { title: "Maratón" },
        },
        feePesos: 450,
        basePesos: 3000,
      } as unknown as PedidoPiloto;
    },
    async cambiarMarca(base, leida, cambios) {
      const actual = leerMarcaPiloto(snapshot);
      if (JSON.stringify(actual) !== JSON.stringify(JSON.parse(JSON.stringify(leida)))) return false;
      snapshot = JSON.parse(JSON.stringify(marcarSnapshotPiloto(base, cambios)));
      llamadas.escrituras++;
      return true;
    },
    async estadoOrden() {
      if (opciones.estadoOrden instanceof Error) throw opciones.estadoOrden;
      return opciones.estadoOrden ?? "created";
    },
    async confirmar() {
      llamadas.confirmar++;
      return opciones.confirmar ?? true;
    },
    async preparar() {
      llamadas.preparar++;
      return opciones.preparar ?? cobroOk();
    },
    async crearOrden(_c, body, key) {
      llamadas.crear.push({ body, key });
      if (opciones.crear instanceof Error) throw opciones.crear;
      if (opciones.pisarTrasCrear) {
        snapshot = JSON.parse(JSON.stringify(marcarSnapshotPiloto({ total: 3450 }, opciones.pisarTrasCrear)));
      }
      return opciones.crear ?? { id: "ORD-NUEVA", url: "https://www.mercadopago.com.ar/checkout/v1/redirect?order_id=ORD-NUEVA" };
    },
  };
  return { deps, llamadas, marca: () => leerMarcaPiloto(snapshot) };
}

describe("plan B con reparto: pedido sin orden", () => {
  it("crea la orden con el reparto, reserva el pedido y guarda el enlace", async () => {
    const e = escenario({ marca: { estado: "PENDIENTE", intento: 2 } });
    const r = await resolverCheckoutSplit(e.deps, 4321);
    assert.deepEqual(r, { tipo: "url", url: "https://www.mercadopago.com.ar/checkout/v1/redirect?order_id=ORD-NUEVA" });
    assert.equal(e.llamadas.crear.length, 1);
    assert.equal(e.llamadas.crear[0].key, "clf-album-order-4321-3");
    const body = e.llamadas.crear[0].body as { external_reference: string; splits: unknown[] };
    assert.equal(body.external_reference, "clf-album-order-4321");
    assert.equal(body.splits.length, 4);
    const m = e.marca();
    assert.equal(m?.estado, "CHECKOUT_SPLIT");
    assert.equal(m?.providerOrderId, "ORD-NUEVA");
    assert.equal(m?.intento, 3);
    assert.equal(m?.organizadorUserId, 77);
  });

  it("si Mercado Pago falla, el pedido vuelve a PENDIENTE y sigue el Checkout Pro de siempre", async () => {
    const e = escenario({ marca: { estado: "PENDIENTE" }, crear: new Error("503") });
    assert.deepEqual(await resolverCheckoutSplit(e.deps, 4321), { tipo: "legacy" });
    assert.equal(e.marca()?.estado, "PENDIENTE");
  });

  it("si Mercado Pago responde sin enlace, también vuelve a PENDIENTE", async () => {
    const e = escenario({ marca: { estado: "PENDIENTE" }, crear: { id: "ORD-X", url: null } });
    assert.deepEqual(await resolverCheckoutSplit(e.deps, 4321), { tipo: "legacy" });
    assert.equal(e.marca()?.estado, "PENDIENTE");
  });

  it("si el pedido no es elegible (p. ej. un consentimiento no está activo), sigue el de siempre sin escribir", async () => {
    const e = escenario({ marca: { estado: "PENDIENTE" }, preparar: { ok: false, codigo: "CONSENTIMIENTO_NO_ACTIVO" } });
    assert.deepEqual(await resolverCheckoutSplit(e.deps, 4321), { tipo: "legacy" });
    assert.equal(e.llamadas.escrituras, 0);
    assert.equal(e.llamadas.crear.length, 0);
  });

  it("con el interruptor apagado no hace nada", async () => {
    const e = escenario({ marca: { estado: "PENDIENTE" }, config: { planBSplit: false } });
    assert.deepEqual(await resolverCheckoutSplit(e.deps, 4321), { tipo: "legacy" });
    assert.equal(e.llamadas.preparar, 0);
    assert.equal(e.llamadas.escrituras, 0);
  });

  it("si la tarjeta reservó el pedido en el medio, no crea ninguna orden", async () => {
    const e = escenario({ marca: { estado: "PENDIENTE" } });
    const preparar = e.deps.preparar;
    e.deps.preparar = async (c, m) => {
      const r = await preparar(c, m);
      // La tarjeta gana la reserva mientras se preparaba el reparto.
      const otra = e.deps.cambiarMarca;
      await otra((await e.deps.cargar())!.order.pricingSnapshot, e.marca()!, { estado: "COBRANDO", intento: 1 });
      return r;
    };
    const r = await resolverCheckoutSplit(e.deps, 4321);
    assert.equal(r.tipo, "fin");
    assert.equal(e.llamadas.crear.length, 0);
    assert.equal(e.marca()?.estado, "COBRANDO");
  });

  it("un cobro con tarjeta en curso no se toca", async () => {
    const e = escenario({ marca: { estado: "COBRANDO" } });
    assert.deepEqual(await resolverCheckoutSplit(e.deps, 4321), { tipo: "legacy" });
    assert.equal(e.llamadas.escrituras, 0);
  });
});

describe("plan B con reparto: ya hay una orden", () => {
  const conOrden = { estado: "CHECKOUT_SPLIT" as const, intento: 3, providerOrderId: "ORD-1", checkoutUrl: "https://mp/1" };

  it("sin pagar: reutiliza el mismo enlace y no crea otra", async () => {
    const e = escenario({ marca: conOrden, estadoOrden: "created" });
    assert.deepEqual(await resolverCheckoutSplit(e.deps, 4321), { tipo: "url", url: "https://mp/1" });
    assert.equal(e.llamadas.crear.length, 0);
  });

  it("también con el interruptor apagado: un enlace vivo no se abandona", async () => {
    const e = escenario({ marca: conOrden, estadoOrden: "processing", config: { planBSplit: false } });
    assert.deepEqual(await resolverCheckoutSplit(e.deps, 4321), { tipo: "url", url: "https://mp/1" });
  });

  it("pagada: la confirma y no ofrece pagar de nuevo", async () => {
    const e = escenario({ marca: conOrden, estadoOrden: "processed" });
    const r = await resolverCheckoutSplit(e.deps, 4321);
    assert.equal(r.tipo, "fin");
    assert.equal(e.llamadas.confirmar, 1);
    assert.equal(e.llamadas.crear.length, 0);
  });

  it("si no se puede leer en Mercado Pago, no cae al Checkout Pro de siempre", async () => {
    const e = escenario({ marca: conOrden, estadoOrden: new Error("timeout") });
    const r = await resolverCheckoutSplit(e.deps, 4321);
    assert.equal(r.tipo, "fin");
    assert.equal(e.marca()?.estado, "CHECKOUT_SPLIT");
  });

  it("vencida: la libera sin el id viejo y crea otra con un intento nuevo", async () => {
    const e = escenario({ marca: conOrden, estadoOrden: "canceled" });
    const r = await resolverCheckoutSplit(e.deps, 4321);
    assert.equal(r.tipo, "url");
    assert.equal(e.llamadas.crear[0].key, "clf-album-order-4321-4");
    assert.equal(e.marca()?.providerOrderId, "ORD-NUEVA");
  });

  it("vencida y con el interruptor apagado: queda libre para el Checkout Pro de siempre", async () => {
    const e = escenario({ marca: conOrden, estadoOrden: "expired", config: { planBSplit: false } });
    assert.deepEqual(await resolverCheckoutSplit(e.deps, 4321), { tipo: "legacy" });
    assert.equal(e.marca()?.estado, "PENDIENTE");
  });

  it("reservado sin orden (se cortó): reintenta con la misma clave y actualiza quiénes cobran", async () => {
    const e = escenario({ marca: { estado: "CHECKOUT_SPLIT", intento: 5, reservadoEn: HACE_5_MIN, organizadorUserId: 1 } });
    const r = await resolverCheckoutSplit(e.deps, 4321);
    assert.equal(r.tipo, "url");
    assert.equal(e.llamadas.crear[0].key, "clf-album-order-4321-5");
    assert.equal(e.marca()?.organizadorUserId, 77);
  });

  it("reservado hace segundos: otra pestaña está abriendo Mercado Pago, no se reintenta", async () => {
    const e = escenario({ marca: { estado: "CHECKOUT_SPLIT", intento: 5, reservadoEn: HACE_10_S } });
    const r = await resolverCheckoutSplit(e.deps, 4321);
    assert.equal(r.tipo, "fin");
    assert.equal(e.llamadas.crear.length, 0);
    assert.equal(e.marca()?.estado, "CHECKOUT_SPLIT");
  });

  it("reservado sin orden y Mercado Pago no responde: no se libera (puede haber un enlace)", async () => {
    const e = escenario({ marca: { estado: "CHECKOUT_SPLIT", intento: 5, reservadoEn: HACE_5_MIN }, crear: new Error("timeout") });
    const r = await resolverCheckoutSplit(e.deps, 4321);
    assert.equal(r.tipo, "fin");
    assert.equal(e.marca()?.estado, "CHECKOUT_SPLIT");
  });

  it("reservado sin orden y Mercado Pago la rechaza: queda libre para el de siempre", async () => {
    const e = escenario({
      marca: { estado: "CHECKOUT_SPLIT", intento: 5, reservadoEn: HACE_5_MIN },
      crear: new PaymentProviderValidationError("splits inválidos"),
    });
    assert.deepEqual(await resolverCheckoutSplit(e.deps, 4321), { tipo: "legacy" });
    assert.equal(e.marca()?.estado, "PENDIENTE");
  });

  it("si otra pestaña cambió el pedido mientras se creaba, la orden se cancela y no se entrega el enlace", async () => {
    const e = escenario({ marca: { estado: "PENDIENTE" }, pisarTrasCrear: { estado: "CHECKOUT_PRO" } });
    const r = await resolverCheckoutSplit(e.deps, 4321);
    assert.equal(r.tipo, "fin");
    assert.deepEqual(e.llamadas.canceladas, ["ORD-NUEVA"]);
  });

  it("pagada pero la confirmación no salió: no dice «acreditado», pide no pagar de nuevo", async () => {
    const e = escenario({ marca: conOrden, estadoOrden: "processed", confirmar: false });
    const r = await resolverCheckoutSplit(e.deps, 4321);
    assert.equal(r.tipo, "fin");
    assert.match(r.tipo === "fin" ? r.mensaje : "", /No pagues de nuevo/);
  });

  it("devuelta o en un estado desconocido: no reutiliza ni libera", async () => {
    for (const estadoOrden of ["refunded", "algo_nuevo"]) {
      const e = escenario({ marca: conOrden, estadoOrden });
      const r = await resolverCheckoutSplit(e.deps, 4321);
      assert.equal(r.tipo, "fin");
      assert.equal(e.llamadas.escrituras, 0);
    }
  });

  it("un pedido ya pagado no se toca", async () => {
    const e = escenario({ marca: conOrden, status: "PAID" });
    assert.deepEqual(await resolverCheckoutSplit(e.deps, 4321), { tipo: "legacy" });
    assert.equal(e.llamadas.escrituras, 0);
  });
});
