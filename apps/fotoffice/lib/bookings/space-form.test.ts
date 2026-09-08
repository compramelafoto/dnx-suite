import { describe, expect, it } from "vitest";
import { parseArsToMinor, parseSpaceForm } from "./space-form";

function form(campos: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) {
    if (Array.isArray(v)) v.forEach((x) => fd.append(k, x));
    else fd.set(k, v);
  }
  return fd;
}

const completo = {
  name: "Estudio de fotografía",
  slotMinutes: "60",
  minBookingMinutes: "60",
  maxBookingMinutes: "",
  bufferMinutes: "0",
  minAdvanceHours: "2",
  maxAdvanceDays: "90",
  memberHourlyPriceArs: "3.000,00",
  nonMemberHourlyPriceArs: "5000",
  memberFreeHoursPerMonth: "2",
  "hours.6": ["09:00-13:00"],
};

describe("importes escritos a mano", () => {
  it("acepta el formato argentino con puntos y coma", () => {
    expect(parseArsToMinor("3.000,50")).toBe(300_050);
  });

  it("acepta un número pelado", () => {
    expect(parseArsToMinor("5000")).toBe(500_000);
  });

  it("acepta el signo pesos y los espacios", () => {
    expect(parseArsToMinor(" $ 1.200 ")).toBe(120_000);
  });

  it("rechaza lo que no es un importe", () => {
    expect(parseArsToMinor("gratis")).toBeNull();
    expect(parseArsToMinor("")).toBeNull();
    expect(parseArsToMinor("-100")).toBeNull();
  });

  it("cero es un importe válido: un espacio puede no cobrarse", () => {
    expect(parseArsToMinor("0")).toBe(0);
  });
});

describe("el formulario de un espacio", () => {
  it("un formulario completo se acepta", () => {
    const r = parseSpaceForm(form(completo));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.name).toBe("Estudio de fotografía");
    expect(r.values.memberHourlyPriceMinor).toBe(300_000);
    expect(r.values.nonMemberHourlyPriceMinor).toBe(500_000);
    expect(r.values.memberFreeHoursPerMonth).toBe(2);
    expect(r.values.maxBookingMinutes).toBeNull();
  });

  it("los horarios se leen como día y minutos desde medianoche", () => {
    const r = parseSpaceForm(form(completo));
    expect(r.ok && r.values.weeklyHours).toEqual([
      { weekday: 6, startMinute: 540, endMinute: 780 },
    ]);
  });

  it("varios tramos en el mismo día se aceptan, en una línea cada uno", () => {
    const r = parseSpaceForm(form({ ...completo, "hours.6": ["09:00-13:00\n16:00-21:00"] }));
    expect(r.ok && r.values.weeklyHours).toHaveLength(2);
  });

  it("un tramo que termina antes de empezar se rechaza", () => {
    const r = parseSpaceForm(form({ ...completo, "hours.6": ["13:00-09:00"] }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("horario");
  });

  it("un espacio sin nombre se rechaza", () => {
    expect(parseSpaceForm(form({ ...completo, name: "  " })).ok).toBe(false);
  });

  it("un espacio sin ningún horario se rechaza", () => {
    const sinHoras: Record<string, string | string[]> = { ...completo };
    delete sinHoras["hours.6"];
    const r = parseSpaceForm(form(sinHoras));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("horario");
  });

  it("un precio ilegible se rechaza y dice cuál", () => {
    const r = parseSpaceForm(form({ ...completo, memberHourlyPriceArs: "tres mil" }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("socios");
  });

  it("una duración mínima que no cae en la grilla se rechaza", () => {
    const r = parseSpaceForm(form({ ...completo, slotMinutes: "60", minBookingMinutes: "45" }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("múltiplo");
  });

  it("un tramo que no arranca en la grilla se rechaza al guardar, no al reservar", () => {
    // Sin esta validación, un espacio con grilla de una hora que abre 09:20 se guardaría
    // y después no ofrecería turnos que nadie sabría explicar.
    const r = parseSpaceForm(form({ ...completo, "hours.6": ["09:20-13:20"] }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("grilla");
  });

  it("un tramo más corto que la duración mínima se rechaza", () => {
    const r = parseSpaceForm(form({ ...completo, "hours.6": ["09:00-09:30"] }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("corto");
  });

  it("las horas bonificadas por defecto son cero", () => {
    const r = parseSpaceForm(form({ ...completo, memberFreeHoursPerMonth: "" }));
    expect(r.ok && r.values.memberFreeHoursPerMonth).toBe(0);
  });

  it("las compatibilidades llegan como lista de identificadores", () => {
    const r = parseSpaceForm(form({ ...completo, compatibleWith: ["coworking", "salon"] }));
    expect(r.ok && r.values.compatibleWith).toEqual(["coworking", "salon"]);
  });

  it("sin compatibilidades declaradas, la lista queda vacía y el espacio bloquea a todos", () => {
    const r = parseSpaceForm(form(completo));
    expect(r.ok && r.values.compatibleWith).toEqual([]);
  });
});
