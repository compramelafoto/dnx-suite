import { describe, expect, it } from "vitest";
import { datosFaltantes, leerFormularioFicha, nombreParaSaludo, valorVigente } from "./ficha";

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

describe("ficha de empleada", () => {
  it("el valor de la jornada que rige es el último con fecha desde igual o anterior", () => {
    const valores = [
      { desde: "2026-11-01", v: 2 },
      { desde: "2026-10-01", v: 1 },
    ];
    expect(valorVigente(valores, "2026-10-15")?.v).toBe(1);
    expect(valorVigente(valores, "2026-11-01")?.v).toBe(2);
    expect(valorVigente(valores, "2026-09-30")).toBeNull();
  });

  it("el saludo usa el apodo, si no el primer nombre, si no el correo", () => {
    expect(nombreParaSaludo({ apodo: "Cami", name: "Camila Pérez", email: "c@x.com" })).toBe("Cami");
    expect(nombreParaSaludo({ apodo: " ", name: "Camila Pérez", email: "c@x.com" })).toBe("Camila");
    expect(nombreParaSaludo({ apodo: null, name: null, email: "sabina@x.com" })).toBe("sabina");
  });

  it("lee el horario de lunes a viernes y el sábado alternado", () => {
    const campos: Record<string, string> = { jornadaHoras: "5", activa: "on", sabadosAlternados: "on", sabadoReferencia: "2026-10-24" };
    for (let d = 0; d < 5; d++) {
      campos[`f-${d}-1-inicio`] = "08:00";
      campos[`f-${d}-1-fin`] = "13:00";
    }
    campos["f-5-1-inicio"] = "09:00";
    campos["f-5-1-fin"] = "13:00";
    const r = leerFormularioFicha(form(campos));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.datos.franjas).toHaveLength(6);
    expect(r.datos.jornadaMinutos).toBe(300);
    expect(r.datos.sabadosAlternados).toBe(true);
    expect(r.datos.activa).toBe(true);
  });

  it("rechaza una franja a medias, un sábado de referencia que no es sábado y una jornada absurda", () => {
    expect(leerFormularioFicha(form({ "f-0-1-inicio": "08:00" })).ok).toBe(false);
    expect(leerFormularioFicha(form({ sabadoReferencia: "2026-10-26" })).ok).toBe(false);
    expect(leerFormularioFicha(form({ jornadaHoras: "30" })).ok).toBe(false);
    expect(leerFormularioFicha(form({ fechaNacimiento: "1995-02-30" })).ok).toBe(false);
  });

  it("acepta media hora con coma", () => {
    const r = leerFormularioFicha(form({ jornadaHoras: "4,5" }));
    expect(r.ok && r.datos.jornadaMinutos).toBe(270);
  });

  it("avisa lo que falta cargar", () => {
    expect(datosFaltantes({ fechaNacimiento: null, sabadosAlternados: true, sabadoReferencia: null, franjas: [], valores: [] })).toEqual([
      "el horario semanal",
      "el valor de la jornada",
      "la fecha de nacimiento",
      "qué sábado arranca",
    ]);
  });
});
