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
