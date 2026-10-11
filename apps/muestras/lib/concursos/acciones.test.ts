import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), count: vi.fn() },
  culturalContestImport: { findFirst: vi.fn(), create: vi.fn() },
  culturalContestWork: { findMany: vi.fn(), updateMany: vi.fn(), count: vi.fn() },
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $transaction: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
const fr = vi.hoisted(() => ({ resultadosDelConcurso: vi.fn() }));
const armar = vi.hoisted(() => ({ aplicarResultados: vi.fn() }));
const img = vi.hoisted(() => ({ copiarImagenDeConcurso: vi.fn(), borrarImagenDeConcurso: vi.fn() }));
const gal = vi.hoisted(() => ({ sincronizarObraConGaleria: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./fotorank", async () => {
  const real = await vi.importActual<typeof import("./fotorank")>("./fotorank");
  return { mensajeDeResultados: real.mensajeDeResultados, resultadosDelConcurso: fr.resultadosDelConcurso };
});
vi.mock("./armar", async () => {
  const real = await vi.importActual<typeof import("./armar")>("./armar");
  return { CorteDeArmado: real.CorteDeArmado, aplicarResultados: armar.aplicarResultados };
});

vi.mock("./imagen", async () => {
  const real = await vi.importActual<typeof import("./imagen")>("./imagen");
  return { ImagenDeConcursoError: real.ImagenDeConcursoError, ...img };
});
vi.mock("./galeria", () => gal);

const {
  actualizarDesdeConcurso, armarMuestraDesdeConcurso, copiarImagenesDelConcurso, guardarOpcionesDeObra, marcarAutorizacionEscrita, marcarEnlaceMandado,
  reintentarImagenes, sacarObraDelConcurso,
} = await import("./acciones");
const { ImagenDeConcursoError } = await import("./imagen");
const { CorteDeArmado } = await import("./armar");
const { resetRateLimit } = await import("@/lib/limite");

const ana = { id: 7, esSuperAdmin: false, email: "ana@x", name: "Ana" };
const RES = {
  ok: true,
  contest: { id: "c1", title: "Paisajes 2026", slug: "paisajes-2026", shortDescription: null, organizationId: "org1", organizationName: "SFPR", visibility: "PUBLIC", status: "COMPLETED" },
  batch: { id: "b1", status: "FINALIZED", version: new Date("2026-09-21"), date: new Date("2026-09-20") },
  categories: [],
  works: [],
};
const muestra = (o: Record<string, unknown> = {}) => ({
  id: "a1", slug: "mi-muestra", type: "MUESTRA", reviewStatus: "DRAFT", proposedByUserId: 7, workspaceId: null, isCancelled: false,
  contestImport: null, members: [], ...o,
});

function fd(o: { contestId?: string; destino?: string; tiers?: string[] }) {
  const f = new FormData();
  if (o.contestId !== undefined) f.set("contestId", o.contestId);
  if (o.destino !== undefined) f.set("destino", o.destino);
  for (const t of o.tiers ?? []) f.append("tiers", t);
  return f;
}
const nueva = () => fd({ contestId: "c1", destino: "nueva", tiers: ["WINNER", "MENTION"] });

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  vi.useRealTimers();
  usuarioActual.valor = ana;
  fr.resultadosDelConcurso.mockResolvedValue(RES);
  armar.aplicarResultados.mockResolvedValue({ creadas: 2, actualizadas: 0, gone: 0, creadasIds: [] });
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db));
  db.$queryRaw.mockResolvedValue([]);
  db.$executeRaw.mockResolvedValue(1);
  db.culturalContestImport.findFirst.mockResolvedValue(null);
  db.culturalActivity.create.mockResolvedValue({ id: "nueva1", slug: "muestra-paisajes-2026-abc" });
  db.culturalContestImport.create.mockResolvedValue({ id: "imp1" });
  db.culturalActivity.findUnique.mockResolvedValue(muestra());
});

describe("armarMuestraDesdeConcurso", () => {
  it("sin sesión", async () => {
    usuarioActual.valor = null;
    expect(await armarMuestraDesdeConcurso(nueva())).toEqual({ ok: false, errores: ["Tenés que ingresar."] });
  });
  it("quien no organiza el concurso (jurado, lector, otra organización): no existe", async () => {
    fr.resultadosDelConcurso.mockResolvedValue({ ok: false, motivo: "NO_EXISTE" });
    expect(await armarMuestraDesdeConcurso(nueva())).toEqual({ ok: false, errores: ["El concurso no existe."] });
    expect(fr.resultadosDelConcurso).toHaveBeenCalledWith(ana, "c1");
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("sin lote cerrado y maratón: el mensaje", async () => {
    fr.resultadosDelConcurso.mockResolvedValue({ ok: false, motivo: "SIN_RESULTADOS" });
    expect((await armarMuestraDesdeConcurso(nueva())) as unknown).toEqual({ ok: false, errores: [expect.stringMatching(/todavía no tiene resultados cerrados/)] });
    fr.resultadosDelConcurso.mockResolvedValue({ ok: false, motivo: "MARATON" });
    expect((await armarMuestraDesdeConcurso(nueva())) as unknown).toEqual({ ok: false, errores: [expect.stringMatching(/maratones de Clickatón/)] });
  });
  it("sin niveles o con destino inválido", async () => {
    expect((await armarMuestraDesdeConcurso(fd({ contestId: "c1", destino: "nueva", tiers: ["x"] }))).ok).toBe(false);
    expect((await armarMuestraDesdeConcurso(fd({ contestId: "c1", destino: "../a", tiers: ["WINNER"] }))).ok).toBe(false);
    expect(fr.resultadosDelConcurso).not.toHaveBeenCalled();
  });

  it("muestra nueva: borrador MUESTRA de quien arma, con título, organización y fechas provisorias", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T15:00:00Z"));
    const r = await armarMuestraDesdeConcurso(nueva());
    expect(r).toEqual({ ok: true, id: "nueva1", avisos: ["Revisá fechas y sede: las pusimos provisorias."] });
    const data = db.culturalActivity.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      type: "MUESTRA", title: "Muestra Paisajes 2026", organizersText: "SFPR", proposedByUserId: 7,
      description: "Las obras premiadas y seleccionadas de Paisajes 2026, organizado por SFPR.",
      // Hoy 10/10 (hora argentina): desde el 9/11 hasta el 8/12.
      startsAt: new Date("2026-11-09T03:00:00.000Z"),
      endsAt: new Date("2026-12-09T02:59:59.999Z"),
    });
    expect(data.reviewStatus).toBeUndefined();
    expect(db.culturalContestImport.create.mock.calls[0][0].data).toMatchObject({
      activityId: "nueva1", contestId: "c1", tiers: ["WINNER", "MENTION"], resultBatchId: "b1", resultBatchStatus: "FINALIZED",
      sourceVersion: new Date("2026-09-21"), createdByUserId: 7,
    });
    expect(armar.aplicarResultados).toHaveBeenCalledWith(db, expect.objectContaining({ activityId: "nueva1", importId: "imp1", tiers: ["WINNER", "MENTION"] }));
    // Bloqueo por concurso, sin tocar tablas de FotoRank.
    expect(String(db.$executeRaw.mock.calls[0][0].join("?"))).toMatch(/pg_advisory_xact_lock/);
  });
  it("con la descripción del concurso, si tiene", async () => {
    fr.resultadosDelConcurso.mockResolvedValue({ ...RES, contest: { ...RES.contest, shortDescription: "Un concurso de paisajes." } });
    await armarMuestraDesdeConcurso(nueva());
    expect(db.culturalActivity.create.mock.calls[0][0].data.description).toBe("Un concurso de paisajes.");
  });
  it("doble clic: la segunda encuentra la muestra recién armada y no crea otra", async () => {
    db.culturalContestImport.findFirst.mockResolvedValue({ activityId: "nueva1", activity: { slug: "s" } });
    expect(await armarMuestraDesdeConcurso(nueva())).toEqual({ ok: true, id: "nueva1" });
    expect(db.culturalActivity.create).not.toHaveBeenCalled();
    expect(db.culturalContestImport.findFirst.mock.calls[0][0].where).toMatchObject({ contestId: "c1", createdByUserId: 7 });
  });
  it("el tope u otro corte del armado vuelve como mensaje", async () => {
    armar.aplicarResultados.mockRejectedValue(new CorteDeArmado("La muestra admite hasta 300 obras: ya tiene 300 y el concurso suma 1. Elegí menos niveles o sacá obras de la muestra."));
    expect(await armarMuestraDesdeConcurso(nueva())).toEqual({ ok: false, errores: [expect.stringMatching(/hasta 300 obras/)] });
  });

  describe("muestra existente", () => {
    const existente = () => fd({ contestId: "c1", destino: "a1", tiers: ["WINNER"] });
    it("propia, editable y sin concurso: crea el import y trae las obras con la muestra bloqueada", async () => {
      expect(await armarMuestraDesdeConcurso(existente())).toEqual({ ok: true, id: "a1" });
      expect(String(db.$queryRaw.mock.calls[0][0].join("?"))).toMatch(/FOR UPDATE/);
      expect(db.culturalContestImport.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ activityId: "a1" }) }));
      expect(armar.aplicarResultados).toHaveBeenCalledWith(db, expect.objectContaining({ activityId: "a1", importId: "imp1" }));
    });
    it("de otra persona (o de la coorganización): no existe", async () => {
      db.culturalActivity.findUnique.mockResolvedValue(muestra({ proposedByUserId: 99 }));
      expect(await armarMuestraDesdeConcurso(existente())).toEqual({ ok: false, errores: ["La muestra no existe."] });
      db.culturalActivity.findUnique.mockResolvedValue(muestra({ proposedByUserId: 99, members: [{ userId: 7, role: "CO_ORGANIZER", status: "ACTIVE" }] }));
      expect(await armarMuestraDesdeConcurso(existente())).toEqual({ ok: false, errores: ["La muestra no existe."] });
      expect(armar.aplicarResultados).not.toHaveBeenCalled();
    });
    it("en revisión: no", async () => {
      db.culturalActivity.findUnique.mockResolvedValue(muestra({ reviewStatus: "IN_REVIEW" }));
      expect(await armarMuestraDesdeConcurso(existente())).toEqual({ ok: false, errores: ["La muestra no se puede editar ahora (está en revisión o despublicada)."] });
    });
    it("con obras de otro concurso: no", async () => {
      db.culturalActivity.findUnique.mockResolvedValue(muestra({ contestImport: { id: "i9", contestId: "c9", tiers: ["WINNER"] } }));
      expect(await armarMuestraDesdeConcurso(existente())).toEqual({ ok: false, errores: ["Esta muestra ya tiene obras de otro concurso."] });
    });
    it("con obras de este mismo concurso: actualiza, sin otro import", async () => {
      db.culturalActivity.findUnique.mockResolvedValue(muestra({ contestImport: { id: "i1", contestId: "c1", tiers: ["WINNER"] } }));
      expect(await armarMuestraDesdeConcurso(existente())).toEqual({ ok: true, id: "a1" });
      expect(db.culturalContestImport.create).not.toHaveBeenCalled();
      expect(armar.aplicarResultados).toHaveBeenCalledWith(db, expect.objectContaining({ importId: "i1" }));
    });
    it("una charla no", async () => {
      db.culturalActivity.findUnique.mockResolvedValue(muestra({ type: "CHARLA" }));
      expect((await armarMuestraDesdeConcurso(existente())).ok).toBe(false);
    });
  });

  it("freno: 10 por hora", async () => {
    for (let i = 0; i < 10; i++) await armarMuestraDesdeConcurso(nueva());
    expect((await armarMuestraDesdeConcurso(nueva())).ok).toBe(false);
  });
});

describe("actualizarDesdeConcurso", () => {
  beforeEach(() => {
    db.culturalActivity.findFirst.mockResolvedValue({ id: "a1", contestImport: { id: "i1", contestId: "c1", tiers: ["WINNER", "MENTION"] } });
    db.culturalActivity.findUnique.mockResolvedValue(muestra({ contestImport: { id: "i1", contestId: "c1", tiers: ["WINNER", "MENTION"] } }));
  });
  it("con un lote nuevo: aplica los resultados con los niveles guardados", async () => {
    fr.resultadosDelConcurso.mockResolvedValue({ ...RES, batch: { ...RES.batch, id: "b2", version: new Date("2026-10-05") } });
    expect(await actualizarDesdeConcurso("a1")).toEqual({ ok: true, id: "a1" });
    const args = armar.aplicarResultados.mock.calls[0][1];
    expect(args).toMatchObject({ activityId: "a1", importId: "i1", tiers: ["WINNER", "MENTION"] });
    expect(args.resultados.batch.version).toEqual(new Date("2026-10-05"));
  });
  it("con niveles nuevos", async () => {
    await actualizarDesdeConcurso("a1", ["FINALIST", "WINNER"]);
    expect(armar.aplicarResultados.mock.calls[0][1].tiers).toEqual(["WINNER", "FINALIST"]);
  });
  it("sin lote usable (el jurado reabrió): el aviso y nada cambia", async () => {
    fr.resultadosDelConcurso.mockResolvedValue({ ok: false, motivo: "SIN_RESULTADOS" });
    expect(await actualizarDesdeConcurso("a1")).toEqual({
      ok: false, errores: ["Los resultados de este concurso ya no están cerrados en FotoRank. La muestra queda como está."],
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("quien ya no organiza el concurso: no actualiza", async () => {
    fr.resultadosDelConcurso.mockResolvedValue({ ok: false, motivo: "NO_EXISTE" });
    expect((await actualizarDesdeConcurso("a1")).ok).toBe(false);
    expect(armar.aplicarResultados).not.toHaveBeenCalled();
  });
  it("sin `contest` sobre la muestra (coorganización) o sin concurso: no existe", async () => {
    db.culturalActivity.findFirst.mockResolvedValue(null);
    expect(await actualizarDesdeConcurso("a1")).toEqual({ ok: false, errores: ["La muestra no existe."] });
    expect(db.culturalActivity.findFirst.mock.calls[0][0].where).toEqual({
      AND: [{ id: "a1" }, { OR: [{ proposedByUserId: 7 }] }],
    });
  });
  it("en revisión: no", async () => {
    db.culturalActivity.findUnique.mockResolvedValue(muestra({ reviewStatus: "IN_REVIEW", contestImport: { id: "i1", contestId: "c1", tiers: [] } }));
    expect((await actualizarDesdeConcurso("a1")).ok).toBe(false);
    expect(armar.aplicarResultados).not.toHaveBeenCalled();
  });
});

describe("copiarImagenesDelConcurso", () => {
  const tanda = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `cw${i + 1}` }));
  beforeEach(() => {
    db.culturalActivity.findFirst.mockResolvedValue({ ...muestra(), startsAt: new Date(), endsAt: new Date(), contestImport: { id: "i1" } });
    db.culturalActivity.count.mockResolvedValue(1);
    db.culturalContestWork.findMany.mockResolvedValue(tanda(6));
    db.culturalContestWork.updateMany.mockResolvedValue({ count: 1 });
    db.culturalContestWork.count.mockResolvedValueOnce(4).mockResolvedValueOnce(0);
    img.copiarImagenDeConcurso.mockImplementation(async (id: string) => ({ url: `https://r2/${id}.webp`, width: 1, height: 1 }));
    gal.sincronizarObraConGaleria.mockResolvedValue({ cambio: "CREADA" });
  });
  it("una tanda de hasta 6, sólo marcadas, con permiso y sin copiar, en orden del ranking", async () => {
    const r = await copiarImagenesDelConcurso("a1");
    expect(r).toEqual({ ok: true, copiadas: 6, faltan: 4, fallaron: 0 });
    expect(db.culturalContestWork.findMany.mock.calls[0][0]).toMatchObject({
      where: { activityId: "a1", include: true, imageStatus: "PENDING", exhibitConsent: "ACCEPTED" }, take: 6,
      orderBy: [{ rank: "asc" }, { id: "asc" }],
    });
    // Copia por id de la fila (leída de la base), y cada una con la muestra bloqueada.
    expect(img.copiarImagenDeConcurso.mock.calls.map((c) => c[0])).toEqual(["cw1", "cw2", "cw3", "cw4", "cw5", "cw6"]);
    expect(gal.sincronizarObraConGaleria).toHaveBeenCalledTimes(6);
    expect(db.$queryRaw).toHaveBeenCalledTimes(6);
  });
  it("una que falla queda FAILED con el mensaje y las demás siguen", async () => {
    img.copiarImagenDeConcurso.mockImplementation(async (id: string) => {
      if (id === "cw2") throw new ImagenDeConcursoError("FETCH_FAILED", "x");
      return { url: `https://r2/${id}.webp`, width: 1, height: 1 };
    });
    const r = await copiarImagenesDelConcurso("a1");
    expect(r).toMatchObject({ ok: true, copiadas: 5 });
    expect(db.culturalContestWork.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["cw2"] }, activityId: "a1", imageStatus: "PENDING" },
      data: { imageStatus: "FAILED", imageError: "No pudimos traer la imagen de FotoRank. Probá de nuevo en un rato." },
    });
  });
  it("sin el secreto: las de la tanda quedan FAILED con el aviso y la acción lo devuelve", async () => {
    img.copiarImagenDeConcurso.mockRejectedValue(new ImagenDeConcursoError("NOT_CONFIGURED", "Falta configurar la conexión con FotoRank (avisale a la administración)."));
    const r = await copiarImagenesDelConcurso("a1");
    expect(r).toEqual({ ok: false, errores: ["Falta configurar la conexión con FotoRank (avisale a la administración)."] });
    expect(db.culturalContestWork.updateMany.mock.calls[0][0].where.id.in).toEqual(tanda(6).map((t) => t.id));
    expect(img.copiarImagenDeConcurso).toHaveBeenCalledTimes(1);
  });
  it("si otra pestaña ya la copió, no la vuelve a llevar a la galería", async () => {
    db.culturalContestWork.findMany.mockResolvedValue(tanda(1));
    db.culturalContestWork.updateMany.mockResolvedValue({ count: 0 });
    await copiarImagenesDelConcurso("a1");
    expect(gal.sincronizarObraConGaleria).not.toHaveBeenCalled();
  });
  it("tope de la muestra: avisa", async () => {
    db.culturalContestWork.findMany.mockResolvedValue(tanda(1));
    gal.sincronizarObraConGaleria.mockResolvedValue({ cambio: "TOPE", aviso: "La muestra llegó al máximo técnico de 300 obras." });
    expect(await copiarImagenesDelConcurso("a1")).toMatchObject({ ok: true, avisos: ["La muestra llegó al máximo técnico de 300 obras."] });
  });
  it("coorganización (sin `contest`): no existe, sin copiar nada", async () => {
    db.culturalActivity.findFirst.mockResolvedValue(null);
    expect(await copiarImagenesDelConcurso("a1")).toEqual({ ok: false, errores: ["La muestra no existe."] });
    expect(img.copiarImagenDeConcurso).not.toHaveBeenCalled();
  });
  it("en revisión: no", async () => {
    db.culturalActivity.findFirst.mockResolvedValue({ ...muestra({ reviewStatus: "IN_REVIEW" }), contestImport: { id: "i1" } });
    expect(await copiarImagenesDelConcurso("a1")).toEqual({ ok: false, errores: ["La muestra está en revisión: esperá a que se revise para cambiar sus obras."] });
  });
  it("reintentar pasa las FAILED a PENDING", async () => {
    expect((await reintentarImagenes("a1")).ok).toBe(true);
    expect(db.culturalContestWork.updateMany).toHaveBeenCalledWith({
      where: { activityId: "a1", include: true, imageStatus: "FAILED" }, data: { imageStatus: "PENDING", imageError: null },
    });
  });
});

describe("opciones por obra", () => {
  type Fila = { id: string; include: boolean; toPrint: boolean; forSale: boolean; exhibitBasis: string; exhibitConsent: string; saleConsent: string; updatedAt: Date };
  let fila: Fila;
  const extra = vi.hoisted(() => ({
    workFindUnique: vi.fn(), workFindFirst: vi.fn(), authorFindUnique: vi.fn(), authorUpdateMany: vi.fn(),
  }));
  beforeEach(() => {
    fila = { id: "cw1", include: true, toPrint: true, forSale: false, exhibitBasis: "EXPLICIT", exhibitConsent: "PENDING", saleConsent: "NOT_ASKED", updatedAt: new Date("2026-10-10") };
    Object.assign(db.culturalContestWork, { findUnique: extra.workFindUnique, findFirst: extra.workFindFirst });
    Object.assign(db, { culturalContestAuthor: { findUnique: extra.authorFindUnique, updateMany: extra.authorUpdateMany } });
    extra.workFindUnique.mockResolvedValue({ id: "cw1", activityId: "a1" });
    extra.workFindFirst.mockImplementation(async () => ({ ...fila }));
    db.culturalContestWork.updateMany.mockResolvedValue({ count: 1 });
    db.culturalActivity.findFirst.mockResolvedValue({
      ...muestra(), startsAt: new Date("2026-11-01"), endsAt: new Date("2099-01-01"), contestImport: { id: "i1" },
    });
    db.culturalActivity.count.mockResolvedValue(1);
    gal.sincronizarObraConGaleria.mockResolvedValue({ cambio: "SIN_CAMBIO" });
  });
  const escrito = () => db.culturalContestWork.updateMany.mock.calls.at(-1)![0];

  it("sacar la galería desmarca 'Se imprime', con la muestra bloqueada, y sincroniza", async () => {
    expect((await guardarOpcionesDeObra("cw1", { include: false, toPrint: true, forSale: false })).ok).toBe(true);
    expect(escrito()).toMatchObject({ where: { id: "cw1", activityId: "a1", updatedAt: fila.updatedAt }, data: { include: false, toPrint: false } });
    expect(String(db.$queryRaw.mock.calls[0][0].join("?"))).toMatch(/FOR UPDATE/);
    expect(gal.sincronizarObraConGaleria).toHaveBeenCalledWith(db, "a1", "cw1");
  });
  it("marcar la venta le pregunta al autor; desmarcarla antes de que responda la retira", async () => {
    await guardarOpcionesDeObra("cw1", { include: true, toPrint: true, forSale: true });
    expect(escrito().data).toMatchObject({ forSale: true, saleConsent: "PENDING" });
    fila = { ...fila, forSale: true, saleConsent: "PENDING" };
    await guardarOpcionesDeObra("cw1", { include: true, toPrint: true, forSale: false });
    expect(escrito().data).toMatchObject({ forSale: false, saleConsent: "NOT_ASKED", saleConsentAt: null });
  });
  it("si el autor ya respondió la venta, su respuesta queda", async () => {
    fila = { ...fila, forSale: true, saleConsent: "DECLINED" };
    await guardarOpcionesDeObra("cw1", { include: true, toPrint: true, forSale: false });
    expect(escrito().data).toMatchObject({ forSale: false, saleConsent: "DECLINED" });
  });
  it("sacar de la muestra: include y toPrint en false; la copia se borra después", async () => {
    gal.sincronizarObraConGaleria.mockResolvedValue({ cambio: "SACADA", borrarImagen: "https://r2/x.webp" });
    expect((await sacarObraDelConcurso("cw1")).ok).toBe(true);
    expect(escrito().data).toEqual({ include: false, toPrint: false });
    expect(img.borrarImagenDeConcurso).toHaveBeenCalledWith("https://r2/x.webp");
  });
  it("autorización escrita sólo sobre lo pendiente", async () => {
    expect((await marcarAutorizacionEscrita("cw1")).ok).toBe(true);
    expect(escrito().data).toMatchObject({ exhibitConsent: "ACCEPTED", consentBy: "ORGANIZER" });
    fila = { ...fila, exhibitConsent: "DECLINED" };
    db.culturalContestWork.updateMany.mockClear();
    expect((await marcarAutorizacionEscrita("cw1")).ok).toBe(false);
    expect(db.culturalContestWork.updateMany).not.toHaveBeenCalled();
  });
  it("la coorganización no cambia nada", async () => {
    db.culturalActivity.findFirst.mockResolvedValue(null);
    expect(await guardarOpcionesDeObra("cw1", { include: false, toPrint: false, forSale: false })).toEqual({ ok: false, errores: ["La obra no existe."] });
    expect(await marcarAutorizacionEscrita("cw1")).toEqual({ ok: false, errores: ["La obra no existe."] });
    expect(db.culturalContestWork.updateMany).not.toHaveBeenCalled();
  });
  it("con la muestra en revisión: no", async () => {
    db.culturalActivity.findFirst.mockResolvedValue({ ...muestra({ reviewStatus: "IN_REVIEW" }), startsAt: new Date(), endsAt: new Date(), contestImport: { id: "i1" } });
    expect(await sacarObraDelConcurso("cw1")).toEqual({ ok: false, errores: ["La muestra está en revisión: esperá a que se revise para cambiar sus obras."] });
  });
  it("si cambió en el medio, no pisa", async () => {
    db.culturalContestWork.updateMany.mockResolvedValue({ count: 0 });
    expect(await sacarObraDelConcurso("cw1")).toEqual({ ok: false, errores: ["La obra cambió mientras tanto. Recargá la página."] });
  });
  it("enlace mandado guarda la fecha", async () => {
    extra.authorFindUnique.mockResolvedValue({ id: "au1", activityId: "a1" });
    expect((await marcarEnlaceMandado("au1")).ok).toBe(true);
    expect(extra.authorUpdateMany).toHaveBeenCalledWith({ where: { id: "au1", activityId: "a1" }, data: { notifiedAt: expect.any(Date) } });
  });
});
