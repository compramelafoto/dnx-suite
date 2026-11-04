import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  actorPuedeUsarPagoSimulado,
  albumUsaPagoSimulado,
  evaluarPagoSimuladoGaleria,
  rutaDescargaDelPedido,
} from "@/lib/demos/pago-simulado-galeria";

const duenoDemo = { id: 980, tags: ["DEMO_PRESENTACION"] };
const duenoReal = { id: 55, tags: [] as string[] };
const pedido = { isTest: true, origin: "STANDARD_CHECKOUT", status: "PENDING" };

describe("demos — pago simulado de la galería", () => {
  it("solo los álbumes de usuarios demo usan el pago simulado", () => {
    assert.equal(albumUsaPagoSimulado(duenoDemo), true);
    assert.equal(albumUsaPagoSimulado(duenoReal), false);
    assert.equal(albumUsaPagoSimulado(null), false);
    assert.equal(albumUsaPagoSimulado({ id: null, tags: ["DEMO_PRESENTACION"] }), false);
  });

  it("puede comprar el dueño demo o quien tiene la demo activa; nadie más", () => {
    assert.equal(actorPuedeUsarPagoSimulado(duenoDemo, { userId: 980, demoActiva: false }), true);
    assert.equal(actorPuedeUsarPagoSimulado(duenoDemo, { userId: null, demoActiva: true }), true);
    assert.equal(actorPuedeUsarPagoSimulado(duenoDemo, { userId: 7, demoActiva: false }), false);
    assert.equal(actorPuedeUsarPagoSimulado(duenoDemo, { userId: null, demoActiva: false }), false);
    // Un álbum real nunca, aunque la demo esté activa o compre el dueño.
    assert.equal(actorPuedeUsarPagoSimulado(duenoReal, { userId: 55, demoActiva: true }), false);
  });

  it("aprueba un pedido de prueba pendiente de un álbum demo", () => {
    assert.deepEqual(
      evaluarPagoSimuladoGaleria({ pedido, dueno: duenoDemo, actor: { userId: 980, demoActiva: false } }),
      { ok: true, yaPagado: false },
    );
    assert.deepEqual(
      evaluarPagoSimuladoGaleria({
        pedido: { ...pedido, status: "PAID" },
        dueno: duenoDemo,
        actor: { userId: 980, demoActiva: false },
      }),
      { ok: true, yaPagado: true },
    );
  });

  it("rechaza pedidos reales, de preventa, de álbumes reales o de otros actores", () => {
    const actor = { userId: 980, demoActiva: true };
    const error = (r: ReturnType<typeof evaluarPagoSimuladoGaleria>) => (r.ok ? null : r.error);
    assert.equal(error(evaluarPagoSimuladoGaleria({ pedido: null, dueno: duenoDemo, actor })), "order_not_found");
    assert.equal(
      error(evaluarPagoSimuladoGaleria({ pedido: { ...pedido, isTest: false }, dueno: duenoDemo, actor })),
      "order_not_test",
    );
    assert.equal(
      error(evaluarPagoSimuladoGaleria({ pedido: { ...pedido, origin: "PREVENTA_PACK" }, dueno: duenoDemo, actor })),
      "order_is_preventa",
    );
    assert.equal(error(evaluarPagoSimuladoGaleria({ pedido, dueno: duenoReal, actor })), "album_not_demo");
    assert.equal(
      error(evaluarPagoSimuladoGaleria({ pedido, dueno: duenoDemo, actor: { userId: 3, demoActiva: false } })),
      "actor_not_allowed",
    );
    assert.equal(
      error(evaluarPagoSimuladoGaleria({ pedido: { ...pedido, status: "CANCELED" }, dueno: duenoDemo, actor })),
      "order_not_payable:CANCELED",
    );
  });

  it("la descarga es el centro de descargas del token", () => {
    assert.equal(rutaDescargaDelPedido("abc"), "/descargas/abc");
    assert.equal(rutaDescargaDelPedido(null), null);
  });
});
