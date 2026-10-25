import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

const K = await import("./contratos");
const { MENSAJES_CONTRATO: M } = await import("./acceso");
const { aTextoPlano } = await import("./formato");

type Nivel = "NONE" | "VIEW" | "MANAGE";
const ctx = (contracts: Nivel, workspaceId = "ws-1") => ({ workspaceId, userId: 7, userLabel: "Ana", role: "STAFF", acceso: { role: "STAFF", levels: { contracts } } as never });
const GESTIONA = ctx("MANAGE");
const SOLO_VER = ctx("VIEW");
const OTRO_WS = ctx("MANAGE", "ws-2");
const AHORA = new Date("2026-10-09T15:00:00.000Z");

const CUERPO = `# Contrato [contrato_numero]

Entre [empresa_nombre] y [contratante1_nombre] ([contratante1_documento]).[si:contratante2_nombre] Y también [contratante2_nombre].[/si]

Evento: [evento] el [evento_fecha]. Total: [pedido_total].

[pedido_items]

[pedido_cuotas]`;

function item(id: string, nombre: string, cantidad: number, precio: number, extra: Record<string, unknown> = {}) {
  return { id, productId: null, nombre, descripcion: null, cantidad, precioUnitario: precio, descuento: null, modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false, ...extra };
}

const contratos = () => B.datos.fotofficeContrato;
const eventos = () => B.datos.fotofficeContratoEvento.map((e) => e.type);

beforeEach(() => {
  B.vaciar();
  B.agregar("client", { id: "c1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Ana", lastName: "Gómez", email: "ana@x.com", docType: "DNI", docNumber: "30.111", address: "Mitre 1", city: "Rosario" });
  B.agregar("client", { id: "c2", workspaceId: "ws-1", kind: "PERSONA", firstName: "Luis", lastName: "Pérez", email: "luis@x.com" });
  B.agregar("client", { id: "c-ajeno", workspaceId: "ws-2", kind: "PERSONA", firstName: "Otra", lastName: "Ajena", email: "o@x.com" });
  B.agregar("fotofficePedido", {
    id: "p1", workspaceId: "ws-1", number: "P-7", clientId: "c1", status: "CONFIRMADO", totalArs: "150000.00",
    items: [item("a", "Cobertura de boda", 1, 120000), item("b", "Álbum 30x30", 2, 15000), item("o", "Drone", 1, 50000, { opcional: true })],
    totals: { renglones: { a: { neto: 120000 }, b: { neto: 30000 }, o: { neto: 50000 } } },
    eventLabel: "Casamiento", eventDate: new Date("2026-12-12T00:00:00.000Z"),
  });
  B.agregar("fotofficePedidoCuota", { id: "q1", workspaceId: "ws-1", pedidoId: "p1", position: 1, dueDate: new Date("2026-11-10T00:00:00.000Z"), amountArs: "75000.00" });
  B.agregar("fotofficePedidoCuota", { id: "q2", workspaceId: "ws-1", pedidoId: "p1", position: 2, dueDate: new Date("2026-12-10T00:00:00.000Z"), amountArs: "75000.00" });
  B.agregar("fotofficePedido", { id: "p-ajeno", workspaceId: "ws-2", number: "P-1", clientId: "c-ajeno", status: "CONFIRMADO", totalArs: "1.00", items: [], totals: {} });
  B.agregar("fotofficeContratoPlantilla", { id: "t1", workspaceId: "ws-1", name: "Contrato de boda", body: CUERPO, isActive: true, order: 0 });
  B.agregar("fotofficeContratoPlantilla", { id: "t-off", workspaceId: "ws-1", name: "Vieja", body: "x", isActive: false, order: 1 });
  B.agregar("fotofficeContratoPlantilla", { id: "t-ajena", workspaceId: "ws-2", name: "Ajena", body: "x", isActive: true, order: 0 });
  B.agregar("fotofficeContratoAjustes", { workspaceId: "ws-1", companyName: "Estudio Luz", companyTaxId: "20-1-3", companyAddress: "Córdoba 5" });
});

async function generar(plantilla = "t1", c = GESTIONA) {
  const r = await K.generarContrato(c, "p1", plantilla, AHORA);
  if (!r.ok) throw new Error(r.error);
  return r;
}

describe("generar", () => {
  it("arma un borrador con los datos del pedido, el número y un evento", async () => {
    const r = await generar();
    expect(r.numero).toMatch(/\d/);
    const c = contratos()[0]!;
    expect(c).toMatchObject({ id: r.id, workspaceId: "ws-1", pedidoId: "p1", clientId: "c1", templateId: "t1", status: "BORRADOR", number: r.numero, ownerUserId: 7, createdByUserId: 7 });
    expect(c.name).toBe("Contrato de boda · Pedido P-7");
    const t = aTextoPlano(c.bodyText as string);
    expect(t).toContain(`# Contrato ${r.numero}`);
    expect(t).toContain("Estudio Luz");
    expect(t).toContain("Gómez, Ana (DNI 30.111)");
    expect(t).toContain("Casamiento el 12/12/2026");
    expect(t).toContain("Cobertura de boda\t1");
    expect(t).toContain("Álbum 30x30\t2");
    expect(t).not.toContain("Drone");
    expect(t).toContain("1\t10/11/2026\t");
    expect(t).not.toContain("Y también");
    expect(eventos()).toEqual(["CREADO"]);
    expect(B.datos.fotofficeRecordNumber.filter((n) => n.entityType === "CONTRATO")).toHaveLength(1);
  });

  it("usa el contratante 2 si el pedido lo tiene", async () => {
    B.agregar("fotofficePedidoContratante", { workspaceId: "ws-1", pedidoId: "p1", orden: 2, clientId: "c2" });
    await generar();
    expect(aTextoPlano(contratos()[0]!.bodyText as string)).toContain("Y también Pérez, Luis.");
  });

  it("dos contratos reciben números distintos", async () => {
    const a = await generar();
    const b = await generar();
    expect(a.numero).not.toBe(b.numero);
    expect(contratos()).toHaveLength(2);
  });

  it("sin Gestionar no genera; Ver no alcanza", async () => {
    expect(await K.generarContrato(SOLO_VER, "p1", "t1", AHORA)).toEqual({ ok: false, error: M.sinPermiso });
    expect(await K.generarContrato(ctx("NONE"), "p1", "t1", AHORA)).toEqual({ ok: false, error: M.sinPermiso });
    expect(contratos()).toHaveLength(0);
  });

  it("aislamiento: ni el pedido ni la plantilla de otra organización sirven", async () => {
    expect(await K.generarContrato(GESTIONA, "p-ajeno", "t1", AHORA)).toEqual({ ok: false, error: M.pedido });
    expect(await K.generarContrato(GESTIONA, "p1", "t-ajena", AHORA)).toEqual({ ok: false, error: M.plantillaNoExiste });
    expect(await K.generarContrato(OTRO_WS, "p1", "t-ajena", AHORA)).toEqual({ ok: false, error: M.pedido });
    expect(contratos()).toHaveLength(0);
  });

  it("no usa una plantilla inactiva ni un pedido cancelado", async () => {
    expect(await K.generarContrato(GESTIONA, "p1", "t-off", AHORA)).toEqual({ ok: false, error: M.plantillaNoExiste });
    B.datos.fotofficePedido[0]!.status = "CANCELADO";
    expect(await K.generarContrato(GESTIONA, "p1", "t1", AHORA)).toEqual({ ok: false, error: M.pedidoCancelado });
  });

  it("una plantilla con variables desconocidas no genera nada y no gasta número", async () => {
    B.datos.fotofficeContratoPlantilla[0]!.body = "Hola [no_existe] y [otra_mas]";
    const r = await K.generarContrato(GESTIONA, "p1", "t1", AHORA);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain("[no_existe]");
    expect(contratos()).toHaveLength(0);
    expect(B.datos.fotofficeRecordNumber.filter((n) => n.entityType === "CONTRATO")).toHaveLength(0);
    expect(eventos()).toEqual([]);
  });

  it("los datos de las personas no pueden cambiar el formato del contrato", async () => {
    B.datos.client[0]!.firstName = "**Ana**\n# Título [x]";
    B.datos.client[0]!.address = "Mitre\n\n**1**";
    await generar();
    const t = contratos()[0]!.bodyText as string;
    expect(t).not.toContain("**");
    expect(t).not.toContain("[x]");
    const entreLlaves = /Entre .* y (.*) \(/.exec(aTextoPlano(t));
    expect(entreLlaves?.[1]).not.toMatch(/\n/);
  });

  it("si los ítems del pedido no validan, no hace un contrato a medias", async () => {
    B.datos.fotofficePedido[0]!.items = [item("a", "", 1, 10)];
    expect(await K.generarContrato(GESTIONA, "p1", "t1", AHORA)).toEqual({ ok: false, error: M.itemsInvalidos });
    expect(contratos()).toHaveLength(0);
  });

  it("ids inválidos o de otro tipo", async () => {
    expect(await K.generarContrato(GESTIONA, 5, "t1", AHORA)).toEqual({ ok: false, error: M.datosInvalidos });
    expect(await K.generarContrato(GESTIONA, "p1", "", AHORA)).toEqual({ ok: false, error: M.datosInvalidos });
  });
});

describe("editar el borrador", () => {
  it("guarda el texto nuevo y deja un evento", async () => {
    const { id } = await generar();
    expect(await K.editarBorrador(GESTIONA, id, { texto: "Texto nuevo\r\ncon dos líneas", nombre: "Mi contrato" })).toEqual({ ok: true });
    expect(contratos()[0]).toMatchObject({ bodyText: "Texto nuevo\ncon dos líneas", name: "Mi contrato" });
    expect(eventos()).toEqual(["CREADO", "EDITADO"]);
  });

  it("valida texto, nombre y largo; ni siquiera mira si no hay permiso", async () => {
    const { id } = await generar();
    const antes = contratos()[0]!.bodyText;
    expect(await K.editarBorrador(GESTIONA, id, { texto: "   " })).toEqual({ ok: false, error: M.textoVacio });
    expect(await K.editarBorrador(GESTIONA, id, {})).toEqual({ ok: false, error: M.textoVacio });
    expect(await K.editarBorrador(GESTIONA, id, { texto: "x".repeat(100_001) })).toEqual({ ok: false, error: M.textoLargo });
    expect(await K.editarBorrador(GESTIONA, id, { texto: "ok", nombre: "n".repeat(121) })).toEqual({ ok: false, error: M.nombreContrato });
    expect(await K.editarBorrador(SOLO_VER, id, { texto: "ok" })).toEqual({ ok: false, error: M.sinPermiso });
    expect(contratos()[0]!.bodyText).toBe(antes);
  });

  it("sólo un borrador se edita; uno enviado no", async () => {
    const { id } = await generar();
    contratos()[0]!.status = "ENVIADO";
    expect(await K.editarBorrador(GESTIONA, id, { texto: "otro" })).toEqual({ ok: false, error: M.soloBorrador });
  });

  it("aislamiento: un contrato de otra organización no existe", async () => {
    const { id } = await generar();
    expect(await K.editarBorrador(OTRO_WS, id, { texto: "otro" })).toEqual({ ok: false, error: M.contratoNoExiste });
  });
});

describe("actualizar datos", () => {
  it("exige confirmar porque pisa lo editado a mano", async () => {
    const { id } = await generar();
    await K.editarBorrador(GESTIONA, id, { texto: "A mano" });
    expect(await K.actualizarDatos(GESTIONA, id, false, AHORA)).toEqual({ ok: false, error: M.confirmarActualizar });
    expect(contratos()[0]!.bodyText).toBe("A mano");
  });

  it("vuelve a armar el texto con los datos de hoy", async () => {
    const { id, numero } = await generar();
    await K.editarBorrador(GESTIONA, id, { texto: "A mano" });
    B.datos.fotofficeContratoAjustes[0]!.companyName = "Estudio Nuevo";
    const r = await K.actualizarDatos(GESTIONA, id, true, AHORA);
    expect(r).toMatchObject({ ok: true, id, numero });
    const t = aTextoPlano(contratos()[0]!.bodyText as string);
    expect(t).toContain("Estudio Nuevo");
    expect(t).toContain(`# Contrato ${numero}`);
  });

  it("no en un contrato enviado, ni sin plantilla, ni en otra organización", async () => {
    const { id } = await generar();
    expect(await K.actualizarDatos(OTRO_WS, id, true, AHORA)).toEqual({ ok: false, error: M.contratoNoExiste });
    expect(await K.actualizarDatos(SOLO_VER, id, true, AHORA)).toEqual({ ok: false, error: M.sinPermiso });
    B.datos.fotofficeContratoPlantilla.splice(0, 1);
    expect(await K.actualizarDatos(GESTIONA, id, true, AHORA)).toEqual({ ok: false, error: M.sinPlantilla });
    contratos()[0]!.status = "ENVIADO";
    expect(await K.actualizarDatos(GESTIONA, id, true, AHORA)).toEqual({ ok: false, error: M.soloBorrador });
  });
});

describe("anular", () => {
  it("anula con motivo desde borrador, enviado, firmado parcial o rechazado", async () => {
    for (const estado of ["BORRADOR", "ENVIADO", "FIRMADO_PARCIAL", "RECHAZADO"]) {
      B.vaciar();
      B.agregar("client", { id: "c1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Ana" });
      B.agregar("fotofficeContrato", { id: "k1", workspaceId: "ws-1", pedidoId: "p1", clientId: "c1", number: "C-1", name: "n", status: estado, bodyText: "t" });
      expect(await K.anular(GESTIONA, "k1", "  Se cayó el trato  ", AHORA)).toEqual({ ok: true });
      expect(contratos()[0]).toMatchObject({ status: "ANULADO", voidReason: "Se cayó el trato", voidedAt: AHORA });
      expect(eventos()).toEqual(["ANULADO"]);
    }
  });

  it("un contrato firmado o ya anulado no se anula", async () => {
    for (const estado of ["FIRMADO", "ANULADO"]) {
      B.vaciar();
      B.agregar("fotofficeContrato", { id: "k1", workspaceId: "ws-1", pedidoId: "p1", clientId: "c1", number: "C-1", name: "n", status: estado, bodyText: "t" });
      expect(await K.anular(GESTIONA, "k1", "motivo", AHORA)).toEqual({ ok: false, error: M.noSeAnula });
      expect(contratos()[0]!.status).toBe(estado);
    }
  });

  it("pide motivo, permiso y es de la organización", async () => {
    B.agregar("fotofficeContrato", { id: "k1", workspaceId: "ws-1", pedidoId: "p1", clientId: "c1", number: "C-1", name: "n", status: "ENVIADO", bodyText: "t" });
    expect(await K.anular(GESTIONA, "k1", "  ", AHORA)).toEqual({ ok: false, error: M.motivoAnular });
    expect(await K.anular(GESTIONA, "k1", "x".repeat(501), AHORA)).toEqual({ ok: false, error: M.motivoAnular });
    expect(await K.anular(SOLO_VER, "k1", "motivo", AHORA)).toEqual({ ok: false, error: M.sinPermiso });
    expect(await K.anular(OTRO_WS, "k1", "motivo", AHORA)).toEqual({ ok: false, error: M.contratoNoExiste });
    expect(contratos()[0]!.status).toBe("ENVIADO");
  });
});

describe("firmado en papel", () => {
  function contrato(estado: string, extra: Record<string, unknown> = {}) {
    B.agregar("fotofficeContrato", { id: "k1", workspaceId: "ws-1", pedidoId: "p1", clientId: "c1", number: "C-1", name: "n", status: estado, bodyText: "t", ...extra });
  }
  const adjunto = (extra: Record<string, unknown> = {}) => B.agregar("fotofficeAttachment", { id: "ad1", workspaceId: "ws-1", clientId: "c1", status: "LISTO", deletedAt: null, ...extra });

  it("pasa a FIRMADO con el escaneo y revoca la versión enviada", async () => {
    contrato("ENVIADO", { currentVersionId: "v1" });
    B.agregar("fotofficeContratoVersion", { id: "v1", workspaceId: "ws-1", contratoId: "k1", number: 1, bodyText: "t", contentHash: "h", sentAt: AHORA });
    adjunto();
    expect(await K.marcarFirmadoEnPapel(GESTIONA, "k1", "ad1", AHORA)).toEqual({ ok: true });
    expect(contratos()[0]).toMatchObject({ status: "FIRMADO", manualSignedAt: AHORA, signedAt: AHORA, manualAttachmentId: "ad1" });
    expect(B.datos.fotofficeContratoVersion[0]!.revokedAt).toEqual(AHORA);
    expect(eventos()).toEqual(["FIRMADO_EN_PAPEL"]);
  });

  it("también desde borrador", async () => {
    contrato("BORRADOR");
    adjunto();
    expect(await K.marcarFirmadoEnPapel(GESTIONA, "k1", "ad1", AHORA)).toEqual({ ok: true });
  });

  it("el adjunto tiene que estar listo, no borrado y ser del contacto del contrato en la organización", async () => {
    contrato("ENVIADO");
    for (const extra of [{ status: "SUBIENDO" }, { deletedAt: new Date() }, { clientId: "c2" }, { workspaceId: "ws-2" }]) {
      B.datos.fotofficeAttachment.length = 0;
      adjunto(extra);
      expect(await K.marcarFirmadoEnPapel(GESTIONA, "k1", "ad1", AHORA)).toEqual({ ok: false, error: M.adjuntoPapel });
    }
    expect(await K.marcarFirmadoEnPapel(GESTIONA, "k1", "no-existe", AHORA)).toEqual({ ok: false, error: M.adjuntoPapel });
    expect(contratos()[0]!.status).toBe("ENVIADO");
  });

  it("no desde un estado final, ni sin permiso, ni de otra organización", async () => {
    adjunto();
    for (const estado of ["FIRMADO", "ANULADO", "RECHAZADO"]) {
      B.datos.fotofficeContrato.length = 0;
      contrato(estado);
      expect(await K.marcarFirmadoEnPapel(GESTIONA, "k1", "ad1", AHORA)).toEqual({ ok: false, error: M.noSePasaAPapel });
    }
    B.datos.fotofficeContrato.length = 0;
    contrato("ENVIADO");
    expect(await K.marcarFirmadoEnPapel(SOLO_VER, "k1", "ad1", AHORA)).toEqual({ ok: false, error: M.sinPermiso });
    expect(await K.marcarFirmadoEnPapel(OTRO_WS, "k1", "ad1", AHORA)).toEqual({ ok: false, error: M.contratoNoExiste });
  });
});
