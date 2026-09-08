import { describe, expect, it } from "vitest";
import { describeQuote, quoteBooking } from "./pricing";

const precios = { memberHourlyPriceMinor: 300_000, nonMemberHourlyPriceMinor: 500_000 };

describe("cuánto sale una reserva", () => {
  it("el no socio paga la tarifa plena y no tiene bonificación", () => {
    const q = quoteBooking({
      minutes: 120,
      customerType: "NON_MEMBER",
      ...precios,
      freeMinutesAvailable: 120,
    });
    expect(q.freeMinutesUsed).toBe(0);
    expect(q.billedMinutes).toBe(120);
    expect(q.hourlyPriceMinor).toBe(500_000);
    expect(q.totalMinor).toBe(1_000_000);
  });

  it("el socio paga la tarifa de socio", () => {
    const q = quoteBooking({
      minutes: 120,
      customerType: "MEMBER",
      ...precios,
      freeMinutesAvailable: 0,
    });
    expect(q.totalMinor).toBe(600_000);
  });

  it("la bonificación se aplica al principio: 4 horas con 2 bonificadas pagan 2", () => {
    const q = quoteBooking({
      minutes: 240,
      customerType: "MEMBER",
      ...precios,
      freeMinutesAvailable: 120,
    });
    expect(q.freeMinutesUsed).toBe(120);
    expect(q.billedMinutes).toBe(120);
    expect(q.totalMinor).toBe(600_000);
  });

  it("una reserva enteramente cubierta no cuesta nada", () => {
    const q = quoteBooking({
      minutes: 120,
      customerType: "MEMBER",
      ...precios,
      freeMinutesAvailable: 120,
    });
    expect(q.billedMinutes).toBe(0);
    expect(q.totalMinor).toBe(0);
  });

  it("no se consumen más minutos bonificados que los que dura la reserva", () => {
    const q = quoteBooking({
      minutes: 60,
      customerType: "MEMBER",
      ...precios,
      freeMinutesAvailable: 500,
    });
    expect(q.freeMinutesUsed).toBe(60);
    expect(q.totalMinor).toBe(0);
  });

  it("media hora cuesta la mitad de la hora", () => {
    const q = quoteBooking({
      minutes: 30,
      customerType: "MEMBER",
      ...precios,
      freeMinutesAvailable: 0,
    });
    expect(q.totalMinor).toBe(150_000);
  });

  it("un precio que no parte exacto se redondea al centavo, sin colas", () => {
    // $1.000,01 la hora, 20 minutos: 100001 * 20 / 60 = 33333,67 → 33334.
    const q = quoteBooking({
      minutes: 20,
      customerType: "MEMBER",
      memberHourlyPriceMinor: 100_001,
      nonMemberHourlyPriceMinor: 200_000,
      freeMinutesAvailable: 0,
    });
    expect(q.totalMinor).toBe(33_334);
    expect(Number.isInteger(q.totalMinor)).toBe(true);
  });

  it("un saldo bonificado negativo o absurdo se trata como cero", () => {
    const q = quoteBooking({
      minutes: 60,
      customerType: "MEMBER",
      ...precios,
      freeMinutesAvailable: -10,
    });
    expect(q.freeMinutesUsed).toBe(0);
    expect(q.totalMinor).toBe(300_000);
  });

  it("una duración inválida no genera un precio inventado", () => {
    const q = quoteBooking({
      minutes: 0,
      customerType: "MEMBER",
      ...precios,
      freeMinutesAvailable: 120,
    });
    expect(q.billedMinutes).toBe(0);
    expect(q.freeMinutesUsed).toBe(0);
    expect(q.totalMinor).toBe(0);
  });
});

describe("el desglose que lee la persona", () => {
  it("dice qué parte es bonificada y qué parte se paga", () => {
    const q = quoteBooking({
      minutes: 240,
      customerType: "MEMBER",
      ...precios,
      freeMinutesAvailable: 120,
    });
    const lineas = describeQuote(q, 240);
    expect(lineas.join(" | ")).toContain("2 h bonificadas");
    expect(lineas.join(" | ")).toContain("$");
  });

  it("cuando no hay bonificación no habla de bonificación", () => {
    const q = quoteBooking({
      minutes: 60,
      customerType: "NON_MEMBER",
      ...precios,
      freeMinutesAvailable: 0,
    });
    expect(describeQuote(q, 60).join(" ")).not.toContain("bonificada");
  });

  it("una reserva sin cargo lo dice con todas las letras", () => {
    const q = quoteBooking({
      minutes: 120,
      customerType: "MEMBER",
      ...precios,
      freeMinutesAvailable: 120,
    });
    expect(describeQuote(q, 120).join(" ")).toContain("Sin cargo");
  });
});
