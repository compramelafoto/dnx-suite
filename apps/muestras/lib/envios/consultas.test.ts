import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ culturalCallSubmission: { findMany: vi.fn(), findUnique: vi.fn() } }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("server-only", () => ({}));

const { listarMisEnvios } = await import("./consultas");

const PRESENCIAL = { isVirtualOnly: false, venueName: "Centro Cultural", address: "Calle 1" };
const envio = (status: string, reviewStatus: string, lugar: object = PRESENCIAL) => ({
  id: "s1", status: "ACTIVE", updatedAt: new Date(),
  call: { id: "c1", slug: "ciudad", title: "Ciudad", status, opensAt: new Date(), closesAt: new Date(), activity: { reviewStatus, ...lugar } },
  works: [{ id: "w1", title: "Uno", imageUrl: "u", decision: "SELECTED" }],
});

beforeEach(() => vi.clearAllMocks());

describe("listarMisEnvios", () => {
  it.each([
    ["OPEN", "APPROVED", true],
    ["DONE", "APPROVED", true],
    ["DRAFT", "APPROVED", false],
    ["OPEN", "UNPUBLISHED", false],
  ])("convocatoria %s con muestra %s: página pública %s", async (status, reviewStatus, esperado) => {
    db.culturalCallSubmission.findMany.mockResolvedValue([envio(status, reviewStatus)]);
    const [e] = await listarMisEnvios(7);
    expect(e!.call.tienePaginaPublica).toBe(esperado);
    expect(e!.call).not.toHaveProperty("activity");
  });
  it("si la muestra ya no tiene lugar físico, no hay página pública", async () => {
    db.culturalCallSubmission.findMany.mockResolvedValue([envio("OPEN", "APPROVED", { isVirtualOnly: true, venueName: null, address: null })]);
    expect((await listarMisEnvios(7))[0]!.call.tienePaginaPublica).toBe(false);
  });
  it("la decisión sólo sale con la selección terminada", async () => {
    db.culturalCallSubmission.findMany.mockResolvedValue([envio("CURATING", "APPROVED")]);
    expect((await listarMisEnvios(7))[0]!.works[0]!.decision).toBeNull();
  });
});
