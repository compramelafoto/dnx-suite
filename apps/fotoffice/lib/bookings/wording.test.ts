import { describe, expect, it } from "vitest";
import { bookingWording } from "./wording";

describe("cómo habla la agenda pública", () => {
  it("sin configurar, habla de espacios como siempre (SFPR no cambia)", () => {
    const w = bookingWording({});
    expect(w.kind).toBe("ESPACIOS");
    expect(w.pageTitle).toBe("Alquilar un espacio");
    expect(w.backLabel).toBe("Volver a los espacios");
  });

  it("una barbería saca turnos con barberos", () => {
    const w = bookingWording({ agendaKind: "PROFESIONALES", resourceSingular: "Barbero", resourcePlural: "Barberos" });
    expect(w.pageTitle).toBe("Reservá tu turno");
    expect(w.singular).toBe("barbero");
    expect(w.backLabel).toBe("Elegir otro barbero");
    expect(w.emptyText).toContain("barberos");
  });

  it("con sólo el singular arma el plural", () => {
    expect(bookingWording({ agendaKind: "PROFESIONALES", resourceSingular: "barbero" }).plural).toBe("barberos");
  });

  it("un tipo desconocido cae en espacios", () => {
    expect(bookingWording({ agendaKind: "OTRA COSA" }).kind).toBe("ESPACIOS");
  });
});
