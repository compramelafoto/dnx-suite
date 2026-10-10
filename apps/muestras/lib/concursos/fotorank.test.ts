import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  fotorankContest: { findUnique: vi.fn(), findMany: vi.fn() },
  fotorankResultBatch: { findMany: vi.fn() },
  fotorankResultEntry: { findMany: vi.fn() },
  fotorankJuryEntrySnapshot: { findMany: vi.fn() },
  fotorankContestEntry: { findMany: vi.fn() },
  fotorankProfile: { findMany: vi.fn() },
  user: { findMany: vi.fn() },
  contestOrganizationMember: { count: vi.fn(), findMany: vi.fn() },
  culturalContestImport: { findMany: vi.fn() },
}));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("server-only", () => ({}));

const { concursosParaArmar, mensajeDeResultados, puedeArmarDesdeConcurso, resultadosDelConcurso } = await import("./fotorank");

const ANA = { id: 7, esSuperAdmin: false };
const ADMIN = { id: 1, esSuperAdmin: true };
const d = (s: string) => new Date(s);
const CODIGO_ANONIMO = "ANON-XYZ-123";

const concurso = {
  id: "c1",
  title: "Paisajes 2026",
  slug: "paisajes-2026",
  shortDescription: "Un concurso de paisajes.",
  visibility: "PUBLIC",
  status: "COMPLETED",
  experienceType: "CONTEST",
  distributionChannel: null,
  organizationId: "org1",
  organization: { name: "SFPR" },
  categories: [
    { id: "cat-p", name: "Paisaje", sortOrder: 0 },
    { id: "cat-r", name: "Retrato", sortOrder: 1 },
  ],
};

const lotes = [
  { id: "b-pub", status: "PUBLISHED", finalizedAt: d("2026-09-01"), publishedAt: d("2026-09-02"), updatedAt: d("2026-09-02") },
  { id: "b-fin", status: "FINALIZED", finalizedAt: d("2026-09-20"), publishedAt: null, updatedAt: d("2026-09-21") },
];

// Filas del lote tal como las devolvería la base: el mock agrega campos prohibidos para probar que no se filtran.
const resultados = [
  { juryEntrySnapshotId: "s1", categoryId: "cat-p", resultStatus: "WINNER", awardType: "FIRST_PLACE", finalPosition: 1, preliminaryPosition: 1, anonymousCode: CODIGO_ANONIMO },
  { juryEntrySnapshotId: "s2", categoryId: "cat-p", resultStatus: "MENTION", awardType: "HONORABLE_MENTION", finalPosition: 4, preliminaryPosition: 4 },
  { juryEntrySnapshotId: "s3", categoryId: "cat-r", resultStatus: "FINALIST", awardType: null, finalPosition: null, preliminaryPosition: 6 },
  { juryEntrySnapshotId: "s4", categoryId: "cat-r", resultStatus: "DISQUALIFIED", awardType: "FIRST_PLACE", finalPosition: 1, preliminaryPosition: 1 },
  { juryEntrySnapshotId: "s5", categoryId: "cat-r", resultStatus: "WINNER", awardType: "SECOND_PLACE", finalPosition: 2, preliminaryPosition: 2 },
  { juryEntrySnapshotId: "s6", categoryId: "cat-r", resultStatus: "WINNER", awardType: "THIRD_PLACE", finalPosition: 3, preliminaryPosition: 3 },
];
const snapshots = [
  { id: "s1", entryId: "e1" }, { id: "s2", entryId: "e2" }, { id: "s3", entryId: "e3" },
  { id: "s4", entryId: "e4" }, { id: "s5", entryId: "e5" }, { id: "s6", entryId: "e6" },
];
const bases = (rights: Record<string, unknown> | null) => ({
  rulesVersion: { configurationVersion: rights ? { configurationJson: { rights } } : null },
});
const obras = [
  { id: "e1", title: "Amanecer", entryNumber: "001", authorUserId: 10, status: "CONFIRMED", withdrawnAt: null, registration: bases({ allowExhibition: true, attributionRequired: true }) },
  { id: "e2", title: "  ", entryNumber: "002", authorUserId: 11, status: "CONFIRMED", withdrawnAt: null, registration: bases({ allowExhibition: false }) },
  { id: "e3", title: "Mirada", entryNumber: "003", authorUserId: 12, status: "CONFIRMED", withdrawnAt: null, registration: null },
  { id: "e4", title: "Trampa", entryNumber: "004", authorUserId: 13, status: "CONFIRMED", withdrawnAt: null, registration: null },
  { id: "e5", title: "Retirada", entryNumber: "005", authorUserId: 14, status: "WITHDRAWN", withdrawnAt: d("2026-09-10"), registration: null },
  { id: "e6", title: "Rechazada", entryNumber: "006", authorUserId: 15, status: "REJECTED", withdrawnAt: null, registration: null },
];

function prepararConcurso() {
  db.fotorankContest.findUnique.mockResolvedValue(concurso);
  db.fotorankResultBatch.findMany.mockImplementation(async (args: { where: { status: { in: string[] } } }) =>
    [...lotes, { id: "b-draft", status: "DRAFT", finalizedAt: null, publishedAt: null, updatedAt: d("2026-10-01") }].filter((l) => args.where.status.in.includes(l.status)),
  );
  db.fotorankResultEntry.findMany.mockImplementation(async (args: { where: { resultBatchId: string | { in: string[] } } }) => {
    const w = args.where.resultBatchId;
    const ids = typeof w === "string" ? [w] : w.in;
    return ids.includes("b-fin") ? resultados.map((r) => ({ ...r, resultBatchId: "b-fin" })) : [];
  });
  db.fotorankJuryEntrySnapshot.findMany.mockResolvedValue(snapshots);
  // Como la base: el `where` saca las rechazadas, retiradas y con `withdrawnAt`.
  db.fotorankContestEntry.findMany.mockImplementation(async (args: { where: { status: { notIn: string[] }; withdrawnAt: null } }) =>
    obras.filter((o) => !args.where.status.notIn.includes(o.status) && (args.where.withdrawnAt !== null || o.withdrawnAt === null)),
  );
  db.fotorankProfile.findMany.mockResolvedValue([{ userId: 10, displayName: "Ana Pérez" }, { userId: 11, displayName: "  " }]);
  db.user.findMany.mockResolvedValue([{ id: 10, name: "Ana P." }, { id: 11, name: "Beto Gómez" }, { id: 12, name: null }]);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("puedeArmarDesdeConcurso", () => {
  beforeEach(() => {
    db.fotorankContest.findUnique.mockResolvedValue({ organizationId: "org1" });
  });
  it("miembro ACTIVE con rol que arma", async () => {
    db.contestOrganizationMember.count.mockResolvedValue(1);
    expect(await puedeArmarDesdeConcurso(ANA, "c1")).toBe(true);
    expect(db.contestOrganizationMember.count.mock.calls[0][0].where).toEqual({
      organizationId: "org1", userId: 7, status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "EDITOR"] },
    });
  });
  it("jurado, lector, removido u otra organización: no (la base no cuenta ninguna fila)", async () => {
    db.contestOrganizationMember.count.mockResolvedValue(0);
    expect(await puedeArmarDesdeConcurso(ANA, "c1")).toBe(false);
  });
  it("concurso inexistente: no", async () => {
    db.fotorankContest.findUnique.mockResolvedValue(null);
    expect(await puedeArmarDesdeConcurso(ANA, "c1")).toBe(false);
  });
  it("super admin: sí, sin consultar membresías", async () => {
    expect(await puedeArmarDesdeConcurso(ADMIN, "c1")).toBe(true);
    expect(db.contestOrganizationMember.count).not.toHaveBeenCalled();
  });
  it("id con caracteres raros: no, sin consultar", async () => {
    expect(await puedeArmarDesdeConcurso(ANA, "c1'; drop")).toBe(false);
    expect(await puedeArmarDesdeConcurso(ANA, "")).toBe(false);
    expect(db.fotorankContest.findUnique).not.toHaveBeenCalled();
  });
});

describe("resultadosDelConcurso", () => {
  it("concurso inexistente o id raro", async () => {
    db.fotorankContest.findUnique.mockResolvedValue(null);
    expect(await resultadosDelConcurso("c1")).toEqual({ ok: false, motivo: "NO_EXISTE" });
    expect(await resultadosDelConcurso("../x")).toEqual({ ok: false, motivo: "NO_EXISTE" });
  });
  it("maratón (por tipo o por canal de Clickatón)", async () => {
    db.fotorankContest.findUnique.mockResolvedValue({ ...concurso, experienceType: "MARATHON" });
    expect(await resultadosDelConcurso("c1")).toEqual({ ok: false, motivo: "MARATON" });
    db.fotorankContest.findUnique.mockResolvedValue({ ...concurso, distributionChannel: "CLICKATON" });
    expect(await resultadosDelConcurso("c1")).toEqual({ ok: false, motivo: "MARATON" });
    expect(db.fotorankResultBatch.findMany).not.toHaveBeenCalled();
  });
  it("sin lote cerrado por el jurado", async () => {
    prepararConcurso();
    db.fotorankResultBatch.findMany.mockResolvedValue([]);
    expect(await resultadosDelConcurso("c1")).toEqual({ ok: false, motivo: "SIN_RESULTADOS" });
  });
  it("sólo pide lotes FINALIZED o PUBLISHED y usa el más nuevo", async () => {
    prepararConcurso();
    const r = await resultadosDelConcurso("c1");
    expect(db.fotorankResultBatch.findMany.mock.calls[0][0].where).toEqual({ contestId: "c1", status: { in: ["FINALIZED", "PUBLISHED"] } });
    if (!r.ok) throw new Error("debía andar");
    expect(r.batch).toEqual({ id: "b-fin", status: "FINALIZED", version: d("2026-09-21"), date: d("2026-09-20") });
    expect(db.fotorankResultEntry.findMany.mock.calls[0][0].where).toMatchObject({ resultBatchId: "b-fin", resultStatus: { not: "DISQUALIFIED" } });
  });
  it("obras: sin descalificadas ni retiradas ni rechazadas, con premio, autor, base de permiso y orden", async () => {
    prepararConcurso();
    const r = await resultadosDelConcurso("c1");
    if (!r.ok) throw new Error("debía andar");
    expect(r.contest).toEqual({
      id: "c1", title: "Paisajes 2026", slug: "paisajes-2026", shortDescription: "Un concurso de paisajes.",
      organizationId: "org1", organizationName: "SFPR", visibility: "PUBLIC", status: "COMPLETED",
    });
    expect(r.works).toEqual([
      {
        entryId: "e1", authorUserId: 10, authorName: "Ana Pérez", title: "Amanecer", tier: "WINNER", awardType: "FIRST_PLACE",
        categoryId: "cat-p", categoryName: "Paisaje", distinction: "1.er premio · Paisaje", rank: 0,
        exhibitBasis: "RULES", attributionRequired: true,
      },
      {
        entryId: "e2", authorUserId: 11, authorName: "Beto Gómez", title: "Obra 002", tier: "MENTION", awardType: "HONORABLE_MENTION",
        categoryId: "cat-p", categoryName: "Paisaje", distinction: "Mención de honor · Paisaje", rank: 1,
        exhibitBasis: "EXPLICIT", attributionRequired: false,
      },
      {
        entryId: "e3", authorUserId: 12, authorName: "Autor/a sin nombre", title: "Mirada", tier: "FINALIST", awardType: null,
        categoryId: "cat-r", categoryName: "Retrato", distinction: "Preseleccionada · Retrato", rank: 2,
        exhibitBasis: "EXPLICIT", attributionRequired: false,
      },
    ]);
    const where = db.fotorankContestEntry.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ contestId: "c1", withdrawnAt: null, status: { notIn: ["REJECTED", "WITHDRAWN", "REPLACED", "DRAFT"] } });
  });
  it("una sola categoría: el premio sin categoría", async () => {
    prepararConcurso();
    db.fotorankContest.findUnique.mockResolvedValue({ ...concurso, categories: [concurso.categories[0]] });
    const r = await resultadosDelConcurso("c1");
    if (!r.ok) throw new Error("debía andar");
    expect(r.works[0]?.distinction).toBe("1.er premio");
  });
  it("una obra en dos categorías sale una vez, con el mejor premio", async () => {
    prepararConcurso();
    db.fotorankResultEntry.findMany.mockResolvedValue([
      { juryEntrySnapshotId: "s1", categoryId: "cat-r", resultStatus: "FINALIST", awardType: null, finalPosition: 5, preliminaryPosition: 5 },
      { juryEntrySnapshotId: "s1", categoryId: "cat-p", resultStatus: "WINNER", awardType: "SECOND_PLACE", finalPosition: 2, preliminaryPosition: 2 },
    ]);
    const r = await resultadosDelConcurso("c1");
    if (!r.ok) throw new Error("debía andar");
    expect(r.works.map((w) => [w.entryId, w.distinction])).toEqual([["e1", "2.º premio · Paisaje"]]);
  });
});

describe("anonimato del jurado", () => {
  const PROHIBIDOS = [
    "anonymousCode", "anonymousJuryCode", "aggregateScore", "normalizedScore", "medianScore", "dispersion",
    "evaluationCount", "juryDecisionNote", "metadata", "metadataSnapshot", "email", "phone", "votes", "flagsJson",
  ];
  function clavesDe(select: unknown, out: string[] = []): string[] {
    if (!select || typeof select !== "object") return out;
    for (const [k, v] of Object.entries(select)) {
      out.push(k);
      clavesDe(v, out);
    }
    return out;
  }
  it("ningún select pide códigos anónimos, puntajes, notas, metadata, email ni teléfono", async () => {
    prepararConcurso();
    db.contestOrganizationMember.findMany.mockResolvedValue([{ organizationId: "org1" }]);
    db.fotorankContest.findMany.mockResolvedValue([{ ...concurso, resultBatches: lotes }]);
    db.culturalContestImport.findMany.mockResolvedValue([]);
    const r = await resultadosDelConcurso("c1");
    await concursosParaArmar(ANA);
    const mocks = [
      db.fotorankContest.findUnique, db.fotorankContest.findMany, db.fotorankResultBatch.findMany, db.fotorankResultEntry.findMany,
      db.fotorankJuryEntrySnapshot.findMany, db.fotorankContestEntry.findMany, db.fotorankProfile.findMany, db.user.findMany,
    ];
    let selects = 0;
    for (const m of mocks) {
      for (const [args] of m.mock.calls as [{ select?: unknown }][]) {
        expect(args.select, "todo pedido lleva select").toBeDefined();
        selects += 1;
        for (const k of clavesDe(args.select)) expect(PROHIBIDOS, `select pide ${k}`).not.toContain(k);
      }
    }
    expect(selects).toBeGreaterThan(8);
    expect(JSON.stringify(r)).not.toContain(CODIGO_ANONIMO);
  });
  it("no usa el cliente cruzado de Clickatón", () => {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    const fuente = readFileSync(path.join(dir, "fotorank.ts"), "utf8");
    expect(fuente).not.toMatch(/clickaton-jury-client/);
    expect(fuente).not.toMatch(/from "@repo\/db\/[^"]+"/);
  });
});

describe("concursosParaArmar", () => {
  it("sin organizaciones donde arma: nada, sin buscar concursos", async () => {
    db.contestOrganizationMember.findMany.mockResolvedValue([]);
    expect(await concursosParaArmar(ANA)).toEqual([]);
    expect(db.fotorankContest.findMany).not.toHaveBeenCalled();
  });
  it("sus concursos con resultados cerrados, sin maratones, con conteos y muestras armadas", async () => {
    prepararConcurso();
    db.contestOrganizationMember.findMany.mockResolvedValue([{ organizationId: "org1" }]);
    db.fotorankContest.findMany.mockResolvedValue([
      { ...concurso, resultBatches: lotes },
      { ...concurso, id: "c2", title: "Maratón", experienceType: "MARATHON", resultBatches: lotes },
      { ...concurso, id: "c3", title: "Sin lote", resultBatches: [] },
    ]);
    db.culturalContestImport.findMany.mockResolvedValue([{ contestId: "c1", activity: { id: "a1", title: "Muestra Paisajes 2026", reviewStatus: "DRAFT" } }]);
    const r = await concursosParaArmar(ANA);
    expect(db.contestOrganizationMember.findMany.mock.calls[0][0].where).toEqual({
      userId: 7, status: "ACTIVE", role: { in: ["OWNER", "ADMIN", "EDITOR"] },
    });
    expect(db.fotorankContest.findMany.mock.calls[0][0].where).toMatchObject({ organizationId: { in: ["org1"] }, experienceType: "CONTEST" });
    expect(r).toEqual([
      {
        id: "c1", title: "Paisajes 2026", slug: "paisajes-2026", organizationName: "SFPR",
        batchStatus: "FINALIZED", batchDate: d("2026-09-20"),
        counts: { WINNER: 1, MENTION: 1, FINALIST: 1 },
        muestras: [{ id: "a1", title: "Muestra Paisajes 2026", reviewStatus: "DRAFT" }],
      },
    ]);
  });
  it("el super admin ve todos los concursos con resultados (sin filtrar por organización)", async () => {
    prepararConcurso();
    db.fotorankContest.findMany.mockResolvedValue([]);
    await concursosParaArmar(ADMIN);
    expect(db.contestOrganizationMember.findMany).not.toHaveBeenCalled();
    expect(db.fotorankContest.findMany.mock.calls[0][0].where.organizationId).toBeUndefined();
    expect(db.fotorankContest.findMany.mock.calls[0][0].take).toBe(50);
  });
});

describe("mensajes", () => {
  it("uno por motivo", () => {
    expect(mensajeDeResultados("NO_EXISTE")).toBe("El concurso no existe.");
    expect(mensajeDeResultados("MARATON")).toMatch(/maratones de Clickatón/);
    expect(mensajeDeResultados("SIN_RESULTADOS")).toBe(
      "Este concurso todavía no tiene resultados cerrados por el jurado. Cuando el jurado los cierre en FotoRank, vas a poder armar la muestra.",
    );
  });
});
