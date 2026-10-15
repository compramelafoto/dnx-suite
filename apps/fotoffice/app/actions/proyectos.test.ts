import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  ctx: vi.fn(), revalidate: vi.fn(), r2: vi.fn(),
  editar: vi.fn(), suspender: vi.fn(), reanudar: vi.fn(), reasignar: vi.fn(),
  agregarPart: vi.fn(), editarPart: vi.fn(), quitarPart: vi.fn(), crearRol: vi.fn(),
  agregarNota: vi.fn(), editarNota: vi.fn(), borrarNota: vi.fn(),
  pedir: vi.fn(), confirmar: vi.fn(), enlace: vi.fn(), borrarAdj: vi.fn(), restaurar: vi.fn(),
  entrega: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: H.revalidate }));
// `after` corre enseguida: así se ve a qué proyecto se le avisa a Google.
vi.mock("next/server", () => ({ after: (f: () => unknown) => void f() }));
vi.mock("@/lib/agenda/google/empuje", () => ({ alCambiarProyecto: H.entrega }));
vi.mock("@/lib/proyectos/contexto", () => ({ contextoDeProyectos: H.ctx }));
vi.mock("@/lib/proyectos/crear", () => ({ crearProyectoManual: vi.fn() }));
vi.mock("@/lib/proyectos/proyectos", () => ({ editarDatos: H.editar, suspender: H.suspender, reanudar: H.reanudar, reasignarTareas: H.reasignar }));
vi.mock("@/lib/proyectos/participantes", () => ({ agregarParticipante: H.agregarPart, editarParticipante: H.editarPart, quitarParticipante: H.quitarPart, crearRol: H.crearRol }));
vi.mock("@/lib/proyectos/notas", () => ({ agregarNota: H.agregarNota, editarNota: H.editarNota, borrarNota: H.borrarNota }));
vi.mock("@/lib/proyectos/adjuntos", () => ({ pedirSubida: H.pedir, confirmarSubida: H.confirmar, enlaceDeDescarga: H.enlace, borrarAdjunto: H.borrarAdj, restaurarAdjunto: H.restaurar }));
vi.mock("@/lib/ficha/adjuntos-r2", () => ({ adjuntosR2Configurado: H.r2 }));

const A = await import("./proyectos");

const CTX = { workspaceId: "ws-1", userId: 7 };
const SIN_PERMISO = { ok: false, error: "No tenés permiso para hacer esto." };
const INVALIDOS = { ok: false, error: "Los datos no son válidos." };
const LIBS = [H.editar, H.suspender, H.reanudar, H.reasignar, H.agregarPart, H.editarPart, H.quitarPart, H.crearRol, H.agregarNota, H.editarNota, H.borrarNota, H.pedir, H.confirmar, H.enlace, H.borrarAdj, H.restaurar];

beforeEach(() => {
  vi.clearAllMocks();
  H.ctx.mockResolvedValue(CTX);
  H.r2.mockReturnValue(true);
  for (const f of LIBS) f.mockResolvedValue({ ok: true });
});

const LLAMADAS: [string, () => Promise<unknown>][] = [
  ["editar", () => A.editarProyectoAction("p1", { name: "x" })],
  ["suspender", () => A.suspenderProyectoAction("p1", "motivo")],
  ["reanudar", () => A.reanudarProyectoAction("p1")],
  ["reasignar", () => A.reasignarTareasAction("p1", { haciaUserId: 8 })],
  ["agregar participante", () => A.agregarParticipanteAction("p1", { userId: 8 })],
  ["editar participante", () => A.editarParticipanteAction("p1", "pa1", { note: "x" })],
  ["quitar participante", () => A.quitarParticipanteAction("p1", "pa1")],
  ["crear rol", () => A.crearRolAction("DJ")],
  ["agregar nota", () => A.agregarNotaAction("p1", "hola")],
  ["editar nota", () => A.editarNotaAction("p1", "n1", "hola")],
  ["borrar nota", () => A.borrarNotaAction("p1", "n1")],
  ["pedir subida", () => A.pedirSubidaAdjuntoAction("p1", { nombre: "a.pdf", tipo: "application/pdf", tamano: 5 })],
  ["confirmar subida", () => A.confirmarSubidaAdjuntoAction("p1", "a1")],
  ["descargar", () => A.enlaceDeDescargaAdjuntoAction("p1", "a1")],
  ["borrar adjunto", () => A.borrarAdjuntoAction("p1", "a1")],
  ["restaurar adjunto", () => A.restaurarAdjuntoAction("p1", "a1")],
];

describe("acciones de Proyectos", () => {
  it.each(LLAMADAS)("%s: sin contexto no llega a la lógica", async (_n, llamar) => {
    H.ctx.mockResolvedValue(null);
    expect(await llamar()).toEqual(SIN_PERMISO);
    for (const f of LIBS) expect(f).not.toHaveBeenCalled();
    expect(H.revalidate).not.toHaveBeenCalled();
  });

  it.each(LLAMADAS)("%s: con permiso llama y revalida la ficha", async (_n, llamar) => {
    await llamar();
    if (!["descargar", "crear rol", "pedir subida"].includes(_n)) expect(H.revalidate).toHaveBeenCalledWith("/proyectos/p1");
    expect(LIBS.some((f) => f.mock.calls.length === 1)).toBe(true);
  });

  it("editar, suspender y reanudar avisan a Google de la entrega del proyecto, después de confirmar", async () => {
    await A.editarProyectoAction("p1", { finalDueDate: "2026-12-01" });
    await A.suspenderProyectoAction("p1", "motivo");
    await A.reanudarProyectoAction("p1");
    expect(H.entrega.mock.calls).toEqual([["ws-1", "p1"], ["ws-1", "p1"], ["ws-1", "p1"]]);
  });

  it("si la acción falla o no hay permiso, no se avisa a Google", async () => {
    H.editar.mockResolvedValue({ ok: false, error: "x" });
    await A.editarProyectoAction("p1", { name: "n" });
    H.ctx.mockResolvedValue(null);
    await A.reanudarProyectoAction("p1");
    expect(H.entrega).not.toHaveBeenCalled();
  });

  it("pide Ver para descargar y Gestionar para el resto", async () => {
    await A.enlaceDeDescargaAdjuntoAction("p1", "a1");
    expect(H.ctx).toHaveBeenLastCalledWith("ver");
    await A.borrarNotaAction("p1", "n1");
    expect(H.ctx).toHaveBeenLastCalledWith("operar");
  });

  it("formas inválidas se rechazan antes de mirar la sesión", async () => {
    for (const r of [
      await A.editarProyectoAction("", {}), await A.suspenderProyectoAction("p1", 5 as never), await A.reanudarProyectoAction(7 as never),
      await A.agregarNotaAction("p1", "x".repeat(20_001)), await A.quitarParticipanteAction("p1", ""), await A.agregarParticipanteAction("p1", null as never),
    ]) expect(r).toEqual(INVALIDOS);
    expect(H.ctx).not.toHaveBeenCalled();
  });

  it("los adjuntos avisan si el bucket no está configurado", async () => {
    H.r2.mockReturnValue(false);
    expect(await A.pedirSubidaAdjuntoAction("p1", { nombre: "a", tipo: "application/pdf", tamano: 5 })).toMatchObject({ ok: false, error: expect.stringContaining("adjuntos") });
    expect(H.pedir).not.toHaveBeenCalled();
  });

  it("pasa sólo los campos conocidos a la lógica", async () => {
    await A.editarProyectoAction("p1", { name: "n", rareza: 1 } as never);
    expect(H.editar).toHaveBeenCalledWith(CTX, "p1", { name: "n", ownerUserId: undefined, delegateUserId: undefined, finalDueDate: undefined, description: undefined });
  });

  it("sólo exporta funciones async", () => {
    for (const [nombre, valor] of Object.entries(A)) {
      expect(typeof valor, nombre).toBe("function");
      expect((valor as () => unknown).constructor.name, nombre).toBe("AsyncFunction");
    }
  });
});
