import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePilotoConfig, type PilotoConfig } from "./config";
import { evaluarElegibilidadPiloto, type ElegibilidadInput } from "./elegibilidad";
import { calcularRepartoPiloto } from "./reparto";

describe("configuración del piloto", () => {
  it("queda apagado si la bandera no está", () => {
    assert.equal(resolvePilotoConfig({}).enabled, false);
  });

  it("lee los álbumes de la lista e ignora lo que no es un número", () => {
    const c = resolvePilotoConfig({ DNX_CLF_SPLIT_1N_PILOTO_ALBUM_IDS: " 12, x ,34" });
    assert.deepEqual([...c.albumIds].sort(), [12, 34]);
  });

  it("lee el mapa de receptores e ignora las entradas mal formadas", () => {
    const c = resolvePilotoConfig({ DNX_CLF_SPLIT_1N_PILOTO_RECEIVERS: "35:aaa,bad,53:bbb" });
    assert.equal(c.receiverByUserId.get(35), "aaa");
    assert.equal(c.receiverByUserId.get(53), "bbb");
    assert.equal(c.receiverByUserId.size, 2);
  });
});

const encendido: PilotoConfig = {
  enabled: true,
  albumIds: new Set([12]),
  receiverByUserId: new Map([
    [35, "aaa"],
    [53, "bbb"],
  ]),
  ownerUserId: "97484805",
  accessToken: "APP_USR-x",
  publicKey: "APP_USR-pk",
};

function entrada(cambios: Partial<ElegibilidadInput> = {}): ElegibilidadInput {
  return {
    config: encendido,
    albumId: 12,
    photographerUserId: 35,
    referrerUserId: 53,
    items: [{ productType: "DIGITAL" }],
    tieneVideos: false,
    esCanje: false,
    esPagoSimulado: false,
    origenEstandar: true,
    ...cambios,
  };
}

describe("quién va por el piloto", () => {
  it("nadie, si el piloto está apagado", () => {
    const r = evaluarElegibilidadPiloto(entrada({ config: { ...encendido, enabled: false } }));
    assert.deepEqual(r, { ok: false, motivo: "piloto_apagado" });
  });

  it("no un álbum que no está en la lista", () => {
    assert.deepEqual(evaluarElegibilidadPiloto(entrada({ albumId: 99 })), {
      ok: false,
      motivo: "album_fuera_de_piloto",
    });
  });

  it("no un carrito con impresiones", () => {
    const r = evaluarElegibilidadPiloto(
      entrada({ items: [{ productType: "DIGITAL" }, { productType: "PRINT" }] }),
    );
    assert.deepEqual(r, { ok: false, motivo: "carrito_no_solo_digital" });
  });

  it("no un carrito con videos", () => {
    assert.deepEqual(evaluarElegibilidadPiloto(entrada({ tieneVideos: true })), {
      ok: false,
      motivo: "carrito_no_solo_digital",
    });
  });

  it("no un fotógrafo sin consentimiento", () => {
    assert.deepEqual(evaluarElegibilidadPiloto(entrada({ photographerUserId: 77 })), {
      ok: false,
      motivo: "fotografo_sin_consentimiento",
    });
  });

  it("no si el referidor no tiene consentimiento", () => {
    assert.deepEqual(evaluarElegibilidadPiloto(entrada({ referrerUserId: 88 })), {
      ok: false,
      motivo: "referidor_sin_consentimiento",
    });
  });

  it("sí, con fotógrafo y referidor", () => {
    assert.deepEqual(evaluarElegibilidadPiloto(entrada()), {
      ok: true,
      receivers: { fotografo: "aaa", referidor: "bbb" },
    });
  });

  it("sí, sin referidor", () => {
    assert.deepEqual(evaluarElegibilidadPiloto(entrada({ referrerUserId: null })), {
      ok: true,
      receivers: { fotografo: "aaa", referidor: null },
    });
  });
});

describe("reparto del piloto", () => {
  it("foto de $3.000: el fotógrafo cobra el precio y el 15 % se parte mitad y mitad", () => {
    assert.deepEqual(calcularRepartoPiloto({ totalPesos: 3450, feePesos: 450, hayReferidor: true }), {
      fotografo: 3000,
      referidor: 225,
      plataforma: 225,
    });
  });

  it("el peso impar del fee queda para la plataforma", () => {
    assert.deepEqual(calcularRepartoPiloto({ totalPesos: 3451, feePesos: 451, hayReferidor: true }), {
      fotografo: 3000,
      referidor: 225,
      plataforma: 226,
    });
  });

  it("sin referidor, todo el fee es de la plataforma", () => {
    assert.deepEqual(calcularRepartoPiloto({ totalPesos: 3450, feePesos: 450, hayReferidor: false }), {
      fotografo: 3000,
      referidor: 0,
      plataforma: 450,
    });
  });
});

import { leerMarcaPiloto, marcarSnapshotPiloto } from "./snapshot";

describe("marca del piloto en el pedido", () => {
  it("se agrega sin pisar el resto del snapshot", () => {
    const s = marcarSnapshotPiloto({ marketplaceFeeCents: 450 }, { estado: "PENDIENTE" });
    assert.equal((s as Record<string, unknown>).marketplaceFeeCents, 450);
    assert.deepEqual(leerMarcaPiloto(s), { v: 1, estado: "PENDIENTE" });
  });

  it("se actualiza conservando lo anterior de la marca", () => {
    const a = marcarSnapshotPiloto({}, { estado: "PENDIENTE" });
    const b = marcarSnapshotPiloto(a, { estado: "ACREDITADA", providerOrderId: "ORD01X" });
    assert.deepEqual(leerMarcaPiloto(b), { v: 1, estado: "ACREDITADA", providerOrderId: "ORD01X" });
  });

  it("un pedido sin marca no es del piloto", () => {
    assert.equal(leerMarcaPiloto({ marketplaceFeeCents: 1 }), null);
    assert.equal(leerMarcaPiloto(null), null);
    assert.equal(leerMarcaPiloto("x"), null);
  });
});

import { decidirFinalizacion, pedidoIdDesdeReferencia } from "./decidir";

describe("referencia de la orden de Mercado Pago", () => {
  it("lee el pedido de una referencia del piloto", () => {
    assert.equal(pedidoIdDesdeReferencia("clf-album-order-42"), 42);
  });

  it("ignora referencias de otras superficies", () => {
    assert.equal(pedidoIdDesdeReferencia("clf-cierre-1n-abc"), null);
    assert.equal(pedidoIdDesdeReferencia("clf-album-order-x"), null);
    assert.equal(pedidoIdDesdeReferencia(null), null);
    assert.equal(pedidoIdDesdeReferencia(undefined), null);
  });
});

describe("cuándo se confirma el pedido", () => {
  const base = {
    estadoPedido: "PENDING",
    mpStatus: "processed",
    mpStatusDetail: "accredited",
    refPedidoId: 42,
    pedidoId: 42,
  };

  it("se aplica con la orden acreditada y la referencia del mismo pedido", () => {
    assert.equal(decidirFinalizacion(base), "aplicar");
  });

  it("un pedido FAILED también se recupera", () => {
    assert.equal(decidirFinalizacion({ ...base, estadoPedido: "FAILED" }), "aplicar");
  });

  it("un pedido ya pagado no se vuelve a aplicar aunque llegue otro aviso", () => {
    assert.equal(decidirFinalizacion({ ...base, estadoPedido: "PAID" }), "ya_pagado");
  });

  it("no se aplica si la orden no está acreditada", () => {
    assert.equal(decidirFinalizacion({ ...base, mpStatusDetail: "in_process" }), "no_acreditada");
    assert.equal(decidirFinalizacion({ ...base, mpStatus: "failed", mpStatusDetail: "rejected" }), "no_acreditada");
  });

  it("no se aplica si la orden es de otro pedido", () => {
    assert.equal(decidirFinalizacion({ ...base, refPedidoId: 7 }), "referencia_distinta");
    assert.equal(decidirFinalizacion({ ...base, refPedidoId: null }), "referencia_distinta");
  });
});

import { prepararCobro } from "./cobro";

describe("preparar el cobro", () => {
  const base = {
    estadoPedido: "PENDING",
    marca: { v: 1 as const, estado: "PENDIENTE" as const },
    totalPesos: 3450,
    feePesos: 450,
    receivers: { fotografo: "aaa", referidor: "bbb" as string | null },
    payerEmail: "ariel@ejemplo.com",
    correosReceptores: ["gabriel@ejemplo.com", "belen@ejemplo.com", "plataforma@ejemplo.com"],
  };

  it("no cobra un pedido ya pagado", () => {
    assert.deepEqual(prepararCobro({ ...base, estadoPedido: "PAID" }), { ok: false, codigo: "YA_PAGADO" });
  });

  it("no cobra dos veces un pedido con una orden ya acreditada", () => {
    const r = prepararCobro({
      ...base,
      marca: { v: 1, estado: "ACREDITADA", providerOrderId: "ORD01X" },
    });
    assert.deepEqual(r, { ok: false, codigo: "ORDEN_EN_CURSO" });
  });

  it("no cobra de nuevo un pedido con un pago en revisión", () => {
    const r = prepararCobro({
      ...base,
      marca: { v: 1, estado: "EN_REVISION", providerOrderId: "ORD01Y" },
    });
    assert.deepEqual(r, { ok: false, codigo: "ORDEN_EN_CURSO" });
  });

  it("no cobra si quien paga también recibe parte", () => {
    const r = prepararCobro({ ...base, payerEmail: "Gabriel@Ejemplo.com " });
    assert.deepEqual(r, { ok: false, codigo: "PAGADOR_ES_RECEPTOR" });
  });

  it("arma un reparto fijo que suma el total en centavos", () => {
    const r = prepararCobro(base);
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.reparto, { fotografo: 3000, referidor: 225, plataforma: 225 });
    const montos = r.distribution.entries.map((e) => [e.recipientId, e.amount.amountMinor]);
    assert.deepEqual(
      Object.fromEntries(montos),
      { owner: 22500n, fotografo: 300000n, referidor: 22500n },
    );
    assert.equal(r.partnerReceiverIds.get("referidor"), "bbb");
  });

  it("sin referidor no hay regla de referidor", () => {
    const r = prepararCobro({ ...base, receivers: { fotografo: "aaa", referidor: null } });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.deepEqual(r.distribution.entries.map((e) => e.recipientId).sort(), ["fotografo", "owner"]);
    assert.equal(r.partnerReceiverIds.has("referidor"), false);
  });
});

import { mensajeRechazo } from "./mensajes";

describe("mensaje al comprador cuando se rechaza el pago", () => {
  it("explica la falta de fondos", () => {
    assert.match(mensajeRechazo("insufficient_amount"), /fondos/);
  });

  it("pide revisar los datos si están mal cargados", () => {
    assert.match(mensajeRechazo("bad_filled_security_code"), /revisá/i);
  });

  it("da un mensaje general para cualquier otro rechazo", () => {
    assert.match(mensajeRechazo("rejected_other_reason"), /otra tarjeta/);
    assert.match(mensajeRechazo(null), /otra tarjeta/);
  });
});

import { idOrdenDelAviso } from "./aviso";

describe("aviso de Mercado Pago", () => {
  it("con el piloto encendido, un aviso de orden se consulta", () => {
    assert.equal(idOrdenDelAviso({ enabled: true, type: "order", dataId: "ORD01ABC" }), "ORD01ABC");
  });

  it("con el piloto apagado no se consulta nada", () => {
    assert.equal(idOrdenDelAviso({ enabled: false, type: "order", dataId: "ORD01ABC" }), null);
  });

  it("los avisos de pagos y los que no traen id no son del piloto", () => {
    assert.equal(idOrdenDelAviso({ enabled: true, type: "payment", dataId: "123" }), null);
    assert.equal(idOrdenDelAviso({ enabled: true, type: "order", dataId: "  " }), null);
    assert.equal(idOrdenDelAviso({ enabled: true, type: null, dataId: "ORD01ABC" }), null);
  });
});

import {
  PaymentProviderTemporaryError,
  PaymentProviderValidationError,
} from "@repo/payments";
import { clasificarErrorCobro, claveIntento, siguienteIntento } from "./intento";

describe("correcciones de la revisión: cobro doble", () => {
  it("C1: un pedido con un cobro en curso no se vuelve a cobrar", () => {
    const r = prepararCobro({
      estadoPedido: "PENDING",
      marca: { v: 1, estado: "COBRANDO", intento: 1 },
      totalPesos: 3450,
      feePesos: 450,
      receivers: { fotografo: "aaa", referidor: null },
      payerEmail: "ariel@ejemplo.com",
      correosReceptores: [],
    });
    assert.deepEqual(r, { ok: false, codigo: "ORDEN_EN_CURSO" });
  });

  it("C1: cada intento tiene su propia clave, estable para el mismo intento", () => {
    assert.equal(siguienteIntento({ v: 1, estado: "PENDIENTE" }), 1);
    assert.equal(siguienteIntento({ v: 1, estado: "PENDIENTE", intento: 2 }), 3);
    assert.equal(claveIntento(42, 3), "clf-album-order-42-3");
  });

  it("C2: un rechazo de validación libera el pedido para reintentar", () => {
    assert.equal(clasificarErrorCobro(new PaymentProviderValidationError("rechazada", 402)), "rechazo");
  });

  it("C2: un error temporal o desconocido deja el pedido trabado hasta verificar", () => {
    assert.equal(clasificarErrorCobro(new PaymentProviderTemporaryError("timeout")), "incierto");
    assert.equal(clasificarErrorCobro(new Error("Order not found")), "incierto");
    assert.equal(clasificarErrorCobro("raro"), "incierto");
  });
});

describe("correcciones de la revisión: alcance", () => {
  it("I3: un álbum con organizador no entra en el piloto", () => {
    assert.deepEqual(evaluarElegibilidadPiloto(entrada({ tieneEvento: true })), {
      ok: false,
      motivo: "album_con_organizador",
    });
  });
});

import { ocultarCorreo } from "./mensajes";

describe("M4: la página no muestra el correo entero", () => {
  it("deja las dos primeras letras y el dominio", () => {
    assert.equal(ocultarCorreo("ariel.11@hotmail.com"), "ar•••@hotmail.com");
  });

  it("un correo raro no se muestra", () => {
    assert.equal(ocultarCorreo("sin-arroba"), "tu correo");
  });
});
