import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `otorgarAccesoAlAula` y el `otorgarFaltantes` por defecto contra una base simulada.
 *
 * Vive aparte de `grant.test.ts` porque acá se reemplaza `@repo/db` entero.
 */

const {
  enrollmentFindUniqueMock,
  enrollmentFindManyMock,
  accessCreateMock,
  accessFindManyMock,
  accessUpdateMock,
  enviarMock,
} = vi.hoisted(() => ({
  enrollmentFindUniqueMock: vi.fn(),
  enrollmentFindManyMock: vi.fn(),
  accessCreateMock: vi.fn(),
  accessFindManyMock: vi.fn(),
  accessUpdateMock: vi.fn(),
  enviarMock: vi.fn(),
}));

class PrismaClientKnownRequestError extends Error {
  code: string;
  constructor(message: string, opts: { code: string }) {
    super(message);
    this.code = opts.code;
  }
}

vi.mock("@repo/db", () => ({
  Prisma: { PrismaClientKnownRequestError },
  prisma: {
    courseEnrollment: { findUnique: enrollmentFindUniqueMock, findMany: enrollmentFindManyMock },
    courseAccess: { create: accessCreateMock, findMany: accessFindManyMock, update: accessUpdateMock },
  },
}));
vi.mock("@/lib/presential-courses/log", () => ({ logCourseEvent: vi.fn() }));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceSignature: vi.fn().mockResolvedValue(null),
}));
vi.mock("./email", async (original) => ({
  ...(await original<typeof import("./email")>()),
  sendClassroomAccessEmail: enviarMock,
}));

const { otorgarAccesoAlAula, reenviarEnlaces } = await import("./grant");

const ahora = new Date(Date.UTC(2026, 9, 3, 15));

function inscripcion(parcial: Record<string, unknown> = {}) {
  return {
    id: "insc-1",
    workspaceId: "ws-1",
    courseId: "curso-1",
    paymentStatus: "APPROVED",
    course: { deliveryMode: "RECORDED", accessMonths: 12 },
    access: null,
    ...parcial,
  };
}

beforeEach(() => {
  enrollmentFindUniqueMock.mockReset().mockResolvedValue(inscripcion());
  enrollmentFindManyMock.mockReset().mockResolvedValue([]);
  accessCreateMock.mockReset().mockResolvedValue({ id: "acc-1" });
  accessFindManyMock.mockReset().mockResolvedValue([]);
  accessUpdateMock.mockReset().mockResolvedValue({});
  enviarMock.mockReset().mockResolvedValue({ sent: true });
});

describe("otorgar el acceso al aula", () => {
  it("crea el acceso de una inscripción pagada a un curso grabado", async () => {
    const r = await otorgarAccesoAlAula("insc-1", ahora);
    expect(r).toMatchObject({ ok: true, creado: true, accessId: "acc-1" });
    expect(accessCreateMock).toHaveBeenCalledTimes(1);
    const data = accessCreateMock.mock.calls[0]?.[0]?.data;
    expect(data).toMatchObject({ enrollmentId: "insc-1", workspaceId: "ws-1", courseId: "curso-1", grantedAt: ahora });
    // En la base va el hash, nunca el token crudo.
    if (r.ok && r.creado) expect(data.tokenHash).not.toBe(r.token);
  });

  it("una inscripción que no existe no crea nada", async () => {
    enrollmentFindUniqueMock.mockResolvedValue(null);
    expect(await otorgarAccesoAlAula("insc-x", ahora)).toEqual({ ok: false, reason: "inscripcion_no_encontrada" });
    expect(accessCreateMock).not.toHaveBeenCalled();
  });

  it("una inscripción no aprobada no recibe acceso", async () => {
    enrollmentFindUniqueMock.mockResolvedValue(inscripcion({ paymentStatus: "PENDING" }));
    expect(await otorgarAccesoAlAula("insc-1", ahora)).toEqual({ ok: false, reason: "inscripcion_no_aprobada" });
    expect(accessCreateMock).not.toHaveBeenCalled();
  });

  it("un curso que no es grabado no tiene aula", async () => {
    enrollmentFindUniqueMock.mockResolvedValue(
      inscripcion({ course: { deliveryMode: "PRESENTIAL", accessMonths: 12 } }),
    );
    expect(await otorgarAccesoAlAula("insc-1", ahora)).toEqual({ ok: false, reason: "no_es_grabado" });
    expect(accessCreateMock).not.toHaveBeenCalled();
  });

  it("si el acceso ya existe no genera otro token", async () => {
    enrollmentFindUniqueMock.mockResolvedValue(inscripcion({ access: { id: "acc-viejo" } }));
    expect(await otorgarAccesoAlAula("insc-1", ahora)).toEqual({ ok: true, creado: false });
    expect(accessCreateMock).not.toHaveBeenCalled();
  });

  it("si otro pedido lo creó al mismo tiempo (P2002) devuelve creado: false", async () => {
    accessCreateMock.mockRejectedValue(new PrismaClientKnownRequestError("único", { code: "P2002" }));
    expect(await otorgarAccesoAlAula("insc-1", ahora)).toEqual({ ok: true, creado: false });
  });

  it("cualquier otro error de la base se propaga", async () => {
    accessCreateMock.mockRejectedValue(new Error("base caída"));
    await expect(otorgarAccesoAlAula("insc-1", ahora)).rejects.toThrow("base caída");
  });
});

describe("reenviar con las dependencias por defecto", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://fotoffice.com");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("otorga el acceso que faltaba y le manda el enlace en la misma llamada", async () => {
    enrollmentFindManyMock.mockResolvedValue([{ id: "insc-1" }]);
    accessFindManyMock.mockResolvedValue([
      {
        id: "acc-1",
        workspaceId: "ws-1",
        expiresAt: new Date(Date.UTC(2027, 9, 3)),
        tokenHash: "hash-recien-creado",
        updatedAt: ahora,
        enrollment: { email: "ana@example.com", name: "Ana" },
        course: { title: "Retrato" },
      },
    ]);

    expect(await reenviarEnlaces("Ana@Example.com", undefined, ahora)).toEqual({ enviados: 1 });

    expect(enrollmentFindManyMock).toHaveBeenCalledWith({
      where: {
        email: { equals: "ana@example.com", mode: "insensitive" },
        paymentStatus: "APPROVED",
        course: { deliveryMode: "RECORDED" },
        access: { is: null },
      },
      select: { id: true },
    });
    expect(accessCreateMock).toHaveBeenCalledTimes(1);
    expect(enviarMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ana@example.com", enlace: expect.stringMatching(/^https:\/\/fotoffice\.com\/aula\//) }),
    );
  });

  it("sin inscripciones pendientes no crea accesos", async () => {
    expect(await reenviarEnlaces("ana@example.com", undefined, ahora)).toEqual({ enviados: 0 });
    expect(accessCreateMock).not.toHaveBeenCalled();
  });
});
