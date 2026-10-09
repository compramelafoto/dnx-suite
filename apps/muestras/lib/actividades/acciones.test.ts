import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  culturalActivityWork: { deleteMany: vi.fn(), createMany: vi.fn(), findMany: vi.fn(), update: vi.fn() },
  culturalCallWork: { updateMany: vi.fn() },
  photographerProfile: { findUnique: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
const correos = vi.hoisted(() => ({ avisarAprobada: vi.fn(), avisarRechazada: vi.fn(), avisarNuevaPropuesta: vi.fn() }));

vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("@/lib/correos/enviar", () => correos);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

process.env.R2_PUBLIC_URL = "https://pub-test.r2.dev";
const { aprobar, enviarARevision, rechazar, guardarBorrador } = await import("./acciones");
const { resetRateLimit } = await import("@/lib/limite");

const fila = {
  id: "a1", slug: "x", type: "CHARLA", title: "Charla", description: "d", coverImageUrl: "u",
  organizersText: "o", startsAt: new Date("2026-11-05T03:00:00Z"), endsAt: new Date("2026-11-06T02:59:59.999Z"),
  scheduleText: "18", isVirtualOnly: true, address: null, latitude: null, longitude: null,
  rightsConfirmedAt: null, reviewStatus: "DRAFT", proposedByUserId: 7, workspaceId: null, isCancelled: false,
  works: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  db.culturalActivity.update.mockResolvedValue({});
  db.culturalActivity.updateMany.mockResolvedValue({ count: 1 });
  db.$transaction.mockImplementation(async (arg: unknown) => (typeof arg === "function" ? arg(db) : []));
  db.$queryRaw.mockResolvedValue([]);
  // Salvo que el test diga otra cosa, la galería en la base es la de la fila que devuelve findUnique.
  db.culturalActivityWork.findMany.mockImplementation(async () =>
    (((await db.culturalActivity.findUnique.getMockImplementation()?.()) as { works?: object[] } | null)?.works ?? []).map((w) => ({
      isHighlight: false, sortOrder: 0, authorProfileId: null, authorUserId: null, ...w,
    })),
  );
  db.photographerProfile.findUnique.mockResolvedValue(null);
  db.photographerProfile.findMany.mockResolvedValue([]);
});

describe("enviarARevision", () => {
  it("pasa a en revisión si está completa", async () => {
    usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: null };
    db.culturalActivity.findUnique.mockResolvedValue(fila);
    const r = await enviarARevision("a1");
    expect(r.ok).toBe(true);
    expect(db.culturalActivity.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reviewStatus: "IN_REVIEW" }) }),
    );
    expect(correos.avisarNuevaPropuesta).toHaveBeenCalled();
  });
  it("devuelve los faltantes y no escribe", async () => {
    usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: null };
    db.culturalActivity.findUnique.mockResolvedValue({ ...fila, title: "" });
    const r = await enviarARevision("a1");
    expect(r).toEqual({ ok: false, errores: ["Falta el título."] });
    expect(db.culturalActivity.updateMany).not.toHaveBeenCalled();
  });
  it("sin sesión no hace nada", async () => {
    usuarioActual.valor = null;
    const r = await enviarARevision("a1");
    expect(r.ok).toBe(false);
  });
});

describe("aprobar y rechazar", () => {
  it("quien propuso no puede aprobarse", async () => {
    usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: null };
    db.culturalActivity.findUnique.mockResolvedValue({ ...fila, reviewStatus: "IN_REVIEW" });
    expect((await aprobar("a1")).ok).toBe(false);
    expect(db.culturalActivity.updateMany).not.toHaveBeenCalled();
  });
  it("el super admin aprueba y se avisa a quien propuso", async () => {
    usuarioActual.valor = { id: 1, esSuperAdmin: true, email: "d@x", name: "Daniel" };
    db.culturalActivity.findUnique.mockResolvedValue({ ...fila, reviewStatus: "IN_REVIEW" });
    expect((await aprobar("a1")).ok).toBe(true);
    expect(db.culturalActivity.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reviewStatus: "APPROVED", reviewedByUserId: 1 }) }),
    );
    expect(correos.avisarAprobada).toHaveBeenCalledWith("a1");
  });
  it("rechazar exige motivo", async () => {
    usuarioActual.valor = { id: 1, esSuperAdmin: true, email: "d@x", name: "Daniel" };
    db.culturalActivity.findUnique.mockResolvedValue({ ...fila, reviewStatus: "IN_REVIEW" });
    expect(await rechazar("a1", "  ")).toEqual({ ok: false, errores: ["Escribí el motivo del rechazo."] });
    expect((await rechazar("a1", "Falta la dirección exacta")).ok).toBe(true);
    expect(correos.avisarRechazada).toHaveBeenCalledWith("a1");
  });
});

describe("transicion con carrera", () => {
  it("si el estado cambió mientras tanto, avisa y no avisa por correo", async () => {
    usuarioActual.valor = { id: 1, esSuperAdmin: true, email: "d@x", name: "Daniel" };
    db.culturalActivity.findUnique.mockResolvedValue({ ...fila, reviewStatus: "IN_REVIEW" });
    db.culturalActivity.updateMany.mockResolvedValue({ count: 0 });
    const r = await aprobar("a1");
    expect(r).toEqual({ ok: false, errores: ["La actividad cambió mientras tanto. Recargá la página."] });
    expect(correos.avisarAprobada).not.toHaveBeenCalled();
  });
  it("argumentos que no son texto no rompen", async () => {
    usuarioActual.valor = { id: 1, esSuperAdmin: true, email: "d@x", name: "Daniel" };
    expect((await aprobar(undefined as unknown as string)).ok).toBe(false);
    expect((await rechazar("a1", undefined as unknown as string)).ok).toBe(false);
  });
});

describe("guardarBorrador sobre una ficha publicada", () => {
  const completa = {
    id: "a1", type: "CHARLA", title: "Charla", description: "d", coverImageUrl: "https://pub-test.r2.dev/muestras/7/p.webp", organizersText: "o",
    startDay: "2026-11-05", endDay: "2026-11-06", scheduleText: "18", isVirtualOnly: "on", rightsConfirmed: "on",
    works: "[]",
  };
  function fd(o: Record<string, string>) {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  }
  beforeEach(() => {
    usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: null };
  });
  it("rechaza dejarla incompleta y no escribe", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ ...fila, reviewStatus: "APPROVED" });
    const r = await guardarBorrador(fd({ ...completa, description: "" }));
    expect(r.ok).toBe(false);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it("guarda si queda completa", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ ...fila, reviewStatus: "APPROVED" });
    const r = await guardarBorrador(fd(completa));
    expect(r).toEqual({ ok: true, id: "a1" });
    expect(db.$transaction).toHaveBeenCalled();
  });
});

describe("topes por persona", () => {
  function fd(o: Record<string, string>) {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  }
  it("crear borradores tiene tope; editar uno existente no cuenta", async () => {
    usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: null };
    db.culturalActivity.create.mockResolvedValue({ id: "n" });
    for (let i = 0; i < 20; i++) expect((await guardarBorrador(fd({ title: "Nueva" }))).ok).toBe(true);
    const r = await guardarBorrador(fd({ title: "Una más" }));
    expect(r.ok).toBe(false);
    expect(db.culturalActivity.create).toHaveBeenCalledTimes(20);
    db.culturalActivity.findUnique.mockResolvedValue(fila);
    expect((await guardarBorrador(fd({ id: "a1", title: "Edición" }))).ok).toBe(true);
  });
  it("enviar a revisión tiene tope y no escribe al pasarlo", async () => {
    usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: null };
    db.culturalActivity.findUnique.mockResolvedValue(fila);
    for (let i = 0; i < 10; i++) expect((await enviarARevision("a1")).ok).toBe(true);
    db.culturalActivity.updateMany.mockClear();
    const r = await enviarARevision("a1");
    expect(r.ok).toBe(false);
    expect(db.culturalActivity.updateMany).not.toHaveBeenCalled();
  });
});

describe("obras: ids estables y perfil del autor", () => {
  const BASE = "https://pub-test.r2.dev";
  const obra = (extra: Record<string, unknown> = {}) => ({
    imageUrl: `${BASE}/muestras/7/1.webp`, title: "Uno", authorName: "Ana Pérez", year: null, technique: null, isHighlight: false, ...extra,
  });
  function fd(o: Record<string, string>) {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  }
  const guardadas = () => db.culturalActivityWork.createMany.mock.calls[0]![0].data as Array<Record<string, unknown>>;

  beforeEach(() => {
    usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: null };
    db.culturalActivity.findUnique.mockResolvedValue({ ...fila, works: [{ id: "w-vieja" }] });
  });

  it("conserva el id de las obras que ya eran de la muestra (el QR impreso sigue andando)", async () => {
    await guardarBorrador(fd({ id: "a1", title: "Charla", works: JSON.stringify([obra({ id: "w-vieja" }), obra({ id: "w-ajena" }), obra({ id: "w-vieja" })]) }));
    expect(guardadas().map((o) => o.id)).toEqual(["w-vieja", undefined, undefined]);
  });
  it("conserva la cuenta del autor de las obras que siguen (no se pierde al reescribir la galería)", async () => {
    db.culturalActivity.findUnique.mockResolvedValue({ ...fila, works: [{ id: "w-vieja", authorProfileId: null, authorUserId: 42 }] });
    await guardarBorrador(fd({ id: "a1", title: "Charla", works: JSON.stringify([obra({ id: "w-vieja" }), obra()]) }));
    expect(guardadas().map((o) => o.authorUserId)).toEqual([42, null]);
  });
  it("vincula sola una obra nueva cuyo autor coincide con el perfil de quien propuso", async () => {
    db.photographerProfile.findUnique.mockResolvedValue({ id: "perfil-ana", displayName: "ana perez" });
    await guardarBorrador(fd({ id: "a1", title: "Charla", works: JSON.stringify([obra()]) }));
    expect(guardadas()[0]!.authorProfileId).toBe("perfil-ana");
  });
  it("descarta un perfil pedido que no existe", async () => {
    await guardarBorrador(fd({ id: "a1", title: "Charla", works: JSON.stringify([obra({ authorProfileId: "cperfilinexistente01" })]) }));
    expect(guardadas()[0]!.authorProfileId).toBeNull();
  });
  it("si edita el super admin, el perfil por defecto es el de quien propuso", async () => {
    usuarioActual.valor = { id: 1, esSuperAdmin: true, email: "d@x", name: "Daniel" };
    await guardarBorrador(fd({ id: "a1", title: "Charla", works: JSON.stringify([obra()]) }));
    expect(db.photographerProfile.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 7 } }));
  });
  describe("publicada: sólo el vínculo previo, el perfil propio o ninguno", () => {
    const AVISO = "Para sumar autores con perfil a una muestra publicada, escribinos. Las obras quedaron con el autor que tenían.";
    const completa = {
      id: "a1", type: "CHARLA", title: "Charla", description: "d", coverImageUrl: `${BASE}/muestras/7/p.webp`, organizersText: "o",
      startDay: "2026-11-05", endDay: "2026-11-06", scheduleText: "18", isVirtualOnly: "on", rightsConfirmed: "on",
    };
    beforeEach(() => {
      db.culturalActivity.findUnique.mockResolvedValue({ ...fila, reviewStatus: "APPROVED", works: [{ id: "w-vieja", authorProfileId: "pviejo0001" }] });
      db.photographerProfile.findUnique.mockResolvedValue({ id: "perfilana01", displayName: "Ana Pérez" });
      db.photographerProfile.findMany.mockResolvedValue([{ id: "pviejo0001" }, { id: "perfilana01" }, { id: "pajeno0001" }]);
    });
    it("ignora un perfil ajeno, conserva el anterior y avisa sin frenar el guardado", async () => {
      const r = await guardarBorrador(fd({ ...completa, works: JSON.stringify([obra({ id: "w-vieja", authorProfileId: "pajeno0001" }), obra({ authorName: "Luis", authorProfileId: "pajeno0001" })]) }));
      expect(r).toEqual({ ok: true, id: "a1", avisos: [AVISO] });
      expect(guardadas().map((o) => o.authorProfileId)).toEqual(["pviejo0001", null]);
    });
    it("deja el vínculo previo y el perfil propio sin aviso", async () => {
      const r = await guardarBorrador(fd({ ...completa, works: JSON.stringify([obra({ id: "w-vieja", authorProfileId: "pviejo0001" }), obra({ authorName: "Otro nombre", authorProfileId: "perfilana01" })]) }));
      expect(r).toEqual({ ok: true, id: "a1" });
      expect(guardadas().map((o) => o.authorProfileId)).toEqual(["pviejo0001", "perfilana01"]);
    });
    it("el super admin puede vincular cualquier perfil", async () => {
      usuarioActual.valor = { id: 1, esSuperAdmin: true, email: "d@x", name: "Daniel" };
      const r = await guardarBorrador(fd({ ...completa, works: JSON.stringify([obra({ id: "w-vieja", authorProfileId: "pajeno0001" })]) }));
      expect(r).toEqual({ ok: true, id: "a1" });
      expect(guardadas()[0]!.authorProfileId).toBe("pajeno0001");
    });
    it("en borrador se puede vincular cualquier perfil existente", async () => {
      db.culturalActivity.findUnique.mockResolvedValue({ ...fila, works: [{ id: "w-vieja", authorProfileId: null }] });
      const r = await guardarBorrador(fd({ id: "a1", title: "Charla", works: JSON.stringify([obra({ id: "w-vieja", authorProfileId: "pajeno0001" })]) }));
      expect(r).toEqual({ ok: true, id: "a1" });
      expect(guardadas()[0]!.authorProfileId).toBe("pajeno0001");
    });
  });
  it("un usuario que no puede editar la actividad no escribe nada", async () => {
    usuarioActual.valor = { id: 99, esSuperAdmin: false, email: "x@y", name: null };
    const r = await guardarBorrador(fd({ id: "a1", title: "Charla", works: JSON.stringify([obra({ id: "w-vieja" })]) }));
    expect(r.ok).toBe(false);
    expect(db.culturalActivityWork.createMany).not.toHaveBeenCalled();
  });
});

describe("guardarBorrador: obras sumadas con la pestaña abierta y obras quitadas", () => {
  const BASE = "https://pub-test.r2.dev";
  const obra = (extra: Record<string, unknown> = {}) => ({
    imageUrl: `${BASE}/muestras/7/1.webp`, title: "Uno", authorName: "Ana Pérez", year: null, technique: null, isHighlight: false, ...extra,
  });
  function fd(o: Record<string, string>) {
    const f = new FormData();
    for (const [k, v] of Object.entries(o)) f.set(k, v);
    return f;
  }
  const enLaBase = (filas: Array<{ id: string; sortOrder: number; isHighlight?: boolean }>) =>
    db.culturalActivityWork.findMany.mockResolvedValue(filas.map((w) => ({ isHighlight: false, authorProfileId: null, authorUserId: null, ...w })));
  beforeEach(() => {
    usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: null };
    db.culturalActivity.findUnique.mockResolvedValue({ ...fila, works: [] });
  });

  it("bloquea la muestra y conserva, después de las enviadas, las obras armadas que la pestaña no vio", async () => {
    enLaBase([{ id: "w1", sortOrder: 0 }, { id: "w2", sortOrder: 1 }, { id: "armada-b", sortOrder: 3 }, { id: "armada-a", sortOrder: 2 }]);
    const r = await guardarBorrador(fd({ id: "a1", title: "Charla", idsCargados: JSON.stringify(["w1", "w2"]), works: JSON.stringify([obra({ id: "w1" }), obra({ id: "w2" })]) }));
    expect(r).toEqual({ ok: true, id: "a1" });
    expect(String(db.$queryRaw.mock.calls[0]![0].join("?"))).toMatch(/FROM "CulturalActivity" WHERE id = \? FOR UPDATE/);
    expect(db.culturalActivityWork.deleteMany).toHaveBeenCalledWith({ where: { activityId: "a1", id: { notIn: ["armada-a", "armada-b"] } } });
    expect(db.culturalActivityWork.update.mock.calls.map((c) => c[0])).toEqual([
      { where: { id: "armada-a" }, data: { sortOrder: 2 } },
      { where: { id: "armada-b" }, data: { sortOrder: 3 } },
    ]);
    expect(db.culturalCallWork.updateMany).not.toHaveBeenCalled();
  });
  it("una obra que el editor cargó y sacó se quita y queda marcada para no volver a armarse", async () => {
    enLaBase([{ id: "w1", sortOrder: 0 }, { id: "elegida", sortOrder: 1 }]);
    const r = await guardarBorrador(fd({ id: "a1", title: "Charla", idsCargados: JSON.stringify(["w1", "elegida"]), works: JSON.stringify([obra({ id: "w1" })]) }));
    expect(r).toEqual({ ok: true, id: "a1" });
    expect(db.culturalActivityWork.deleteMany).toHaveBeenCalledWith({ where: { activityId: "a1", id: { notIn: [] } } });
    expect(db.culturalCallWork.updateMany).toHaveBeenCalledWith({
      where: { activityWorkId: { in: ["elegida"] }, call: { activityId: "a1" } },
      data: { activityWorkId: "quitada" },
    });
  });
  it("los topes cuentan las obras conservadas: si se pasan, no escribe", async () => {
    enLaBase(Array.from({ length: 5 }, (_, i) => ({ id: `armada-${i}`, sortOrder: 40 + i })));
    const muchas = Array.from({ length: 36 }, () => obra());
    const r = await guardarBorrador(fd({ id: "a1", title: "Charla", idsCargados: "[]", works: JSON.stringify(muchas) }));
    expect(r).toMatchObject({ ok: false, errores: [expect.stringMatching(/quedarían 41 y el tope es 40/)] });
    expect(db.culturalActivityWork.deleteMany).not.toHaveBeenCalled();
    expect(db.culturalActivityWork.createMany).not.toHaveBeenCalled();
  });
  it("también las destacadas", async () => {
    enLaBase([{ id: "armada", sortOrder: 5, isHighlight: true }]);
    const destacadas = Array.from({ length: 12 }, () => obra({ isHighlight: true }));
    const r = await guardarBorrador(fd({ id: "a1", title: "Charla", idsCargados: "[]", works: JSON.stringify(destacadas) }));
    expect(r).toMatchObject({ ok: false, errores: [expect.stringMatching(/13 destacadas y el tope es 12/)] });
  });
});
