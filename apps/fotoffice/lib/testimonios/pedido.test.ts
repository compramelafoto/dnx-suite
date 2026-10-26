import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, contextoDe, crearInvitacion, asegurar, enviarCorreo, abrirWhatsapp } = vi.hoisted(() => ({
  db: {
    fotofficeProyecto: { findFirst: vi.fn() },
    fotofficeMessageTemplate: { findFirst: vi.fn() },
    fotofficeTestimonioInvitacion: { findFirst: vi.fn(), updateMany: vi.fn() },
  },
  contextoDe: vi.fn(),
  crearInvitacion: vi.fn(),
  asegurar: vi.fn(),
  enviarCorreo: vi.fn(),
  abrirWhatsapp: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/plantillas/contexto", async (original) => ({ ...(await original<typeof import("@/lib/plantillas/contexto")>()), contextoDe }));
vi.mock("@/lib/plantillas/envio", async (original) => ({
  ...(await original<typeof import("@/lib/plantillas/envio")>()),
  enviarCorreo,
  abrirWhatsapp,
}));
vi.mock("@/lib/plantillas/semillas", async (original) => ({
  ...(await original<typeof import("@/lib/plantillas/semillas")>()),
  asegurarPlantillaTestimonio: asegurar,
}));
vi.mock("./invitaciones", async (original) => ({ ...(await original<typeof import("./invitaciones")>()), crearInvitacion }));

const P = await import("./pedido");
const { TESTIMONIO_INVITACION_INICIAL } = await import("@/lib/plantillas/semillas");

const TOKEN = "A".repeat(43);
const ENLACE = `https://dnx.fotoffice.com/w/dnx/testimonio?t=${TOKEN}`;
const ctx = { workspaceId: "ws-1", userId: 7, userLabel: "Daniel", role: "WORKSPACE_OWNER" };

function contexto(destino: { email: string | null; telefono: string | null }) {
  return {
    variables: {
      persona: { nombreCompleto: "Cami Pérez", ...destino },
      organizacion: { nombre: "DNX Estudio", email: null, telefono: null, whatsapp: null, web: null, instagram: null, ciudad: null },
      usuario: { nombre: "Daniel", email: null },
      hoy: new Date("2026-10-26T12:00:00Z"),
      campos: {},
    },
    firma: { html: "", texto: "" },
    destino,
    remitente: { nombre: "DNX Estudio", replyTo: null },
    camposActivos: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  crearInvitacion.mockResolvedValue({ invitacionId: "inv-1", enlace: ENLACE });
  db.fotofficeMessageTemplate.findFirst.mockResolvedValue({
    id: "tpl-1",
    subject: TESTIMONIO_INVITACION_INICIAL.EMAIL.asunto,
    body: TESTIMONIO_INVITACION_INICIAL.EMAIL.cuerpo,
  });
});

describe("prepararPedidoTestimonio", () => {
  it("cliente sin correo: sólo WhatsApp, con el enlace personal en el texto", async () => {
    contextoDe.mockResolvedValueOnce(contexto({ email: null, telefono: "+54 9 341 555-1234" }));
    const r = await P.prepararPedidoTestimonio(ctx, { clientId: "c1" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.correo).toBeNull();
    expect(r.motivos.correo).toMatch(/correo/);
    expect(r.whatsapp?.cuerpo).toContain(ENLACE);
    expect(r.whatsapp?.cuerpo).toContain("Cami");
    // Sin correo no se toca la plantilla de correo.
    expect(asegurar).not.toHaveBeenCalled();
    expect(crearInvitacion).toHaveBeenCalledWith("ws-1", expect.objectContaining({ clientId: "c1", correo: null, nombreSugerido: "Cami Pérez" }));
  });

  it("con correo arma el correo con la plantilla «Pedido de testimonio»", async () => {
    contextoDe.mockResolvedValueOnce(contexto({ email: "cami@mail.com", telefono: null }));
    const r = await P.prepararPedidoTestimonio(ctx, { clientId: "c1" });
    if (!r.ok) throw new Error(r.error);
    expect(asegurar).toHaveBeenCalledWith("ws-1");
    expect(r.correo).toMatchObject({ destino: "cami@mail.com", templateId: "tpl-1", asunto: "¿Nos contás cómo te fue con DNX Estudio?" });
    expect(r.correo?.cuerpo).toContain(ENLACE);
    expect(r.whatsapp).toBeNull();
  });

  it("sin correo ni WhatsApp no crea la invitación", async () => {
    contextoDe.mockResolvedValueOnce(contexto({ email: "no-es-correo", telefono: "123" }));
    expect(await P.prepararPedidoTestimonio(ctx, { clientId: "c1" })).toEqual({ ok: false, error: P.MENSAJES_PEDIDO.sinCanal });
    expect(crearInvitacion).not.toHaveBeenCalled();
  });

  it("un proyecto que no es de ese cliente no se usa", async () => {
    contextoDe.mockResolvedValueOnce(contexto({ email: "cami@mail.com", telefono: null }));
    db.fotofficeProyecto.findFirst.mockResolvedValueOnce(null);
    const r = await P.prepararPedidoTestimonio(ctx, { clientId: "c1", proyectoId: "p-ajeno" });
    expect(r.ok).toBe(false);
    expect(db.fotofficeProyecto.findFirst.mock.calls[0][0].where).toEqual({ id: "p-ajeno", workspaceId: "ws-1", clientId: "c1" });
    expect(crearInvitacion).not.toHaveBeenCalled();
  });

  it("el sitio sin dirección pública se avisa (crearInvitacion lanza)", async () => {
    contextoDe.mockResolvedValueOnce(contexto({ email: "cami@mail.com", telefono: null }));
    const { MENSAJE_SIN_SITIO } = await import("./invitaciones");
    crearInvitacion.mockRejectedValueOnce(new Error(MENSAJE_SIN_SITIO));
    expect(await P.prepararPedidoTestimonio(ctx, { clientId: "c1" })).toEqual({ ok: false, error: MENSAJE_SIN_SITIO });
  });
});

describe("enviarPedidoTestimonio", () => {
  it("con una invitación vencida, usada o de otro cliente no manda nada", async () => {
    db.fotofficeTestimonioInvitacion.findFirst.mockResolvedValueOnce(null);
    const r = await P.enviarPedidoTestimonio(ctx, { clientId: "c1", invitacionId: "inv-1", canal: "WHATSAPP", cuerpo: "Hola" });
    expect(r).toEqual({ ok: false, error: P.MENSAJES_PEDIDO.invitacionVencida });
    expect(db.fotofficeTestimonioInvitacion.findFirst.mock.calls[0][0].where).toMatchObject({
      id: "inv-1",
      workspaceId: "ws-1",
      clientId: "c1",
      estado: "ENVIADA",
    });
    expect(abrirWhatsapp).not.toHaveBeenCalled();
  });

  it("manda por el envío común, con la plantilla de testimonio y el enlace tapado en el historial", async () => {
    db.fotofficeTestimonioInvitacion.findFirst.mockResolvedValueOnce({ id: "inv-1" });
    enviarCorreo.mockResolvedValueOnce({ ok: true, mensajeId: "m1" });
    await P.enviarPedidoTestimonio(ctx, { clientId: "c1", invitacionId: "inv-1", canal: "EMAIL", templateId: "tpl-1", asunto: "Hola", cuerpo: `Dejalo acá: ${ENLACE}` });
    const [, datos, , opciones] = enviarCorreo.mock.calls[0];
    expect(datos).toMatchObject({ entityType: "CLIENTE", entityId: "c1", templateId: "tpl-1" });
    expect(opciones.tipoPlantilla).toBe("TESTIMONIO");
    expect(opciones.taparEnRegistro(`Dejalo acá: ${ENLACE}`)).toBe(`Dejalo acá: ${P.ENLACE_TAPADO}`);
    expect(db.fotofficeTestimonioInvitacion.updateMany).toHaveBeenCalledWith({ where: { id: "inv-1", workspaceId: "ws-1" }, data: { canal: "EMAIL" } });
  });
});

describe("taparEnlacePersonal", () => {
  it("tapa el enlace con token, también en la ruta de FOTOFFICE, y deja el resto", () => {
    const local = `/w/dnx/testimonio?t=${TOKEN}`;
    expect(P.taparEnlacePersonal(`Uno ${ENLACE} y ${local}.`)).toBe(`Uno ${P.ENLACE_TAPADO} y ${P.ENLACE_TAPADO}.`);
    expect(P.taparEnlacePersonal("https://dnx.com/testimonio")).toBe("https://dnx.com/testimonio");
  });
});
