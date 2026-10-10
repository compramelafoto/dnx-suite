import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findUnique: vi.fn(), count: vi.fn() },
  culturalActivityWork: { count: vi.fn(), aggregate: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  culturalExhibitor: { findUnique: vi.fn(), update: vi.fn() },
  culturalExhibitorWork: { findUnique: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { aprobarObraDeExpositor, corregirObraDeExpositor, pedirCambiosObraDeExpositor, sacarExpositor, sacarObraDeExpositor } = await import("./revision");
const { resetRateLimit } = await import("@/lib/limite");

const dueno = { id: 7, esSuperAdmin: false, email: "d@x", name: "Dueña" };
const coorg = { id: 8, esSuperAdmin: false, email: "c@x", name: "Coorg" };
const textos = { id: 9, esSuperAdmin: false, email: "t@x", name: "Tere" };
let miembros: Record<number, string>;
let muestra: Record<string, unknown>;
let obra: Record<string, unknown>;
const nuevaObra = (extra: Record<string, unknown> = {}) => ({
  id: "ew1", status: "SUBMITTED", activityId: "a1", activityWorkId: null as string | null,
  imageUrl: "https://pub/muestras/50/f.webp", title: "Silos", year: 2024, technique: "Giclée",
  imageWidthCm: 40, imageHeightCm: 60, frameWidthCm: 50, frameHeightCm: 70, edition: "UNIQUE", editionNumber: null, editionSize: null,
  statement: null, forSale: true, priceArs: 120000, hangingNotes: null,
  exhibitor: { id: "e1", userId: 50, profileId: "p50", displayName: "Ema Expone", status: "ACTIVE", activityId: "a1" },
  ...extra,
});
function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = dueno;
  miembros = { 8: "CO_ORGANIZER", 9: "TEXT_EDITOR" };
  muestra = { id: "a1", slug: "silos", reviewStatus: "DRAFT", proposedByUserId: 7, workspaceId: null, isCancelled: false };
  obra = nuevaObra();
  db.culturalActivity.findUnique.mockImplementation(async (q: { select: Record<string, unknown> }) =>
    q.select.members
      ? {
          proposedByUserId: 7,
          members: miembros[usuarioActual.valor!.id] ? [{ userId: usuarioActual.valor!.id, role: miembros[usuarioActual.valor!.id], status: "ACTIVE" }] : [],
        }
      : muestra);
  db.culturalActivity.count.mockResolvedValue(1);
  db.culturalExhibitorWork.findUnique.mockImplementation(async () => obra);
  db.culturalExhibitorWork.findFirst.mockImplementation(async () => obra);
  db.culturalExhibitorWork.updateMany.mockResolvedValue({ count: 1 });
  db.culturalActivityWork.count.mockResolvedValue(10);
  db.culturalActivityWork.aggregate.mockResolvedValue({ _max: { sortOrder: 9 } });
  db.culturalActivityWork.create.mockResolvedValue({ id: "aw-nueva" });
  db.culturalActivityWork.updateMany.mockResolvedValue({ count: 1 });
  db.culturalActivityWork.deleteMany.mockResolvedValue({ count: 1 });
  db.culturalExhibitor.update.mockResolvedValue({});
  db.$transaction.mockImplementation(async (fn: (t: typeof db) => Promise<unknown>) => fn(db));
  db.$queryRaw.mockResolvedValue([{ id: "a1" }]);
});

describe("aprobarObraDeExpositor", () => {
  it("el rol de textos no aprueba (la obra no existe para él)", async () => {
    usuarioActual.valor = textos;
    expect(await aprobarObraDeExpositor("ew1")).toEqual({ ok: false, errores: ["La obra no existe."] });
    expect(db.culturalActivityWork.create).not.toHaveBeenCalled();
  });

  it("con la muestra en revisión no aprueba ni escribe", async () => {
    muestra.reviewStatus = "IN_REVIEW";
    const r = await aprobarObraDeExpositor("ew1");
    expect(r).toEqual({ ok: false, errores: ["La muestra está en revisión: esperá a que se revise para sumar obras."] });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("crea la obra al final de la muestra (sin el precio) y guarda su id", async () => {
    expect(await aprobarObraDeExpositor("ew1")).toEqual({ ok: true });
    expect(db.$queryRaw).toHaveBeenCalled();
    const creada = db.culturalActivityWork.create.mock.calls[0]![0].data;
    expect(creada).toMatchObject({
      activityId: "a1", sortOrder: 10, imageUrl: "https://pub/muestras/50/f.webp", title: "Silos", authorName: "Ema Expone",
      authorUserId: 50, authorProfileId: "p50", isHighlight: false,
    });
    expect(JSON.stringify(creada)).not.toContain("120000");
    expect(db.culturalExhibitorWork.updateMany.mock.calls[0]![0]).toMatchObject({
      where: { id: "ew1", activityId: "a1", status: "SUBMITTED" },
      data: { status: "APPROVED", activityWorkId: "aw-nueva", reviewNote: null, reviewedByUserId: 7 },
    });
  });

  it("con 300 obras en la muestra no entra otra", async () => {
    db.culturalActivityWork.count.mockResolvedValue(300);
    expect(await aprobarObraDeExpositor("ew1")).toEqual({ ok: false, errores: ["La muestra llegó al máximo técnico de 300 obras."] });
    expect(db.culturalActivityWork.create).not.toHaveBeenCalled();
  });

  it("volver a aprobar actualiza la misma obra por id y no crea otra", async () => {
    obra = nuevaObra({ activityWorkId: "aw1" });
    expect(await aprobarObraDeExpositor("ew1")).toEqual({ ok: true });
    expect(db.culturalActivityWork.updateMany.mock.calls[0]![0].where).toEqual({ id: "aw1", activityId: "a1" });
    expect(db.culturalActivityWork.create).not.toHaveBeenCalled();
  });

  it("una obra cuya muestra no coincide con la de su expositor no existe", async () => {
    obra = nuevaObra({ activityId: "otra" });
    expect(await aprobarObraDeExpositor("ew1")).toEqual({ ok: false, errores: ["La obra no existe."] });
  });

  it("cada acción relee el rol: una coorganizadora sacada del equipo entre medio ya no puede", async () => {
    usuarioActual.valor = coorg;
    expect((await aprobarObraDeExpositor("ew1")).ok).toBe(true);
    miembros = {};
    obra = nuevaObra();
    expect(await aprobarObraDeExpositor("ew1")).toEqual({ ok: false, errores: ["La obra no existe."] });
  });

  it("si el permiso se pierde con la muestra bloqueada, no escribe", async () => {
    db.culturalActivity.count.mockResolvedValue(0);
    expect((await aprobarObraDeExpositor("ew1")).ok).toBe(false);
    expect(db.culturalActivityWork.create).not.toHaveBeenCalled();
  });
});

describe("pedirCambiosObraDeExpositor", () => {
  it("sin nota no pide cambios", async () => {
    expect(await pedirCambiosObraDeExpositor("ew1", "  ")).toEqual({ ok: false, errores: ["Escribí qué hay que cambiar."] });
    expect(db.culturalExhibitorWork.updateMany).not.toHaveBeenCalled();
  });

  it("a una aprobada: la obra de la muestra sigue", async () => {
    obra = nuevaObra({ status: "APPROVED", activityWorkId: "aw1" });
    expect(await pedirCambiosObraDeExpositor("ew1", "Mandá la foto sin marca de agua.")).toEqual({ ok: true });
    expect(db.culturalExhibitorWork.updateMany.mock.calls[0]![0].data).toMatchObject({ status: "CHANGES_REQUESTED", reviewNote: "Mandá la foto sin marca de agua." });
    expect(db.culturalExhibitorWork.updateMany.mock.calls[0]![0].data).not.toHaveProperty("activityWorkId");
    expect(db.culturalActivityWork.deleteMany).not.toHaveBeenCalled();
  });
});

describe("corregirObraDeExpositor", () => {
  it("corrige el texto de una aprobada y lo copia a la ficha; nunca el precio ni la foto", async () => {
    obra = nuevaObra({ status: "APPROVED", activityWorkId: "aw1" });
    const r = await corregirObraDeExpositor(fd({
      id: "ew1", title: "Silos al alba", year: "2024", technique: "Giclée", imageWidthCm: "40", imageHeightCm: "60",
      frameWidthCm: "50", frameHeightCm: "70", edition: "UNIQUE", priceArs: "1", forSale: "1", imageUrl: "https://otra/x.webp",
    }));
    expect(r).toEqual({ ok: true });
    const data = db.culturalExhibitorWork.updateMany.mock.calls[0]![0].data;
    expect(data).toMatchObject({ title: "Silos al alba" });
    expect(data).not.toHaveProperty("priceArs");
    expect(data).not.toHaveProperty("imageUrl");
    expect(db.culturalActivityWork.updateMany).toHaveBeenCalledWith({
      where: { id: "aw1", activityId: "a1" }, data: { title: "Silos al alba", year: 2024, technique: "Giclée" },
    });
  });
});

describe("sacar", () => {
  it("sacar una obra borra la de la muestra sólo con el activityId de esta muestra", async () => {
    obra = nuevaObra({ status: "APPROVED", activityWorkId: "aw1" });
    expect(await sacarObraDeExpositor("ew1")).toEqual({ ok: true });
    expect(db.culturalActivityWork.deleteMany).toHaveBeenCalledWith({ where: { id: "aw1", activityId: "a1" } });
    expect(db.culturalExhibitorWork.updateMany.mock.calls[0]![0].data).toMatchObject({
      status: "REMOVED", activityWorkId: null, reviewNote: "La organización la sacó de la muestra.",
    });
  });

  it("sacar a la persona saca todas sus obras", async () => {
    db.culturalExhibitor.findUnique.mockResolvedValue({
      id: "e1", status: "ACTIVE", activityId: "a1",
      works: [{ id: "ew1", activityId: "a1", activityWorkId: "aw1" }, { id: "ew2", activityId: "a1", activityWorkId: null }],
    });
    expect(await sacarExpositor("e1")).toEqual({ ok: true });
    expect(db.culturalExhibitor.update.mock.calls[0]![0].data).toMatchObject({ status: "REMOVED", removedByUserId: 7 });
    expect(db.culturalExhibitorWork.updateMany.mock.calls[0]![0]).toMatchObject({
      where: { exhibitorId: "e1", activityId: "a1", status: { not: "REMOVED" } }, data: { status: "REMOVED", activityWorkId: null },
    });
    expect(db.culturalActivityWork.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["aw1"] }, activityId: "a1" } });
  });

  it("textos no saca a nadie", async () => {
    usuarioActual.valor = textos;
    db.culturalExhibitor.findUnique.mockResolvedValue({ id: "e1", status: "ACTIVE", activityId: "a1", works: [] });
    expect((await sacarExpositor("e1")).ok).toBe(false);
    expect(db.culturalExhibitor.update).not.toHaveBeenCalled();
  });
});
