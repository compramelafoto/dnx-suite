import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAuthMock, isPlatformAdminMock, upsertMock, revalidateMock } = vi.hoisted(() => ({
  requireAuthMock: vi.fn(),
  isPlatformAdminMock: vi.fn(),
  upsertMock: vi.fn(),
  revalidateMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: revalidateMock }));
vi.mock("@/lib/auth", () => ({ requireAuth: requireAuthMock }));
vi.mock("@/lib/platform-admin", () => ({ isFotofficePlatformAdmin: isPlatformAdminMock }));
vi.mock("@repo/db", async () => {
  const actual = await vi.importActual<typeof import("@repo/db")>("@repo/db");
  return { ...actual, prisma: { workspaceModuleFee: { upsert: upsertMock } } };
});

const { setModuleFeeAction } = await import("./platform-fee-admin");

function formOf(values: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  requireAuthMock.mockReset().mockResolvedValue({ id: 1 });
  isPlatformAdminMock.mockReset().mockResolvedValue(true);
  upsertMock.mockReset().mockResolvedValue({});
  revalidateMock.mockReset();
});

describe("setModuleFeeAction", () => {
  it("guarda 7,5% como 750 puntos básicos", async () => {
    const r = await setModuleFeeAction(
      undefined,
      formOf({ workspaceId: "ws-1", moduleKey: "courses-sales", feePercent: "7,5" }),
    );

    expect(r.error).toBeNull();
    expect(upsertMock.mock.calls[0]?.[0]).toMatchObject({
      where: { workspaceId_moduleKey: { workspaceId: "ws-1", moduleKey: "courses-sales" } },
      update: { feeBps: 750, updatedByUserId: 1 },
      create: {
        workspaceId: "ws-1",
        moduleKey: "courses-sales",
        feeBps: 750,
        updatedByUserId: 1,
      },
    });
  });

  it("acepta punto además de coma", async () => {
    await setModuleFeeAction(
      undefined,
      formOf({ workspaceId: "ws-1", moduleKey: "courses-sales", feePercent: "7.5" }),
    );
    expect(upsertMock.mock.calls[0]?.[0].update.feeBps).toBe(750);
  });

  it("acepta comisión cero", async () => {
    await setModuleFeeAction(
      undefined,
      formOf({ workspaceId: "ws-1", moduleKey: "courses-sales", feePercent: "0" }),
    );
    expect(upsertMock.mock.calls[0]?.[0].update.feeBps).toBe(0);
  });

  it("guarda 5% como 500", async () => {
    await setModuleFeeAction(
      undefined,
      formOf({ workspaceId: "ws-1", moduleKey: "members", feePercent: "5" }),
    );
    expect(upsertMock.mock.calls[0]?.[0].update.feeBps).toBe(500);
  });

  /** El guard es el punto de todo el cambio: sin esto el cliente vuelve a poder tocarlo. */
  it("rechaza a quien no es super admin y no escribe nada", async () => {
    isPlatformAdminMock.mockResolvedValue(false);
    const r = await setModuleFeeAction(
      undefined,
      formOf({ workspaceId: "ws-1", moduleKey: "courses-sales", feePercent: "0" }),
    );

    expect(r.error).toBe("Solo SUPER_ADMIN puede editar la comisión de la plataforma.");
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it.each([
    ["negativa", "-1"],
    ["mayor a 100", "101"],
    ["no numérica", "abc"],
    ["vacía", ""],
    ["con más de 2 decimales", "5,123"],
  ])("rechaza una comisión %s", async (_label, feePercent) => {
    const r = await setModuleFeeAction(
      undefined,
      formOf({ workspaceId: "ws-1", moduleKey: "courses-sales", feePercent }),
    );
    expect(r.error).not.toBeNull();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rechaza un módulo que no está en el registry", async () => {
    const r = await setModuleFeeAction(
      undefined,
      formOf({ workspaceId: "ws-1", moduleKey: "modulo-inventado", feePercent: "5" }),
    );
    expect(r.error).toBe("Módulo inválido.");
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("rechaza un workspace vacío", async () => {
    const r = await setModuleFeeAction(
      undefined,
      formOf({ workspaceId: "", moduleKey: "courses-sales", feePercent: "5" }),
    );
    expect(r.error).toBe("Workspace inválido.");
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
