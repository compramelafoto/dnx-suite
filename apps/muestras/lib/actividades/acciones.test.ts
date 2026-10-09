import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn(), create: vi.fn() },
  culturalActivityWork: { deleteMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(),
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
  db.$transaction.mockResolvedValue([]);
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
