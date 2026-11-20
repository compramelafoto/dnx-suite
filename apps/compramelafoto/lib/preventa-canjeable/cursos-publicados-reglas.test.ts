import { describe, expect, it } from "vitest";
import {
  anotadosEsperan,
  cursoDelPackTodaviaNoEsta,
  packsAAvisar,
  parseCursoIds,
  resolverCursosPorNombre,
  resumirCursos,
  type MarcaDeCurso,
  type PackConCurso,
} from "./cursos-publicados-reglas";

const pack = (orderId: number, schoolCourseId: number | null, extra: Partial<PackConCurso> = {}): PackConCurso => ({
  orderId,
  schoolCourseId,
  canjeado: false,
  avisoAt: null,
  tieneEmail: true,
  ...extra,
});
const marcas = (...m: Array<[number, Date | null]>) =>
  new Map<number, MarcaDeCurso>(m.map(([id, avisoAt]) => [id, { schoolCourseId: id, marcadoAt: new Date("2026-11-20T12:00:00Z"), avisoAt }]));

describe("packsAAvisar", () => {
  it("sólo los packs sin canjear de los cursos marcados (Goethe: 3 cursos subidos de 26)", () => {
    const packs = [pack(1, 10), pack(2, 10, { canjeado: true }), pack(3, 11), pack(4, 12), pack(5, null)];
    expect(packsAAvisar(packs, new Set([10, 11]))).toEqual([1, 3]);
  });
  it("sin cursos elegidos, nadie", () => {
    expect(packsAAvisar([pack(1, 10)], new Set())).toEqual([]);
  });
});

describe("resumirCursos", () => {
  it("cuenta familias y estado por curso, respetando el orden de la escuela", () => {
    const r = resumirCursos(
      [
        { id: 10, nombre: "3° A" },
        { id: 11, nombre: "3° B" },
        { id: 12, nombre: "Sala 5" },
        { id: 13, nombre: "4° A" },
      ],
      [pack(1, 10), pack(2, 10, { tieneEmail: false }), pack(3, 11, { canjeado: true }), pack(4, 13, { avisoAt: "2026-11-01T10:00:00.000Z" })],
      marcas([10, null], [11, new Date("2026-11-20T13:00:00Z")])
    );
    expect(r.map((c) => [c.nombre, c.packs, c.pendientes, c.pendientesConEmail, c.estado])).toEqual([
      ["3° A", 2, 2, 1, "esperando_proceso"],
      ["3° B", 1, 0, 0, "avisado"],
      ["Sala 5", 0, 0, 0, "sin_marcar"],
      // Avisado con el botón viejo, antes del aviso por curso.
      ["4° A", 1, 1, 1, "avisado"],
    ]);
  });
});

describe("anotadosEsperan", () => {
  it("sin preventa no esperan", () => {
    expect(anotadosEsperan([], new Map())).toBe(false);
  });
  it("con preventa y sin ningún aviso esperan", () => {
    expect(anotadosEsperan([pack(1, 10)], new Map())).toBe(true);
  });
  it("falta un curso con packs: esperan", () => {
    expect(anotadosEsperan([pack(1, 10), pack(2, 11)], marcas([10, null]))).toBe(true);
  });
  it("todos los cursos con packs publicados (marcados o avisados antes): no esperan", () => {
    expect(anotadosEsperan([pack(1, 10), pack(2, 11, { avisoAt: "2026-11-01T00:00:00.000Z" })], marcas([10, null]))).toBe(false);
  });
  it("packs sin curso (cobrados por fuera): alcanza con un aviso, como antes", () => {
    expect(anotadosEsperan([pack(1, null, { avisoAt: "2026-11-01T00:00:00.000Z" })], new Map())).toBe(false);
  });
});

describe("cursoDelPackTodaviaNoEsta", () => {
  it("el álbum no usa el aviso por curso: nunca frena (álbumes viejos)", () => {
    expect(cursoDelPackTodaviaNoEsta({ schoolCourseId: 10, avisoAt: null }, new Map())).toBe(false);
  });
  it("curso sin marcar y sin aviso: frena", () => {
    expect(cursoDelPackTodaviaNoEsta({ schoolCourseId: 11, avisoAt: null }, marcas([10, null]))).toBe(true);
  });
  it("curso marcado, o pack ya avisado, o sin curso: no frena", () => {
    const m = marcas([10, null]);
    expect(cursoDelPackTodaviaNoEsta({ schoolCourseId: 10, avisoAt: null }, m)).toBe(false);
    expect(cursoDelPackTodaviaNoEsta({ schoolCourseId: 11, avisoAt: "2026-11-01T00:00:00.000Z" }, m)).toBe(false);
    expect(cursoDelPackTodaviaNoEsta({ schoolCourseId: null, avisoAt: null }, m)).toBe(false);
  });
});

describe("resolverCursosPorNombre", () => {
  const cursos = [
    { schoolCourseId: 1, nombre: "3° A" },
    { schoolCourseId: 2, nombre: "3° B" },
    { schoolCourseId: 3, nombre: "Inicial · Sala 5" },
    { schoolCourseId: 4, nombre: "Primario · 6° grado A" },
  ];
  it("acepta cómo lo escribe la fotógrafa", () => {
    expect(resolverCursosPorNombre(["3 a", "3°B", "sala 5", "6 A"], cursos)).toEqual({ ids: [1, 2, 3, 4], noEncontrados: [] });
  });
  it("lo que no existe vuelve en noEncontrados", () => {
    expect(resolverCursosPorNombre(["4° C"], cursos)).toEqual({ ids: [], noEncontrados: ["4° C"] });
  });
});

describe("parseCursoIds", () => {
  it("enteros positivos sin repetir", () => {
    expect(parseCursoIds([3, 3, -1, 0, 2.5, "4", 7])).toEqual([3, 7]);
    expect(parseCursoIds(null)).toEqual([]);
  });
});
