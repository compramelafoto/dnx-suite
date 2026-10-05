// lib/course-classroom/grant-otorgar.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@repo/db";

const m = vi.hoisted(() => ({
  enrollmentFindUnique: vi.fn(),
  accessFindUnique: vi.fn(),
  accessCreate: vi.fn(),
  accessUpdate: vi.fn(),
}));

vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return {
    ...actual,
    prisma: {
      courseEnrollment: { findUnique: m.enrollmentFindUnique },
      courseAccess: { findUnique: m.accessFindUnique, create: m.accessCreate, update: m.accessUpdate },
    },
  };
});

const { otorgarAccesoPorCompra } = await import("./grant");

const anterior = new Date(Date.UTC(2026, 8, 1));
const ahora = new Date(Date.UTC(2026, 9, 4, 12));
const inscripcion = {
  id: "insc-1",
  workspaceId: "ws-1",
  courseId: "curso-1",
  paymentStatus: "APPROVED",
  createdAt: new Date(Date.UTC(2026, 9, 1)),
  course: { deliveryMode: "RECORDED", accessMonths: 12 },
};

beforeEach(() => {
  for (const f of Object.values(m)) f.mockReset();
  m.enrollmentFindUnique.mockResolvedValue(inscripcion);
  m.accessFindUnique.mockResolvedValue(null);
  m.accessCreate.mockResolvedValue({ id: "acc-1" });
  m.accessUpdate.mockResolvedValue({ id: "acc-1" });
});

describe("otorgar el acceso por una compra", () => {
  it("crea el acceso de la persona, con vencimiento", async () => {
    const r = await otorgarAccesoPorCompra({ enrollmentId: "insc-1", userId: 7 }, ahora);
    expect(r).toEqual({ ok: true, accessId: "acc-1", expiresAt: new Date(Date.UTC(2027, 9, 4, 12)), nuevo: true });
    expect(m.accessCreate.mock.calls[0][0].data).toMatchObject({
      userId: 7,
      enrollmentId: "insc-1",
      courseId: "curso-1",
      origin: "PURCHASE",
    });
  });

  it("no aprobada, no grabada o inexistente: no da nada", async () => {
    m.enrollmentFindUnique.mockResolvedValueOnce({ ...inscripcion, paymentStatus: "PENDING" });
    expect(await otorgarAccesoPorCompra({ enrollmentId: "insc-1", userId: 7 }, ahora)).toEqual({ ok: false, reason: "inscripcion_no_aprobada" });
    m.enrollmentFindUnique.mockResolvedValueOnce({ ...inscripcion, course: { deliveryMode: "PRESENCIAL", accessMonths: 12 } });
    expect(await otorgarAccesoPorCompra({ enrollmentId: "insc-1", userId: 7 }, ahora)).toEqual({ ok: false, reason: "no_es_grabado" });
    m.enrollmentFindUnique.mockResolvedValueOnce(null);
    expect(await otorgarAccesoPorCompra({ enrollmentId: "insc-1", userId: 7 }, ahora)).toEqual({ ok: false, reason: "inscripcion_no_encontrada" });
    expect(m.accessCreate).not.toHaveBeenCalled();
  });

  it("el mismo aviso de pago dos veces no duplica nada", async () => {
    m.accessFindUnique.mockResolvedValue({ id: "acc-1", enrollmentId: "insc-1", origin: "PURCHASE", expiresAt: new Date(Date.UTC(2027, 9, 4, 12)), enrollment: { createdAt: anterior } });
    const r = await otorgarAccesoPorCompra({ enrollmentId: "insc-1", userId: 7 }, ahora);
    expect(r).toMatchObject({ ok: true, nuevo: false });
    expect(m.accessCreate).not.toHaveBeenCalled();
    expect(m.accessUpdate).not.toHaveBeenCalled();
  });

  it("si lo tenía de beneficio y lo compra, pasa a comprado con vencimiento", async () => {
    m.accessFindUnique.mockResolvedValue({ id: "acc-1", enrollmentId: "insc-gratis", origin: "MEMBER_BENEFIT", expiresAt: null, enrollment: { createdAt: anterior } });
    const r = await otorgarAccesoPorCompra({ enrollmentId: "insc-1", userId: 7 }, ahora);
    expect(r).toMatchObject({ ok: true, accessId: "acc-1", nuevo: true });
    expect(m.accessUpdate.mock.calls[0][0].data).toMatchObject({
      origin: "PURCHASE",
      enrollmentId: "insc-1",
      expiresAt: new Date(Date.UTC(2027, 9, 4, 12)),
      revokedAt: null,
    });
  });

  it("renovar una compra vigente extiende desde el vencimiento actual", async () => {
    const vigente = new Date(Date.UTC(2027, 0, 1));
    m.accessFindUnique.mockResolvedValue({ id: "acc-1", enrollmentId: "insc-0", origin: "PURCHASE", expiresAt: vigente, enrollment: { createdAt: anterior } });
    const r = await otorgarAccesoPorCompra({ enrollmentId: "insc-1", userId: 7 }, ahora);
    expect(r).toMatchObject({ ok: true, nuevo: true, expiresAt: new Date(Date.UTC(2028, 0, 1)) });
    expect(m.accessUpdate.mock.calls[0][0].data.expiresAt).toEqual(new Date(Date.UTC(2028, 0, 1)));
  });

  it("una inscripción más vieja que la que tiene el acceso no lo mueve ni lo renueva", async () => {
    const vigente = new Date(Date.UTC(2027, 0, 1));
    m.accessFindUnique.mockResolvedValue({ id: "acc-1", enrollmentId: "insc-nueva", origin: "PURCHASE", expiresAt: vigente, enrollment: { createdAt: new Date(Date.UTC(2026, 9, 3)) } });
    const r = await otorgarAccesoPorCompra({ enrollmentId: "insc-1", userId: 7 }, ahora);
    expect(r).toEqual({ ok: true, accessId: "acc-1", expiresAt: vigente, nuevo: false });
    expect(m.accessUpdate).not.toHaveBeenCalled();
  });

  it("si otro pedido lo creó al mismo tiempo (P2002), lo toma como existente", async () => {
    m.accessCreate.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("único", { code: "P2002", clientVersion: "x" }),
    );
    m.accessFindUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "acc-9", enrollmentId: "insc-1", origin: "PURCHASE", expiresAt: null });
    expect(await otorgarAccesoPorCompra({ enrollmentId: "insc-1", userId: 7 }, ahora)).toMatchObject({ ok: true, accessId: "acc-9", nuevo: false });
  });
});
