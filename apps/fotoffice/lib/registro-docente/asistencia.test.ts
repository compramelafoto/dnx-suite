import { describe, expect, it } from "vitest";
import { faltaDe, fechaArgentina, ganaLaNueva, horaArgentina, resumirAsistencia } from "./asistencia";

const R = { faltaPorTarde: 0.5, faltaPorRetiro: 0.5, justificadaCuenta: true, limiteFaltas: 15 };

describe("asistencia", () => {
  it("cuenta faltas según las reglas", () => {
    expect(faltaDe("AUSENTE", R)).toBe(1);
    expect(faltaDe("TARDE", R)).toBe(0.5);
    expect(faltaDe("JUSTIFICADA", { ...R, justificadaCuenta: false })).toBe(0);
    expect(faltaDe("PRESENTE", R)).toBe(0);
  });

  it("resume porcentaje y límite", () => {
    const r = resumirAsistencia(["PRESENTE", "AUSENTE", "TARDE", "PRESENTE"], R);
    expect(r.faltas).toBe(1.5);
    expect(r.porcentaje).toBe(62.5);
    expect(r.conteo.TARDE).toBe(1);
    expect(r.superaLimite).toBe(false);
  });

  it("avisa cerca del límite y al pasarlo", () => {
    const doce = Array(12).fill("AUSENTE");
    expect(resumirAsistencia(doce, R).cercaDelLimite).toBe(true);
    expect(resumirAsistencia([...doce, ...Array(4).fill("AUSENTE")], R).superaLimite).toBe(true);
    expect(resumirAsistencia(doce, { ...R, limiteFaltas: null }).cercaDelLimite).toBe(false);
    expect(resumirAsistencia([], R).porcentaje).toBeNull();
  });

  it("hora y fecha en Argentina, no en la zona del aparato", () => {
    const d = new Date("2027-03-02T02:30:00Z"); // 01/03 23:30 en Argentina
    expect(fechaArgentina(d)).toBe("2027-03-01");
    expect(horaArgentina(d)).toBe("23:30");
  });

  it("gana la versión anotada después", () => {
    expect(ganaLaNueva(null, new Date())).toBe(true);
    expect(ganaLaNueva(new Date("2027-03-01T10:00:00Z"), new Date("2027-03-01T09:00:00Z"))).toBe(false);
    expect(ganaLaNueva(new Date("2027-03-01T10:00:00Z"), new Date("2027-03-01T10:00:00Z"))).toBe(true);
  });
});
