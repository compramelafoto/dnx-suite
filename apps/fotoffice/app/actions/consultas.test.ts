import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  ctx: vi.fn(),
  revalidate: vi.fn(),
  manual: vi.fn(),
  rapida: vi.fn(),
  editar: vi.fn(),
  agregar: vi.fn(),
  quitar: vi.fn(),
  buscar: vi.fn(),
  veContactos: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: H.revalidate }));
vi.mock("@/lib/consultas/acceso", () => ({ contextoDeConsultas: H.ctx }));
vi.mock("@/lib/consultas/edicion", () => ({
  crearConsultaManual: H.manual,
  crearConsultaRapida: H.rapida,
  editarConsulta: H.editar,
  agregarParticipante: H.agregar,
  quitarParticipante: H.quitar,
  veContactos: H.veContactos,
  MENSAJES_EDICION: { sinContactos: "Sin contactos." },
}));
vi.mock("@/lib/consultas/ficha", () => ({ buscarContactos: H.buscar }));

const A = await import("./consultas");

const CTX = { workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF" };
const SIN_ACCESO = { ok: false, error: "No tenés permiso para hacer esto." };
const LIB = [H.manual, H.rapida, H.editar, H.agregar, H.quitar, H.buscar];

beforeEach(() => {
  vi.clearAllMocks();
  H.ctx.mockResolvedValue(CTX);
  for (const f of [H.editar, H.agregar, H.quitar]) f.mockResolvedValue({ ok: true });
  for (const f of [H.manual, H.rapida]) f.mockResolvedValue({ ok: true, leadId: "lead-1", avisos: {} });
  H.buscar.mockResolvedValue([]);
  H.veContactos.mockReturnValue(true);
});

const LLAMADAS: [string, () => Promise<unknown>][] = [
  ["buscar", () => A.buscarContactosAction("laura")],
  ["crear", () => A.crearConsultaAction({ contacto: { clientId: "c1" }, categoriaId: "cat" })],
  ["rápida", () => A.altaRapidaAction({ nombre: "Ana", telefonoOCorreo: "ana@x.test", categoriaId: "cat" })],
  ["editar", () => A.editarConsultaAction({ leadId: "lead-1", form: { categoriaId: "cat" } })],
  ["agregar", () => A.agregarParticipanteAction({ leadId: "lead-1", clientId: "c2", roleId: "r1" })],
  ["quitar", () => A.quitarParticipanteAction({ leadId: "lead-1", participanteId: "p1" })],
];

describe("acciones de Consultas", () => {
  it.each(LLAMADAS)("%s: pide «Gestionar» (operar) en Consultas", async (_n, llamar) => {
    await llamar();
    expect(H.ctx).toHaveBeenCalledWith("operar");
  });

  it.each(LLAMADAS)("%s: sin contexto (sin sesión, otro módulo, sólo «Ver») no lee ni escribe", async (_n, llamar) => {
    H.ctx.mockResolvedValue(null);
    expect(await llamar()).toEqual(SIN_ACCESO);
    for (const f of LIB) expect(f).not.toHaveBeenCalled();
    expect(H.revalidate).not.toHaveBeenCalled();
  });

  it("el workspace sale del contexto de la sesión, nunca del pedido", async () => {
    await A.editarConsultaAction({ leadId: "lead-1", form: { categoriaId: "cat" }, workspaceId: "ws-2" } as never);
    expect(H.editar).toHaveBeenCalledWith(CTX, "lead-1", { categoriaId: "cat" });
    await A.buscarContactosAction("laura");
    expect(H.buscar).toHaveBeenCalledWith("ws-1", "laura");
  });

  it("revalida el tablero y la ficha sólo si salió bien", async () => {
    await A.crearConsultaAction({ contacto: { clientId: "c1" }, categoriaId: "cat" });
    expect(H.revalidate).toHaveBeenCalledWith("/consultas");
    expect(H.revalidate).toHaveBeenCalledWith("/consultas/lead-1");
    H.revalidate.mockClear();
    H.editar.mockResolvedValue({ ok: false, error: "x" });
    expect(await A.editarConsultaAction({ leadId: "lead-1", form: { categoriaId: "cat" } })).toEqual({ ok: false, error: "x" });
    expect(H.revalidate).not.toHaveBeenCalled();
  });

  it("el buscador de contactos pide además «Ver» en Clientes (R10)", async () => {
    H.veContactos.mockReturnValue(false);
    expect(await A.buscarContactosAction("laura")).toEqual({ ok: false, error: "Sin contactos." });
    expect(H.veContactos).toHaveBeenCalledWith(CTX);
    expect(H.buscar).not.toHaveBeenCalled();
  });

  it("forma inválida no llega a la base", async () => {
    expect(await A.editarConsultaAction(null as never)).toEqual({ ok: false, error: "Los datos no son válidos." });
    expect(await A.quitarParticipanteAction({ leadId: 5 } as never)).toEqual({ ok: false, error: "Los datos no son válidos." });
    expect(H.editar).not.toHaveBeenCalled();
    expect(H.quitar).not.toHaveBeenCalled();
  });
});
