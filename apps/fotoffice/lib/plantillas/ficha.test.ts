import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const H = vi.hoisted(() => ({ ctx: vi.fn(), modulo: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("./acceso", () => ({ contextoDePlantillas: H.ctx }));
vi.mock("@/lib/modules/gating", () => ({ isModuleEnabledForWorkspace: H.modulo }));
vi.mock("@/lib/communications/load-workspace-signature", () => ({ loadWorkspaceEmailContext: vi.fn() }));

const { cargarPanelMensaje, contextoDelPanelMensaje } = await import("./ficha");
const { MENSAJES_ENVIO } = await import("./envio");

const CTX = { workspaceId: "ws-1", workspaceSlug: "otro", userId: 7, userLabel: "Ana", userName: "Ana", userEmail: null, role: "STAFF" };

const automaticas = () => B.datos.fotofficeMessageTemplate.filter((p) => p.systemKey === "CONSULTA_AUTORESPUESTA").length;

function plantilla(id: string, extra: Record<string, unknown>) {
  B.agregar("fotofficeMessageTemplate", {
    id, workspaceId: "ws-1", channel: "EMAIL", entityType: "CLIENTE", name: id, subject: "A", body: "x", systemKey: null,
    archivedAt: null, order: 0, createdAt: new Date(), ...extra,
  });
}

beforeEach(() => {
  B.vaciar();
  H.ctx.mockReset().mockResolvedValue(CTX);
  H.modulo.mockReset().mockResolvedValue(true);
  B.agregar("client", { id: "c1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Lu", lastName: "Paz", email: "lu@x.test", phone: "+54 9 341 555 0000", memberId: null });
  B.agregar("client", { id: "cx", workspaceId: "ws-2", kind: "PERSONA", firstName: "X", lastName: "Y", email: "x@x.test", memberId: null });
  B.agregar("member", { id: "m1", workspaceId: "ws-1", firstName: "Juan", lastName: "Sosa", email: "mal-correo", phone: "341 4444", memberNumber: "1" });
  B.agregar("serviceSalesLead", { id: "l1", workspaceId: "ws-1", name: "Mara", email: null, phone: "+5493415550000" });
  plantilla("cli", { entityType: "CLIENTE" });
  plantilla("gen", { entityType: "GENERAL", order: 1 });
  plantilla("soc", { entityType: "SOCIO" });
  plantilla("vieja", { entityType: "CLIENTE", archivedAt: new Date() });
  plantilla("wa", { channel: "WHATSAPP", entityType: "CONSULTA", subject: null });
  plantilla("ajena", { workspaceId: "ws-2", entityType: "CLIENTE" });
});

describe("panel «Mensaje» — guarda antes de leer", () => {
  it("sin contexto (sin sesión, sin workspace o sin `operar`): null y no siembra ni lee plantillas", async () => {
    H.ctx.mockResolvedValue(null);
    const antes = B.datos.fotofficeMessageTemplate.length;
    expect(await cargarPanelMensaje("CLIENTE", "c1")).toBeNull();
    expect(B.datos.fotofficeMessageTemplate.length).toBe(antes);
    expect(H.modulo).not.toHaveBeenCalled();
  });

  it("un rol sin `operar` no pasa aunque el contexto venga", async () => {
    H.ctx.mockResolvedValue({ ...CTX, role: "COLLABORATOR" });
    expect(await contextoDelPanelMensaje("CLIENTE", "c1")).toBeNull();
  });

  it("módulo apagado, registro de otro workspace, inexistente o tipo inválido: null", async () => {
    H.modulo.mockResolvedValue(false);
    expect(await cargarPanelMensaje("CLIENTE", "c1")).toBeNull();
    H.modulo.mockResolvedValue(true);
    expect(await cargarPanelMensaje("CLIENTE", "cx")).toBeNull();
    expect(await cargarPanelMensaje("CLIENTE", "nada")).toBeNull();
    expect(await contextoDelPanelMensaje("GENERAL", "c1")).toBeNull();
    expect(await contextoDelPanelMensaje("CLIENTE", "")).toBeNull();
    // Nada se sembró: la guarda corta antes.
    expect(automaticas()).toBe(0);
  });

  it("el módulo que se mira es el del tipo de la ficha", async () => {
    await contextoDelPanelMensaje("SOCIO", "m1");
    expect(H.modulo).toHaveBeenCalledWith("ws-1", "members");
  });
});

describe("panel «Mensaje» — lo que viaja al navegador", () => {
  it("cliente: plantillas activas del canal para su ficha más las GENERAL, y sus destinos", async () => {
    const p = await cargarPanelMensaje("CLIENTE", "c1");
    expect(p!.correo).toEqual({
      destino: "lu@x.test",
      motivo: null,
      plantillas: [
        { id: "cli", nombre: "cli", general: false },
        { id: "gen", nombre: "gen", general: true },
      ],
    });
    expect(p!.whatsapp).toEqual({ destino: "+54 9 341 555 0000", motivo: null, plantillas: [] });
    // Se aseguraron las plantillas iniciales (la automática), que nunca se ofrece acá.
    expect(automaticas()).toBe(1);
  });

  it("sin correo válido o sin teléfono con código de país: el canal va deshabilitado con el motivo", async () => {
    const socio = await cargarPanelMensaje("SOCIO", "m1");
    expect(socio!.correo).toMatchObject({ destino: null, motivo: MENSAJES_ENVIO.sinCorreo });
    expect(socio!.whatsapp).toMatchObject({ destino: null, motivo: MENSAJES_ENVIO.sinWhatsapp });
    expect(socio!.correo.plantillas.map((x) => x.id)).toEqual(["soc", "gen"]);
    const consulta = await cargarPanelMensaje("CONSULTA", "l1");
    expect(consulta!.correo.destino).toBeNull();
    expect(consulta!.whatsapp).toMatchObject({ destino: "+5493415550000", plantillas: [{ id: "wa", nombre: "wa", general: false }] });
  });
});
