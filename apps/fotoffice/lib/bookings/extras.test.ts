import { describe, expect, it } from "vitest";
import { anyRequiresConfirmation, extrasTotalMinor, offerExtras, unitsCommitted } from "./extras";

const r = (a: string, b: string) => ({ startAt: new Date(a), endAt: new Date(b) });
const sabado14a16 = r("2026-09-19T17:00:00Z", "2026-09-19T19:00:00Z");

const flashSuelto = {
  id: "flash-1",
  name: "Flash adicional",
  priceMode: "PER_BOOKING" as const,
  memberPriceMinor: 100_000,
  nonMemberPriceMinor: 150_000,
  resourceId: "res-flash",
  unitsConsumed: 1,
  requiresConfirmation: false,
};

const packDeDos = {
  ...flashSuelto,
  id: "flash-pack",
  name: "Pack de 2 flashes",
  // Promocional: menos que dos sueltos.
  memberPriceMinor: 160_000,
  nonMemberPriceMinor: 250_000,
  unitsConsumed: 2,
};

const humo = {
  id: "humo",
  name: "Máquina de humo",
  priceMode: "PER_BOOKING" as const,
  memberPriceMinor: 50_000,
  nonMemberPriceMinor: 80_000,
  resourceId: "res-humo",
  unitsConsumed: 1,
  requiresConfirmation: false,
};

const modelo = {
  id: "modelo",
  name: "Modelo",
  priceMode: "PER_HOUR" as const,
  memberPriceMinor: 200_000,
  nonMemberPriceMinor: 300_000,
  resourceId: "res-modelo",
  unitsConsumed: 1,
  requiresConfirmation: true,
};

const fondo = {
  id: "fondo",
  name: "Fondo de papel",
  priceMode: "PER_BOOKING" as const,
  memberPriceMinor: 20_000,
  nonMemberPriceMinor: 30_000,
  // Sin recurso: hay de sobra, no se controla.
  resourceId: null,
  unitsConsumed: 1,
  requiresConfirmation: false,
};

const stock = [
  { resourceId: "res-flash", quantity: 2 },
  { resourceId: "res-humo", quantity: 1 },
  { resourceId: "res-modelo", quantity: 1 },
];

const base = {
  extras: [flashSuelto, packDeDos, humo, modelo, fondo],
  stock,
  commitments: [],
  range: sabado14a16,
  customerType: "MEMBER" as const,
};

describe("unidades ya comprometidas", () => {
  it("suma solo lo que se pisa con el rango pedido", () => {
    const comprometidas = unitsCommitted("res-flash", sabado14a16, [
      { resourceId: "res-flash", units: 1, range: r("2026-09-19T18:00:00Z", "2026-09-19T20:00:00Z") },
      { resourceId: "res-flash", units: 1, range: r("2026-09-19T22:00:00Z", "2026-09-19T23:00:00Z") },
    ]);
    expect(comprometidas).toBe(1);
  });

  it("no mezcla recursos distintos", () => {
    expect(
      unitsCommitted("res-flash", sabado14a16, [
        { resourceId: "res-humo", units: 1, range: sabado14a16 },
      ]),
    ).toBe(0);
  });

  it("dos reservas pegadas no se comprometen entre sí", () => {
    expect(
      unitsCommitted("res-flash", sabado14a16, [
        { resourceId: "res-flash", units: 2, range: r("2026-09-19T19:00:00Z", "2026-09-19T21:00:00Z") },
      ]),
    ).toBe(0);
  });
});

describe("qué extras se pueden ofrecer", () => {
  it("sin nada comprometido, todos están disponibles", () => {
    expect(offerExtras(base).every((o) => o.available)).toBe(true);
  });

  it("un extra sin recurso siempre está disponible", () => {
    const ofertas = offerExtras({
      ...base,
      commitments: [{ resourceId: "res-flash", units: 2, range: sabado14a16 }],
    });
    expect(ofertas.find((o) => o.extra.id === "fondo")?.available).toBe(true);
    expect(ofertas.find((o) => o.extra.id === "fondo")?.unitsFree).toBeNull();
  });

  it("con un flash tomado, el suelto se puede y el pack no", () => {
    // Este es EL caso que justifica separar recurso de extra: quedó 1 flash libre,
    // así que el suelto entra y el pack de 2 no.
    const ofertas = offerExtras({
      ...base,
      commitments: [{ resourceId: "res-flash", units: 1, range: sabado14a16 }],
    });
    expect(ofertas.find((o) => o.extra.id === "flash-1")?.available).toBe(true);
    expect(ofertas.find((o) => o.extra.id === "flash-pack")?.available).toBe(false);
  });

  it("con los dos flashes tomados, ninguno de los dos se puede", () => {
    const ofertas = offerExtras({
      ...base,
      commitments: [{ resourceId: "res-flash", units: 2, range: sabado14a16 }],
    });
    expect(ofertas.find((o) => o.extra.id === "flash-1")?.available).toBe(false);
    expect(ofertas.find((o) => o.extra.id === "flash-pack")?.available).toBe(false);
  });

  it("el extra agotado se devuelve igual, marcado: se muestra, no se esconde", () => {
    const ofertas = offerExtras({
      ...base,
      commitments: [{ resourceId: "res-humo", units: 1, range: sabado14a16 }],
    });
    const oferta = ofertas.find((o) => o.extra.id === "humo");
    expect(oferta).toBeDefined();
    expect(oferta!.available).toBe(false);
    expect(oferta!.unitsFree).toBe(0);
  });

  it("un recurso sin stock declarado se trata como agotado, no como infinito", () => {
    // Falla cerrado: un recurso mal cargado no puede volverse ilimitado.
    const ofertas = offerExtras({ ...base, stock: [] });
    expect(ofertas.find((o) => o.extra.id === "flash-1")?.available).toBe(false);
    expect(ofertas.find((o) => o.extra.id === "fondo")?.available).toBe(true);
  });
});

describe("cuánto cuestan", () => {
  it("un extra por reserva cuesta lo mismo dure lo que dure", () => {
    const dosHoras = offerExtras(base).find((o) => o.extra.id === "humo")!.amountMinor;
    const cuatroHoras = offerExtras({
      ...base,
      range: r("2026-09-19T17:00:00Z", "2026-09-19T21:00:00Z"),
    }).find((o) => o.extra.id === "humo")!.amountMinor;
    expect(dosHoras).toBe(50_000);
    expect(cuatroHoras).toBe(50_000);
  });

  it("un extra por hora se multiplica por la duración", () => {
    expect(offerExtras(base).find((o) => o.extra.id === "modelo")!.amountMinor).toBe(400_000);
  });

  it("media hora de un extra por hora cuesta la mitad", () => {
    const media = offerExtras({
      ...base,
      range: r("2026-09-19T17:00:00Z", "2026-09-19T17:30:00Z"),
    }).find((o) => o.extra.id === "modelo")!.amountMinor;
    expect(media).toBe(100_000);
  });

  it("el no socio paga la tarifa de no socio", () => {
    const ofertas = offerExtras({ ...base, customerType: "NON_MEMBER" });
    expect(ofertas.find((o) => o.extra.id === "humo")!.amountMinor).toBe(80_000);
  });

  it("el pack sale menos que dos flashes sueltos", () => {
    const ofertas = offerExtras(base);
    const suelto = ofertas.find((o) => o.extra.id === "flash-1")!.amountMinor;
    const pack = ofertas.find((o) => o.extra.id === "flash-pack")!.amountMinor;
    expect(pack).toBeLessThan(suelto * 2);
  });

  it("el total suma solo lo elegido", () => {
    const ofertas = offerExtras(base);
    expect(extrasTotalMinor(ofertas, ["humo", "fondo"])).toBe(70_000);
    expect(extrasTotalMinor(ofertas, [])).toBe(0);
  });

  it("un extra agotado no suma al total aunque venga elegido", () => {
    const ofertas = offerExtras({
      ...base,
      commitments: [{ resourceId: "res-humo", units: 1, range: sabado14a16 }],
    });
    expect(extrasTotalMinor(ofertas, ["humo"])).toBe(0);
  });
});

describe("los que hay que coordinar", () => {
  it("pedir la modelo obliga a que la institución apruebe", () => {
    expect(anyRequiresConfirmation(offerExtras(base), ["modelo"])).toBe(true);
  });

  it("sin extras a confirmar, la reserva sigue su curso normal", () => {
    expect(anyRequiresConfirmation(offerExtras(base), ["humo", "fondo"])).toBe(false);
    expect(anyRequiresConfirmation(offerExtras(base), [])).toBe(false);
  });

  it("un extra a confirmar que está agotado no obliga a nada", () => {
    const ofertas = offerExtras({
      ...base,
      commitments: [{ resourceId: "res-modelo", units: 1, range: sabado14a16 }],
    });
    expect(anyRequiresConfirmation(ofertas, ["modelo"])).toBe(false);
  });
});
