import { describe, expect, it } from "vitest";

import {
  arMonthOf,
  arMonthRange,
  buildRoyaltiesCsv,
  csvAmount,
  groupRoyaltiesByAuthor,
  parsePaidReference,
  parseRoyaltyMonth,
  royaltyRowLabel,
  shiftMonth,
  type RoyaltyRow,
} from "./royalty-report";

function fila(over: Partial<RoyaltyRow> = {}): RoyaltyRow {
  return {
    id: "r1",
    authorUserId: 10,
    orderId: "ord1",
    orderNumber: 7,
    orderStatus: "PAID",
    workTitle: "Niebla",
    formatName: "Copia",
    qty: 1,
    baseMinor: 3000000,
    royaltyBps: 2000,
    amountMinor: 600000,
    status: "ACCRUED",
    createdAt: new Date("2026-10-04T15:00:00Z"),
    paidAt: null,
    paidReference: null,
    ...over,
  };
}

describe("meses en hora argentina", () => {
  it("el mes empieza y termina a la medianoche de Buenos Aires (03:00 UTC)", () => {
    const r = arMonthRange("2026-10");
    expect(r.start.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(r.end.toISOString()).toBe("2026-11-01T03:00:00.000Z");
  });

  it("diciembre cierra en enero del año siguiente", () => {
    expect(arMonthRange("2026-12").end.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });

  it("una regalía del 1/11 a las 01:00 UTC es todavía de octubre en Argentina", () => {
    expect(arMonthOf(new Date("2026-11-01T01:00:00Z"))).toBe("2026-10");
    expect(arMonthOf(new Date("2026-11-01T03:00:00Z"))).toBe("2026-11");
  });

  it("un mes mal escrito cae en el mes actual argentino", () => {
    const ahora = new Date("2026-11-01T02:00:00Z");
    expect(parseRoyaltyMonth("2026-13", ahora)).toBe("2026-10");
    expect(parseRoyaltyMonth(undefined, ahora)).toBe("2026-10");
    expect(parseRoyaltyMonth("2026-09", ahora)).toBe("2026-09");
  });

  it("avanza y retrocede meses", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});

describe("groupRoyaltiesByAuthor", () => {
  it("agrupa por autor con copias, a pagar y pagado; las anuladas no suman", () => {
    const grupos = groupRoyaltiesByAuthor(
      [
        fila({ id: "a", qty: 2, amountMinor: 1000 }),
        fila({ id: "b", status: "PAID", amountMinor: 500 }),
        fila({ id: "c", status: "VOIDED", amountMinor: 999, qty: 3 }),
        fila({ id: "d", authorUserId: 20, amountMinor: 700 }),
      ],
      new Map([
        [10, { name: "Zoe Autora", email: "zoe@example.com" }],
        [20, { name: "Ana Autora", email: "ana@example.com" }],
      ]),
    );
    expect(grupos.map((g) => g.name)).toEqual(["Ana Autora", "Zoe Autora"]);
    const zoe = grupos[1]!;
    expect(zoe).toMatchObject({ authorUserId: 10, copies: 3, accruedMinor: 1000, paidMinor: 500 });
    expect(zoe.items.map((i) => i.id)).toEqual(["a", "b", "c"]);
  });

  it("una pagada de un pedido cancelado no es una copia vendida y se rotula a recuperar", () => {
    const [g] = groupRoyaltiesByAuthor(
      [fila({ id: "a", qty: 2 }), fila({ id: "b", status: "PAID", orderStatus: "CANCELLED", qty: 5, amountMinor: 300 })],
      new Map(),
    );
    expect(g).toMatchObject({ copies: 2, paidMinor: 300 });
    expect(royaltyRowLabel(g!.items[1]!)).toBe("Pagada · pedido cancelado (a recuperar)");
    expect(royaltyRowLabel(g!.items[0]!)).toBe("A pagar");
  });

  it("un autor sin datos queda identificado por su número", () => {
    const [g] = groupRoyaltiesByAuthor([fila()], new Map());
    expect(g).toMatchObject({ name: "Autor #10", email: null });
  });
});

describe("parsePaidReference", () => {
  it("exige texto y hasta 120 caracteres", () => {
    expect(parsePaidReference("  Transferencia   123 ")).toEqual({ ok: true, value: "Transferencia 123" });
    expect(parsePaidReference("   ").ok).toBe(false);
    expect(parsePaidReference("x".repeat(121)).ok).toBe(false);
    expect(parsePaidReference(null).ok).toBe(false);
  });
});

describe("CSV", () => {
  it("pesos con coma decimal y sin separador de miles", () => {
    expect(csvAmount(123456789)).toBe("1234567,89");
    expect(csvAmount(5)).toBe("0,05");
    expect(csvAmount(-150)).toBe("-1,50");
  });

  it("UTF-8 con BOM, punto y coma, encabezados en castellano y comillas cuando hace falta", () => {
    const grupos = groupRoyaltiesByAuthor(
      [
        fila({ workTitle: 'Luz; "sombra"', status: "PAID", paidAt: new Date("2026-10-20T02:00:00Z"), paidReference: "=TRANSF" }),
      ],
      new Map([[10, { name: "José Núñez", email: "jose@example.com" }]]),
    );
    const csv = buildRoyaltiesCsv(grupos, "2026-10");
    expect(csv.startsWith("﻿")).toBe(true);
    const lineas = csv.slice(1).split("\r\n");
    expect(lineas[0]).toBe(
      "Mes;Autor;Email;Pedido;Obra;Formato;Copias;Base;Regalía %;Regalía;Estado;Pagada el;Referencia",
    );
    expect(lineas[1]).toBe(
      `2026-10;José Núñez;jose@example.com;7;"Luz; ""sombra""";Copia;1;30000,00;20;6000,00;Pagada;19/10/2026;'=TRANSF`,
    );
  });

  it("neutraliza fórmulas aunque vengan detrás de espacios", () => {
    const [g] = groupRoyaltiesByAuthor([fila({ workTitle: "  =HYPERLINK(1)", formatName: " +1", paidReference: "@x" })], new Map());
    const linea = buildRoyaltiesCsv([g!], "2026-10").split("\r\n")[1]!;
    expect(linea).toContain(";'  =HYPERLINK(1);' +1;");
    expect(linea.endsWith(";'@x")).toBe(true);
  });

  it("porcentaje con decimales usa coma", () => {
    const [g] = groupRoyaltiesByAuthor([fila({ royaltyBps: 1250 })], new Map());
    expect(buildRoyaltiesCsv([g!], "2026-10").split("\r\n")[1]).toContain(";12,5;");
  });
});
