import { describe, expect, it } from "vitest";
import { armarFicha, textoFaltan, type DatosFicha } from "./ficha-publica";
import { formasDePagoEnCorto } from "@/components/presupuestos/portada-presupuesto";

const AHORA = new Date("2026-10-28T15:00:00Z");

const base: DatosFicha = {
  cliente: { kind: "PERSONA", firstName: "Sofía Belén", lastName: "Gómez", businessName: null },
  consulta: {
    categoria: "Cumpleaños de 15",
    eventStartsAt: new Date("2026-11-16T00:00:00Z"),
    eventTimeKnown: false,
    venue: "Salón La Arbolada, Funes",
    ceremonyVenue: null,
    receptionVenue: null,
    city: "Funes",
    guests: 150,
    partnerOneName: null,
    partnerTwoName: null,
  },
  lead: null,
  enviado: new Date("2026-10-27T18:30:00Z"),
  preparadoPor: "Daniel Cuart",
};

describe("armarFicha", () => {
  it("arma el nombre, el evento y la fecha sin hora (el día guardado tal cual)", () => {
    const f = armarFicha(base, AHORA);
    expect(f.cliente).toBe("Sofía Belén Gómez");
    expect(f.nombrePila).toBe("Sofía");
    expect(f.evento).toBe("Cumpleaños de 15");
    expect(f.fecha).toBe("lunes, 16 de noviembre de 2026");
    expect(f.hora).toBeNull();
    expect(f.faltan).toBe("Faltan 19 días");
    expect(f.lugares).toEqual([{ etiqueta: "Lugar", valor: "Salón La Arbolada, Funes" }]);
    expect(f.invitados).toBe(150);
    expect(f.emitido).toBe("27/10/2026");
    expect(f.preparadoPor).toBe("Daniel Cuart");
  });

  it("con hora conocida la muestra en hora argentina", () => {
    const f = armarFicha({ ...base, consulta: { ...base.consulta!, eventStartsAt: new Date("2027-03-21T00:30:00Z"), eventTimeKnown: true } }, AHORA);
    expect(f.fecha).toBe("sábado, 20 de marzo de 2027");
    expect(f.hora).toBe("21:30");
    expect(f.faltan).toBe("Faltan 4 meses");
  });

  it("boda: novios, ceremonia y fiesta sin repetir el lugar", () => {
    const f = armarFicha(
      {
        ...base,
        consulta: { ...base.consulta!, categoria: "Boda", partnerOneName: "Ana", partnerTwoName: "Juan", ceremonyVenue: "Parroquia", receptionVenue: "Los Robles", venue: "los robles" },
      },
      AHORA,
    );
    expect(f.pareja).toBe("Ana y Juan");
    expect(f.lugares).toEqual([
      { etiqueta: "Ceremonia", valor: "Parroquia" },
      { etiqueta: "Fiesta", valor: "Los Robles" },
    ]);
  });

  it("empresa: razón social y sin nombre de pila; sin consulta, usa lo viejo", () => {
    const f = armarFicha(
      {
        cliente: { kind: "EMPRESA", firstName: "Juan", lastName: null, businessName: "Eventos SA" },
        consulta: null,
        lead: { eventDate: new Date("2026-10-20T00:00:00Z"), eventLocation: "Rosario" },
        enviado: null,
        preparadoPor: null,
      },
      AHORA,
    );
    expect(f.cliente).toBe("Eventos SA");
    expect(f.nombrePila).toBeNull();
    expect(f.lugares).toEqual([{ etiqueta: "Lugar", valor: "Rosario" }]);
    expect(f.faltan).toBeNull();
    expect(f.evento).toBeNull();
  });

  it("textoFaltan", () => {
    expect(textoFaltan(0)).toBe("¡Es hoy!");
    expect(textoFaltan(1)).toBe("Falta 1 día");
    expect(textoFaltan(-3)).toBeNull();
  });
});

describe("formasDePagoEnCorto", () => {
  it("contado con ahorro y cuotas sin interés, en orden y sin repetir", () => {
    const o = (id: string, cuotas: number, total: number) => ({ id, etiqueta: id, cuotas, importeCuota: total / cuotas, total, nota: null, medio: null, sena: 0 });
    expect(formasDePagoEnCorto([o("c6", 4, 1000), o("c3", 3, 1000), o("contado", 1, 900), o("otra", 3, 1000)], 1000)).toEqual([
      "1 pago · ahorrás 10 %",
      "3 cuotas sin interés",
      "4 cuotas sin interés",
    ]);
  });
});
