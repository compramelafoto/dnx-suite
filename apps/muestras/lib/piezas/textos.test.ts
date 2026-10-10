import { describe, expect, it } from "vitest";
import { dayEndAr, dayStartAr } from "@repo/muestras";
import { autorDeObra, datosDeCartel, detalleDeObra, lugarDeMuestra, nombreDePieza, urlVisible } from "./textos";

const a = {
  id: "cka1", slug: "miradas-abc", title: "Miradas del litoral", organizersText: "Foto Club Rosario",
  curatorialText: "Uno.\n\nDos.", curatorCredits: "Curaduría: Ana Pérez",
  startsAt: dayStartAr("2026-11-05"), endsAt: dayEndAr("2026-11-20"), scheduleText: "Martes a domingo, 15 a 20",
  venueName: "Centro Cultural Parque España", address: "Sarmiento 1", city: "Rosario", province: "Santa Fe",
};

describe("textos de las piezas", () => {
  it("datos del cartel", () => {
    expect(datosDeCartel(a, "https://muestrasfotograficas.com")).toEqual({
      titulo: "Miradas del litoral",
      organizan: "Organiza: Foto Club Rosario",
      curaduria: "Curaduría: Ana Pérez",
      texto: "Uno.\n\nDos.",
      fechas: "Del 5 al 20 de noviembre de 2026",
      horarios: "Martes a domingo, 15 a 20",
      lugar: "Centro Cultural Parque España, Sarmiento 1, Rosario, Santa Fe",
      url: "https://muestrasfotograficas.com/q/m/cka1",
    });
  });
  it("lo que falta queda en null", () => {
    const d = datosDeCartel({ ...a, organizersText: " ", curatorialText: null, curatorCredits: "", scheduleText: null, venueName: null, address: null, city: null, province: null }, "https://x.com");
    expect([d.organizan, d.curaduria, d.texto, d.horarios, d.lugar]).toEqual([null, null, null, null, null]);
  });
  it("detalle, autor y lugar", () => {
    expect(detalleDeObra({ year: 2025, technique: " Copia pigmentaria " })).toBe("2025. Copia pigmentaria");
    expect(detalleDeObra({ year: null, technique: null })).toBeNull();
    expect(autorDeObra("  ")).toBe("Autor sin indicar");
    expect(lugarDeMuestra({ venueName: "Sala", address: null, city: "Rosario", province: null })).toBe("Sala, Rosario");
  });
  it("dirección visible sin protocolo y nombres de archivo seguros", () => {
    expect(urlVisible("https://muestrasfotograficas.com/", "/m/x/libro")).toBe("muestrasfotograficas.com/m/x/libro");
    expect(nombreDePieza("marcos", "miradas-abc", ["A3", "remarco"])).toBe("marcos-miradas-abc-A3-remarco");
    expect(nombreDePieza("cartel", "a b/../c", ["50x70"])).toBe("cartel-a-b----c-50x70");
  });
});
