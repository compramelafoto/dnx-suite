import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivity: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
  culturalActivityWork: { deleteMany: vi.fn(), createMany: vi.fn() },
  $transaction: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
const correos = vi.hoisted(() => ({ avisarAprobada: vi.fn(), avisarRechazada: vi.fn(), avisarNuevaPropuesta: vi.fn() }));

vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("@/lib/correos/enviar", () => correos);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { aprobar, enviarARevision, rechazar } = await import("./acciones");

const fila = {
  id: "a1", slug: "x", type: "CHARLA", title: "Charla", description: "d", coverImageUrl: "u",
  organizersText: "o", startsAt: new Date("2026-11-05T03:00:00Z"), endsAt: new Date("2026-11-06T02:59:59.999Z"),
  scheduleText: "18", isVirtualOnly: true, address: null, latitude: null, longitude: null,
  rightsConfirmedAt: null, reviewStatus: "DRAFT", proposedByUserId: 7, workspaceId: null, isCancelled: false,
  works: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  db.culturalActivity.update.mockResolvedValue({});
});

describe("enviarARevision", () => {
  it("pasa a en revisión si está completa", async () => {
    usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: null };
    db.culturalActivity.findUnique.mockResolvedValue(fila);
    const r = await enviarARevision("a1");
    expect(r.ok).toBe(true);
    expect(db.culturalActivity.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reviewStatus: "IN_REVIEW" }) }),
    );
    expect(correos.avisarNuevaPropuesta).toHaveBeenCalled();
  });
  it("devuelve los faltantes y no escribe", async () => {
    usuarioActual.valor = { id: 7, esSuperAdmin: false, email: "a@b", name: null };
    db.culturalActivity.findUnique.mockResolvedValue({ ...fila, title: "" });
    const r = await enviarARevision("a1");
    expect(r).toEqual({ ok: false, errores: ["Falta el título."] });
    expect(db.culturalActivity.update).not.toHaveBeenCalled();
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
    expect(db.culturalActivity.update).not.toHaveBeenCalled();
  });
  it("el super admin aprueba y se avisa a quien propuso", async () => {
    usuarioActual.valor = { id: 1, esSuperAdmin: true, email: "d@x", name: "Daniel" };
    db.culturalActivity.findUnique.mockResolvedValue({ ...fila, reviewStatus: "IN_REVIEW" });
    expect((await aprobar("a1")).ok).toBe(true);
    expect(db.culturalActivity.update).toHaveBeenCalledWith(
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
