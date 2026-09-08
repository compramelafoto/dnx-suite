import { describe, expect, it } from "vitest";
import { totalForBooking } from "./portal";

const quote = {
  freeMinutesUsed: 120,
  billedMinutes: 120,
  hourlyPriceMinor: 300_000,
  totalMinor: 600_000,
};

describe("el total que ve el socio", () => {
  it("suma el espacio y los extras elegidos", () => {
    expect(totalForBooking({ quote, extrasMinor: 50_000 })).toBe(650_000);
  });

  it("sin extras, es solo el espacio", () => {
    expect(totalForBooking({ quote, extrasMinor: 0 })).toBe(600_000);
  });

  it("las horas bonificadas NO cubren los extras", () => {
    // Es la regla del diseño: el espacio sale $0 y la máquina de humo se paga igual.
    const cubierta = { ...quote, billedMinutes: 0, totalMinor: 0 };
    expect(totalForBooking({ quote: cubierta, extrasMinor: 50_000 })).toBe(50_000);
  });

  it("una reserva enteramente bonificada y sin extras no cuesta nada", () => {
    const cubierta = { ...quote, billedMinutes: 0, totalMinor: 0 };
    expect(totalForBooking({ quote: cubierta, extrasMinor: 0 })).toBe(0);
  });

  it("un importe de extras absurdo no ensucia el total", () => {
    expect(totalForBooking({ quote, extrasMinor: -1 })).toBe(600_000);
    expect(totalForBooking({ quote, extrasMinor: Number.NaN })).toBe(600_000);
  });
});
