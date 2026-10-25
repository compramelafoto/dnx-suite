import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  role: vi.fn(),
  revalidate: vi.fn(),
  lib: {} as Record<string, ReturnType<typeof vi.fn>>,
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: H.revalidate }));
vi.mock("@/lib/access/active-context", () => ({
  requireActiveWorkspaceRole: vi.fn(async () => ({
    user: { id: 7, email: "ana@x.test", name: "Ana" },
    workspace: { id: "ws-1", name: "Estudio" },
    role: H.role(),
  })),
}));
vi.mock("@/lib/circuitos/configuracion", () => {
  const nombres = [
    "activarCircuito", "activarMotivo", "archivarEtapa", "borrarEtapa", "clonarCircuito", "crearCircuito", "crearEtapa",
    "crearMotivo", "desarchivarEtapa", "editarEtapa", "guardarReglas", "guardarTareasModelo", "marcarPredeterminado",
    "ordenarMotivos", "renombrarCircuito", "renombrarMotivo", "reordenarEtapas",
  ];
  for (const n of nombres) H.lib[n] = vi.fn();
  return H.lib;
});

const A = await import("./actions");

function fd(o: Record<string, string | string[]>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
  return f;
}

const CTX = { workspaceId: "ws-1", role: "ADMIN" };

beforeEach(() => {
  H.role.mockReset();
  H.revalidate.mockReset();
  H.role.mockReturnValue("ADMIN");
  for (const f of Object.values(H.lib)) {
    f.mockReset();
    f.mockResolvedValue({ ok: true });
  }
});

describe("acciones de Configuración → Circuitos", () => {
  it("sin `configurar` ninguna acción llega al catálogo", async () => {
    H.role.mockReturnValue("STAFF");
    const f = fd({ id: "x", circuitoId: "c1", nombre: "X", clase: "VENTA", activo: "1", dias: "0", color: "gris", etapa: ["a"], motivo: ["m"], evento: ["SENA_COBRADA"], tareas: "[]" });
    const acciones = Object.entries(A).filter(([, v]) => typeof v === "function") as [string, (p: undefined, f: FormData) => Promise<{ error: string | null }>][];
    expect(acciones).toHaveLength(17);
    for (const [, accion] of acciones) expect((await accion(undefined, f)).error).toMatch(/dueño o un administrador/);
    for (const g of Object.values(H.lib)) expect(g).not.toHaveBeenCalled();
  });

  it("el workspace sale de la sesión y el orden llega completo", async () => {
    await A.reordenarEtapasAction(undefined, fd({ circuitoId: "c1", etapa: ["s3", "s1", "s2"], workspaceId: "otro" }));
    expect(H.lib.reordenarEtapas).toHaveBeenCalledWith(CTX, "c1", ["s3", "s1", "s2"]);
    expect(H.revalidate).toHaveBeenCalledWith("/workspace/configuracion/circuitos");
  });

  it("editar etapa convierte días, casilla y estado vacío", async () => {
    await A.editarEtapaAction(undefined, fd({ id: "s1", nombre: "Nueva", dias: "3", color: "rojo", exigeTareas: "1", estadoCaptacion: "" }));
    expect(H.lib.editarEtapa).toHaveBeenCalledWith(CTX, "s1", { name: "Nueva", days: 3, color: "rojo", requireTasks: true, leadStatus: null });
    await A.editarEtapaAction(undefined, fd({ id: "s1", nombre: "Nueva", dias: "-2", color: "rojo" }));
    expect(H.lib.editarEtapa).toHaveBeenLastCalledWith(CTX, "s1", expect.objectContaining({ days: Number.NaN, requireTasks: false }));
  });

  it("las tareas llegan como JSON; un JSON roto no llega al catálogo", async () => {
    await A.guardarTareasModeloAction(undefined, fd({ id: "s1", tareas: '[{"title":"Llamar","days":1,"required":true}]' }));
    expect(H.lib.guardarTareasModelo).toHaveBeenCalledWith(CTX, "s1", [{ title: "Llamar", days: 1, required: true }]);
    expect((await A.guardarTareasModeloAction(undefined, fd({ id: "s1", tareas: "{roto" }))).error).toBeTruthy();
    expect(H.lib.guardarTareasModelo).toHaveBeenCalledTimes(1);
  });

  it("el error del catálogo llega a la pantalla sin revalidar", async () => {
    H.lib.borrarEtapa!.mockResolvedValue({ ok: false, error: "Esta etapa tiene registros: archivala." });
    expect(await A.borrarEtapaAction(undefined, fd({ id: "s1" }))).toEqual({ error: "Esta etapa tiene registros: archivala." });
    expect(H.revalidate).not.toHaveBeenCalled();
  });
});
