import { describe, expect, it } from "vitest";
import { ANOTADA_POR_DEFECTO, alConfirmarEnvio, cambiarHora, completarPresentes, cuerpoDeEnvio, fusionarPlanilla, marcar, marcarSinClase, planillaVacia, resumen } from "./cola-asistencia";

const EST = ["a", "b", "c"];
const t = (h: string) => new Date(`2027-03-01T${h}:00.000Z`);

describe("cola de asistencia", () => {
  it("la primera marca deja a los demás presentes con la hora por defecto", () => {
    const p = marcar(planillaVacia("c1", "2027-03-01"), EST, "b", "AUSENTE", t("10:00"), null);
    expect(p.pendiente).toBe(true);
    expect(p.registros.a).toEqual({ estado: "PRESENTE", horaLlegada: null, anotadaAt: ANOTADA_POR_DEFECTO });
    expect(p.registros.b.estado).toBe("AUSENTE");
    expect(resumen(p, EST)).toMatchObject({ PRESENTE: 2, AUSENTE: 1, sinMarcar: 0 });
  });

  it("tarde guarda la hora; otro estado la borra", () => {
    let p = marcar(planillaVacia("c1", "2027-03-01"), EST, "a", "TARDE", t("10:00"), "08:12");
    expect(p.registros.a.horaLlegada).toBe("08:12");
    p = cambiarHora(p, "a", "08:20", t("10:01"));
    expect(p.registros.a.horaLlegada).toBe("08:20");
    p = marcar(p, EST, "a", "PRESENTE", t("10:02"), "08:30");
    expect(p.registros.a.horaLlegada).toBeNull();
    expect(cambiarHora(p, "a", "09:00", t("10:03"))).toBe(p);
  });

  it("al fusionar gana la marca anotada después, estudiante por estudiante", () => {
    const servidor = { ...planillaVacia("c1", "d"), registros: { a: { estado: "AUSENTE" as const, horaLlegada: null, anotadaAt: t("10:05").toISOString() }, b: { estado: "PRESENTE" as const, horaLlegada: null, anotadaAt: ANOTADA_POR_DEFECTO } } };
    const local = { ...planillaVacia("c1", "d"), pendiente: true, registros: { a: { estado: "PRESENTE" as const, horaLlegada: null, anotadaAt: t("10:00").toISOString() }, b: { estado: "TARDE" as const, horaLlegada: "08:10", anotadaAt: t("10:01").toISOString() } } };
    const f = fusionarPlanilla(servidor, local)!;
    expect(f.registros.a.estado).toBe("AUSENTE");
    expect(f.registros.b.estado).toBe("TARDE");
    expect(f.pendiente).toBe(true);
    expect(fusionarPlanilla(undefined, local)).toBe(local);
    expect(fusionarPlanilla(servidor, undefined)).toBe(servidor);
  });

  it("los presentes por defecto nunca le ganan a una marca real del otro aparato", () => {
    const otro = { ...planillaVacia("c1", "d"), registros: { c: { estado: "AUSENTE" as const, horaLlegada: null, anotadaAt: t("09:00").toISOString() } } };
    const local = marcar(planillaVacia("c1", "d"), EST, "a", "AUSENTE", t("10:00"), null);
    expect(fusionarPlanilla(otro, local)!.registros.c.estado).toBe("AUSENTE");
  });

  it("si se tocó algo mientras viajaba, sigue pendiente", () => {
    const enviada = marcar(planillaVacia("c1", "d"), EST, "a", "AUSENTE", t("10:00"), null);
    expect(alConfirmarEnvio(enviada, enviada).pendiente).toBe(false);
    const despues = marcar(enviada, EST, "b", "AUSENTE", t("10:01"), null);
    expect(alConfirmarEnvio(despues, enviada).pendiente).toBe(true);
  });

  it("sin clase y todos presentes", () => {
    const p = marcarSinClase(planillaVacia("c1", "d"), true, "Paro", t("10:00"));
    expect(p).toMatchObject({ sinClase: true, motivo: "Paro", pendiente: true });
    expect(marcarSinClase(p, false, "Paro", t("10:01")).motivo).toBeNull();
    const q = completarPresentes(marcar(planillaVacia("c1", "d"), ["a"], "a", "AUSENTE", t("10:00"), null), EST, t("10:01"));
    expect(resumen(q, EST)).toMatchObject({ PRESENTE: 2, AUSENTE: 1 });
    expect(cuerpoDeEnvio(q).registros).toHaveLength(3);
  });
});

describe("hora de llegada de la docente", () => {
  it("viaja con la planilla y lo local pendiente gana", async () => {
    const { marcarHoraDocente } = await import("./cola-asistencia");
    const p = marcarHoraDocente(planillaVacia("c1", "d"), "07:55", t("10:00"));
    expect(cuerpoDeEnvio(p).horaDocente).toBe("07:55");
    expect(fusionarPlanilla({ ...planillaVacia("c1", "d"), horaDocente: "08:10" }, p)!.horaDocente).toBe("07:55");
  });
});
