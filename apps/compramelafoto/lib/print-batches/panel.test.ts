import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AVISO_A_CLIENTES,
  accionesDelLote,
  agruparParaImprimir,
  columnaDelLote,
  conteoDelPanel,
  pasoDeLaEntrada,
  pasoInicialDelPanel,
  PASOS_DEL_PANEL,
  type DatosDelPanel,
  confirmacionAlMover,
  fechaDelPanel,
  laboratorioDeLaSeleccion,
  laboratorioParaEnviar,
  leerFechaPrometida,
  textoDeCopiasDelPanel,
  textoDeImpresion,
  pedidosListosParaEntregar,
  confirmacionDeEntrega,
  NOTA_PARA_IMPRIMIR,
  agruparEnElLaboratorio,
  confirmacionAlSacar,
  avisaAlLabAlSacar,
  sePuedeSacar,
  esImpresoPorFuera,
  faseDelLote,
  fechaYHoraDelPanel,
  seguimientoDelLote,
  textoDeLaFase,
  type LoteDelPanel,
  type EntradaDelPanel,
  type LaboratorioDelPanel,
  type PedidoDelPanel,
} from "./panel";
import type { EstadoLote } from "./reglas";

const pedido = (id: number, extra: Partial<PedidoDelPanel> = {}): PedidoDelPanel => ({
  albumOrderId: id, cliente: `Cliente ${id}`, album: "Álbum", copias: [{ medida: "13x18", acabado: "BRILLO", cantidad: 2 }],
  totalCopias: 2, retiraCliente: false, pickupLabContactId: null, pagadoAt: "2026-11-20T15:00:00.000Z", motivo: null, ...extra,
});
const entrada = (id: number, extra: Partial<EntradaDelPanel> = {}): EntradaDelPanel => ({
  id, albumOrderId: id, cliente: "C", album: "A", copias: [], totalCopias: 1, retiraCliente: false,
  pickupLabContactId: null, estadoPedido: "CREATED", entregadoAt: null, codigoQr: null, ...extra,
});
const labs: LaboratorioDelPanel[] = [
  { id: 7, nombre: "Procolor", esPredeterminado: false, puntoDeRetiro: true },
  { id: 3, nombre: "Kodak Centro", esPredeterminado: true, puntoDeRetiro: true },
];

test("columnaDelLote: cada estado en su columna y el anulado en ninguna", () => {
  assert.equal(columnaDelLote("ARMADO"), "PARA_IMPRIMIR");
  for (const e of ["ENVIADO", "EN_PRODUCCION", "LISTO", "DESPACHADO"] as const) assert.equal(columnaDelLote(e), "EN_LABORATORIO");
  assert.equal(columnaDelLote("RECIBIDO"), "LISTOS");
  assert.equal(columnaDelLote("CERRADO"), "ENTREGADOS");
  assert.equal(columnaDelLote("ANULADO"), null);
});

test("agruparParaImprimir: sin retiro primero, después por laboratorio en el orden de la agenda", () => {
  const grupos = agruparParaImprimir(
    [pedido(1, { pickupLabContactId: 3 }), pedido(2), pedido(3, { pickupLabContactId: 7 }), pedido(4, { pickupLabContactId: 3 })],
    labs,
  );
  assert.deepEqual(grupos.map((g) => g.labContactId), [null, 7, 3]);
  assert.deepEqual(grupos.map((g) => g.titulo), ["Sin retiro en laboratorio", "Retiran en Procolor", "Retiran en Kodak Centro"]);
  assert.deepEqual(grupos[2]!.pedidos.map((p) => p.albumOrderId), [1, 4]);
});

test("agruparParaImprimir: los que no entran van al final de su grupo; laboratorio desconocido al final", () => {
  const grupos = agruparParaImprimir(
    [pedido(1, { motivo: "No tiene copias sueltas para imprimir." }), pedido(2), pedido(5, { pickupLabContactId: 99 })],
    labs,
  );
  assert.deepEqual(grupos[0]!.pedidos.map((p) => p.albumOrderId), [2, 1]);
  assert.equal(grupos[1]!.titulo, "Retiran en otro laboratorio");
  assert.deepEqual(agruparParaImprimir([], labs), []);
});

test("laboratorioDeLaSeleccion: un laboratorio, ninguno o mezcla", () => {
  assert.deepEqual(laboratorioDeLaSeleccion([pedido(1), pedido(2)].map((p) => p)), { ok: true, labContactId: null });
  assert.deepEqual(laboratorioDeLaSeleccion([pedido(1), pedido(2, { pickupLabContactId: 7 })]), { ok: true, labContactId: 7 });
  const mezcla = laboratorioDeLaSeleccion([pedido(1, { pickupLabContactId: 3 }), pedido(2, { pickupLabContactId: 7 })]);
  assert.equal(mezcla.ok, false);
});

test("accionesDelLote: armado se envía, se deshace y se sacan pedidos", () => {
  const a = accionesDelLote({ estado: "ARMADO", entregaPreferida: "RETIRA_FOTOGRAFO", pagadoAlLabAt: null });
  assert.equal(a.enviar, true);
  assert.equal(a.deshacer, true);
  assert.deepEqual(a.mover, []);
  assert.equal(a.pagadoAlLab, false);
  assert.equal(a.quitar, "SACAR");
});

test("accionesDelLote: enviado puede ir hacia adelante; despachado sólo si envía el laboratorio", () => {
  const retira = accionesDelLote({ estado: "ENVIADO", entregaPreferida: "RETIRA_FOTOGRAFO", pagadoAlLabAt: null });
  assert.deepEqual(retira.mover.map((m) => m.hacia), ["EN_PRODUCCION", "LISTO", "RECIBIDO"]);
  assert.equal(retira.mover[0]!.principal, true);
  assert.equal(retira.quitar, "SACAR");
  assert.equal(retira.pagadoAlLab, true);
  const envia = accionesDelLote({ estado: "ENVIADO", entregaPreferida: "ENVIA_LAB", pagadoAlLabAt: null });
  assert.deepEqual(envia.mover.map((m) => m.hacia), ["EN_PRODUCCION", "LISTO", "DESPACHADO", "RECIBIDO"]);
});

test("accionesDelLote: listo o despachado tienen «Recibí el lote» como principal", () => {
  for (const estado of ["LISTO", "DESPACHADO"] as const) {
    const a = accionesDelLote({ estado, entregaPreferida: "ENVIA_LAB", pagadoAlLabAt: null });
    const principal = a.mover.filter((m) => m.principal);
    assert.deepEqual(principal.map((m) => [m.hacia, m.texto]), [["RECIBIDO", "Recibí el lote"]]);
  }
});

test("accionesDelLote: recibido no se mueve más a mano; cerrado sólo se marca pagado; pagado no se repite", () => {
  const recibido = accionesDelLote({ estado: "RECIBIDO", entregaPreferida: "RETIRA_FOTOGRAFO", pagadoAlLabAt: null });
  assert.deepEqual(recibido.mover, []);
  const cerrado = accionesDelLote({ estado: "CERRADO", entregaPreferida: "RETIRA_FOTOGRAFO", pagadoAlLabAt: null });
  assert.deepEqual([cerrado.pagadoAlLab, cerrado.quitar, cerrado.mover.length], [true, null, 0]);
  const pagado = accionesDelLote({ estado: "LISTO", entregaPreferida: "RETIRA_FOTOGRAFO", pagadoAlLabAt: "2026-11-20T10:00:00.000Z" });
  assert.equal(pagado.pagadoAlLab, false);
});

test("confirmacionAlMover: avisa sólo si algún pedido pasa a «Listo para retirar»", () => {
  const retiraFotografo = { estado: "EN_PRODUCCION" as const, entradas: [entrada(1)] };
  assert.equal(confirmacionAlMover(retiraFotografo, "LISTO"), null);
  assert.equal(confirmacionAlMover(retiraFotografo, "RECIBIDO"), AVISO_A_CLIENTES);
  const retiraCliente = { estado: "EN_PRODUCCION" as const, entradas: [entrada(1, { retiraCliente: true })] };
  assert.equal(confirmacionAlMover(retiraCliente, "LISTO"), AVISO_A_CLIENTES);
  const yaAvisado = { estado: "LISTO" as const, entradas: [entrada(1, { retiraCliente: true, estadoPedido: "READY_TO_PICKUP" })] };
  assert.equal(confirmacionAlMover(yaAvisado, "RECIBIDO"), null);
  const entregado = { estado: "LISTO" as const, entradas: [entrada(1, { entregadoAt: "2026-11-20T10:00:00.000Z", estadoPedido: "DELIVERED" })] };
  assert.equal(confirmacionAlMover(entregado, "RECIBIDO"), null);
  assert.equal(confirmacionAlMover({ estado: "ENVIADO", entradas: [entrada(1)] }, "EN_PRODUCCION"), null);
});

test("laboratorioParaEnviar: retiro fijo bloquea; si no, el del lote o el predeterminado", () => {
  assert.deepEqual(laboratorioParaEnviar({ labContactId: null, entradas: [entrada(1), entrada(2, { pickupLabContactId: 7 })] }, labs), { elegido: 7, bloqueado: true });
  assert.deepEqual(laboratorioParaEnviar({ labContactId: 7, entradas: [entrada(1)] }, labs), { elegido: 7, bloqueado: false });
  assert.deepEqual(laboratorioParaEnviar({ labContactId: null, entradas: [entrada(1)] }, labs), { elegido: 3, bloqueado: false });
  assert.deepEqual(laboratorioParaEnviar({ labContactId: 55, entradas: [entrada(1)] }, labs), { elegido: 3, bloqueado: false });
  assert.deepEqual(laboratorioParaEnviar({ labContactId: null, entradas: [] }, []), { elegido: null, bloqueado: false });
});

test("textoDeImpresion: estado del pedido y nombre del lote", () => {
  assert.equal(textoDeImpresion({ loteEstado: "ARMADO", loteNombre: "Lote 3", estadoPedido: "CREATED", entregado: false }), "En lote, sin enviar · Lote 3");
  assert.equal(textoDeImpresion({ loteEstado: "ENVIADO", loteNombre: "Lote 3", estadoPedido: "CREATED", entregado: false }), "Enviado al laboratorio · Lote 3");
  assert.equal(textoDeImpresion({ loteEstado: "LISTO", loteNombre: "Lote 3", estadoPedido: "READY_TO_PICKUP", entregado: false }), "Listo para retirar · Lote 3");
  assert.equal(textoDeImpresion({ loteEstado: "CERRADO", loteNombre: "Lote 3", estadoPedido: "DELIVERED", entregado: true }), "Entregado · Lote 3");
  // Un solo nombre por estado en todo el módulo (el mismo que el sobre).
  assert.equal(textoDeImpresion({ loteEstado: "EN_PRODUCCION", loteNombre: "Lote 3", estadoPedido: "IN_PRODUCTION", entregado: false }), "En el laboratorio · Lote 3");
});

test("fechaDelPanel, copias y fecha prometida", () => {
  assert.equal(fechaDelPanel("2026-11-25T00:00:00.000Z"), "25/11");
  assert.equal(fechaDelPanel("2026-11-21T01:30:00.000Z"), "20/11");
  assert.equal(fechaDelPanel(null), "");
  assert.equal(textoDeCopiasDelPanel([{ medida: "13x18", acabado: "BRILLO", cantidad: 3 }, { medida: "10x15", acabado: "", cantidad: 1 }]), "3× 13x18 BRILLO · 1× 10x15");
  assert.equal(leerFechaPrometida(""), null);
  assert.equal(leerFechaPrometida(undefined), null);
  assert.equal((leerFechaPrometida("2026-11-25") as Date).toISOString(), "2026-11-25T00:00:00.000Z");
  assert.equal(leerFechaPrometida("2026-02-30"), "invalida");
  assert.equal(leerFechaPrometida("25/11/2026"), "invalida");
});

const lote = (id: number, estado: LoteDelPanel["estado"], entradas: EntradaDelPanel[]): LoteDelPanel => ({
  id, nombre: `Lote ${id}`, estado, entregaPreferida: "RETIRA_FOTOGRAFO", labContactId: null, laboratorio: null, mensajeAlLab: null,
  fechaPrometida: null, createdAt: "2026-11-20T15:00:00.000Z", enviadoAt: null, labAbrioAt: null, labDescargoAt: null,
  listoAt: null, recibidoAt: null, cerradoAt: null, pagadoAlLabAt: null, porFuera: false, entradas,
});

test("pedidosListosParaEntregar: cada pedido «Listo para retirar» sin entregar, retire quien retire", () => {
  const lotes = [
    lote(1, "LISTO", [
      entrada(10, { retiraCliente: true, estadoPedido: "READY_TO_PICKUP" }),
      entrada(11, { retiraCliente: false, estadoPedido: "READY" }),
    ]),
    lote(2, "RECIBIDO", [
      entrada(20, { retiraCliente: false, estadoPedido: "READY_TO_PICKUP" }),
      entrada(21, { retiraCliente: true, estadoPedido: "DELIVERED", entregadoAt: "2026-11-21T10:00:00.000Z" }),
    ]),
    lote(3, "CERRADO", [entrada(30, { estadoPedido: "READY_TO_PICKUP" })]),
    lote(4, "ARMADO", [entrada(40, { estadoPedido: "READY_TO_PICKUP" })]),
  ];
  const listos = pedidosListosParaEntregar(lotes);
  assert.deepEqual(listos.map((p) => [p.lote.id, p.entrada.id]), [[1, 10], [2, 20]]);
  assert.equal(listos[0]!.lote.nombre, "Lote 1");
});

test("confirmacionDeEntrega y nota de «Para imprimir»", () => {
  assert.equal(confirmacionDeEntrega(3871), "¿Marcar entregado el pedido #3871?");
  assert.equal(confirmacionDeEntrega(null), "¿Marcar entregado este pedido?");
  assert.equal(NOTA_PARA_IMPRIMIR, "Se muestran los pedidos pagados de los últimos 60 días.");
});

function loteDePrueba(estado: EstadoLote, entradas: Array<Partial<EntradaDelPanel>>): LoteDelPanel {
  return {
    id: 1, nombre: "Lote 1 · 21/11", estado, entregaPreferida: "RETIRA_FOTOGRAFO", labContactId: null, laboratorio: null,
    mensajeAlLab: null, fechaPrometida: null, createdAt: "2026-11-21T12:00:00.000Z", enviadoAt: null, labAbrioAt: null,
    labDescargoAt: null, listoAt: null, recibidoAt: null, cerradoAt: null, pagadoAlLabAt: null, porFuera: false,
    entradas: entradas.map((e, i) => ({
      id: i + 1, albumOrderId: 100 + i, cliente: "Ana", album: "XV", copias: [], totalCopias: 1, retiraCliente: false,
      pickupLabContactId: null, estadoPedido: null, entregadoAt: null, codigoQr: null, ...e,
    })),
  };
}

test("pasoDeLaEntrada: cada pedido de un lote cae en un solo paso", () => {
  assert.equal(pasoDeLaEntrada(loteDePrueba("ARMADO", [{}]), loteDePrueba("ARMADO", [{}]).entradas[0]), "PARA_IMPRIMIR");
  const enLab = loteDePrueba("EN_PRODUCCION", [{ estadoPedido: "IN_PRODUCTION" }]);
  assert.equal(pasoDeLaEntrada(enLab, enLab.entradas[0]), "EN_LABORATORIO");
  const listo = loteDePrueba("LISTO", [{ estadoPedido: "READY_TO_PICKUP", retiraCliente: true }]);
  assert.equal(pasoDeLaEntrada(listo, listo.entradas[0]), "LISTOS");
  // Entregado en un lote que sigue abierto: no queda nada por hacer, no cuenta en ningún paso.
  const entregado = loteDePrueba("RECIBIDO", [{ estadoPedido: "DELIVERED", entregadoAt: "2026-11-21T15:00:00.000Z" }]);
  assert.equal(pasoDeLaEntrada(entregado, entregado.entradas[0]), null);
  const porLaRutaVieja = loteDePrueba("RECIBIDO", [{ estadoPedido: "RETIRED" }]);
  assert.equal(pasoDeLaEntrada(porLaRutaVieja, porLaRutaVieja.entradas[0]), null);
  // Un lote recibido se ve en «Listos»: sus pedidos pendientes cuentan ahí, no en «En el laboratorio».
  const recibido = loteDePrueba("RECIBIDO", [{ estadoPedido: "READY" }]);
  assert.equal(pasoDeLaEntrada(recibido, recibido.entradas[0]), "LISTOS");
  const anulado = loteDePrueba("ANULADO", [{}]);
  assert.equal(pasoDeLaEntrada(anulado, anulado.entradas[0]), null);
  const cerrado = loteDePrueba("CERRADO", [{ estadoPedido: "DELIVERED" }]);
  assert.equal(pasoDeLaEntrada(cerrado, cerrado.entradas[0]), "ENTREGADOS");
});

test("conteoDelPanel: cuenta pedidos por paso, sin contar dos veces el mismo", () => {
  const datos: DatosDelPanel = {
    paraImprimir: [
      { albumOrderId: 1, cliente: "A", album: "X", copias: [], totalCopias: 1, retiraCliente: false, pickupLabContactId: null, pagadoAt: "2026-11-20T12:00:00.000Z", motivo: null },
      { albumOrderId: 2, cliente: "B", album: "X", copias: [], totalCopias: 1, retiraCliente: false, pickupLabContactId: null, pagadoAt: "2026-11-20T12:00:00.000Z", motivo: "El álbum venció: las fotos ya no están." },
    ],
    lotes: [
      loteDePrueba("ARMADO", [{}]),
      // Un lote en el laboratorio con un pedido ya listo para retirar: ese pedido cuenta sólo en «Listos».
      loteDePrueba("LISTO", [{ estadoPedido: "READY_TO_PICKUP", retiraCliente: true }, { estadoPedido: "READY" }]),
      loteDePrueba("CERRADO", [{ estadoPedido: "DELIVERED" }, { estadoPedido: "DELIVERED" }]),
    ],
    laboratorios: [],
  };
  assert.deepEqual(conteoDelPanel(datos), { PARA_IMPRIMIR: 2, EN_LABORATORIO: 1, LISTOS: 1, ENTREGADOS: 2 });
});

test("pasoInicialDelPanel: el primer paso con pedidos, sin abrir en «Entregados»", () => {
  assert.equal(pasoInicialDelPanel({ PARA_IMPRIMIR: 0, EN_LABORATORIO: 3, LISTOS: 1, ENTREGADOS: 9 }), "EN_LABORATORIO");
  assert.equal(pasoInicialDelPanel({ PARA_IMPRIMIR: 0, EN_LABORATORIO: 0, LISTOS: 0, ENTREGADOS: 9 }), "PARA_IMPRIMIR");
});

test("PASOS_DEL_PANEL: cuatro pasos numerados en orden", () => {
  assert.deepEqual(PASOS_DEL_PANEL.map((p) => [p.clave, p.numero]), [["PARA_IMPRIMIR", 1], ["EN_LABORATORIO", 2], ["LISTOS", 3], ["ENTREGADOS", 4]]);
});

test("faseDelLote: entre «Enviado» y «En producción» se ve si el laboratorio abrió y descargó", () => {
  const base = { estado: "ENVIADO" as const, labAbrioAt: null, labDescargoAt: null, porFuera: false };
  assert.equal(faseDelLote(base), "SIN_ABRIR");
  assert.equal(faseDelLote({ ...base, labAbrioAt: "2026-11-23T17:00:00.000Z" }), "ABIERTO");
  assert.equal(faseDelLote({ ...base, labAbrioAt: "2026-11-23T17:00:00.000Z", labDescargoAt: "2026-11-23T17:05:00.000Z" }), "DESCARGADO");
  assert.equal(textoDeLaFase("DESCARGADO"), "Descargado por el laboratorio");
  // En producción ya no muestra la descarga como fase (queda en el seguimiento).
  assert.equal(faseDelLote({ ...base, estado: "EN_PRODUCCION", labDescargoAt: "2026-11-23T17:05:00.000Z" }), "EN_PRODUCCION");
  assert.equal(faseDelLote({ ...base, estado: "RECIBIDO", porFuera: true }), "POR_FUERA");
});

test("agruparEnElLaboratorio: sin descargar, descargados, en producción y listos, sin grupos vacíos", () => {
  const l = (id: number, estado: EstadoLote, descargo: string | null = null) => ({ ...lote(id, estado, []), labDescargoAt: descargo });
  const grupos = agruparEnElLaboratorio([l(1, "ENVIADO"), l(2, "ENVIADO", "2026-11-23T17:05:00.000Z"), l(3, "LISTO"), l(4, "DESPACHADO")]);
  assert.deepEqual(grupos.map((g) => [g.titulo, g.lotes.map((x) => x.id)]), [
    ["Esperando que el laboratorio lo descargue", [1]],
    ["Descargados por el laboratorio", [2]],
    ["Listos en el laboratorio o despachados", [3, 4]],
  ]);
});

test("fechaYHoraDelPanel y seguimientoDelLote: sólo lo que ya pasó, en hora argentina", () => {
  assert.equal(fechaYHoraDelPanel("2026-11-23T17:05:00.000Z"), "23/11 14:05");
  assert.equal(fechaYHoraDelPanel(null), "");
  const s = seguimientoDelLote({ ...lote(1, "ENVIADO", []), enviadoAt: "2026-11-23T12:00:00.000Z", labDescargoAt: "2026-11-23T17:05:00.000Z" });
  assert.deepEqual(s, [
    { texto: "Enviado al laboratorio", cuando: "23/11 09:00" },
    { texto: "El laboratorio descargó las fotos", cuando: "23/11 14:05" },
  ]);
  const fuera = seguimientoDelLote({ ...lote(2, "RECIBIDO", []), porFuera: true, recibidoAt: "2026-11-23T12:00:00.000Z" });
  assert.deepEqual(fuera.map((x) => x.texto), ["Marcado como ya impreso"]);
});

test("confirmacionAlSacar: si el lote ya salió avisa que el laboratorio puede haberlo impreso", () => {
  const e = { albumOrderId: 15, retiraCliente: false };
  const armado = lote(1, "ARMADO", []);
  assert.match(confirmacionAlSacar(armado, e), /^¿Sacar el pedido #15 del Lote 1/);
  assert.doesNotMatch(confirmacionAlSacar(armado, e), /Atención/);
  const enviado = { ...lote(2, "ENVIADO", []), laboratorio: "Procolor", enviadoAt: "2026-11-22T15:00:00.000Z", labDescargoAt: "2026-11-23T17:05:00.000Z" };
  const t = confirmacionAlSacar(enviado, e);
  assert.match(t, /ya se envió al laboratorio el 22\/11 y descargó las fotos el 23\/11 14:05/);
  assert.match(t, /Puede que ya lo hayan impreso/);
  assert.match(t, /le avisamos al laboratorio por correo/);
  // Recibido: sólo se le escribe al laboratorio si el cliente retira allá (las copias siguen ahí).
  const recibido = { ...enviado, estado: "RECIBIDO" as const };
  assert.doesNotMatch(confirmacionAlSacar(recibido, e), /le avisamos/);
  assert.match(confirmacionAlSacar(recibido, { ...e, retiraCliente: true }), /le avisamos/);
  assert.match(confirmacionAlSacar({ ...lote(3, "RECIBIDO", []), porFuera: true }, e), /Deja de figurar como impreso/);
});

test("avisaAlLabAlSacar y sePuedeSacar", () => {
  const l = { estado: "LISTO" as const, enviadoAt: "2026-11-22T15:00:00.000Z", laboratorio: "Procolor" };
  assert.equal(avisaAlLabAlSacar(l, { retiraCliente: false }), true);
  assert.equal(avisaAlLabAlSacar({ ...l, laboratorio: null }, { retiraCliente: false }), false);
  assert.equal(avisaAlLabAlSacar({ ...l, enviadoAt: null }, { retiraCliente: false }), false);
  assert.equal(avisaAlLabAlSacar({ ...l, porFuera: true }, { retiraCliente: false }), false);
  assert.equal(sePuedeSacar(entrada(1)), true);
  assert.equal(sePuedeSacar(entrada(1, { entregadoAt: "2026-11-23T10:00:00.000Z" })), false);
  assert.equal(sePuedeSacar(entrada(1, { estadoPedido: "DELIVERED" })), false);
});

test("esImpresoPorFuera y accionesDelLote: sin laboratorio no se mueve ni se paga, sólo se saca", () => {
  assert.equal(esImpresoPorFuera({ estado: "RECIBIDO", enviadoAt: null, labContactId: null }), true);
  assert.equal(esImpresoPorFuera({ estado: "RECIBIDO", enviadoAt: "2026-11-22T15:00:00.000Z", labContactId: 3 }), false);
  assert.equal(esImpresoPorFuera({ estado: "ARMADO", enviadoAt: null, labContactId: null }), false);
  const a = accionesDelLote({ estado: "RECIBIDO", entregaPreferida: "RETIRA_FOTOGRAFO", pagadoAlLabAt: null, porFuera: true });
  assert.deepEqual([a.enviar, a.deshacer, a.mover.length, a.pagadoAlLab, a.quitar], [false, false, 0, false, "SACAR"]);
  const listo = accionesDelLote({ estado: "LISTO", entregaPreferida: "RETIRA_FOTOGRAFO", pagadoAlLabAt: null });
  assert.equal(listo.quitar, "SACAR");
});
