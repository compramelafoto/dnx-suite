import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GrupoCargado, PedidoDelGrupoCargado } from "./cargar";
import {
  ESPERA_RESERVA_GRUPO_MS,
  MENSAJES_CHECKOUT_GRUPO as M,
  marcaComunDelGrupo,
  resolverCheckoutSplitGrupo,
  type DepsCheckoutSplitGrupo,
} from "./checkout-split-grupo";
import { prepararCobroGrupo } from "./cobro-grupo";
import { leerMarcaGrupo, marcarSnapshotGrupo } from "./marca";
import type { GrupoPreparado } from "./preparar-grupo";

const GRUPO = "3f2b8c1e-9a4d-4e6b-8f1a-2c3d4e5f6a7b";
const AHORA = new Date("2026-11-15T15:00:00.000Z");

type Fila = { id: number; status: string; snapshot: Record<string, unknown> };

/** Base en memoria con dos pedidos del mismo grupo (dos fotógrafos). */
function crearBase(estado: Record<string, unknown> = { estado: "PENDIENTE" }) {
  const filas: Fila[] = [1, 2].map((id) => ({
    id,
    status: "PENDING",
    snapshot: JSON.parse(
      JSON.stringify(marcarSnapshotGrupo({}, { grupoId: GRUPO, pedidos: [1, 2], ...estado } as never)),
    ),
  }));
  function cargar(): GrupoCargado {
    return {
      grupoId: GRUPO,
      eventId: 192,
      autoresPorPedido: new Map(),
      pedidos: filas.map(
        (f) =>
          ({
            order: { id: f.id, status: f.status, pricingSnapshot: structuredClone(f.snapshot), album: { userId: f.id } },
            marca: leerMarcaGrupo(structuredClone(f.snapshot))!,
          }) as unknown as PedidoDelGrupoCargado,
      ),
    };
  }
  return { filas, cargar };
}

/**
 * El caso de Hakai Games: Ayelen vende sus fotos, Martin las suyas y Ayelen además es la
 * referidora de Martin. Dos pedidos de $8.600 (precio 8.000 + recargo 600).
 */
function cobroHakai() {
  const r = prepararCobroGrupo({
    pedidos: [
      { pedidoId: 1, estadoPedido: "PENDING", totalPesos: 8600, feePesos: 600, basePesos: 8000, porcentajeOrganizador: 0, receivers: { fotografo: "R-AYELEN", referidor: null } },
      { pedidoId: 2, estadoPedido: "PENDING", totalPesos: 8600, feePesos: 600, basePesos: 8000, porcentajeOrganizador: 0, receivers: { fotografo: "R-MARTIN", referidor: "R-AYELEN" } },
    ],
    estadoGrupo: "PENDIENTE",
    payerEmail: "comprador@example.com",
    correosReceptores: [],
    maxReceptores: 10,
  });
  if (!r.ok) throw new Error(`cobro: ${r.codigo}`);
  return r;
}

const PREPARADO: GrupoPreparado = {
  ok: true,
  clientes: {} as never,
  payerEmail: "comprador@example.com",
  cobro: cobroHakai(),
  cobroDelPedido: (p) => ({
    referidorUserId: p.order.id === 2 ? 403 : null,
    organizadorUserId: null,
    referidorOrganizadorUserId: null,
    reparto: cobroHakai().repartos.get(p.order.id)!,
  }),
};

function deps(
  base: ReturnType<typeof crearBase>,
  extra: Partial<DepsCheckoutSplitGrupo> & { llamadas?: string[] } = {},
): DepsCheckoutSplitGrupo & { llamadas: string[] } {
  const llamadas = extra.llamadas ?? [];
  return {
    planBSplit: true,
    ownerUserId: "97484805",
    baseUrl: "https://www.compramelafoto.com",
    ahora: () => AHORA,
    async cargar() {
      return base.cargar();
    },
    async cambiarMarcas(grupo, cambios) {
      // Todo o nada, condicionado a la marca leída.
      for (const p of grupo.pedidos) {
        const f = base.filas.find((x) => x.id === p.order.id)!;
        if (f.status !== "PENDING" && f.status !== "FAILED") return false;
        if (JSON.stringify(f.snapshot.split1nGrupo) !== JSON.stringify(p.marca)) return false;
      }
      for (const p of grupo.pedidos) {
        const f = base.filas.find((x) => x.id === p.order.id)!;
        f.snapshot = JSON.parse(JSON.stringify(marcarSnapshotGrupo(f.snapshot, cambios(p))));
      }
      llamadas.push("cambiar");
      return true;
    },
    async estadoOrden() {
      return "created";
    },
    async confirmar() {
      llamadas.push("confirmar");
      return true;
    },
    async cancelarOrden(id) {
      llamadas.push(`cancelar:${id}`);
    },
    async preparar() {
      return PREPARADO;
    },
    async crearOrden(_c, body, key) {
      llamadas.push(`crear:${key}:${(body as { external_reference: string }).external_reference}`);
      return { id: "ORD01NUEVA", url: "https://www.mercadopago.com.ar/checkout/ORD01NUEVA" };
    },
    ...extra,
    llamadas,
  };
}

describe("Pagar con Mercado Pago en un carrito de evento", () => {
  it("la marca común exige que todos los pedidos coincidan", () => {
    const base = crearBase();
    assert.ok(marcaComunDelGrupo(base.cargar()));
    base.filas[1].snapshot = marcarSnapshotGrupo(base.filas[1].snapshot, { estado: "COBRANDO" });
    assert.equal(marcaComunDelGrupo(base.cargar()), null);
  });

  it("reutiliza el enlace vigente sin crear otra orden", async () => {
    const base = crearBase({ estado: "CHECKOUT_SPLIT", providerOrderId: "ORD01A", checkoutUrl: "https://mp/ORD01A", intento: 1 });
    const d = deps(base);
    const r = await resolverCheckoutSplitGrupo(d);
    assert.deepEqual(r, { tipo: "url", url: "https://mp/ORD01A" });
    assert.deepEqual(d.llamadas, []);
  });

  it("si la orden ya se pagó, confirma el grupo y no abre otro cobro", async () => {
    const base = crearBase({ estado: "CHECKOUT_SPLIT", providerOrderId: "ORD01A", checkoutUrl: "https://mp/ORD01A", intento: 1 });
    const d = deps(base, { estadoOrden: async () => "processed" });
    const r = await resolverCheckoutSplitGrupo(d);
    assert.deepEqual(r, { tipo: "fin", mensaje: M.pagado });
    assert.deepEqual(d.llamadas, ["confirmar"]);
  });

  it("con un estado desconocido de la orden, no entrega enlace ni crea otra", async () => {
    const base = crearBase({ estado: "CHECKOUT_SPLIT", providerOrderId: "ORD01A", checkoutUrl: "https://mp/ORD01A", intento: 1 });
    const d = deps(base, { estadoOrden: async () => "refunded" });
    assert.deepEqual(await resolverCheckoutSplitGrupo(d), { tipo: "fin", mensaje: M.verificando });
    assert.deepEqual(d.llamadas, []);
  });

  it("una orden vencida se libera y se crea otra con el intento siguiente", async () => {
    const base = crearBase({ estado: "CHECKOUT_SPLIT", providerOrderId: "ORD01A", checkoutUrl: "https://mp/ORD01A", intento: 1 });
    const d = deps(base, { estadoOrden: async () => "expired" });
    const r = await resolverCheckoutSplitGrupo(d);
    assert.equal(r.tipo, "url");
    assert.ok(d.llamadas.includes(`crear:clf-event-cart-${GRUPO}-2:clf-event-cart-${GRUPO}`));
    const marca = leerMarcaGrupo(base.filas[0].snapshot)!;
    assert.equal(marca.estado, "CHECKOUT_SPLIT");
    assert.equal(marca.providerOrderId, "ORD01NUEVA");
    assert.equal(marca.intento, 2);
    // Los dos pedidos quedan con la misma marca común (el reparto es propio de cada pedido).
    assert.ok(marcaComunDelGrupo(base.cargar()));
  });

  it("primer intento: reserva todo el grupo, crea la orden con la referencia del carrito y guarda el enlace", async () => {
    const base = crearBase();
    const d = deps(base);
    const r = await resolverCheckoutSplitGrupo(d);
    assert.deepEqual(r, { tipo: "url", url: "https://www.mercadopago.com.ar/checkout/ORD01NUEVA" });
    assert.deepEqual(d.llamadas, ["cambiar", `crear:clf-event-cart-${GRUPO}-1:clf-event-cart-${GRUPO}`, "cambiar"]);
    for (const f of base.filas) {
      const m = leerMarcaGrupo(f.snapshot)!;
      assert.equal(m.estado, "CHECKOUT_SPLIT");
      assert.equal(m.checkoutUrl, "https://www.mercadopago.com.ar/checkout/ORD01NUEVA");
      assert.ok(m.cobro, "cada pedido guarda su reparto para las comisiones");
    }
  });

  it("la orden reparte a las tres partes y vuelve a la página del carrito", async () => {
    const base = crearBase();
    let body: Record<string, unknown> | null = null;
    const d = deps(base, {
      crearOrden: async (_c, b) => {
        body = b as Record<string, unknown>;
        return { id: "ORD01X", url: "https://mp/ORD01X" };
      },
    });
    await resolverCheckoutSplitGrupo(d);
    const orden = body as unknown as {
      total_amount: string;
      processing_mode: string;
      splits: Array<{ receiver_id: string; receiver_type: string; amount: string }>;
      config: { online: { success_url: string } };
    };
    assert.equal(orden.processing_mode, "manual");
    assert.equal(orden.total_amount, "17200.00");
    const suma = orden.splits.reduce((acc, x) => acc + Math.round(Number(x.amount) * 100), 0);
    assert.equal(suma, 1720000);
    const ids = orden.splits.map((x) => x.receiver_id).sort();
    assert.deepEqual(ids, ["97484805", "R-AYELEN", "R-MARTIN"], "Ayelen va una sola vez, con la suma de sus dos roles");
    const cobro = cobroHakai();
    const r1 = cobro.repartos.get(1)!;
    const r2 = cobro.repartos.get(2)!;
    const de = (id: string) => Number(orden.splits.find((x) => x.receiver_id === id)!.amount);
    assert.equal(de("R-MARTIN"), r2.fotografo);
    assert.equal(de("R-AYELEN"), r1.fotografo + r2.referidor);
    assert.equal(orden.config.online.success_url, `https://www.compramelafoto.com/pagar/grupo/${GRUPO}`);
  });

  it("si Mercado Pago no crea la orden, el grupo vuelve a PENDIENTE (puede pagar con tarjeta)", async () => {
    const base = crearBase();
    const d = deps(base, {
      crearOrden: async () => {
        throw new Error("timeout");
      },
    });
    assert.deepEqual(await resolverCheckoutSplitGrupo(d), { tipo: "fin", mensaje: M.error });
    for (const f of base.filas) assert.equal(leerMarcaGrupo(f.snapshot)!.estado, "PENDIENTE");
  });

  it("con la tarjeta en curso no abre Mercado Pago", async () => {
    const base = crearBase({ estado: "COBRANDO", intento: 1 });
    const d = deps(base);
    assert.deepEqual(await resolverCheckoutSplitGrupo(d), { tipo: "fin", mensaje: M.tarjeta_en_curso });
    assert.deepEqual(d.llamadas, []);
  });

  it("con un pedido ya pagado no abre otro cobro", async () => {
    const base = crearBase({ estado: "PAGADO", providerOrderId: "ORD01A", intento: 1 });
    base.filas[0].status = "PAID";
    const d = deps(base);
    assert.deepEqual(await resolverCheckoutSplitGrupo(d), { tipo: "fin", mensaje: M.pagado });
    assert.deepEqual(d.llamadas, ["confirmar"]);
  });

  it("una reserva reciente sin orden es de otra pestaña: espera", async () => {
    const base = crearBase({
      estado: "CHECKOUT_SPLIT",
      intento: 1,
      reservadoEn: new Date(AHORA.getTime() - ESPERA_RESERVA_GRUPO_MS / 2).toISOString(),
    });
    const d = deps(base);
    assert.deepEqual(await resolverCheckoutSplitGrupo(d), { tipo: "fin", mensaje: M.abriendo });
    assert.deepEqual(d.llamadas, []);
  });

  it("una reserva vieja sin orden se retoma con el MISMO intento (Mercado Pago devuelve la misma orden)", async () => {
    const base = crearBase({
      estado: "CHECKOUT_SPLIT",
      intento: 3,
      reservadoEn: new Date(AHORA.getTime() - ESPERA_RESERVA_GRUPO_MS * 2).toISOString(),
    });
    const d = deps(base);
    const r = await resolverCheckoutSplitGrupo(d);
    assert.equal(r.tipo, "url");
    assert.ok(d.llamadas.includes(`crear:clf-event-cart-${GRUPO}-3:clf-event-cart-${GRUPO}`));
  });

  it("si otra pestaña cambió el grupo mientras se creaba la orden, la cancela", async () => {
    const base = crearBase();
    const d = deps(base);
    const crearOriginal = d.crearOrden;
    d.crearOrden = async (c, body, key) => {
      const r = await crearOriginal(c, body, key);
      // Otra pestaña liberó y reservó con otro intento.
      for (const f of base.filas) f.snapshot = marcarSnapshotGrupo(f.snapshot, { estado: "COBRANDO", intento: 9 });
      return r;
    };
    assert.deepEqual(await resolverCheckoutSplitGrupo(d), { tipo: "fin", mensaje: M.cambio });
    assert.ok(d.llamadas.includes("cancelar:ORD01NUEVA"));
  });

  it("con el interruptor apagado no abre Mercado Pago y libera una reserva cortada", async () => {
    const base = crearBase({ estado: "CHECKOUT_SPLIT", intento: 1, reservadoEn: "2026-11-01T00:00:00.000Z" });
    const d = deps(base, { planBSplit: false });
    assert.deepEqual(await resolverCheckoutSplitGrupo(d), { tipo: "fin", mensaje: M.no_disponible });
    for (const f of base.filas) assert.equal(leerMarcaGrupo(f.snapshot)!.estado, "PENDIENTE");
  });

  it("si un fotógrafo dejó de estar habilitado, no abre Mercado Pago", async () => {
    const base = crearBase();
    const d = deps(base, { preparar: async () => ({ ok: false, codigo: "CONSENTIMIENTO_NO_ACTIVO" }) });
    const r = await resolverCheckoutSplitGrupo(d);
    assert.equal(r.tipo, "fin");
    assert.deepEqual(d.llamadas, []);
  });
});
