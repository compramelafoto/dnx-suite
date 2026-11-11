import { describe, expect, it } from "vitest";
import { CUESTIONARIO_CLUB_POR_SUSCRIPCION as C } from "./cuestionarios/club-por-suscripcion";
import { cuestionarioPorClave } from "./cuestionarios";
import { faltantes, limpiarRespuestas, respuestasEnTexto, seMuestra } from "./tipos";

const preguntas = C.secciones.flatMap((s) => s.preguntas);
const pregunta = (id: string) => preguntas.find((p) => p.id === id)!;

describe("cuestionario club-suscripcion (SOYBELUZ)", () => {
  it("está registrado por su clave", () => {
    expect(cuestionarioPorClave("club-suscripcion-v1")).toBe(C);
  });

  it("no repite ids y cada condición apunta a una pregunta que existe", () => {
    const ids = preguntas.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of preguntas) {
      const conds = p.mostrarSi ? (Array.isArray(p.mostrarSi) ? p.mostrarSi : [p.mostrarSi]) : [];
      for (const c of conds) expect(ids, `${p.id} → ${c.pregunta}`).toContain(c.pregunta);
    }
  });

  it("trae los diez BOX ya cargados, en orden, para completar los materiales", () => {
    const box = pregunta("box_contenido");
    if (box.tipo !== "lista") throw new Error("tipo");
    expect(box.filasIniciales).toHaveLength(10);
    expect(box.filasIniciales?.[0]).toEqual({ numero: "1", nombre: "Mi primer universo creativo: Soltar la mano" });
    expect(box.filasIniciales?.[9]?.numero).toBe("10");
  });

  it("dice «el BOX» y nunca «la BOX», ni «juntas»", () => {
    const todo = JSON.stringify(C);
    expect(todo).not.toMatch(/\bla BOX\b|\blas BOX\b|juntas/i);
  });

  it("pregunta por la cuenta «Renera» y pide otra sólo si no es la suya", () => {
    const otra = pregunta("mp_otra");
    expect(seMuestra(otra, { mp_cuenta: "si" })).toBe(false);
    expect(seMuestra(otra, { mp_cuenta: "otra" })).toBe(true);
  });

  it("con lo obligatorio respondido se puede enviar", () => {
    expect(faltantes(C, {})).toContain("Cobros: ¿La cuenta de Mercado Pago «Renera» es la tuya, donde querés recibir el dinero de las cuotas?");
    const minimo = {
      nombre_completo: "María Belén Saldaña",
      email_acceso: "b@ejemplo.com",
      contacto_publico_ok: true,
      mp_cuenta: "si",
      box_envio_incluido: "incluido",
      vivo_horario_ok: true,
      vivo_primera: "2026-11-19",
      revision_venta: "ok",
      revision_sobre: "ok",
      revision_materiales: "no_vi",
      instagram: "yo",
    };
    expect(faltantes(C, minimo)).toEqual([]);
  });

  it("el resumen muestra los BOX con sus materiales", () => {
    const r = limpiarRespuestas(C, {
      box_contenido: [{ numero: "1", nombre: "Soltar la mano", materiales: "Lápiz 2B\nCuaderno A5", hack: "x" }],
    });
    const texto = respuestasEnTexto(C, r, "María Belén Saldaña");
    expect(texto).toContain("# Lo que falta para abrir el Club — María Belén Saldaña");
    expect(texto).toContain("1. N°: 1 · Nombre: Soltar la mano · Materiales (uno por renglón): Lápiz 2B");
    expect(texto).not.toContain("hack");
  });
});
