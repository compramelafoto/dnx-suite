import { describe, expect, it } from "vitest";
import { addMonths, computeExclusions, prizeSeriesKey } from "./repeat-rule";

const premio = (over: Partial<Parameters<typeof prizeSeriesKey>[0]> = {}) => ({
  commitmentId: null,
  partnerId: null,
  partnerNameSnapshot: null,
  title: "Limpieza de sensor",
  ...over,
});

describe("qué es el mismo premio", () => {
  it("dos premios de la misma serie mensual son el mismo, aunque cambie el título", () => {
    expect(prizeSeriesKey(premio({ commitmentId: "c-1" }))).toBe(
      prizeSeriesKey(premio({ commitmentId: "c-1", title: "Limpieza de sensor full frame" })),
    );
  });

  it("dos series distintas no son el mismo premio aunque se llamen igual", () => {
    expect(prizeSeriesKey(premio({ commitmentId: "c-1" }))).not.toBe(
      prizeSeriesKey(premio({ commitmentId: "c-2" })),
    );
  });

  it("un premio suelto es el mismo que otro con el mismo aliado y título, sin mirar mayúsculas ni espacios", () => {
    expect(prizeSeriesKey(premio({ partnerId: "p-1", title: "  Limpieza de  Sensor " }))).toBe(
      prizeSeriesKey(premio({ partnerId: "p-1", title: "limpieza de sensor" })),
    );
  });

  it("sin id de aliado, se compara por el nombre del aliado", () => {
    expect(prizeSeriesKey(premio({ partnerNameSnapshot: "Tecnoflash" }))).not.toBe(
      prizeSeriesKey(premio({ partnerNameSnapshot: "Otro" })),
    );
  });

  it("un premio de serie y uno suelto nunca son el mismo", () => {
    expect(prizeSeriesKey(premio({ commitmentId: "c-1", partnerId: "p-1" }))).not.toBe(
      prizeSeriesKey(premio({ partnerId: "p-1" })),
    );
  });
});

describe("sumar meses", () => {
  it("conserva el día y la hora", () => {
    expect(addMonths(new Date("2026-10-11T23:00:00Z"), 6).toISOString()).toBe(
      "2027-04-11T23:00:00.000Z",
    );
  });

  it("si el mes de destino no llega a ese día, usa el último", () => {
    expect(addMonths(new Date("2026-08-31T23:00:00Z"), 6).toISOString()).toBe(
      "2027-02-28T23:00:00.000Z",
    );
  });
});

describe("quién queda afuera de qué premio", () => {
  // La hora del acto, no la de resolución (que fue 23:00:03).
  const OCTUBRE = new Date("2026-10-11T23:00:00Z");
  const premios = [
    { order: 1, key: "s:tecnoflash" },
    { order: 2, key: "s:arteenfoco" },
    { order: 3, key: "s:proyectodesign" },
  ];
  const ganoEnOctubre = [
    { memberId: "rovere", prizeKey: "s:tecnoflash", raffleDrawsAt: OCTUBRE },
    { memberId: "franceschini", prizeKey: "s:arteenfoco", raffleDrawsAt: OCTUBRE },
  ];

  it("en noviembre, quien ganó un premio queda afuera sólo de ese premio", () => {
    const x = computeExclusions({
      drawsAt: new Date("2026-11-11T23:00:00Z"),
      months: 6,
      prizes: premios,
      pastWins: ganoEnOctubre,
    });
    expect(x.get("rovere")).toEqual([1]);
    expect(x.get("franceschini")).toEqual([2]);
    expect(x.has("villagomez")).toBe(false);
  });

  it("en marzo sigue afuera; en el sorteo de abril, a la misma hora, ya puede ganarlo", () => {
    const marzo = computeExclusions({
      drawsAt: new Date("2027-03-11T23:00:00Z"),
      months: 6,
      prizes: premios,
      pastWins: ganoEnOctubre,
    });
    expect(marzo.get("rovere")).toEqual([1]);

    const abril = computeExclusions({
      drawsAt: new Date("2027-04-11T23:00:00Z"),
      months: 6,
      prizes: premios,
      pastWins: ganoEnOctubre,
    });
    expect(abril.size).toBe(0);
  });

  it("con la regla apagada no excluye a nadie", () => {
    const x = computeExclusions({
      drawsAt: new Date("2026-11-11T23:00:00Z"),
      months: 0,
      prizes: premios,
      pastWins: ganoEnOctubre,
    });
    expect(x.size).toBe(0);
  });

  it("si el premio no está en este sorteo, la victoria vieja no excluye de nada", () => {
    const x = computeExclusions({
      drawsAt: new Date("2026-11-11T23:00:00Z"),
      months: 6,
      prizes: [{ order: 1, key: "s:otro" }],
      pastWins: ganoEnOctubre,
    });
    expect(x.size).toBe(0);
  });

  it("los órdenes salen ordenados y sin repetir", () => {
    const x = computeExclusions({
      drawsAt: new Date("2026-11-11T23:00:00Z"),
      months: 6,
      prizes: [
        { order: 3, key: "s:b" },
        { order: 1, key: "s:a" },
      ],
      pastWins: [
        { memberId: "m", prizeKey: "s:b", raffleDrawsAt: OCTUBRE },
        { memberId: "m", prizeKey: "s:a", raffleDrawsAt: OCTUBRE },
        { memberId: "m", prizeKey: "s:a", raffleDrawsAt: new Date("2026-09-11T23:00:00Z") },
      ],
    });
    expect(x.get("m")).toEqual([1, 3]);
  });

  it("una victoria posterior al acto no cuenta", () => {
    const x = computeExclusions({
      drawsAt: new Date("2026-11-11T23:00:00Z"),
      months: 6,
      prizes: premios,
      pastWins: [{ memberId: "m", prizeKey: "s:tecnoflash", raffleDrawsAt: new Date("2026-11-12T00:00:00Z") }],
    });
    expect(x.size).toBe(0);
  });
});
