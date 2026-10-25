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
const C = "COMPLETE";
const resultados = [
  { juryEntrySnapshotId: "s1", categoryId: "cat-p", resultStatus: "WINNER", awardType: "FIRST_PLACE", coverageStatus: C, finalPosition: 1, preliminaryPosition: 1, anonymousCode: CODIGO_ANONIMO },
  { juryEntrySnapshotId: "s2", categoryId: "cat-p", resultStatus: "MENTION", awardType: "HONORABLE_MENTION", coverageStatus: C, finalPosition: 4, preliminaryPosition: 4 },
  // FotoRank marca a los finalistas con el premio FINALIST (y el estado RANKED).
  { juryEntrySnapshotId: "s3", categoryId: "cat-r", resultStatus: "RANKED", awardType: "FINALIST", coverageStatus: C, finalPosition: null, preliminaryPosition: 6 },
  { juryEntrySnapshotId: "s4", categoryId: "cat-r", resultStatus: "DISQUALIFIED", awardType: "FIRST_PLACE", coverageStatus: C, finalPosition: 1, preliminaryPosition: 1 },
  { juryEntrySnapshotId: "s5", categoryId: "cat-r", resultStatus: "WINNER", awardType: "SECOND_PLACE", coverageStatus: C, finalPosition: 2, preliminaryPosition: 2 },
  { juryEntrySnapshotId: "s6", categoryId: "cat-r", resultStatus: "WINNER", awardType: "THIRD_PLACE", coverageStatus: C, finalPosition: 3, preliminaryPosition: 3 },
  { juryEntrySnapshotId: "s7", categoryId: "cat-r", resultStatus: "WINNER", awardType: "FIRST_PLACE", coverageStatus: C, finalPosition: 1, preliminaryPosition: 1 },
  { juryEntrySnapshotId: "s8", categoryId: "cat-r", resultStatus: "WINNER", awardType: "FIRST_PLACE", coverageStatus: C, finalPosition: 1, preliminaryPosition: 1 },
  { juryEntrySnapshotId: "s9", categoryId: "cat-r", resultStatus: "WINNER", awardType: "FIRST_PLACE", coverageStatus: C, finalPosition: 1, preliminaryPosition: 1 },
  // Sin premio, sin seleccionar, a revisar o con la cobertura del jurado incompleta: no salen.
  { juryEntrySnapshotId: "s10", categoryId: "cat-r", resultStatus: "MENTION", awardType: null, coverageStatus: C, finalPosition: 5, preliminaryPosition: 5 },
  { juryEntrySnapshotId: "s11", categoryId: "cat-r", resultStatus: "NOT_SELECTED", awardType: "FINALIST", coverageStatus: C, finalPosition: 9, preliminaryPosition: 9 },
  { juryEntrySnapshotId: "s12", categoryId: "cat-r", resultStatus: "REVIEW_REQUIRED", awardType: "FINALIST", coverageStatus: C, finalPosition: 9, preliminaryPosition: 9 },
  { juryEntrySnapshotId: "s13", categoryId: "cat-r", resultStatus: "WINNER", awardType: "FIRST_PLACE", coverageStatus: "INCOMPLETE", finalPosition: 1, preliminaryPosition: 1 },
];
const snapshots = Array.from({ length: 13 }, (_, i) => ({ id: `s${i + 1}`, entryId: `e${i + 1}`, contestId: "c1" }));
const bases = (rights: Record<string, unknown> | null, status = "CONFIRMED") => ({
  status,
  rulesVersion: { configurationVersion: rights ? { configurationJson: { rights } } : null },
});
type ObraMock = {
  id: string; contestId: string; title: string; entryNumber: string; authorUserId: number; status: string; withdrawnAt: Date | null;
  admissionStatus: string | null; registrationId: string | null; registration: ReturnType<typeof bases> | null;
};
const obra = (o: Partial<ObraMock> & { id: string }): ObraMock => ({
  contestId: "c1", title: "Obra", entryNumber: o.id.slice(1).padStart(3, "0"), authorUserId: 20, status: "CONFIRMED", withdrawnAt: null,
  admissionStatus: null, registrationId: o.registration ? `r-${o.id}` : null, registration: null, ...o,
});
const obras: ObraMock[] = [
  obra({ id: "e1", title: "Amanecer", authorUserId: 10, admissionStatus: "ADMITTED", registration: bases({ allowExhibition: true, attributionRequired: true }) }),
  obra({ id: "e2", title: "  ", authorUserId: 11, registration: bases({ allowExhibition: false }) }),
  // Sin inscripción (concursos viejos): cuenta.
  obra({ id: "e3", title: "Mirada", authorUserId: 12 }),
  obra({ id: "e4", title: "Trampa", authorUserId: 13 }),
  obra({ id: "e5", title: "Retirada", authorUserId: 14, status: "WITHDRAWN", withdrawnAt: d("2026-09-10") }),
  obra({ id: "e6", title: "Rechazada", authorUserId: 15, status: "REJECTED" }),
  obra({ id: "e7", title: "Excluida", admissionStatus: "EXCLUDED" }),
  obra({ id: "e8", title: "Descalificada", registration: bases(null, "DISQUALIFIED") }),
  obra({ id: "e9", title: "Sin confirmar", status: "UPLOADED" }),
];

/** Como la base: aplica el `where` de obras vigentes que arma `fotorank.ts`. */
type WhereObra = {
  id: { in: string[] }; contestId: { in: string[] }; status: string; withdrawnAt: null;
  AND: [{ OR: [unknown, { admissionStatus: { notIn: string[] } }] }, { OR: [unknown, { registration: { status: { notIn: string[] } } }] }];
};
function obrasDeLaBase(w: WhereObra) {
  const admisionFuera = w.AND[0].OR[1].admissionStatus.notIn;
  const inscripcionFuera = w.AND[1].OR[1].registration.status.notIn;
  return obras.filter(
    (o) =>
      w.id.in.includes(o.id) && w.contestId.in.includes(o.contestId) && o.status === w.status && o.withdrawnAt === null &&
      (o.admissionStatus == null || !admisionFuera.includes(o.admissionStatus)) &&
      (o.registrationId == null || !inscripcionFuera.includes(o.registration!.status)),
  );
}
type WhereResultado = { resultBatchId: string | { in: string[] }; awardType: { not: null }; resultStatus: { notIn: string[] }; coverageStatus: string };
const pasaResultado = (r: (typeof resultados)[number], w: WhereResultado) =>
  r.awardType != null && !w.resultStatus.notIn.includes(r.resultStatus) && r.coverageStatus === w.coverageStatus;

function prepararConcurso() {
  db.fotorankContest.findUnique.mockResolvedValue(concurso);
  db.contestOrganizationMember.count.mockResolvedValue(1);
  db.fotorankResultBatch.findMany.mockImplementation(async (args: { where: { status: { in: string[] } } }) =>
    [...lotes, { id: "b-draft", status: "DRAFT", finalizedAt: null, publishedAt: null, updatedAt: d("2026-10-01") }].filter((l) => args.where.status.in.includes(l.status)),
  );
  db.fotorankResultEntry.findMany.mockImplementation(async (args: { where: WhereResultado }) => {
    const w = args.where.resultBatchId;
    const ids = typeof w === "string" ? [w] : w.in;
    return ids.includes("b-fin") ? resultados.filter((r) => pasaResultado(r, args.where)).map((r) => ({ ...r, resultBatchId: "b-fin" })) : [];
  });
  db.fotorankJuryEntrySnapshot.findMany.mockImplementation(async (args: { where: { id: { in: string[] }; contestId: { in: string[] } } }) =>
    snapshots.filter((x) => args.where.id.in.includes(x.id) && args.where.contestId.in.includes(x.contestId)),
  );
  db.fotorankContestEntry.findMany.mockImplementation(async (args: { where: WhereObra }) => obrasDeLaBase(args.where));
  db.fotorankProfile.findMany.mockResolvedValue([{ userId: 10, displayName: "Ana Pérez" }, { userId: 11, displayName: "  " }]);
  db.user.findMany.mockResolvedValue([{ id: 10, name: "Ana P." }, { id: 11, name: "Beto Gómez" }, { id: 12, name: null }]);
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("puedeArmarDesdeConcurso", () => {
  beforeEach(() => {
    db.fotorankContest.findUnique.mockResolvedValue({ organizationId: "org1", status: "COMPLETED" });
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
  it("concurso en borrador o cancelado: no", async () => {
    db.contestOrganizationMember.count.mockResolvedValue(1);
    db.fotorankContest.findUnique.mockResolvedValue({ organizationId: "org1", status: "CANCELLED" });
    expect(await puedeArmarDesdeConcurso(ANA, "c1")).toBe(false);
    db.fotorankContest.findUnique.mockResolvedValue({ organizationId: "org1", status: "DRAFT" });
    expect(await puedeArmarDesdeConcurso(ADMIN, "c1")).toBe(false);
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
    expect(await resultadosDelConcurso(ANA, "c1")).toEqual({ ok: false, motivo: "NO_EXISTE" });
    expect(await resultadosDelConcurso(ANA, "../x")).toEqual({ ok: false, motivo: "NO_EXISTE" });
  });
  it("quien no organiza el concurso: como si no existiera, sin leer resultados", async () => {
    prepararConcurso();
    db.contestOrganizationMember.count.mockResolvedValue(0);
    expect(await resultadosDelConcurso(ANA, "c1")).toEqual({ ok: false, motivo: "NO_EXISTE" });
    expect(db.fotorankResultBatch.findMany).not.toHaveBeenCalled();
    expect(db.fotorankResultEntry.findMany).not.toHaveBeenCalled();
  });
  it("concurso cancelado: no existe", async () => {
    prepararConcurso();
    db.fotorankContest.findUnique.mockResolvedValue({ ...concurso, status: "CANCELLED" });
    expect(await resultadosDelConcurso(ADMIN, "c1")).toEqual({ ok: false, motivo: "NO_EXISTE" });
  });
  it("maratón (por tipo o por canal de Clickatón)", async () => {
    db.contestOrganizationMember.count.mockResolvedValue(1);
    db.fotorankContest.findUnique.mockResolvedValue({ ...concurso, experienceType: "MARATHON" });
    expect(await resultadosDelConcurso(ANA, "c1")).toEqual({ ok: false, motivo: "MARATON" });
    db.fotorankContest.findUnique.mockResolvedValue({ ...concurso, distributionChannel: "CLICKATON" });
    expect(await resultadosDelConcurso(ANA, "c1")).toEqual({ ok: false, motivo: "MARATON" });
    expect(db.fotorankResultBatch.findMany).not.toHaveBeenCalled();
  });
  it("sin lote cerrado por el jurado", async () => {
    prepararConcurso();
    db.fotorankResultBatch.findMany.mockResolvedValue([]);
    expect(await resultadosDelConcurso(ANA, "c1")).toEqual({ ok: false, motivo: "SIN_RESULTADOS" });
  });
  it("sólo pide lotes FINALIZED o PUBLISHED y usa el más nuevo", async () => {
    prepararConcurso();
    const r = await resultadosDelConcurso(ANA, "c1");
    expect(db.fotorankResultBatch.findMany.mock.calls[0][0].where).toEqual({ contestId: "c1", status: { in: ["FINALIZED", "PUBLISHED"] } });
    if (!r.ok) throw new Error("debía andar");
    expect(r.batch).toEqual({ id: "b-fin", status: "FINALIZED", version: d("2026-09-21"), date: d("2026-09-20") });
    expect(db.fotorankResultEntry.findMany.mock.calls[0][0].where).toEqual({
      resultBatchId: "b-fin", awardType: { not: null }, coverageStatus: "COMPLETE",
      resultStatus: { notIn: ["NOT_SELECTED", "REVIEW_REQUIRED", "DISQUALIFIED"] },
    });
  });
  it("obras: sólo confirmadas, sin descalificadas, retiradas, rechazadas, excluidas, sin premio ni con cobertura incompleta", async () => {
    prepararConcurso();
    const r = await resultadosDelConcurso(ANA, "c1");
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
        entryId: "e3", authorUserId: 12, authorName: "Autor/a sin nombre", title: "Mirada", tier: "FINALIST", awardType: "FINALIST",
        categoryId: "cat-r", categoryName: "Retrato", distinction: "Preseleccionada · Retrato", rank: 2,
        exhibitBasis: "EXPLICIT", attributionRequired: false,
      },
    ]);
    const where = db.fotorankContestEntry.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ contestId: { in: ["c1"] }, withdrawnAt: null, status: "CONFIRMED" });
    expect(where.AND).toEqual([
      { OR: [{ admissionStatus: null }, { admissionStatus: { notIn: ["REJECTED", "EXCLUDED", "WITHDRAWN", "REPLACED"] } }] },
      { OR: [{ registrationId: null }, { registration: { status: { notIn: ["DISQUALIFIED", "CANCELLED"] } } }] },
    ]);
  });
  it("una sola categoría: el premio sin categoría", async () => {
    prepararConcurso();
    db.fotorankContest.findUnique.mockResolvedValue({ ...concurso, categories: [concurso.categories[0]] });
    const r = await resultadosDelConcurso(ANA, "c1");
    if (!r.ok) throw new Error("debía andar");
    expect(r.works[0]?.distinction).toBe("1.er premio");
  });
  it("una obra en dos categorías sale una vez, con el mejor premio", async () => {
    prepararConcurso();
    db.fotorankResultEntry.findMany.mockResolvedValue([
      { juryEntrySnapshotId: "s1", categoryId: "cat-r", resultStatus: "RANKED", awardType: "FINALIST", finalPosition: 5, preliminaryPosition: 5 },
      { juryEntrySnapshotId: "s1", categoryId: "cat-p", resultStatus: "WINNER", awardType: "SECOND_PLACE", finalPosition: 2, preliminaryPosition: 2 },
    ]);
    const r = await resultadosDelConcurso(ANA, "c1");
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
    const r = await resultadosDelConcurso(ANA, "c1");
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
    expect(db.fotorankContest.findMany.mock.calls[0][0].where).toMatchObject({
      organizationId: { in: ["org1"] }, experienceType: "CONTEST", status: { notIn: ["DRAFT", "CANCELLED"] },
    });
    expect(r).toEqual([
      {
        id: "c1", title: "Paisajes 2026", slug: "paisajes-2026", organizationName: "SFPR",
        batchStatus: "FINALIZED", batchDate: d("2026-09-20"),
        counts: { WINNER: 1, MENTION: 1, FINALIST: 1 },
        muestras: [{ id: "a1", title: "Muestra Paisajes 2026", reviewStatus: "DRAFT" }],
      },
    ]);
  });
  it("dos consultas en total para fotos del jurado y obras, no dos por concurso", async () => {
    prepararConcurso();
    db.contestOrganizationMember.findMany.mockResolvedValue([{ organizationId: "org1" }]);
    db.fotorankContest.findMany.mockResolvedValue(
      Array.from({ length: 5 }, (_, i) => ({ ...concurso, id: i === 0 ? "c1" : `c${i + 10}`, resultBatches: lotes })),
    );
    db.culturalContestImport.findMany.mockResolvedValue([]);
    const r = await concursosParaArmar(ANA);
    expect(r).toHaveLength(5);
    expect(db.fotorankJuryEntrySnapshot.findMany).toHaveBeenCalledTimes(1);
    expect(db.fotorankContestEntry.findMany).toHaveBeenCalledTimes(1);
    // Las obras de c1 no se cuentan en los otros concursos (cada foto del jurado es de su concurso).
    expect(r.filter((c) => c.id !== "c1").every((c) => c.counts.WINNER === 0)).toBe(true);
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
