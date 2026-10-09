import { describe, expect, it } from "vitest";
import {
  OBRA_QUITADA_DE_LA_GALERIA, anonymousCodes, assemblyPlan, editorGalleryPlan, needsAssembly, canDecide, canScore, canSeeIdentity, canViewCallImage, curatorOrder, curatorProgress,
  filterForCurator, filterRanking, invitationState, isValidScore, leakedFields, normalizeEmail, rankWorks, selectionRoom,
  stableHash, toCuratorView, type AssemblySource,
} from "./curation";

describe("códigos anónimos", () => {
  it("son únicos aunque haya muchas obras (no dependen de la suerte)", () => {
    const ids = Array.from({ length: 1200 }, (_, i) => `w${i}`);
    const c = anonymousCodes("call1", ids);
    expect(new Set(c.values()).size).toBe(1200);
    expect([...c.values()].every((x) => /^O-\d{4}$/.test(x))).toBe(true);
  });
  it("ancho mínimo 3 y estables", () => {
    const a = anonymousCodes("call1", ["a", "b", "c"]);
    expect([...a.values()].sort()).toEqual(["O-001", "O-002", "O-003"]);
    expect(anonymousCodes("call1", ["c", "b", "a"])).toEqual(a);
  });
  it("no siguen el orden de envío", () => {
    const ids = Array.from({ length: 50 }, (_, i) => `w${String(i).padStart(2, "0")}`);
    const c = anonymousCodes("call1", ids);
    const enOrden = ids.every((id, i) => c.get(id) === `O-${String(i + 1).padStart(3, "0")}`);
    expect(enOrden).toBe(false);
  });
});

describe("orden por curador", () => {
  const filas = Array.from({ length: 30 }, (_, i) => ({ id: `w${i}` }));
  it("es estable para el mismo curador", () => {
    expect(curatorOrder(filas, "cur1", "call1")).toEqual(curatorOrder([...filas].reverse(), "cur1", "call1"));
  });
  it("cambia entre curadores", () => {
    expect(curatorOrder(filas, "cur1", "call1").map((f) => f.id)).not.toEqual(curatorOrder(filas, "cur2", "call1").map((f) => f.id));
  });
  it("el hash es de 14 caracteres hexadecimales", () => expect(stableHash("x")).toMatch(/^[0-9a-f]{14}$/));
});

describe("lo que ve un curador", () => {
  const fila = {
    id: "cw1", anonymousCode: "O-004", title: "Puerto", year: 2024, technique: "Digital", statement: "Texto",
    imageUrl: "https://pub/muestras/7/x.webp", submissionId: "s1", authorName: "Ana Pérez", userId: 7,
  };
  it("sólo los campos permitidos, con la imagen por la ruta anónima", () => {
    const v = toCuratorView(fila, { score: 4, note: null });
    expect(v).toEqual({
      id: "cw1", code: "O-004", imagePath: "/api/curaduria/obras/cw1/imagen", title: "Puerto", year: 2024,
      technique: "Digital", statement: "Texto", myScore: 4, myNote: "",
    });
    expect(leakedFields(v as unknown as Record<string, unknown>)).toEqual([]);
  });
  it("la vigilancia detecta una fuga", () => {
    expect(leakedFields({ ...fila })).toEqual(expect.arrayContaining(["userId", "authorName", "submissionId", "imageUrl"]));
  });
  it("filtros y avance", () => {
    const vs = [{ myScore: 3 }, { myScore: null }, { myScore: 5 }];
    expect(filterForCurator(vs, "ME_FALTAN")).toEqual([{ myScore: null }]);
    expect(filterForCurator(vs, "PUNTUADAS")).toHaveLength(2);
    expect(curatorProgress(vs)).toEqual({ scored: 2, total: 3 });
  });
  it("puntaje de 1 a 5, entero", () => {
    expect(isValidScore(1)).toBe(true);
    expect(isValidScore(5)).toBe(true);
    expect(isValidScore(0)).toBe(false);
    expect(isValidScore(3.5)).toBe(false);
    expect(isValidScore("4")).toBe(false);
  });
});

describe("ranking", () => {
  const obras = [
    { id: "a", anonymousCode: "O-001", decision: "PENDING" },
    { id: "b", anonymousCode: "O-002", decision: "SELECTED" },
    { id: "c", anonymousCode: "O-003", decision: "RARO" },
    { id: "d", anonymousCode: "O-004", decision: "DISCARDED" },
  ];
  const puntajes = [
    { callWorkId: "a", score: 4 }, { callWorkId: "a", score: 5 },
    { callWorkId: "b", score: 5 }, { callWorkId: "b", score: 4 }, { callWorkId: "b", score: 5 },
    { callWorkId: "d", score: 2 }, { callWorkId: "d", score: 9 },
  ];
  const r = rankWorks(obras, puntajes);
  it("ordena por promedio, cantidad y código; sin puntajes al final", () => {
    expect(r.map((x) => [x.code, x.average, x.count])).toEqual([
      ["O-002", 4.67, 3], ["O-001", 4.5, 2], ["O-004", 2, 1], ["O-003", null, 0],
    ]);
  });
  it("una decisión desconocida es pendiente", () => expect(r.find((x) => x.code === "O-003")?.decision).toBe("PENDING"));
  it("filtra por promedio mínimo, cantidad y decisión", () => {
    expect(filterRanking(r, { minAverage: 4.5 }).map((x) => x.code)).toEqual(["O-002", "O-001"]);
    expect(filterRanking(r, { minCount: 3 }).map((x) => x.code)).toEqual(["O-002"]);
    expect(filterRanking(r, { decision: "DISCARDED" }).map((x) => x.code)).toEqual(["O-004"]);
  });
});

describe("permisos de la curaduría", () => {
  it("decidir sólo en curaduría; identidad sólo al terminar", () => {
    expect(canDecide("CURATING")).toBe(true);
    expect(canDecide("DONE")).toBe(false);
    expect(canSeeIdentity("CURATING")).toBe(false);
    expect(canSeeIdentity("DONE")).toBe(true);
  });
  it("puntuar: curador activo en curaduría", () => {
    expect(canScore({ status: "CURATING", curatorStatus: "ACTIVE" })).toBe(true);
    expect(canScore({ status: "CURATING", curatorStatus: "REVOKED" })).toBe(false);
    expect(canScore({ status: "DONE", curatorStatus: "ACTIVE" })).toBe(false);
  });
  it("la imagen anónima: organizador desde el cierre, curador desde la curaduría, nadie más", () => {
    const base = { isOwner: false, isSuperAdmin: false, curatorStatus: null };
    expect(canViewCallImage({ ...base, status: "OPEN", isOwner: true })).toBe(false);
    expect(canViewCallImage({ ...base, status: "CLOSED", isOwner: true })).toBe(true);
    expect(canViewCallImage({ ...base, status: "CLOSED", curatorStatus: "ACTIVE" })).toBe(false);
    expect(canViewCallImage({ ...base, status: "CURATING", curatorStatus: "ACTIVE" })).toBe(true);
    expect(canViewCallImage({ ...base, status: "CURATING", curatorStatus: "INVITED" })).toBe(false);
    expect(canViewCallImage({ ...base, status: "CURATING" })).toBe(false);
  });
  it("lugar para seleccionar", () => {
    expect(selectionRoom(0, 0)).toBe(40);
    expect(selectionRoom(30, 8)).toBe(2);
    expect(selectionRoom(30, 20)).toBe(0);
  });
});

describe("invitaciones", () => {
  const ahora = new Date("2026-11-10T12:00:00Z");
  it("vigente, usada, revocada y vencida a los 30 días", () => {
    expect(invitationState({ status: "INVITED", invitedAt: new Date("2026-11-01T12:00:00Z") }, ahora)).toBe("VALID");
    expect(invitationState({ status: "ACTIVE", invitedAt: ahora }, ahora)).toBe("USED");
    expect(invitationState({ status: "REVOKED", invitedAt: ahora }, ahora)).toBe("REVOKED");
    expect(invitationState({ status: "INVITED", invitedAt: new Date("2026-10-01T12:00:00Z") }, ahora)).toBe("EXPIRED");
  });
  it("normaliza el email", () => {
    expect(normalizeEmail("  Ana@Mail.COM ")).toBe("ana@mail.com");
    expect(normalizeEmail("sin-arroba")).toBeNull();
  });
});

describe("armar la muestra", () => {
  const src = (i: number): AssemblySource => ({
    callWorkId: `cw${i}`, imageUrl: `u${i}`, title: `T${i}`, year: null, technique: null,
    authorName: `A${i}`, authorUserId: i, authorProfileId: null,
  });
  it("agrega después de lo que había y completa las destacadas con las mejores", () => {
    const { works, problems } = assemblyPlan([src(1), src(2), src(3)], { count: 5, highlights: 10 });
    expect(problems).toEqual([]);
    expect(works.map((w) => [w.callWorkId, w.sortOrder, w.isHighlight])).toEqual([
      ["cw1", 5, true], ["cw2", 6, true], ["cw3", 7, false],
    ]);
  });
  it("no se pasa del tope de 40", () => {
    const sel = Array.from({ length: 11 }, (_, i) => src(i));
    const msg = assemblyPlan(sel, { count: 30, highlights: 0 }).problems[0];
    expect(msg).toMatch(/hasta 40 obras: ya tiene 30 y seleccionaste 11/);
    expect(msg).toMatch(/quitá obras elegidas desde el editor \(no se vuelven a agregar\)/);
  });
  it("sin seleccionadas no arma nada", () => expect(assemblyPlan([], { count: 0, highlights: 0 }).problems).toEqual(["No hay obras seleccionadas."]));
});

describe("obras quitadas de la galería", () => {
  const galeria = new Set(["aw-1"]);
  it("se copian las nunca copiadas y las que se borraron por otro camino", () => {
    expect(needsAssembly(null, galeria)).toBe(true);
    expect(needsAssembly("aw-borrada", galeria)).toBe(true);
    expect(needsAssembly("aw-1", galeria)).toBe(false);
  });
  it("una quitada a propósito no se vuelve a copiar", () => expect(needsAssembly(OBRA_QUITADA_DE_LA_GALERIA, galeria)).toBe(false));
});

describe("lo que el editor hace con la galería", () => {
  const fila = (id: string, sortOrder: number, isHighlight = false) => ({ id, sortOrder, isHighlight });
  it("quita sólo lo que cargó y ya no manda; conserva lo que no vio, después de lo enviado", () => {
    const r = editorGalleryPlan({
      current: [fila("a", 0), fila("b", 1), fila("z", 6), fila("y", 5)],
      loadedIds: ["a", "b"], keptIds: ["a"], submittedCount: 2, submittedHighlights: 0,
    });
    expect(r).toEqual({ removedIds: ["b"], preserved: [{ id: "y", sortOrder: 2 }, { id: "z", sortOrder: 3 }], problems: [] });
  });
  it("los topes cuentan las conservadas", () => {
    const current = Array.from({ length: 5 }, (_, i) => fila(`n${i}`, i, i < 2));
    const obras = editorGalleryPlan({ current, loadedIds: [], keptIds: [], submittedCount: 36, submittedHighlights: 0 });
    expect(obras.problems[0]).toMatch(/se sumaron 5 obras.*quedarían 41 y el tope es 40/);
    const destacadas = editorGalleryPlan({ current, loadedIds: [], keptIds: [], submittedCount: 10, submittedHighlights: 11 });
    expect(destacadas.problems[0]).toMatch(/quedarían 13 destacadas y el tope es 12/);
    expect(editorGalleryPlan({ current, loadedIds: [], keptIds: [], submittedCount: 35, submittedHighlights: 10 }).problems).toEqual([]);
  });
});
