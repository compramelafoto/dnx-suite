import { describe, expect, it } from "vitest";
import { textoAsistencia, textoLugarLiberado } from "./textos-inauguracion";

const base = {
  nombre: "Ana", muestra: "Rosario", cuando: "Sábado 14 de noviembre, 19 h", lugar: "Sala, Calle 1, Rosario",
  invitacion: "https://muestrasfotograficas.com/m/rosario/inauguracion", ics: "https://muestrasfotograficas.com/m/rosario/inauguracion/evento.ics",
};
const enlace = "https://muestrasfotograficas.com/m/rosario/inauguracion/r/x";

describe("textos de la inauguración", () => {
  it("confirmada: día y hora, sede, enlace personal y agendar", () => {
    const t = textoAsistencia({ ...base, estado: "CONFIRMED", enlace });
    expect(t.subject).toBe("Confirmaste tu asistencia a la inauguración de «Rosario»");
    const todo = t.parrafos.join(" ");
    expect(todo).toMatch(/Sábado 14 de noviembre, 19 h/);
    expect(todo).toMatch(/Sala, Calle 1, Rosario/);
    expect(todo).toContain(base.ics);
    expect(t.enlace.url).toBe(enlace);
  });
  it("lista de espera", () => {
    const t = textoAsistencia({ ...base, estado: "WAITLIST", enlace });
    expect(t.subject).toBe("Quedaste en lista de espera para la inauguración de «Rosario»");
    expect(t.parrafos.join(" ")).toMatch(/orden de llegada/);
  });
  it("se liberó un lugar: sin enlace personal (no lo guardamos), con la invitación y agendar", () => {
    const t = textoLugarLiberado(base);
    expect(t.subject).toBe("Se liberó un lugar: te esperamos en la inauguración de «Rosario»");
    const todo = t.parrafos.join(" ");
    expect(todo).toMatch(/Sábado 14 de noviembre/);
    expect(todo).toContain(base.ics);
    expect(t.enlace.url).toBe(base.invitacion);
  });
});
