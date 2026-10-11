import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findFirst: vi.fn(), findMany: vi.fn() },
  culturalContestWork: { findMany: vi.fn(), groupBy: vi.fn() },
  culturalContestAuthor: { findMany: vi.fn(), findFirst: vi.fn() },
  culturalContestImport: { findMany: vi.fn() },
  photographerProfile: { findUnique: vi.fn() },
}));
const fr = vi.hoisted(() => ({ loteVigente: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/correos/enviar", () => ({ APP_URL: "https://muestras.test" }));
vi.mock("./fotorank", () => fr);
vi.mock("@/lib/usuario", () => ({ getUsuario: vi.fn() }));

const { miAutoriaEnMuestra, misObrasDeConcursos, panelDelConcurso, pendientesDelConcurso } = await import("./consultas");

const ana = { id: 7, esSuperAdmin: false, email: "a@x", name: "Ana" };
const muestra = (o: Record<string, unknown> = {}) => ({
  id: "a1", title: "Muestra Paisajes", slug: "m", type: "MUESTRA", reviewStatus: "DRAFT", proposedByUserId: 7, workspaceId: null, isCancelled: false,
  startsAt: new Date("2026-11-09"), endsAt: new Date("2099-01-01"), members: [],
  contestImport: { id: "i1", contestId: "c1", contestTitle: "Paisajes 2026", contestSlug: "p", organizationName: "SFPR", tiers: ["WINNER"], resultBatchId: "b1", sourceVersion: new Date("2026-09-21"), syncedAt: new Date() },
  ...o,
});
const obra = (o: Record<string, unknown> = {}) => ({
  id: "cw1", entryId: "e1", authorUserId: 10, authorName: "Ana Pérez", title: "Amanecer", tier: "WINNER", distinction: "1.er premio", sourceStatus: "CURRENT",
  imageStatus: "COPIED", imageUrl: "https://r2/x.webp", imageError: null, include: true, toPrint: true, forSale: false, exhibitBasis: "RULES",
  attributionRequired: false, exhibitConsent: "ACCEPTED", consentBy: "RULES", saleConsent: "NOT_ASKED", activityWorkId: "aw1", ...o,
});

beforeEach(() => {
  vi.resetAllMocks();
  db.culturalActivity.findFirst.mockResolvedValue(muestra());
  db.culturalContestWork.findMany.mockResolvedValue([obra(), obra({ id: "cw2", entryId: "e2", authorUserId: null, authorName: "Viejo", exhibitBasis: "EXPLICIT", exhibitConsent: "PENDING", consentBy: null, activityWorkId: null, imageStatus: "PENDING", imageUrl: null })]);
  db.culturalContestAuthor.findMany.mockResolvedValue([
    { id: "au1", userId: 10, authorName: "Ana Pérez", displayName: null, notifiedAt: null, respondedAt: null },
    { id: "au2", userId: null, authorName: "Viejo", displayName: null, notifiedAt: null, respondedAt: null },
  ]);
  fr.loteVigente.mockResolvedValue({ id: "b1", version: new Date("2026-09-21") });
});

describe("panelDelConcurso", () => {
  it("sin `view` (o sin concurso): null", async () => {
    db.culturalActivity.findFirst.mockResolvedValue(null);
    expect(await panelDelConcurso("a1", ana)).toBeNull();
    db.culturalActivity.findFirst.mockResolvedValue(muestra({ contestImport: null }));
    expect(await panelDelConcurso("a1", ana)).toBeNull();
  });
  it("el dueño: obras, crédito del autor, enlaces y resumen", async () => {
    const p = (await panelDelConcurso("a1", ana))!;
    expect(p.puedeCambiar).toBe(true);
    expect(p.editable).toBe(true);
    expect(p.concurso.cambio).toBe(false);
    expect(p.obras.map((o) => [o.id, o.enLaMuestra, o.seVeSuNombre, o.sinCuenta])).toEqual([["cw1", true, false, false], ["cw2", false, false, true]]);
    expect(p.autores).toEqual([
      expect.objectContaining({
        id: "au1", nombre: "Ana Pérez", pendientes: 0, url: "https://muestras.test/panel/expositor/concurso/au1",
        mensaje: expect.stringMatching(/^Hola Ana Pérez, con SFPR armamos una muestra con obras de Paisajes 2026/),
      }),
    ]);
    expect(p.resumen).toMatchObject({ total: 2, enLaMuestra: 1, esperanAlAutor: 1, sacadas: 0 });
  });
  it("si el lote de FotoRank cambió (o ya no hay), avisa", async () => {
    fr.loteVigente.mockResolvedValue({ id: "b2", version: new Date("2026-10-01") });
    expect((await panelDelConcurso("a1", ana))!.concurso.cambio).toBe(true);
    fr.loteVigente.mockResolvedValue(null);
    const p = (await panelDelConcurso("a1", ana))!;
    expect([p.concurso.cambio, p.concurso.sinLote]).toEqual([true, true]);
    fr.loteVigente.mockResolvedValue(undefined);
    expect((await panelDelConcurso("a1", ana))!.concurso.cambio).toBe(false);
  });
  it("la coorganización lo ve sin poder cambiar y sin leer FotoRank", async () => {
    db.culturalActivity.findFirst.mockResolvedValue(muestra({ proposedByUserId: 99, members: [{ userId: 7, role: "CO_ORGANIZER", status: "ACTIVE" }] }));
    const p = (await panelDelConcurso("a1", ana))!;
    expect([p.puedeCambiar, p.editable]).toEqual([false, false]);
    expect(fr.loteVigente).not.toHaveBeenCalled();
  });
  it("en revisión: no editable", async () => {
    db.culturalActivity.findFirst.mockResolvedValue(muestra({ reviewStatus: "IN_REVIEW" }));
    const p = (await panelDelConcurso("a1", ana))!;
    expect([p.editable, p.enRevision]).toEqual([false, true]);
  });
});

describe("pendientesDelConcurso", () => {
  it("cuenta por muestra lo que espera al autor", async () => {
    db.culturalContestWork.groupBy.mockResolvedValue([{ activityId: "a1", _count: { _all: 3 } }]);
    expect(await pendientesDelConcurso(["a1", "a2"])).toEqual(new Map([["a1", 3]]));
    expect(await pendientesDelConcurso([])).toEqual(new Map());
  });
});

describe("el autor", () => {
  const filaAutor = {
    id: "au1", activityId: "a1", authorName: "Ana Pérez", displayName: null, respondedAt: null,
    import: { contestTitle: "Paisajes 2026", organizationName: "SFPR" },
    activity: { title: "Muestra Paisajes", slug: "muestra-paisajes", reviewStatus: "DRAFT", organizersText: "SFPR", startsAt: new Date("2026-11-09"), endsAt: new Date("2099-01-01"), venueName: null, city: null, isVirtualOnly: false, isCancelled: false },
  };

  it("otra cuenta: null, sin leer ninguna obra", async () => {
    db.culturalContestAuthor.findFirst.mockResolvedValue(null);
    expect(await miAutoriaEnMuestra("au1", { ...ana, id: 99 })).toBeNull();
    expect(db.culturalContestAuthor.findFirst.mock.calls[0][0].where).toEqual({ id: "au1", userId: 99 });
    expect(db.culturalContestWork.findMany).not.toHaveBeenCalled();
  });

  it("la suya: sólo sus obras que siguen en la muestra; la imagen sólo si está copiada; sin enlace público en borrador", async () => {
    db.culturalContestAuthor.findFirst.mockResolvedValue(filaAutor);
    db.photographerProfile.findUnique.mockResolvedValue(null);
    db.culturalContestWork.findMany.mockResolvedValue([
      { id: "cw1", title: "Amanecer", distinction: "1.er premio", imageStatus: "PENDING", imageUrl: "https://r2/x.webp", forSale: false, exhibitBasis: "EXPLICIT", attributionRequired: false, exhibitConsent: "PENDING", consentBy: null, saleConsent: "NOT_ASKED", activityWorkId: null },
    ]);
    const r = await miAutoriaEnMuestra("au1", { ...ana, id: 10 });
    expect(db.culturalContestWork.findMany.mock.calls[0][0].where).toEqual({ activityId: "a1", authorUserId: 10, include: true });
    expect(r?.obras[0]).toMatchObject({ imageUrl: null, enLaMuestra: false, seVeSuNombre: false });
    expect(r?.muestra.slug).toBeNull();
    expect(r?.cerrada).toBe(false);
  });

  it("Dónde expongo: por la cuenta, con cuántas esperan respuesta", async () => {
    db.culturalContestAuthor.findMany.mockResolvedValue([{ ...filaAutor, activity: { ...filaAutor.activity, reviewStatus: "APPROVED" } }]);
    db.culturalContestWork.findMany.mockResolvedValue([
      { activityId: "a1", include: true, exhibitConsent: "PENDING", saleConsent: "NOT_ASKED" },
      { activityId: "a1", include: true, exhibitConsent: "ACCEPTED", saleConsent: "NOT_ASKED" },
    ]);
    const r = await misObrasDeConcursos({ id: 10, esSuperAdmin: false });
    expect(db.culturalContestAuthor.findMany.mock.calls[0][0].where).toEqual({ userId: 10 });
    expect(db.culturalContestWork.findMany.mock.calls[0][0].where).toMatchObject({ authorUserId: 10 });
    expect(r[0]).toMatchObject({ id: "au1", concurso: "Paisajes 2026", obras: 2, pendientes: 1, muestra: { slug: "muestra-paisajes" } });
  });
});

describe("la coorganización (sólo lectura)", () => {
  it("ve el crédito público, no el nombre real de una obra con Autoría reservada, ni los enlaces a autores", async () => {
    // Coorganización: tiene `view` pero no `contest`.
    db.culturalActivity.findFirst.mockResolvedValue(muestra({ proposedByUserId: 99, members: [{ userId: 7, role: "CO_ORGANIZER", status: "ACTIVE" }] }));
    db.culturalContestWork.findMany.mockResolvedValue([obra({ exhibitBasis: "RULES", exhibitConsent: "ACCEPTED", consentBy: "RULES", attributionRequired: false })]);
    const p = await panelDelConcurso("a1", ana);
    expect(p?.puedeCambiar).toBe(false);
    expect(p?.obras[0]?.authorName).toBe("Autoría reservada");
    // Ni la cuenta del autor ni su inscripción en FotoRank llegan al navegador.
    expect(p?.obras[0]).not.toHaveProperty("authorUserId");
    expect(p?.obras[0]).not.toHaveProperty("entryId");
    expect(p?.autores).toEqual([]);
  });
  it("el dueño ve el nombre real", async () => {
    db.culturalContestWork.findMany.mockResolvedValue([obra({ attributionRequired: false })]);
    const p = await panelDelConcurso("a1", ana);
    expect(p?.obras[0]?.authorName).toBe("Ana Pérez");
  });
});
