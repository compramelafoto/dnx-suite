import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({
  contexto: vi.fn(), revalidate: vi.fn(),
  responder: vi.fn(), tomar: vi.fn(), marcarLeido: vi.fn(), guardarConexion: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: H.revalidate }));
vi.mock("@/lib/bandeja/contexto", () => ({ contextoDeBandeja: H.contexto }));
vi.mock("@/lib/bandeja/acciones", () => ({
  responder: H.responder, tomar: H.tomar, marcarLeido: H.marcarLeido,
  devolverAlBot: vi.fn(), resolver: vi.fn(), vincularCliente: vi.fn(), crearContactoDesdeChat: vi.fn(),
}));
vi.mock("@/lib/bandeja/conexion", () => ({ guardarConexion: H.guardarConexion, MENSAJES_CONEXION: { sinPermiso: "sólo admin" } }));

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
    expect(await A.guardarConexionAction({})).toMatchObject({ ok: false });
    expect(H.responder).not.toHaveBeenCalled();
    expect(H.revalidate).not.toHaveBeenCalled();
  });

  it("piden el nivel justo: operar para actuar, ver para marcar leído, configurar para la conexión", async () => {
    H.tomar.mockResolvedValue({ ok: true });
    H.marcarLeido.mockResolvedValue({ ok: true });
    H.guardarConexion.mockResolvedValue({ ok: true });
    await A.tomarAction("c1");
    await A.marcarLeidoAction("c1");
    await A.guardarConexionAction({ pausaBotHoras: 3 });
    expect(H.contexto.mock.calls.map((c) => c[0])).toEqual(["operar", "ver", "configurar"]);
  });

  it("usan el contexto de la sesión, nunca datos del navegador, y revalidan las dos rutas", async () => {
    H.responder.mockResolvedValue({ ok: true, mensajeId: "m1", estadoEnvio: "SIMULADO" });
    const r = await A.responderAction("c1", "hola", "tok-1");
    expect(r).toMatchObject({ ok: true });
    expect(H.responder).toHaveBeenCalledWith(CTX, "c1", "hola", "tok-1");
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
