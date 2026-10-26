import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, contextoWeb, nivel, redirigir, revalidar, guardaMensaje, moduloEncendido, pedido, foto } = vi.hoisted(() => ({
  db: {
    fotofficeTestimonio: { create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
  contextoWeb: vi.fn(),
  nivel: vi.fn(),
  redirigir: vi.fn((ruta: string) => {
    throw new Error(`NEXT_REDIRECT ${ruta}`);
  }),
  revalidar: vi.fn(),
  guardaMensaje: vi.fn(),
  moduloEncendido: vi.fn(),
  pedido: { prepararPedidoTestimonio: vi.fn(), enviarPedidoTestimonio: vi.fn() },
  foto: { archivoDeFoto: vi.fn(() => null), revisarFotoAutor: vi.fn(), subirFotoAutor: vi.fn(), borrarFotoAutor: vi.fn() },
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("next/cache", () => ({ revalidatePath: revalidar }));
vi.mock("next/navigation", () => ({ redirect: redirigir }));
vi.mock("next/server", () => ({ NextResponse: { json: vi.fn() } }));
vi.mock("@/lib/auth", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/workspace", () => ({ requireWebsiteContext: contextoWeb, resolveActiveWorkspace: vi.fn() }));
vi.mock("@/lib/permissions/module-access", () => ({ hasModuleLevel: nivel }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: moduloEncendido }));
vi.mock("@/lib/plantillas/ficha", () => ({ contextoDelPanelMensaje: guardaMensaje }));
vi.mock("@/lib/plantillas/envio", () => ({
  MENSAJES_ENVIO: { sinPermiso: "No tenés permiso para enviar mensajes.", datosInvalidos: "Los datos no son válidos.", noEncontrado: "No encontramos ese registro." },
}));
vi.mock("@/lib/testimonios/pedido", () => pedido);
vi.mock("@/lib/testimonios/foto", () => foto);

const A = await import("./testimonios");

const usuario = { id: 7, name: "Daniel", email: "d@x.com" };

/** Lo que devuelve la guarda de «Mensaje» cuando deja pasar. */
const CTX_MENSAJE = { workspaceId: "ws-1", userId: 7, userLabel: "Daniel", role: "WORKSPACE_MEMBER" };

beforeEach(() => {
  vi.clearAllMocks();
  contextoWeb.mockResolvedValue({ user: usuario, workspace: { id: "ws-1" } });
  nivel.mockResolvedValue(true);
  moduloEncendido.mockResolvedValue(true);
  guardaMensaje.mockResolvedValue(CTX_MENSAJE);
});

describe("moderación de testimonios", () => {
  it("un usuario sin permiso de sitio no modera: redirige antes de tocar la base", async () => {
    nivel.mockResolvedValue(false);
    await expect(A.moderarTestimonioAction("t1", "PUBLICADO")).rejects.toThrow("NEXT_REDIRECT /website");
    await expect(A.borrarTestimonioAction("t1")).rejects.toThrow("NEXT_REDIRECT");
    await expect(A.reordenarTestimoniosAction(["t1"])).rejects.toThrow("NEXT_REDIRECT");
    await expect(A.agregarTestimonioAction(new FormData())).rejects.toThrow("NEXT_REDIRECT");
    expect(nivel).toHaveBeenCalledWith(7, "ws-1", "website", "MANAGE");
    expect(db.fotofficeTestimonio.findFirst).not.toHaveBeenCalled();
    expect(db.fotofficeTestimonio.create).not.toHaveBeenCalled();
    expect(db.fotofficeTestimonio.updateMany).not.toHaveBeenCalled();
    expect(db.fotofficeTestimonio.deleteMany).not.toHaveBeenCalled();
  });

  it("publicar sin el permiso del autor falla y no escribe", async () => {
    db.fotofficeTestimonio.findFirst.mockResolvedValueOnce({ id: "t1", consentimiento: false, texto: "Hermoso", autorNombre: "Sofi" });
    const r = await A.moderarTestimonioAction("t1", "PUBLICADO");
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/permiso del autor/) });
    expect(db.fotofficeTestimonio.updateMany).not.toHaveBeenCalled();
  });

  it("publica con permiso, filtrando por la institución de la sesión, y refresca el panel", async () => {
    db.fotofficeTestimonio.findFirst.mockResolvedValueOnce({ id: "t1", consentimiento: true, texto: "Hermoso", autorNombre: "Sofi" });
    db.fotofficeTestimonio.updateMany.mockResolvedValueOnce({ count: 1 });
    expect(await A.moderarTestimonioAction("t1", "PUBLICADO")).toEqual({ ok: true, valor: true });
    expect(db.fotofficeTestimonio.updateMany.mock.calls[0][0].where).toEqual({ id: "t1", workspaceId: "ws-1", consentimiento: true });
    expect(revalidar).toHaveBeenCalledWith("/website/testimonios", "layout");
  });

  it("un estado inventado no llega a la base", async () => {
    expect(await A.moderarTestimonioAction("t1", "BORRADO")).toEqual({ ok: false, error: "Los datos no son válidos." });
    expect(db.fotofficeTestimonio.findFirst).not.toHaveBeenCalled();
  });

  it("sin las tablas devuelve el aviso para el administrador", async () => {
    db.fotofficeTestimonio.findFirst.mockRejectedValueOnce(Object.assign(new Error("x"), { code: "P2021" }));
    expect(await A.moderarTestimonioAction("t1", "RECHAZADO")).toEqual({
      ok: false,
      error: "Falta crear las tablas de Testimonios en la base. Avisale al administrador.",
    });
  });

  it("borrar quita también la foto del autor de R2", async () => {
    db.fotofficeTestimonio.findFirst.mockResolvedValueOnce({ autorFotoKey: "fotoffice/site-testimonios/ws-1/a.jpg" });
    db.fotofficeTestimonio.deleteMany.mockResolvedValueOnce({ count: 1 });
    expect(await A.borrarTestimonioAction("t1")).toEqual({ ok: true, valor: true });
    expect(foto.borrarFotoAutor).toHaveBeenCalledWith("fotoffice/site-testimonios/ws-1/a.jpg");
  });

  it("editar con «Tengo permiso del autor» asienta el permiso con el nombre de quien lo marcó", async () => {
    db.fotofficeTestimonio.findFirst.mockResolvedValueOnce({ consentimiento: false });
    db.fotofficeTestimonio.updateMany.mockResolvedValueOnce({ count: 1 });
    await A.editarTestimonioAction("t1", { extracto: " Lo mejor ", autorDetalle: "Boda", permisoDelAutor: true });
    const data = db.fotofficeTestimonio.updateMany.mock.calls[0][0].data;
    expect(data).toMatchObject({ extracto: "Lo mejor", autorDetalle: "Boda", consentimiento: true });
    expect(data.consentimientoTexto).toMatch(/^Carga manual: Daniel/);
  });
});

describe("carga manual", () => {
  function formulario(extra: Record<string, string> = {}) {
    const fd = new FormData();
    fd.set("texto", "Nos encantó todo");
    fd.set("autorNombre", "Cami");
    for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    return fd;
  }

  it("con «Tengo permiso del autor» deja asentado quién lo marcó y puede publicarse ya", async () => {
    db.fotofficeTestimonio.create.mockResolvedValueOnce({ id: "t9" });
    db.fotofficeTestimonio.findFirst.mockResolvedValueOnce({ id: "t9", consentimiento: true, texto: "Nos encantó todo", autorNombre: "Cami" });
    db.fotofficeTestimonio.updateMany.mockResolvedValueOnce({ count: 1 });
    const r = await A.agregarTestimonioAction(formulario({ permiso: "on", publicar: "on" }));
    expect(r).toEqual({ ok: true, publicado: true, aviso: null });
    const data = db.fotofficeTestimonio.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ workspaceId: "ws-1", origen: "CARGA_MANUAL", estado: "PENDIENTE", consentimiento: true });
    expect(data.consentimientoTexto).toMatch(/^Carga manual: Daniel marcó «Tengo permiso del autor»/);
    expect(db.fotofficeTestimonio.updateMany.mock.calls[0][0].data).toMatchObject({ estado: "PUBLICADO" });
  });

  it("sin la casilla entra pendiente y sin permiso, aunque pida publicar", async () => {
    db.fotofficeTestimonio.create.mockResolvedValueOnce({ id: "t9" });
    const r = await A.agregarTestimonioAction(formulario({ publicar: "on" }));
    expect(r).toEqual({ ok: true, publicado: false, aviso: null });
    expect(db.fotofficeTestimonio.create.mock.calls[0][0].data).toMatchObject({ consentimiento: false, consentimientoTexto: null });
    expect(db.fotofficeTestimonio.updateMany).not.toHaveBeenCalled();
  });

  it("los errores de validación vuelven al formulario por campo", async () => {
    const fd = formulario();
    fd.set("autorNombre", "");
    const r = await A.agregarTestimonioAction(fd);
    expect(r).toEqual({ ok: false, error: "Poné tu nombre.", errores: { autorNombre: "Poné tu nombre." } });
    expect(db.fotofficeTestimonio.create).not.toHaveBeenCalled();
  });
});

describe("«Pedir testimonio»", () => {
  it("sin permiso de mandar mensajes al cliente (la guarda de «Mensaje» no deja) no crea la invitación", async () => {
    guardaMensaje.mockResolvedValue(null);
    const r = await A.pedirTestimonioAction({ clientId: "c1" });
    expect(guardaMensaje).toHaveBeenCalledWith("CLIENTE", "c1");
    expect(r).toEqual({ ok: false, error: "No tenés permiso para enviar mensajes." });
    expect(pedido.prepararPedidoTestimonio).not.toHaveBeenCalled();
    const e = await A.enviarPedidoTestimonioAction({ clientId: "c1", invitacionId: "i1", canal: "WHATSAPP", cuerpo: "Hola" });
    expect(e).toEqual({ ok: false, error: "No tenés permiso para enviar mensajes." });
    expect(pedido.enviarPedidoTestimonio).not.toHaveBeenCalled();
  });

  it("no hace falta poder editar el sitio: con permiso de mensajes, prepara el pedido", async () => {
    nivel.mockResolvedValue(false);
    pedido.prepararPedidoTestimonio.mockResolvedValueOnce({ ok: true, invitacionId: "i1" });
    await A.pedirTestimonioAction({ clientId: "c1", proyectoId: "p1" });
    expect(pedido.prepararPedidoTestimonio).toHaveBeenCalledWith(expect.objectContaining({ workspaceId: "ws-1" }), { clientId: "c1", proyectoId: "p1" });
  });

  it("con el sitio web apagado no se pide", async () => {
    moduloEncendido.mockResolvedValue(false);
    const r = await A.pedirTestimonioAction({ clientId: "c1" });
    expect(r.ok).toBe(false);
    expect(moduloEncendido).toHaveBeenCalledWith("ws-1", "website");
    expect(pedido.prepararPedidoTestimonio).not.toHaveBeenCalled();
  });

  it("al mandarlo refresca la ficha del cliente y la del proyecto", async () => {
    pedido.enviarPedidoTestimonio.mockResolvedValueOnce({ ok: true, url: "https://wa.me/1", mensajeId: "m1" });
    const r = await A.enviarPedidoTestimonioAction({ clientId: "c1", proyectoId: "p1", invitacionId: "i1", canal: "WHATSAPP", cuerpo: "Hola" });
    expect(r).toEqual({ ok: true, url: "https://wa.me/1" });
    expect(revalidar).toHaveBeenCalledWith("/clientes/c1");
    expect(revalidar).toHaveBeenCalledWith("/proyectos/p1");
  });
});
