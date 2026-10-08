import { beforeEach, describe, expect, it, vi } from "vitest";

/** Acción de Configuración → Presupuestos con `guardarAjustes` real y la base simulada. */
const H = vi.hoisted(() => ({
  role: vi.fn(),
  revalidate: vi.fn(),
  upsert: vi.fn(async (_datos: unknown) => ({ id: "a1" })),
  updateMany: vi.fn(async () => ({ count: 1 })),
  modulo: vi.fn(async () => false),
  guardarPM: vi.fn(async (..._a: unknown[]): Promise<{ ok: true } | { ok: false; error: string }> => ({ ok: true })),
  borrarPM: vi.fn(async (..._a: unknown[]): Promise<{ ok: true } | { ok: false; error: string }> => ({ ok: true })),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({
  prisma: { fotofficePresupuestoAjustes: { upsert: H.upsert, updateMany: H.updateMany, findUnique: vi.fn() } },
}));
vi.mock("next/cache", () => ({ revalidatePath: H.revalidate }));
vi.mock("@/lib/presupuestos/propuestas-modelo", () => ({ guardarPropuestaModelo: H.guardarPM, borrarPropuestaModelo: H.borrarPM }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: H.modulo }));
vi.mock("@/lib/access/active-context", () => ({
  requireActiveWorkspaceRole: vi.fn(async () => ({
    user: { id: 7, email: "ana@x.test", name: "Ana" },
    workspace: { id: "ws-1", name: "Estudio" },
    role: H.role(),
  })),
}));

const A = await import("./actions");

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.append(k, v);
  return f;
}

const VALIDO = { validez: "20", condiciones: "  Incluye edición.  ", propuestaPago: "", seguimiento: "3", seguimientoActivo: "1" };

describe("guardarAjustesPresupuestosAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    H.role.mockReturnValue("WORKSPACE_OWNER");
  });

  it("sin `configurar` no escribe nada", async () => {
    H.role.mockReturnValue("WORKSPACE_MEMBER");
    const r = await A.guardarAjustesPresupuestosAction(undefined, fd(VALIDO));
    expect(r.error).toMatch(/dueño o un administrador/);
    expect(H.upsert).not.toHaveBeenCalled();
  });

  it("guarda con el módulo apagado, en el workspace de la sesión, recortando textos", async () => {
    const r = await A.guardarAjustesPresupuestosAction(undefined, fd({ ...VALIDO, workspaceId: "otro" }));
    expect(r).toEqual({ error: null, ok: "Ajustes guardados." });
    expect(H.modulo).not.toHaveBeenCalled();
    const arg = H.upsert.mock.calls[0]![0] as { where: { workspaceId: string }; update: Record<string, unknown> };
    expect(arg.where.workspaceId).toBe("ws-1");
    expect(arg.update).toEqual({
      validityDays: 20,
      terms: "Incluye edición.",
      paymentProposal: null,
      followUpDays: 3,
      followUpEnabled: true,
    });
    expect(H.revalidate).toHaveBeenCalledWith("/workspace/configuracion/presupuestos");
  });

  it("el seguimiento sin tildar queda apagado", async () => {
    const sinTilde: Record<string, string> = { ...VALIDO };
    delete sinTilde.seguimientoActivo;
    await A.guardarAjustesPresupuestosAction(undefined, fd(sinTilde));
    const arg = H.upsert.mock.calls[0]![0] as { update: Record<string, unknown> };
    expect(arg.update.followUpEnabled).toBe(false);
  });

  it("rechaza validez y seguimiento fuera de rango o que faltan", async () => {
    for (const malo of [{ validez: "0" }, { validez: "366" }, { validez: "1.5" }, { seguimiento: "91" }, { seguimiento: "abc" }]) {
      const r = await A.guardarAjustesPresupuestosAction(undefined, fd({ ...VALIDO, ...malo }));
      expect(r.error, JSON.stringify(malo)).toBeTruthy();
    }
    const sinValidez: Record<string, string> = { ...VALIDO };
    delete sinValidez.validez;
    expect((await A.guardarAjustesPresupuestosAction(undefined, fd(sinValidez))).error).toBe("Los datos no son válidos.");
    expect(H.upsert).not.toHaveBeenCalled();
  });

  it("opciones de pago: el JSON del editor se valida y se guarda; roto o inválido, no guarda", async () => {
    const opciones = { cashEnabled: false, installmentPlans: [{ id: "p3", numberOfInstallments: "3", interestMode: "none" }] };
    expect(await A.guardarAjustesPresupuestosAction(undefined, fd({ ...VALIDO, opcionesPago: JSON.stringify(opciones) }))).toEqual({ error: null, ok: "Ajustes guardados." });
    const arg = H.upsert.mock.calls[0]![0] as { update: Record<string, unknown> };
    expect(arg.update.paymentOptions).toEqual({
      cashEnabled: false, cashDiscountPercent: "", cashCommercialNote: "",
      installmentPlans: [{ id: "p3", numberOfInstallments: "3", interestMode: "none", interestPercent: "", commercialNote: "", appliedIndexMetadata: null }],
    });
    H.upsert.mockClear();
    expect((await A.guardarAjustesPresupuestosAction(undefined, fd({ ...VALIDO, opcionesPago: "{roto" }))).error).toBe("Los datos no son válidos.");
    expect((await A.guardarAjustesPresupuestosAction(undefined, fd({ ...VALIDO, opcionesPago: JSON.stringify({ installmentPlans: [{ numberOfInstallments: "0" }] }) }))).error).toMatch(/cuotas/);
    expect(H.upsert).not.toHaveBeenCalled();
  });

  it("rechaza textos de más de 4000 caracteres", async () => {
    const r = await A.guardarAjustesPresupuestosAction(undefined, fd({ ...VALIDO, condiciones: "x".repeat(4001) }));
    expect(r.error).toMatch(/4000/);
    expect(H.upsert).not.toHaveBeenCalled();
  });
});

describe("acciones de la propuesta modelo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    H.role.mockReturnValue("WORKSPACE_OWNER");
  });

  it("sin `configurar` no guardan ni borran", async () => {
    H.role.mockReturnValue("WORKSPACE_MEMBER");
    expect((await A.guardarPropuestaModeloAction({ categoriaId: "cat", items: [] })).ok).toBe(false);
    expect((await A.borrarPropuestaModeloAction("cat")).ok).toBe(false);
    expect(H.guardarPM).not.toHaveBeenCalled();
    expect(H.borrarPM).not.toHaveBeenCalled();
  });

  it("usan el workspace de la sesión y pasan sólo los campos conocidos", async () => {
    const datos = { categoriaId: "cat", items: [], condiciones: "c", enviarSola: false, plantillaId: null, workspaceId: "otro" };
    expect(await A.guardarPropuestaModeloAction(datos)).toEqual({ ok: true });
    const [ctx, pasados] = H.guardarPM.mock.calls[0]! as [{ workspaceId: string }, Record<string, unknown>];
    expect(ctx.workspaceId).toBe("ws-1");
    expect(pasados).toEqual({ categoriaId: "cat", items: [], condiciones: "c", enviarSola: false, plantillaId: null });
    expect(H.revalidate).toHaveBeenCalledWith("/workspace/configuracion/presupuestos/propuestas", "layout");
    expect(await A.borrarPropuestaModeloAction("cat")).toEqual({ ok: true });
    expect((H.borrarPM.mock.calls[0]![0] as { workspaceId: string }).workspaceId).toBe("ws-1");
  });

  it("devuelven el error de la validación sin revalidar", async () => {
    H.guardarPM.mockResolvedValueOnce({ ok: false, error: "No encontramos esa categoría." });
    expect(await A.guardarPropuestaModeloAction({ categoriaId: "x", items: [] })).toEqual({ ok: false, error: "No encontramos esa categoría." });
    expect(H.revalidate).not.toHaveBeenCalled();
  });
});
