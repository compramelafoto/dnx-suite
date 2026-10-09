import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  contexto: vi.fn(), revalidate: vi.fn(), refrescar: vi.fn(),
  responder: vi.fn(), tomar: vi.fn(), marcarLeido: vi.fn(), buscarClientes: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: H.revalidate, refresh: H.refrescar }));
vi.mock("@/lib/bandeja/contexto", () => ({ contextoDeBandeja: H.contexto }));
vi.mock("@/lib/bandeja/acciones", () => ({
  responder: H.responder, tomar: H.tomar, marcarLeido: H.marcarLeido,
  devolverAlBot: vi.fn(), resolver: vi.fn(), vincularCliente: vi.fn(), crearContactoDesdeChat: vi.fn(),
}));
vi.mock("@/lib/bandeja/lecturas", () => ({ buscarClientes: H.buscarClientes }));

const A = await import("./bandeja");
const CTX = { workspaceId: "ws-1", userId: 7, userLabel: "Ana", role: "STAFF" };

beforeEach(() => {
  vi.clearAllMocks();
  H.contexto.mockResolvedValue(CTX);
});

describe("server actions de la Bandeja", () => {
  it("sin contexto (sin sesión, módulo apagado o sin permiso) no ejecutan nada", async () => {
    H.contexto.mockResolvedValue(null);
    expect(await A.responderAction("c1", "hola", "tok-1")).toEqual({ ok: false, error: "No tenés permiso para hacer esto." });
    expect(await A.tomarAction("c1")).toMatchObject({ ok: false });
    expect(await A.marcarLeidoAction("c1")).toMatchObject({ ok: false });
    expect(H.responder).not.toHaveBeenCalled();
    expect(H.revalidate).not.toHaveBeenCalled();
  });

  it("piden el nivel justo: operar para actuar y ver para marcar leído", async () => {
    H.tomar.mockResolvedValue({ ok: true });
    H.marcarLeido.mockResolvedValue({ ok: true });
    await A.tomarAction("c1");
    await A.marcarLeidoAction("c1");
    expect(H.contexto.mock.calls.map((c) => c[0])).toEqual(["operar", "ver"]);
  });

  it("usan el contexto de la sesión, nunca datos del navegador, y revalidan las dos rutas", async () => {
    H.responder.mockResolvedValue({ ok: true, mensajeId: "m1", estadoEnvio: "SIMULADO" });
    const r = await A.responderAction("c1", "hola", "tok-1");
    expect(r).toMatchObject({ ok: true });
    expect(H.responder).toHaveBeenCalledWith(CTX, "c1", "hola", "tok-1");
    expect(H.refrescar).toHaveBeenCalled();
    expect(H.revalidate).toHaveBeenCalledWith("/bandeja");
    expect(H.revalidate).toHaveBeenCalledWith("/bandeja/c1");
  });

  it("si la acción falla no revalida", async () => {
    H.tomar.mockResolvedValue({ ok: false, error: "x" });
    await A.tomarAction("c1");
    expect(H.revalidate).not.toHaveBeenCalled();
  });

  it("un chatId que no es texto se rechaza antes de llegar a la acción", async () => {
    expect(await A.tomarAction(undefined as never)).toMatchObject({ ok: false });
    expect(H.tomar).not.toHaveBeenCalled();
  });
});

describe("buscarClientesAction", () => {
  it("sin contexto de operar no busca nada", async () => {
    H.contexto.mockResolvedValue(null);
    expect(await A.buscarClientesAction("marta")).toMatchObject({ ok: false });
    expect(H.buscarClientes).not.toHaveBeenCalled();
  });

  it("pide el nivel operar y devuelve los clientes; sin permiso de Clientes, error", async () => {
    H.buscarClientes.mockResolvedValueOnce([{ id: "c1", nombre: "Marta", telefono: null }]);
    expect(await A.buscarClientesAction("marta")).toEqual({ ok: true, clientes: [{ id: "c1", nombre: "Marta", telefono: null }] });
    expect(H.contexto).toHaveBeenCalledWith("operar");
    H.buscarClientes.mockResolvedValueOnce(null);
    expect(await A.buscarClientesAction("marta")).toMatchObject({ ok: false });
  });
});

