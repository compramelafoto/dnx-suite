import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PilotoConfig } from "../split-1n-piloto/config";
import { calcularRepartoPiloto } from "../split-1n-piloto/reparto";
import { leerMarcaPiloto, marcarSnapshotPiloto } from "../split-1n-piloto/snapshot";
import { carritoActivoParaEvento, resolveCarritoConfig, type CarritoConfig } from "./config";
import {
  claveIntentoGrupo,
  grupoIdDesdeReferencia,
  leerMarcaGrupo,
  marcaComoPiloto,
  marcarSnapshotGrupo,
  referenciaGrupo,
} from "./marca";
import { prepararCobroGrupo, type PedidoDelGrupo } from "./cobro-grupo";
import { evaluarElegibilidadGrupo, type AlbumDelCarrito } from "./elegibilidad-grupo";
import { decidirFinalizacionGrupo } from "./decidir-grupo";
import { armarComprobanteGrupo } from "./correo-contenido";
import { separarPedidosDeGrupo } from "./cron";

const GRUPO = "3f2b8c1e-9a4d-4e6b-8f1a-2c3d4e5f6a7b";

describe("configuración del carrito de evento", () => {
  it("queda apagado si la bandera no está", () => {
    const c = resolveCarritoConfig({});
    assert.equal(c.enabled, false);
    assert.equal(c.eventIds.size, 0);
  });

  it("se enciende con TRUE aunque tenga espacios", () => {
    assert.equal(resolveCarritoConfig({ DNX_CLF_SPLIT_1N_CARRITO_EVENTO_ENABLED: " TRUE " }).enabled, true);
    assert.equal(resolveCarritoConfig({ DNX_CLF_SPLIT_1N_CARRITO_EVENTO_ENABLED: "1" }).enabled, false);
  });

  it("lee los eventos de la lista e ignora lo que no es un número", () => {
    const c = resolveCarritoConfig({ DNX_CLF_SPLIT_1N_CARRITO_EVENTO_IDS: " 7, x ,9,-1" });
    assert.deepEqual([...c.eventIds].sort(), [7, 9]);
  });

  it("el tope de receptores es 10 por defecto y se acota entre 2 y 11", () => {
    assert.equal(resolveCarritoConfig({}).maxReceptores, 10);
    assert.equal(resolveCarritoConfig({ DNX_CLF_SPLIT_1N_MAX_RECEPTORES: "50" }).maxReceptores, 11);
    assert.equal(resolveCarritoConfig({ DNX_CLF_SPLIT_1N_MAX_RECEPTORES: "1" }).maxReceptores, 2);
    assert.equal(resolveCarritoConfig({ DNX_CLF_SPLIT_1N_MAX_RECEPTORES: "x" }).maxReceptores, 10);
    assert.equal(resolveCarritoConfig({ DNX_CLF_SPLIT_1N_MAX_RECEPTORES: "6" }).maxReceptores, 6);
  });
});

const piloto: PilotoConfig = {
  enabled: true,
  todosLosAlbumes: false,
  receptoresDesdeClf: false,
  albumIds: new Set(),
  receiverByUserId: new Map([
    [1, "rcv-a"],
    [2, "rcv-b"],
    [3, "rcv-org"],
    [4, "rcv-ref-a"],
    [5, "rcv-ref-org"],
  ]),
  ownerUserId: "97484805",
  accessToken: "APP_USR-x",
  publicKey: "APP_USR-pk",
};
const carrito: CarritoConfig = { enabled: true, eventIds: new Set([7]), maxReceptores: 10 };

describe("cuándo está activo el carrito de un evento", () => {
  it("sólo con la bandera, el piloto encendido y el evento en la lista", () => {
    assert.equal(carritoActivoParaEvento(carrito, piloto, 7), true);
    assert.equal(carritoActivoParaEvento({ ...carrito, enabled: false }, piloto, 7), false);
    assert.equal(carritoActivoParaEvento(carrito, { ...piloto, enabled: false }, 7), false);
    assert.equal(carritoActivoParaEvento(carrito, piloto, 8), false);
    assert.equal(carritoActivoParaEvento(carrito, piloto, null), false);
  });

  it("apagado por defecto: sin variables no está activo para ningún evento", () => {
    assert.equal(carritoActivoParaEvento(resolveCarritoConfig({}), piloto, 7), false);
  });
});

describe("marca de grupo en el pedido", () => {
  it("se agrega sin pisar el resto del snapshot ni la marca del piloto", () => {
    const s = marcarSnapshotGrupo({ x: 1, split1nPiloto: { v: 1, estado: "PENDIENTE" } }, {
      grupoId: GRUPO,
      pedidos: [10, 11],
      estado: "PENDIENTE",
    });
    assert.equal(s.x, 1);
    assert.deepEqual(s.split1nPiloto, { v: 1, estado: "PENDIENTE" });
    assert.equal(leerMarcaGrupo(s)?.grupoId, GRUPO);
  });

  it("se actualiza conservando lo anterior", () => {
    const s1 = marcarSnapshotGrupo({}, { grupoId: GRUPO, pedidos: [10], estado: "PENDIENTE" });
    const s2 = marcarSnapshotGrupo(s1, { estado: "COBRANDO", intento: 1 });
    assert.deepEqual(leerMarcaGrupo(s2), { v: 1, grupoId: GRUPO, pedidos: [10], estado: "COBRANDO", intento: 1 });
  });

  it("un pedido de grupo no es del piloto: /pagar/[orderId] no lo cobra suelto", () => {
    const s = marcarSnapshotGrupo({}, { grupoId: GRUPO, pedidos: [10], estado: "PENDIENTE" });
    assert.equal(leerMarcaPiloto(s), null);
  });

  it("un pedido del piloto no es de grupo", () => {
    assert.equal(leerMarcaGrupo(marcarSnapshotPiloto({}, { estado: "PENDIENTE" })), null);
    assert.equal(leerMarcaGrupo(null), null);
  });

  it("pasa a la forma del piloto para registrar comisiones", () => {
    const reparto = { fotografo: 7200, referidor: 0, organizador: 1800, referidorOrganizador: 0, plataforma: 1350 };
    const m = marcaComoPiloto({
      v: 1,
      grupoId: GRUPO,
      pedidos: [10],
      estado: "PAGADO",
      providerOrderId: "ORD1",
      cobro: { referidorUserId: null, organizadorUserId: 3, referidorOrganizadorUserId: null, reparto },
    });
    assert.equal(m.organizadorUserId, 3);
    assert.equal(m.reparto?.organizador, 1800);
    assert.equal(m.estado, "PAGADO");
  });
});

describe("referencia de la orden de grupo", () => {
  it("ida y vuelta", () => {
    assert.equal(referenciaGrupo(GRUPO), `clf-event-cart-${GRUPO}`);
    assert.equal(grupoIdDesdeReferencia(referenciaGrupo(GRUPO)), GRUPO);
  });

  it("ignora la referencia del piloto y basura", () => {
    assert.equal(grupoIdDesdeReferencia("clf-album-order-12"), null);
    assert.equal(grupoIdDesdeReferencia("clf-event-cart-nada"), null);
    assert.equal(grupoIdDesdeReferencia(null), null);
  });

  it("cada intento tiene su clave", () => {
    assert.equal(claveIntentoGrupo(GRUPO, 2), `clf-event-cart-${GRUPO}-2`);
  });
});

// Ejemplo del diseño: fotos de $3.000, recargo 15 %, organizador 20 %.
// 3 fotos de A: total 10.350, recargo 1.350, base 9.000. 2 de B: 6.900, 900, 6.000.
function pedido(cambios: Partial<PedidoDelGrupo> & { pedidoId: number }): PedidoDelGrupo {
  return {
    estadoPedido: "PENDING",
    totalPesos: 10350,
    feePesos: 1350,
    basePesos: 9000,
    porcentajeOrganizador: 20,
    receivers: { fotografo: "rcv-a", referidor: null, organizador: "rcv-org", referidorOrganizador: null },
    ...cambios,
  };
}
const pedidoA = pedido({ pedidoId: 10 });
const pedidoB = pedido({
  pedidoId: 11,
  totalPesos: 6900,
  feePesos: 900,
  basePesos: 6000,
  receivers: { fotografo: "rcv-b", referidor: null, organizador: "rcv-org", referidorOrganizador: null },
});

function montos(r: Extract<ReturnType<typeof prepararCobroGrupo>, { ok: true }>) {
  const porReceptor = new Map<string, bigint>();
  for (const line of r.distribution.entries) {
    const receptor = line.recipientId === "owner" ? "owner" : r.partnerReceiverIds.get(line.recipientId)!;
    porReceptor.set(receptor, line.amount.amountMinor);
  }
  return porReceptor;
}

const base = { estadoGrupo: "PENDIENTE" as const, payerEmail: "cliente@x.com", correosReceptores: [], maxReceptores: 10 };

describe("cobro de grupo", () => {
  it("ejemplo del diseño: A 7.200, B 4.800, organizador 3.000, plataforma 2.250, total 17.250", () => {
    const r = prepararCobroGrupo({ ...base, pedidos: [pedidoA, pedidoB] });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.total.amountMinor, 1725000n);
    const m = montos(r);
    assert.equal(m.get("rcv-a"), 720000n);
    assert.equal(m.get("rcv-b"), 480000n);
    assert.equal(m.get("rcv-org"), 300000n);
    assert.equal(m.get("owner"), 225000n);
    assert.equal(r.distribution.entries.length, 4, "el organizador va una sola vez");
    assert.equal(r.receptores, 4);
    const suma = r.distribution.entries.reduce((acc, l) => acc + l.amount.amountMinor, 0n);
    assert.equal(suma, r.total.amountMinor);
  });

  it("el reparto de cada pedido es el del piloto", () => {
    const r = prepararCobroGrupo({ ...base, pedidos: [pedidoA, pedidoB] });
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.deepEqual(
      r.repartos.get(10),
      calcularRepartoPiloto({ totalPesos: 10350, feePesos: 1350, basePesos: 9000, hayReferidor: false, porcentajeOrganizador: 20 }),
    );
    assert.equal(r.repartos.get(11)?.organizador, 1200);
  });

  it("un fotógrafo con dos álbumes cobra la suma en una sola regla", () => {
    const otroDeA = { ...pedidoB, receivers: { ...pedidoB.receivers, fotografo: "rcv-a" } };
    const r = prepararCobroGrupo({ ...base, pedidos: [pedidoA, otroDeA] });
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.equal(montos(r).get("rcv-a"), 1200000n);
    assert.equal(r.distribution.entries.length, 3);
  });

  it("con referidores de A y del organizador, cada monto coincide con la contabilidad pedido por pedido", () => {
    const a = { ...pedidoA, receivers: { ...pedidoA.receivers, referidor: "rcv-ref-a", referidorOrganizador: "rcv-ref-org" } };
    const b = { ...pedidoB, receivers: { ...pedidoB.receivers, referidorOrganizador: "rcv-ref-org" } };
    const r = prepararCobroGrupo({ ...base, pedidos: [a, b] });
    assert.ok(r.ok);
    if (!r.ok) return;
    const ra = r.repartos.get(10)!;
    const rb = r.repartos.get(11)!;
    const m = montos(r);
    assert.equal(m.get("rcv-ref-a"), BigInt(ra.referidor * 100));
    assert.equal(m.get("rcv-ref-org"), BigInt((ra.referidorOrganizador + rb.referidorOrganizador) * 100));
    assert.equal(m.get("owner"), BigInt((ra.plataforma + rb.plataforma) * 100));
    assert.equal(r.receptores, 6);
  });

  it("una misma cuenta en dos roles (organizador y referidor de B) va una sola vez con la suma", () => {
    const b = { ...pedidoB, receivers: { ...pedidoB.receivers, referidor: "rcv-org" } };
    const r = prepararCobroGrupo({ ...base, pedidos: [pedidoA, b] });
    assert.ok(r.ok);
    if (!r.ok) return;
    const rb = r.repartos.get(11)!;
    assert.equal(montos(r).get("rcv-org"), BigInt((1800 + rb.organizador + rb.referidor) * 100));
    assert.equal(r.distribution.entries.length, 4);
  });

  it("rechaza si se pasa del tope de receptores", () => {
    const r = prepararCobroGrupo({ ...base, maxReceptores: 3, pedidos: [pedidoA, pedidoB] });
    assert.deepEqual(r, { ok: false, codigo: "DEMASIADOS_RECEPTORES" });
  });

  it("no cobra un grupo vacío", () => {
    assert.deepEqual(prepararCobroGrupo({ ...base, pedidos: [] }), { ok: false, codigo: "GRUPO_VACIO" });
  });

  it("no cobra si algún pedido ya está pagado", () => {
    const r = prepararCobroGrupo({ ...base, pedidos: [pedidoA, { ...pedidoB, estadoPedido: "PAID" }] });
    assert.deepEqual(r, { ok: false, codigo: "YA_PAGADO" });
  });

  it("no cobra dos veces un grupo con un cobro en curso", () => {
    for (const estadoGrupo of ["COBRANDO", "EN_REVISION", "ACREDITADA", "PAGADO"] as const) {
      const r = prepararCobroGrupo({ ...base, estadoGrupo, pedidos: [pedidoA, pedidoB] });
      assert.deepEqual(r, { ok: false, codigo: "ORDEN_EN_CURSO" });
    }
  });

  it("no cobra si quien paga también recibe parte", () => {
    const r = prepararCobroGrupo({ ...base, correosReceptores: ["Cliente@x.com"], pedidos: [pedidoA, pedidoB] });
    assert.deepEqual(r, { ok: false, codigo: "PAGADOR_ES_RECEPTOR" });
  });
});

function album(cambios: Partial<AlbumDelCarrito> & { albumId: number }): AlbumDelCarrito {
  return {
    eventId: 7,
    photographerUserId: 1,
    referrerUserId: null,
    organizador: { userId: 3, porcentaje: 20, comisionActiva: true, referrerUserId: null },
    esEscolar: false,
    items: [{ productType: "DIGITAL" }],
    tieneVideos: false,
    esCanje: false,
    esPagoSimulado: false,
    origenEstandar: true,
    autoresDeFotos: [1],
    ...cambios,
  };
}
const albumA = album({ albumId: 100 });
const albumB = album({ albumId: 200, photographerUserId: 2, autoresDeFotos: [2, null] });

describe("quién va por el carrito de grupo (todo o nada)", () => {
  it("dos álbumes elegibles, sin estar en la lista de álbumes del piloto", () => {
    const r = evaluarElegibilidadGrupo({ piloto, carrito, eventId: 7, albumes: [albumA, albumB] });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.receivers.get(100)?.fotografo, "rcv-a");
    assert.equal(r.receivers.get(200)?.fotografo, "rcv-b");
    assert.equal(r.receivers.get(200)?.organizador, "rcv-org");
    assert.equal(r.receptores, 4);
  });

  it("carrito apagado: nadie", () => {
    const r = evaluarElegibilidadGrupo({ piloto, carrito: { ...carrito, enabled: false }, eventId: 7, albumes: [albumA] });
    assert.deepEqual(r, { ok: false, motivos: [{ albumId: null, motivo: "carrito_apagado" }] });
  });

  it("piloto apagado: nadie", () => {
    const r = evaluarElegibilidadGrupo({ piloto: { ...piloto, enabled: false }, carrito, eventId: 7, albumes: [albumA] });
    assert.equal(r.ok, false);
  });

  it("carrito vacío", () => {
    const r = evaluarElegibilidadGrupo({ piloto, carrito, eventId: 7, albumes: [] });
    assert.deepEqual(r, { ok: false, motivos: [{ albumId: null, motivo: "carrito_vacio" }] });
  });

  it("un fotógrafo sin consentimiento hace caer a todo el grupo y dice cuál", () => {
    const sinConsentimiento = album({ albumId: 300, photographerUserId: 99, autoresDeFotos: [99] });
    const r = evaluarElegibilidadGrupo({ piloto, carrito, eventId: 7, albumes: [albumA, sinConsentimiento] });
    assert.deepEqual(r, { ok: false, motivos: [{ albumId: 300, motivo: "fotografo_sin_consentimiento" }] });
  });

  it("un álbum de otro evento no entra", () => {
    const r = evaluarElegibilidadGrupo({ piloto, carrito, eventId: 7, albumes: [albumA, { ...albumB, eventId: 8 }] });
    assert.deepEqual(r, { ok: false, motivos: [{ albumId: 200, motivo: "album_de_otro_evento" }] });
  });

  it("una foto de otro autor no entra: nadie cobra fotos de otro", () => {
    const r = evaluarElegibilidadGrupo({ piloto, carrito, eventId: 7, albumes: [{ ...albumA, autoresDeFotos: [1, 2] }] });
    assert.deepEqual(r, { ok: false, motivos: [{ albumId: 100, motivo: "album_con_varios_autores" }] });
  });

  it("un álbum escolar no entra", () => {
    const r = evaluarElegibilidadGrupo({ piloto, carrito, eventId: 7, albumes: [albumA, { ...albumB, esEscolar: true }] });
    assert.deepEqual(r, { ok: false, motivos: [{ albumId: 200, motivo: "album_escolar" }] });
  });

  it("con impresiones no entra", () => {
    const r = evaluarElegibilidadGrupo({
      piloto,
      carrito,
      eventId: 7,
      albumes: [{ ...albumA, items: [{ productType: "PRINT" }] }],
    });
    assert.deepEqual(r, { ok: false, motivos: [{ albumId: 100, motivo: "carrito_no_solo_digital" }] });
  });

  it("se pasa del tope de receptores", () => {
    const r = evaluarElegibilidadGrupo({ piloto, carrito: { ...carrito, maxReceptores: 3 }, eventId: 7, albumes: [albumA, albumB] });
    assert.deepEqual(r, { ok: false, motivos: [{ albumId: null, motivo: "demasiados_receptores" }] });
  });
});

describe("confirmación del grupo", () => {
  const pedidos = [
    { id: 10, status: "PENDING" },
    { id: 11, status: "PAID" },
    { id: 12, status: "FAILED" },
  ];
  const ok = { grupoId: GRUPO, refGrupoId: GRUPO, mpStatus: "processed", mpStatusDetail: "accredited", pedidos };

  it("confirma sólo los pedidos que faltan: idempotente por pedido", () => {
    assert.deepEqual(decidirFinalizacionGrupo(ok), { accion: "confirmar", aConfirmar: [10, 12], yaPagados: [11] });
  });

  it("con todo pagado no hay nada que confirmar", () => {
    const r = decidirFinalizacionGrupo({ ...ok, pedidos: pedidos.map((p) => ({ ...p, status: "PAID" })) });
    assert.deepEqual(r, { accion: "confirmar", aConfirmar: [], yaPagados: [10, 11, 12] });
  });

  it("no confirma una orden no acreditada", () => {
    assert.equal(decidirFinalizacionGrupo({ ...ok, mpStatusDetail: "pending_review_manual" }).accion, "no_acreditada");
    assert.equal(decidirFinalizacionGrupo({ ...ok, mpStatus: "failed" }).accion, "no_acreditada");
  });

  it("no confirma con la orden de otro grupo", () => {
    assert.equal(decidirFinalizacionGrupo({ ...ok, refGrupoId: "otro" }).accion, "referencia_distinta");
    assert.equal(decidirFinalizacionGrupo({ ...ok, refGrupoId: null }).accion, "referencia_distinta");
  });

  it("un pedido cancelado del grupo no se confirma ni se cuenta como pagado", () => {
    const r = decidirFinalizacionGrupo({ ...ok, pedidos: [{ id: 10, status: "PENDING" }, { id: 13, status: "CANCELED" }] });
    assert.deepEqual(r, { accion: "confirmar", aConfirmar: [10], yaPagados: [] });
  });
});

describe("comprobante único del grupo", () => {
  const contenido = armarComprobanteGrupo({
    buyerEmail: "ana@x.com",
    totalPesos: 17250,
    descargasUrl: "https://www.compramelafoto.com/pagar/grupo/abc",
    eventoTitulo: "Club 9 de Julio",
    pedidos: [
      { pedidoId: 10, fotografo: "Fotógrafa A", fotos: 3, totalPesos: 10350 },
      { pedidoId: 11, fotografo: "Fotógrafo B", fotos: 2, totalPesos: 6900 },
    ],
  });

  it("nombra a cada fotógrafo, el total y un solo enlace a las descargas", () => {
    for (const texto of [contenido.text, contenido.html]) {
      assert.match(texto, /Fotógrafa A/);
      assert.match(texto, /Fotógrafo B/);
      assert.match(texto, /17\.250/);
      assert.match(texto, /pagar\/grupo\/abc/);
      assert.doesNotMatch(texto, /plata/i);
    }
    assert.match(contenido.subject, /Club 9 de Julio/);
  });

  it("escapa los nombres en el HTML", () => {
    const c = armarComprobanteGrupo({
      buyerEmail: "ana@x.com",
      totalPesos: 100,
      descargasUrl: "https://x/y",
      eventoTitulo: "<b>x</b>",
      pedidos: [{ pedidoId: 1, fotografo: "<script>", fotos: 1, totalPesos: 100 }],
    });
    assert.doesNotMatch(c.html, /<script>/);
  });
});

describe("red de seguridad de comprobantes", () => {
  it("los pedidos de un grupo no reciben el comprobante por pedido: se asegura el del grupo", () => {
    const r = separarPedidosDeGrupo([
      { id: 1, pricingSnapshot: {} },
      { id: 2, pricingSnapshot: marcarSnapshotGrupo({}, { grupoId: GRUPO, pedidos: [2, 3], estado: "PAGADO" }) },
      { id: 3, pricingSnapshot: marcarSnapshotGrupo({}, { grupoId: GRUPO, pedidos: [2, 3], estado: "PAGADO" }) },
      { id: 4, pricingSnapshot: null },
    ]);
    assert.deepEqual(r.sueltos, [1, 4]);
    assert.deepEqual(r.grupos, [GRUPO]);
  });
});
