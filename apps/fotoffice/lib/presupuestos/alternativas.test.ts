import { describe, expect, it } from "vitest";
import type { ItemPresupuesto } from "./constantes";
import { validarItem } from "./constantes";
import {
  agregarAlternativa,
  alternativaAceptada,
  alternativaElegidaId,
  alternativaPrincipal,
  alternativasGuardadas,
  asignarItems,
  copiarItemA,
  costosConAlternativas,
  fijarAlternativa,
  itemsQueValen,
  marcarMasElegida,
  MENSAJES_ALTERNATIVAS,
  moverAlternativa,
  moverItemA,
  pagoDeAlternativa,
  quitarAlternativa,
  totalesConAlternativas,
  totalParaMensaje,
  validarAlternativas,
  type Alternativa,
} from "./alternativas";
import { calcularTotales } from "./totales";
import { firmaDelBorrador, pesos } from "./editor";
import { contenidoDelModelo, contenidoParaGuardar, validarContenidoDeModelo } from "./propuestas-modelo";
import { resumenDeVersion } from "@/lib/presupuesto-automatico/flujo";
import { armarResumen, lineasDePrecio } from "@/lib/presupuesto-automatico/resumen";
import { armarVistaPublica } from "./vista-publica";
import { vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {}, Prisma: { JsonNull: null } }));

const item = (id: string, precio: number, datos: Partial<ItemPresupuesto> = {}): ItemPresupuesto => ({
  id, productId: null, nombre: `Ítem ${id}`, descripcion: null, cantidad: 1, precioUnitario: precio, descuento: null,
  modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false, ...datos,
});

const BASICO: Alternativa = { id: "basico", nombre: "Básico", descripcion: "Lo esencial", masElegida: false };
const PREMIUM: Alternativa = { id: "premium", nombre: "Premium", descripcion: null, masElegida: true };

describe("validar opciones", () => {
  it("sin opciones (undefined, null o []) es un presupuesto común", () => {
    expect(validarAlternativas(undefined)).toEqual({ ok: true, valor: [] });
    expect(validarAlternativas(null)).toEqual({ ok: true, valor: [] });
    expect(validarAlternativas([])).toEqual({ ok: true, valor: [] });
  });

  it("hasta 4, con nombre, sin nombres repetidos y una sola «más elegida»", () => {
    const cinco = [1, 2, 3, 4, 5].map((n) => ({ id: `a${n}`, nombre: `Opción ${n}` }));
    expect(validarAlternativas(cinco)).toEqual({ ok: false, error: MENSAJES_ALTERNATIVAS.maximo });
    expect(validarAlternativas([{ id: "a", nombre: "  " }])).toEqual({ ok: false, error: MENSAJES_ALTERNATIVAS.nombre });
    expect(validarAlternativas([{ id: "a", nombre: "Básico" }, { id: "b", nombre: "básico" }])).toEqual({ ok: false, error: MENSAJES_ALTERNATIVAS.repetida });
    expect(validarAlternativas([{ id: "a", nombre: "A", masElegida: true }, { id: "b", nombre: "B", masElegida: true }])).toEqual({
      ok: false,
      error: MENSAJES_ALTERNATIVAS.masElegida,
    });
    expect(validarAlternativas([{ id: "a b", nombre: "A" }]).ok).toBe(false);
    expect(validarAlternativas([{ id: "a", nombre: "  Básico   plus ", descripcion: " Corto " }])).toEqual({
      ok: true,
      valor: [{ id: "a", nombre: "Básico plus", descripcion: "Corto", masElegida: false }],
    });
  });

  it("la principal es la más elegida o, si no hay, la primera", () => {
    expect(alternativaPrincipal([BASICO, PREMIUM])?.id).toBe("premium");
    expect(alternativaPrincipal([BASICO, { ...PREMIUM, masElegida: false }])?.id).toBe("basico");
    expect(alternativaPrincipal([])).toBeNull();
  });

  it("un ítem sin opción (o con una que no está) va a la principal; sin opciones, ninguno lleva opción", () => {
    const items = [item("a", 1, { alternativaId: "basico" }), item("b", 1), item("c", 1, { alternativaId: "borrada" })];
    expect(asignarItems(items, [BASICO, PREMIUM]).map((i) => i.alternativaId)).toEqual(["basico", "premium", "premium"]);
    expect(asignarItems(items, []).map((i) => "alternativaId" in i)).toEqual([false, false, false]);
  });

  it("el ítem guarda su opción sólo si tiene (sin opciones queda idéntico a antes)", () => {
    const sin = validarItem(item("a", 10));
    expect(sin.ok && "alternativaId" in sin.valor).toBe(false);
    const con = validarItem(item("a", 10, { alternativaId: "basico" }));
    expect(con.ok && con.valor.alternativaId).toBe("basico");
  });
});

describe("totales por opción", () => {
  const items = [
    item("b1", 100_000, { alternativaId: "basico" }),
    item("b2", 50_000, { alternativaId: "basico", opcional: true }),
    item("p1", 100_000, { alternativaId: "premium" }),
    item("p2", 250_000, { alternativaId: "premium", cantidad: 2, descuento: { tipo: "PORCENTAJE", valor: 10 } }),
  ];

  it("cada opción con su cuenta y el descuento global en cada una; arriba, la principal con el neto de todos los renglones", () => {
    const { totales, alternativas } = totalesConAlternativas(items, [BASICO, PREMIUM], { tipo: "MONTO", valor: 10_000 });
    const [b, p] = alternativas;
    expect(b!.totales.total).toBe(90_000);
    expect(b!.totales.opcionales).toEqual({ cantidad: 1, total: 50_000 });
    // Premium: 100.000 + 2 × 250.000 − 10 % = 550.000, menos 10.000 de descuento global.
    expect(p!.totales.subtotal).toBe(600_000);
    expect(p!.totales.descuentoItems).toBe(50_000);
    expect(p!.totales.total).toBe(540_000);
    expect(totales.total).toBe(540_000);
    expect(Object.keys(totales.renglones).sort()).toEqual(["b1", "b2", "p1", "p2"]);
    expect(totales.renglones.p2!.neto).toBe(450_000);
  });

  it("sin opciones es exactamente `calcularTotales`", () => {
    const comunes = items.map(({ alternativaId: _a, ...i }) => i);
    expect(totalesConAlternativas(comunes, [], null)).toEqual({ totales: calcularTotales(comunes, null), alternativas: [] });
  });

  it("costo y margen de cada opción; arriba, los de la principal", () => {
    const catalogo = new Map([["prod-1", { plantillas: [], costoProducto: 40_000 }]]);
    const conCosto = items.map((i) => (i.id === "p1" || i.id === "b1" ? { ...i, productId: "prod-1" } : i));
    const { totales, alternativas } = totalesConAlternativas(conCosto, [BASICO, PREMIUM], null);
    const c = costosConAlternativas(conCosto, totales, alternativas, catalogo);
    expect(c.alternativas?.basico).toMatchObject({ costoTotal: 40_000, margen: 60_000, margenProporcion: 0.6 });
    expect(c.alternativas?.premium).toMatchObject({ costoTotal: 40_000, margen: 510_000, itemsSinCosto: 1 });
    expect(c.margen).toBe(510_000);
    expect(Object.keys(c.porItem).sort()).toEqual(["b1", "b2", "p1", "p2"]);
  });
});

/** `totals` guardado de una versión con dos opciones (como lo deja `normalizarBorrador`). */
function guardado() {
  const items = [item("b1", 100_000, { alternativaId: "basico" }), item("p1", 300_000, { alternativaId: "premium" })];
  const { totales, alternativas } = totalesConAlternativas(items, [BASICO, PREMIUM], null);
  return { items, totals: { ...totales, descuento: null, alternativas } };
}

describe("aceptar una opción", () => {
  it("con varias hay que elegir una que exista; con una sola, ésa; sin opciones, ninguna", () => {
    const { totals } = guardado();
    expect(alternativaAceptada(totals, "basico")).toEqual({ ok: true, valor: "basico" });
    expect(alternativaAceptada(totals, undefined)).toEqual({ ok: false, error: MENSAJES_ALTERNATIVAS.elegir });
    expect(alternativaAceptada(totals, "otra")).toEqual({ ok: false, error: MENSAJES_ALTERNATIVAS.elegir });
    const una = { ...totals, alternativas: totals.alternativas.slice(0, 1) };
    expect(alternativaAceptada(una, undefined)).toEqual({ ok: true, valor: "basico" });
    expect(alternativaAceptada(calcularTotales([], null), "basico")).toEqual({ ok: true, valor: null });
  });

  it("fija la elegida: totales, opciones de pago y costos de arriba pasan a ser los suyos; la oferta queda", () => {
    const { totals } = guardado();
    const pago = { schemaVersion: 1, basePrice: 300_000, installmentPlans: [], porAlternativa: { basico: { schemaVersion: 1, basePrice: 100_000, installmentPlans: [] }, premium: { schemaVersion: 1, basePrice: 300_000, installmentPlans: [] } } };
    const costos = { porItem: { b1: { costo: 1 } }, costoTotal: 9, margen: 9, margenProporcion: null, itemsSinCosto: 0, alternativas: { basico: { porItem: {}, costoTotal: 30_000, margen: 70_000, margenProporcion: 0.7, itemsSinCosto: 0 } } };
    const f = fijarAlternativa({ totals, paymentOptions: pago, costSnapshot: costos }, "basico")!;
    expect(f.totals).toMatchObject({ total: 100_000, alternativaElegidaId: "basico", descuento: null });
    expect(Object.keys(f.totals.renglones as object).sort()).toEqual(["b1", "p1"]);
    expect(alternativasGuardadas(f.totals).map((a) => a.id)).toEqual(["basico", "premium"]);
    expect(alternativaElegidaId(f.totals)).toBe("basico");
    expect(f.paymentOptions).toMatchObject({ basePrice: 100_000 });
    expect((f.paymentOptions as { porAlternativa: object }).porAlternativa).toBe(pago.porAlternativa);
    expect(f.costSnapshot).toMatchObject({ costoTotal: 30_000, margen: 70_000, porItem: { b1: { costo: 1 } } });
    expect(fijarAlternativa({ totals, paymentOptions: pago, costSnapshot: costos }, "nada")).toBeNull();
  });

  it("las formas de pago de una opción son las suyas (o las de arriba si no hay por opción)", () => {
    const pago = { basePrice: 1, porAlternativa: { basico: { basePrice: 2 } } };
    expect(pagoDeAlternativa(pago, "basico")).toEqual({ basePrice: 2 });
    expect(pagoDeAlternativa(pago, "premium")).toBe(pago);
    expect(pagoDeAlternativa(null, "basico")).toBeNull();
  });

  it("el pedido lleva sólo los ítems de la elegida; sin opciones, todos", () => {
    const { items, totals } = guardado();
    const f = fijarAlternativa({ totals, paymentOptions: null, costSnapshot: null }, "premium")!;
    expect(itemsQueValen(items, f.totals).map((i) => i.id)).toEqual(["p1"]);
    const comunes = [item("a", 1), item("b", 2)];
    expect(itemsQueValen(comunes, calcularTotales(comunes, null)).map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("el total del mensaje: «desde» la más barata mientras no se eligió; después, el de la elegida", () => {
    const { totals } = guardado();
    expect(totalParaMensaje(totals, pesos)).toBe(`desde ${pesos(100_000)}`);
    expect(totalParaMensaje(fijarAlternativa({ totals, paymentOptions: null, costSnapshot: null }, "premium")!.totals, pesos)).toBe(pesos(300_000));
    expect(totalParaMensaje(calcularTotales([item("a", 5)], null), pesos)).toBe(pesos(5));
  });
});

describe("operaciones del editor", () => {
  let n = 0;
  const clave = () => `k${++n}`;

  it("la primera vez arma dos opciones: la 1 con lo que había y la 2 vacía; hasta 4", () => {
    const e = agregarAlternativa({ alternativas: [], items: [item("a", 1)] }, clave);
    expect(e.alternativas.map((a) => a.nombre)).toEqual(["Opción 1", "Opción 2"]);
    expect(e.items[0]!.alternativaId).toBe(e.alternativas[0]!.id);
    expect(e.nueva).toBe(e.alternativas[1]!.id);
    const tres = agregarAlternativa(e, clave);
    const cuatro = agregarAlternativa(tres, clave);
    expect(cuatro.alternativas.map((a) => a.nombre)).toEqual(["Opción 1", "Opción 2", "Opción 3", "Opción 4"]);
    expect(agregarAlternativa(cuatro, clave).nueva).toBeNull();
  });

  it("borrar una opción se lleva sus ítems; si queda una, vuelve a ser un presupuesto común", () => {
    const e = { alternativas: [BASICO, PREMIUM], items: [item("b", 1, { alternativaId: "basico" }), item("p", 2, { alternativaId: "premium" })] };
    const r = quitarAlternativa(e, "premium");
    expect(r.alternativas).toEqual([]);
    expect(r.items.map((i) => [i.id, "alternativaId" in i])).toEqual([["b", false]]);
  });

  it("ordenar, marcar la más elegida, mover y copiar ítems", () => {
    expect(moverAlternativa([BASICO, PREMIUM], "premium", -1).map((a) => a.id)).toEqual(["premium", "basico"]);
    expect(moverAlternativa([BASICO, PREMIUM], "basico", -1).map((a) => a.id)).toEqual(["basico", "premium"]);
    expect(marcarMasElegida([BASICO, PREMIUM], "basico", true).map((a) => a.masElegida)).toEqual([true, false]);
    const items = [item("b", 1, { alternativaId: "basico" }), item("p", 2, { alternativaId: "premium" }), item("q", 3, { alternativaId: "premium" })];
    expect(moverItemA(items, "b", "premium").map((i) => i.alternativaId)).toEqual(["premium", "premium", "premium"]);
    const copia = copiarItemA(items, "p", "basico", "nuevo");
    expect(copia.map((i) => [i.id, i.alternativaId])).toEqual([["b", "basico"], ["nuevo", "basico"], ["p", "premium"], ["q", "premium"]]);
  });

  it("la firma del borrador no cambia sin opciones y sí cuando cambian las opciones", () => {
    const items = [item("a", 1)];
    const base = firmaDelBorrador(items, null, null, null);
    expect(firmaDelBorrador(items, null, null, null, [])).toBe(base);
    expect(firmaDelBorrador(items, null, null, null, [BASICO])).not.toBe(base);
    expect(firmaDelBorrador(items, null, null, null, [BASICO])).not.toBe(firmaDelBorrador(items, null, null, null, [{ ...BASICO, nombre: "Otro" }]));
  });
});

describe("propuesta modelo con opciones", () => {
  it("sin opciones se guarda la lista de siempre; con opciones, { alternativas, items }; las dos se leen", () => {
    const items = [item("a", 0, { productId: "prod-1" })];
    expect(contenidoParaGuardar(items, [])).toBe(items);
    const guardado = contenidoParaGuardar(items, [BASICO]);
    expect(guardado).toEqual({ alternativas: [BASICO], items });
    expect(contenidoDelModelo(items)).toEqual({ items, alternativas: [] });
    expect(contenidoDelModelo(guardado)).toEqual({ items, alternativas: [BASICO] });
    const v = validarContenidoDeModelo(items, [BASICO, PREMIUM]);
    expect(v.ok && v.valor.items[0]!.alternativaId).toBe("premium");
  });
});

describe("resumen de Telegram y vista pública", () => {
  it("cada opción con su precio, costo y margen", () => {
    const { items, totals } = guardado();
    const costSnapshot = {
      porItem: {}, costoTotal: 100_000, margen: 200_000, margenProporcion: 0.6667, itemsSinCosto: 0,
      alternativas: {
        basico: { porItem: {}, costoTotal: 40_000, margen: 60_000, margenProporcion: 0.6, itemsSinCosto: 0 },
        premium: { porItem: {}, costoTotal: 100_000, margen: 200_000, margenProporcion: 0.6667, itemsSinCosto: 0 },
      },
    };
    const r = resumenDeVersion({ items, totals, costSnapshot });
    expect(r.total).toBe(300_000);
    expect(r.alternativas?.map((a) => [a.nombre, a.masElegida, a.total, a.costo, a.margen])).toEqual([
      ["Básico", false, 100_000, 40_000, 60_000],
      ["Premium", true, 300_000, 100_000, 200_000],
    ]);
    expect(lineasDePrecio(r)).toEqual([
      `Básico: ${pesos(100_000)} · costo ${pesos(40_000)} · margen ${pesos(60_000)} (60 %)`,
      `Premium: ${pesos(300_000)} · costo ${pesos(100_000)} · margen ${pesos(200_000)} (67 %)`,
    ]);
    const { html } = armarResumen({
      aprobacionId: "a1", origen: "WEB", numeroConsulta: null, cliente: "Laura", email: null, telefono: null, categoria: "15 años",
      fechaEvento: null, lugar: null, invitados: null, mensaje: null, presupuesto: r, urlPresupuesto: null, urlConsulta: null,
    });
    expect(html).toContain("2 opciones para que elija");
    expect(html).toContain("<b>Básico</b>");
    expect(html).toContain("<b>Premium</b> ⭐ la más elegida");
    expect(html).toContain(`margen ${pesos(60_000)} (60 %)`);
  });

  it("sin opciones, el resumen es el de siempre (sin `alternativas`)", () => {
    const items = [item("a", 1000)];
    const r = resumenDeVersion({ items, totals: { ...calcularTotales(items, null), descuento: null }, costSnapshot: null });
    expect(r.alternativas).toBeUndefined();
    expect(lineasDePrecio(r)).toEqual([pesos(1000)]);
  });

  it("la vista pública muestra las opciones para elegir; aceptada, sólo la elegida", () => {
    const { items, totals } = guardado();
    const base = {
      estado: "ACTIVO" as const,
      organizacion: { nombre: "DNX", logoUrl: null, whatsappUrl: null, email: null },
      numero: "1",
      validUntil: null,
    };
    const version = { number: 1, items, totals, terms: null, paymentProposal: null, paymentOptions: null, acceptedAt: null, acceptedName: null };
    const v = armarVistaPublica({ ...base, version });
    expect(v.alternativas.map((a) => [a.nombre, a.masElegida, a.totales.total, a.items.map((i) => i.id)])).toEqual([
      ["Básico", false, 100_000, ["b1"]],
      ["Premium", true, 300_000, ["p1"]],
    ]);
    // El costo nunca viaja: las opciones sólo tienen lo que ve el cliente.
    expect(JSON.stringify(v)).not.toMatch(/costo|margen/i);
    const fijado = fijarAlternativa({ totals, paymentOptions: null, costSnapshot: null }, "basico")!;
    const aceptada = armarVistaPublica({
      ...base,
      estado: "ACEPTADO",
      version: { ...version, totals: fijado.totals as never, acceptedAt: new Date("2026-10-25T15:00:00Z"), acceptedName: "Laura" },
    });
    expect(aceptada.alternativas).toEqual([]);
    expect(aceptada.alternativaElegida).toBe("Básico");
    expect(aceptada.items.map((i) => i.id)).toEqual(["b1"]);
    expect(aceptada.totales.total).toBe(100_000);
  });

  it("sin opciones la vista no cambia: todos los ítems y ninguna opción", () => {
    const items = [item("a", 1000), item("b", 500)];
    const v = armarVistaPublica({
      estado: "ACTIVO",
      organizacion: { nombre: "DNX", logoUrl: null, whatsappUrl: null, email: null },
      numero: null,
      validUntil: null,
      version: { number: 1, items, totals: { ...calcularTotales(items, null), descuento: null }, terms: null, paymentProposal: null, acceptedAt: null, acceptedName: null },
    });
    expect(v.alternativas).toEqual([]);
    expect(v.alternativaElegida).toBeNull();
    expect(v.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(v.totales.total).toBe(1500);
  });
});
