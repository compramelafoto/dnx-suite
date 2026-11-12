import { describe, expect, it } from "vitest";
import { CUESTIONARIO_REGISTRO_DOCENTE as C } from "./cuestionarios/registro-docente";
import { cuestionarioPorClave } from "./cuestionarios";
import { faltantes, respuestasEnTexto, seMuestra } from "./tipos";

const preguntas = C.secciones.flatMap((s) => s.preguntas);

describe("cuestionario registro-docente", () => {
  it("está registrado por su clave", () => {
    expect(cuestionarioPorClave("registro-docente-v1")).toBe(C);
  });

  it("no repite ids y cada condición apunta a una pregunta que existe", () => {
    const ids = preguntas.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of preguntas) {
      const conds = p.mostrarSi ? (Array.isArray(p.mostrarSi) ? p.mostrarSi : [p.mostrarSi]) : [];
      for (const c of conds) expect(ids, `${p.id} → ${c.pregunta}`).toContain(c.pregunta);
    }
  });

  it("pregunta lo que hace falta para configurar: períodos, cálculo, Mi Escuela, señal y familias", () => {
    const ids = preguntas.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining(["periodos_esquema", "nota_periodo_como", "mi_escuela_quien", "senal", "cursos", "familias_quiere"]),
    );
  });

  it("muestra los pesos sólo si calcula con pesos", () => {
    const pesos = preguntas.find((p) => p.id === "pesos")!;
    expect(seMuestra(pesos, { nota_periodo_como: "promedio" })).toBe(false);
    expect(seMuestra(pesos, { nota_periodo_como: "pesos" })).toBe(true);
  });

  it("con lo obligatorio respondido se puede enviar y el resumen lista los cursos", () => {
    const r = {
      nivel: ["secundaria"],
      ciclo_inicio: "2027",
      mi_escuela_quien: "yo",
      periodos_esquema: "cuatrimestral",
      nota_periodo_como: "mezcla",
      senal: "a_veces",
      lo_que_mas: "Cerrar el cuatrimestre sin pasar notas dos veces",
      cursos: [{ escuela: "Esc. 123", curso: "3.º B", materia: "Historia", turno: "manana" }],
    };
    expect(faltantes(C, r)).toEqual([]);
    const texto = respuestasEnTexto(C, r, "Belén Saldaña");
    expect(texto).toContain("Escuela (nombre o número): Esc. 123 · Año y división: 3.º B · Materia: Historia · Turno: Mañana");
  });
});
