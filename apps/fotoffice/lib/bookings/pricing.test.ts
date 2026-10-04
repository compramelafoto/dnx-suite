import { describe, expect, it } from "vitest";
import { describeQuote, etiquetaDePrecio, quoteBooking, quoteForSpace, spacePriceLabel } from "./pricing";

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

/*
 * El modo por bloque, con los dos casos reales de SFPR:
 *   estudio → paquetes de 2 h a $30.000 socio / $40.000 no socio, con 2 h bonificadas al mes
 *   salón   → precio plano por jornada, $140.000 socio / $200.000 no socio, mínimo 3 h
 */
const ESTUDIO = {
  mode: "BLOCK" as const,
  blockMinutes: 120,
  memberBlockPriceMinor: 3_000_000,
  nonMemberBlockPriceMinor: 4_000_000,
  memberHourlyPriceMinor: 0,
  nonMemberHourlyPriceMinor: 0,
};

const SALON = {
  mode: "BLOCK" as const,
  blockMinutes: null,
  memberBlockPriceMinor: 14_000_000,
  nonMemberBlockPriceMinor: 20_000_000,
  memberHourlyPriceMinor: 0,
  nonMemberHourlyPriceMinor: 0,
};

describe("cobro por bloque: el estudio", () => {
  it("el socio usa sus 2 horas bonificadas y no paga nada", () => {
    const q = quoteBooking({ ...ESTUDIO, minutes: 120, customerType: "MEMBER", freeMinutesAvailable: 120 });
    expect(q.blocksFree).toBe(1);
    expect(q.blocksBilled).toBe(0);
    expect(q.totalMinor).toBe(0);
  });

  it("cuatro horas con la bonificación intacta: un bloque gratis y uno a $30.000", () => {
    const q = quoteBooking({ ...ESTUDIO, minutes: 240, customerType: "MEMBER", freeMinutesAvailable: 120 });
    expect(q.blocksFree).toBe(1);
    expect(q.blocksBilled).toBe(1);
    expect(q.totalMinor).toBe(3_000_000);
  });

  it("el socio que ya gastó la bonificación paga el paquete entero", () => {
    const q = quoteBooking({ ...ESTUDIO, minutes: 120, customerType: "MEMBER", freeMinutesAvailable: 0 });
    expect(q.totalMinor).toBe(3_000_000);
  });

  it("el no socio paga $40.000 las dos horas, y no tiene bonificación aunque se la pasen", () => {
    const q = quoteBooking({ ...ESTUDIO, minutes: 120, customerType: "NON_MEMBER", freeMinutesAvailable: 999 });
    expect(q.blocksFree).toBe(0);
    expect(q.totalMinor).toBe(4_000_000);
  });

  it("una hora y media ocupa un paquete entero: no se cobra medio bloque", () => {
    const q = quoteBooking({ ...ESTUDIO, minutes: 90, customerType: "NON_MEMBER", freeMinutesAvailable: 0 });
    expect(q.blocksBilled).toBe(1);
    expect(q.totalMinor).toBe(4_000_000);
  });

  it("media hora bonificada no alcanza para cubrir un paquete de dos", () => {
    const q = quoteBooking({ ...ESTUDIO, minutes: 120, customerType: "MEMBER", freeMinutesAvailable: 30 });
    expect(q.blocksFree).toBe(0);
    expect(q.totalMinor).toBe(3_000_000);
  });

  it("seis horas son tres paquetes", () => {
    const q = quoteBooking({ ...ESTUDIO, minutes: 360, customerType: "NON_MEMBER", freeMinutesAvailable: 0 });
    expect(q.blocksBilled).toBe(3);
    expect(q.totalMinor).toBe(12_000_000);
  });

  it("en modo bloque no hay precio por hora que mostrar", () => {
    const q = quoteBooking({ ...ESTUDIO, minutes: 120, customerType: "MEMBER", freeMinutesAvailable: 0 });
    expect(q.hourlyPriceMinor).toBe(0);
    expect(q.mode).toBe("BLOCK");
  });
});

describe("cobro por bloque: el salón, precio por jornada", () => {
  it("tres horas o cinco, el socio paga lo mismo", () => {
    const tres = quoteBooking({ ...SALON, minutes: 180, customerType: "MEMBER", freeMinutesAvailable: 0 });
    const cinco = quoteBooking({ ...SALON, minutes: 300, customerType: "MEMBER", freeMinutesAvailable: 0 });
    expect(tres.totalMinor).toBe(14_000_000);
    expect(cinco.totalMinor).toBe(14_000_000);
  });

  it("ocho horas tampoco suman: es por jornada", () => {
    const q = quoteBooking({ ...SALON, minutes: 480, customerType: "NON_MEMBER", freeMinutesAvailable: 0 });
    expect(q.blocksBilled).toBe(1);
    expect(q.totalMinor).toBe(20_000_000);
  });

  it("el no socio paga $200.000", () => {
    const q = quoteBooking({ ...SALON, minutes: 180, customerType: "NON_MEMBER", freeMinutesAvailable: 0 });
    expect(q.totalMinor).toBe(20_000_000);
  });
});

describe("cómo se anuncia el precio", () => {
  it("por bloque dice el paquete, nunca un precio por hora", () => {
    const t = etiquetaDePrecio({ mode: "BLOCK", hourlyPriceMinor: 0, blockPriceMinor: 4_000_000, blockMinutes: 120 });
    expect(t).toContain("cada 2 h");
    expect(t).not.toContain("por hora");
  });

  it("sin tamaño de bloque, habla de jornada", () => {
    const t = etiquetaDePrecio({ mode: "BLOCK", hourlyPriceMinor: 0, blockPriceMinor: 20_000_000, blockMinutes: null });
    expect(t).toContain("por jornada");
  });

  it("por hora sigue diciendo por hora", () => {
    const t = etiquetaDePrecio({ mode: "HOURLY", hourlyPriceMinor: 1_000_000, blockPriceMinor: 0, blockMinutes: null });
    expect(t).toContain("por hora");
  });
});

describe("el desglose en modo bloque", () => {
  it("nombra el bloque bonificado y el que se cobra", () => {
    const q = quoteBooking({ ...ESTUDIO, minutes: 240, customerType: "MEMBER", freeMinutesAvailable: 120 });
    const lineas = describeQuote(q, 240, 120);
    expect(lineas[0]).toContain("bonificado por ser socio");
    expect(lineas[1]).toContain("1 × 2 h");
    expect(lineas[2]).toContain("Total");
  });

  it("la jornada no inventa un precio por hora", () => {
    const q = quoteBooking({ ...SALON, minutes: 300, customerType: "NON_MEMBER", freeMinutesAvailable: 0 });
    const lineas = describeQuote(q, 300, null);
    expect(lineas.join(" ")).toContain("Jornada");
    expect(lineas.join(" ")).not.toContain("por hora");
  });
});

describe("el precio según cómo cobra el espacio (SFPR)", () => {
  const estudio = {
    pricingMode: "BLOCK" as const,
    blockMinutes: 120,
    memberHourlyPriceMinor: 1_000_000,
    nonMemberHourlyPriceMinor: 2_500_000,
    memberBlockPriceMinor: 3_000_000,
    nonMemberBlockPriceMinor: 4_000_000,
  };
  const salon = { ...estudio, blockMinutes: null, memberBlockPriceMinor: 14_000_000, nonMemberBlockPriceMinor: 20_000_000 };

  it("el socio con sus 2 h del mes no paga las primeras 2 horas del estudio", () => {
    expect(quoteForSpace(estudio, { minutes: 120, customerType: "MEMBER", freeMinutesAvailable: 120 }).totalMinor).toBe(0);
  });

  it("el socio sin bonificación paga $30.000 el paquete, no el precio por hora viejo", () => {
    expect(quoteForSpace(estudio, { minutes: 120, customerType: "MEMBER", freeMinutesAvailable: 0 }).totalMinor).toBe(3_000_000);
  });

  it("el no socio paga $40.000 aunque use una sola hora", () => {
    expect(quoteForSpace(estudio, { minutes: 60, customerType: "NON_MEMBER", freeMinutesAvailable: 120 }).totalMinor).toBe(4_000_000);
  });

  it("el salón por una hora cobra la jornada entera", () => {
    expect(quoteForSpace(salon, { minutes: 60, customerType: "MEMBER", freeMinutesAvailable: 0 }).totalMinor).toBe(14_000_000);
    expect(quoteForSpace(salon, { minutes: 480, customerType: "NON_MEMBER", freeMinutesAvailable: 0 }).totalMinor).toBe(20_000_000);
  });

  it("la etiqueta nunca dice 'por hora' en un espacio por bloque", () => {
    expect(spacePriceLabel(estudio, "MEMBER")).toMatch(/30\.000.*cada 2 h/);
    expect(spacePriceLabel(salon, "NON_MEMBER")).toMatch(/200\.000.*por jornada/);
    expect(spacePriceLabel(estudio, "MEMBER")).not.toMatch(/hora/);
  });
});
