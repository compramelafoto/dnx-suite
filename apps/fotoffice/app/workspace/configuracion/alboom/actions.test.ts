import { beforeEach, describe, expect, it, vi } from "vitest";

/** Acciones de Configuración → Migración desde Alboom: permisos, workspace de la sesión y la contraseña nunca vuelve. */
const H = vi.hoisted(() => ({
  role: vi.fn(),
  revalidate: vi.fn(),
  conectar: vi.fn(),
  leerCred: vi.fn(),
  marcar: vi.fn(),
  usada: vi.fn(),
  borrarCred: vi.fn(),
  resumen: vi.fn(),
  iniciar: vi.fn(),
  cancelar: vi.fn(),
  borrar: vi.fn(),
  cliente: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: H.revalidate }));
vi.mock("@/lib/payments/connect/log", () => ({ sanitizeError: (e: unknown) => String(e) }));
vi.mock("@/lib/access/active-context", () => ({
  requireActiveWorkspaceRole: vi.fn(async () => ({ user: { id: 7, email: "ana@x.test", name: "Ana" }, workspace: { id: "ws-1", name: "Estudio" }, role: H.role() })),
}));
vi.mock("@/lib/alboom/credenciales", () => ({
  conectarAlboom: H.conectar,
  leerCredencialAlboom: H.leerCred,
  marcarAlboomParaReconectar: H.marcar,
  marcarAlboomUsada: H.usada,
  borrarCredencialAlboom: H.borrarCred,
  resumenConexionAlboom: H.resumen,
}));
vi.mock("@/lib/alboom/extracciones", () => ({ iniciarExtraccion: H.iniciar, cancelarExtraccion: H.cancelar, borrarLoExtraido: H.borrar }));
vi.mock("@/lib/alboom/client", async (original) => ({ ...(await original<typeof import("@/lib/alboom/client")>()), crearClienteAlboom: H.cliente }));

const A = await import("./actions");
const { AlboomLoginError, AlboomApiError } = await import("@/lib/alboom/client");

const PASS = "clave-secreta-de-prueba";
function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  H.role.mockReturnValue("WORKSPACE_OWNER");
  H.resumen.mockResolvedValue({ usuario: "a@b.test", subdomain: "estudio", estado: "ACTIVE", conectadaEn: new Date(), ultimoUso: null });
  H.iniciar.mockResolvedValue({ ok: true, id: "e1" });
  H.borrar.mockResolvedValue({ ok: true, registros: 1234 });
  H.cancelar.mockResolvedValue(true);
  H.leerCred.mockResolvedValue({ subdomain: "estudio", username: "a@b.test", password: PASS });
  H.cliente.mockResolvedValue({});
});

const TODAS = [
  () => A.conectarAlboomAction(undefined, fd({ subdomain: "estudio", username: "a@b.test", password: PASS })),
  () => A.probarConexionAction(undefined, fd({})),
  () => A.desconectarAlboomAction(undefined, fd({})),
  () => A.extraerAction(undefined, fd({ modo: "TODO" })),
  () => A.cancelarExtraccionAction(undefined, fd({})),
  () => A.borrarLoExtraidoAction(undefined, fd({ confirmacion: "BORRAR" })),
];

describe("permisos", () => {
  it("sin `configurar` (personal, colaborador, sin rol) ninguna acción toca nada", async () => {
    for (const rol of ["STAFF", "MEMBER", "COLLABORATOR", null]) {
      H.role.mockReturnValue(rol);
      for (const accion of TODAS) expect((await accion()).error).toMatch(/dueño o un administrador/);
    }
    for (const f of [H.conectar, H.leerCred, H.borrarCred, H.resumen, H.iniciar, H.cancelar, H.borrar, H.cliente]) expect(f).not.toHaveBeenCalled();
  });

  it("dueño y administrador pueden", async () => {
    for (const rol of ["WORKSPACE_OWNER", "WORKSPACE_ADMIN"]) {
      H.role.mockReturnValue(rol);
      expect((await A.extraerAction(undefined, fd({ modo: "TODO" }))).error).toBeNull();
    }
  });
});

describe("conectar", () => {
  it("usa el workspace de la sesión y no devuelve la contraseña", async () => {
    const r = await A.conectarAlboomAction(undefined, fd({ subdomain: "estudio", username: "a@b.test", password: PASS, workspaceId: "otro" }));
    expect(r).toEqual({ error: null, ok: "Cuenta de Alboom conectada." });
    expect(H.conectar).toHaveBeenCalledWith("ws-1", 7, { subdomain: "estudio", username: "a@b.test", password: PASS });
    expect(JSON.stringify(r)).not.toContain(PASS);
  });

  it("si Alboom rechaza, lo dice sin la contraseña ni en el resultado ni en el registro", async () => {
    H.conectar.mockRejectedValue(new AlboomLoginError());
    const r = await A.conectarAlboomAction(undefined, fd({ subdomain: "estudio", username: "a@b.test", password: PASS }));
    expect(r.error).toBe("Alboom rechazó el usuario o la contraseña.");
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain(PASS);
    H.conectar.mockRejectedValue(new AlboomApiError("Faltan datos para conectar Alboom"));
    expect((await A.conectarAlboomAction(undefined, fd({ subdomain: "", username: "", password: "" }))).error).toMatch(/Completá/);
  });
});

describe("probar conexión", () => {
  it("con la credencial rechazada la marca para volver a conectar", async () => {
    H.cliente.mockRejectedValue(new AlboomLoginError());
    expect((await A.probarConexionAction(undefined, fd({}))).error).toMatch(/rechazó/);
    expect(H.marcar).toHaveBeenCalledWith("ws-1");
  });
  it("si funciona, lo marca como usado", async () => {
    expect((await A.probarConexionAction(undefined, fd({}))).ok).toMatch(/funciona/);
    expect(H.usada).toHaveBeenCalledWith("ws-1");
    expect(H.marcar).not.toHaveBeenCalled();
  });
});

describe("extraer, cancelar, borrar y desconectar", () => {
  it("extraer exige la conexión activa y pasa el modo", async () => {
    await A.extraerAction(undefined, fd({ modo: "INCREMENTAL" }));
    expect(H.iniciar).toHaveBeenCalledWith("ws-1", 7, "INCREMENTAL");
    H.resumen.mockResolvedValue({ usuario: "a", subdomain: "e", estado: "NEEDS_RECONSENT", conectadaEn: new Date(), ultimoUso: null });
    expect((await A.extraerAction(undefined, fd({ modo: "TODO" }))).error).toMatch(/volver a conectar/);
    H.resumen.mockResolvedValue(null);
    expect((await A.extraerAction(undefined, fd({ modo: "TODO" }))).error).toMatch(/conectá/);
    expect(H.iniciar).toHaveBeenCalledTimes(1);
    H.resumen.mockResolvedValue({ usuario: "a", subdomain: "e", estado: "ACTIVE", conectadaEn: new Date(), ultimoUso: null });
    H.iniciar.mockResolvedValue({ ok: false, error: "Ya hay una extracción en curso." });
    expect((await A.extraerAction(undefined, fd({ modo: "TODO" }))).error).toBe("Ya hay una extracción en curso.");
  });

  it("borrar pide escribir BORRAR", async () => {
    expect((await A.borrarLoExtraidoAction(undefined, fd({ confirmacion: "si" }))).error).toMatch(/BORRAR/);
    expect(H.borrar).not.toHaveBeenCalled();
    expect((await A.borrarLoExtraidoAction(undefined, fd({ confirmacion: "borrar" }))).ok).toMatch(/1\.234/);
    expect(H.borrar).toHaveBeenCalledWith("ws-1");
  });

  it("cancelar y desconectar van por el workspace de la sesión", async () => {
    await A.cancelarExtraccionAction(undefined, fd({ workspaceId: "otro" }));
    expect(H.cancelar).toHaveBeenCalledWith("ws-1");
    await A.desconectarAlboomAction(undefined, fd({}));
    expect(H.borrarCred).toHaveBeenCalledWith("ws-1");
    expect(H.cancelar).toHaveBeenCalledTimes(2);
  });
});
