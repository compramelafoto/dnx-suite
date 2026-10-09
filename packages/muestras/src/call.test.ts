import { describe, expect, it } from "vitest";
import { dayEndAr, dayStartAr } from "./dates";
import {
  acceptsSubmissions, callPhase, canCallAction, closeDayProblem, editableCallFields, hasPublicPage, isListedPhase,
  callMetaDescription, missingForOpening, nextCallStatus, submissionProblems, submitterConflict, type CallActionContext,
} from "./call";

const fechas = { opensAt: dayStartAr("2026-11-01"), closesAt: dayEndAr("2026-11-30") };
const antes = new Date("2026-10-20T15:00:00Z");
const durante = new Date("2026-11-15T15:00:00Z");
// 30/11 a las 23:30 hora argentina todavía recibe.
const ultimoMinuto = new Date("2026-12-01T02:30:00Z");
const despues = new Date("2026-12-01T03:00:00Z");

describe("fase de la convocatoria", () => {
  it("abierta se divide por fechas en hora argentina", () => {
    expect(callPhase({ status: "OPEN", ...fechas }, antes)).toBe("UPCOMING");
    expect(callPhase({ status: "OPEN", ...fechas }, durante)).toBe("RECEIVING");
    expect(callPhase({ status: "OPEN", ...fechas }, ultimoMinuto)).toBe("RECEIVING");
    expect(callPhase({ status: "OPEN", ...fechas }, despues)).toBe("ENDED");
  });
  it("los estados posteriores se respetan y lo desconocido es borrador", () => {
    expect(callPhase({ status: "CURATING", ...fechas }, durante)).toBe("CURATING");
    expect(callPhase({ status: "RARO", ...fechas }, durante)).toBe("DRAFT");
  });
  it("qué se lista, qué tiene página y qué recibe", () => {
    expect(isListedPhase("UPCOMING")).toBe(true);
    expect(isListedPhase("ENDED")).toBe(false);
    expect(hasPublicPage("DONE")).toBe(true);
    expect(hasPublicPage("DRAFT")).toBe(false);
    expect(acceptsSubmissions("RECEIVING")).toBe(true);
    expect(acceptsSubmissions("ENDED")).toBe(false);
  });
});

describe("abrir la convocatoria", () => {
  const ok = { title: "Ciudad", basesText: "Bases", rightsText: "Autorizo", opensDay: "2026-11-01", closesDay: "2026-11-30", maxWorksPerPerson: 3 };
  it("completa no tiene faltantes", () => expect(missingForOpening(ok, "2026-10-20")).toEqual([]));
  it("explica cada faltante", () => {
    const r = missingForOpening({ ...ok, title: " ", basesText: "", rightsText: "", opensDay: "", closesDay: "2026-02-30", maxWorksPerPerson: 0 }, "2026-10-20");
    expect(r).toEqual([
      "Falta el título de la convocatoria.",
      "Faltan las bases.",
      "Falta el texto de autorización de derechos.",
      "Falta la fecha en que empieza a recibir obras.",
      "Falta la fecha de cierre.",
      "Cada persona puede enviar entre 1 y 10 obras.",
    ]);
  });
  it("cierre antes de la apertura o ya pasado", () => {
    expect(missingForOpening({ ...ok, closesDay: "2026-10-30" }, "2026-10-20")).toContain("La fecha de cierre es anterior a la de apertura.");
    expect(missingForOpening(ok, "2026-12-01")).toContain("La fecha de cierre ya pasó.");
  });
});

describe("edición según el estado", () => {
  it("en borrador todo, abierta sólo textos y cierre, después nada", () => {
    expect(editableCallFields("DRAFT")).toContain("maxWorksPerPerson");
    expect(editableCallFields("OPEN")).toEqual(["title", "basesText", "requirementsText", "closesDay"]);
    expect(editableCallFields("CLOSED")).toEqual([]);
  });
  it("abierta, el cierre sólo se estira", () => {
    expect(closeDayProblem("OPEN", fechas.closesAt, "2026-11-29")).toMatch(/sólo se puede estirar/);
    expect(closeDayProblem("OPEN", fechas.closesAt, "2026-11-30")).toBeNull();
    expect(closeDayProblem("OPEN", fechas.closesAt, "2026-12-10")).toBeNull();
    expect(closeDayProblem("DRAFT", fechas.closesAt, "2026-01-01")).toBeNull();
  });
});

describe("transiciones", () => {
  const ctx: CallActionContext = { now: durante, activeSubmissions: 0, activeCurators: 0, works: 0, missingForOpening: [] };
  const dueno = { userId: 7, isSuperAdmin: false };
  const otro = { userId: 8, isSuperAdmin: false };
  const admin = { userId: 1, isSuperAdmin: true };
  const conv = (status: string) => ({ status, ownerUserId: 7, ...fechas });

  it("siguiente estado", () => {
    expect(nextCallStatus("open", "DRAFT")).toBe("OPEN");
    expect(nextCallStatus("closeCuration", "CURATING")).toBe("DONE");
    expect(() => nextCallStatus("close", "DRAFT")).toThrow();
  });
  it("sólo el dueño o el super admin", () => {
    expect(canCallAction("open", conv("DRAFT"), otro, ctx)).toEqual({ ok: false, reason: "Sólo quien organiza la muestra puede hacer esto." });
    expect(canCallAction("open", conv("DRAFT"), dueno, ctx)).toEqual({ ok: true });
    expect(canCallAction("open", conv("DRAFT"), admin, ctx)).toEqual({ ok: true });
  });
  it("abrir exige estar completa", () => {
    expect(canCallAction("open", conv("DRAFT"), dueno, { ...ctx, missingForOpening: ["Faltan las bases."] })).toEqual({ ok: false, reason: "Faltan las bases." });
  });
  it("cerrar sólo después de la fecha de cierre", () => {
    expect(canCallAction("close", conv("OPEN"), dueno, ctx).ok).toBe(false);
    expect(canCallAction("close", conv("OPEN"), dueno, { ...ctx, now: despues }).ok).toBe(true);
  });
  it("empezar la curaduría exige obras y un curador activo", () => {
    expect(canCallAction("startCuration", conv("CLOSED"), dueno, { ...ctx, works: 0, activeCurators: 1 })).toEqual({ ok: false, reason: "No hay obras para curar." });
    expect(canCallAction("startCuration", conv("CLOSED"), dueno, { ...ctx, works: 5, activeCurators: 0 }).ok).toBe(false);
    expect(canCallAction("startCuration", conv("CLOSED"), dueno, { ...ctx, works: 5, activeCurators: 1 }).ok).toBe(true);
  });
  it("volver a borrador: el dueño sin envíos, el super admin siempre", () => {
    expect(canCallAction("unpublish", conv("OPEN"), dueno, { ...ctx, activeSubmissions: 2 }).ok).toBe(false);
    expect(canCallAction("unpublish", conv("OPEN"), dueno, ctx).ok).toBe(true);
    expect(canCallAction("unpublish", conv("OPEN"), admin, { ...ctx, activeSubmissions: 2 }).ok).toBe(true);
  });
  it("un estado que no corresponde se rechaza", () => {
    expect(canCallAction("closeCuration", conv("OPEN"), dueno, ctx).ok).toBe(false);
  });
});

describe("envíos", () => {
  const obra = { imageUrl: "https://x/muestras/7/a.webp", title: "Una" };
  const ok = { authorName: "Ana", basesAccepted: true, rightsAccepted: true, works: [obra] };
  it("completo no tiene problemas", () => expect(submissionProblems(ok, 3)).toEqual([]));
  it("respeta el tope por persona", () => {
    expect(submissionProblems({ ...ok, works: [obra, obra] }, 1)).toEqual(["Esta convocatoria recibe una sola obra por persona."]);
    expect(submissionProblems({ ...ok, works: [obra, obra, obra, obra] }, 3)).toEqual(["Esta convocatoria recibe hasta 3 obras por persona."]);
  });
  it("exige nombre, título y las dos aceptaciones", () => {
    expect(submissionProblems({ authorName: "", basesAccepted: false, rightsAccepted: false, works: [{ imageUrl: "u", title: " " }] }, 3)).toEqual([
      "Escribí tu nombre como querés que figure si tu obra queda seleccionada.",
      "Cada obra necesita un título.",
      "Tenés que aceptar las bases.",
      "Tenés que aceptar la autorización de derechos.",
    ]);
  });
  it("organizador y curadores no envían", () => {
    expect(submitterConflict({ isOwner: true, isCurator: false })).toMatch(/Organizás/);
    expect(submitterConflict({ isOwner: false, isCurator: true })).toMatch(/equipo curatorial/);
    expect(submitterConflict({ isOwner: false, isCurator: false })).toBeNull();
  });
});

describe("reglas de publicación y descripción", () => {
  const ok = { title: "Ciudad", basesText: "Bases", rightsText: "Autorizo", opensDay: "2026-11-01", closesDay: "2026-11-30", maxWorksPerPerson: 3 };
  it("no abre con la muestra sin publicar", () => {
    expect(missingForOpening(ok, "2026-10-20", "DRAFT")).toContain("Para abrir la convocatoria, la muestra tiene que estar publicada.");
    expect(missingForOpening(ok, "2026-10-20", "APPROVED")).toEqual([]);
  });
  it("descripción: fallback, corte en palabra y sin partir pares sustitutos", () => {
    expect(callMetaDescription("  ", "Bases")).toBe("Bases");
    expect(callMetaDescription("corto", "x")).toBe("corto");
    const largo = callMetaDescription("palabra ".repeat(40), "x");
    expect(largo.endsWith("palabra…")).toBe(true);
    expect(callMetaDescription("📷".repeat(200), "x")).toBe("📷".repeat(160) + "…");
  });
});
