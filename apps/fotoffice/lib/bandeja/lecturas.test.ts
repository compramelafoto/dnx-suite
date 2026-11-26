import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const L = await import("./lecturas");

const AHORA = new Date("2026-10-09T15:00:00.000Z");
const hace = (horas: number) => new Date(AHORA.getTime() - horas * 3_600_000);

const ctxDe = (userId: number, levels: Record<string, "VIEW" | "MANAGE" | "NONE">, workspaceId = "w1") => ({
  workspaceId, userId, userLabel: "x", role: "STAFF", acceso: { role: "STAFF", levels } as never,
});
const ANA = ctxDe(2, { "whatsapp-inbox": "MANAGE", clients: "MANAGE", "service-leads": "VIEW", quotes: "VIEW" });
const LEO = ctxDe(3, { "whatsapp-inbox": "VIEW" });
const SIN = ctxDe(4, {});
const OTRA = ctxDe(2, { "whatsapp-inbox": "MANAGE", clients: "MANAGE" }, "w2");

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- la base en memoria tipa el cliente como mapa suelto
const P = B.prisma as Record<string, any>;

async function chat(waId: string, p: Record<string, unknown> = {}) {
  return (await P.fotofficeWaChat.create({ data: { workspaceId: "w1", waId, ultimoMensajeEn: hace(1), ...p } })) as { id: string };
}
async function msg(chatId: string, p: Record<string, unknown> = {}) {
  return P.fotofficeWaMensaje.create({
    data: { workspaceId: "w1", chatId, direccion: "ENTRANTE", autor: "CLIENTE", tipo: "TEXTO", texto: "hola", createdAt: hace(1), ...p },
  });
}

beforeEach(() => {
  B.vaciar();
  B.agregar("user", { id: 2, name: "Ana", email: "ana@x.com" });
  B.agregar("user", { id: 3, name: null, email: "leo@x.com" });
});

describe("listarChats", () => {
  it("sin permiso de Ver devuelve null; con Ver, la lista", async () => {
    await chat("5491111111111");
    expect(await L.listarChats(SIN, { ahora: AHORA })).toBeNull();
    expect(await L.listarChats(LEO, { ahora: AHORA })).toHaveLength(1);
  });

  it("no mezcla instituciones", async () => {
    await chat("5491111111111");
    await P.fotofficeWaChat.create({ data: { workspaceId: "w2", waId: "5492222222222", ultimoMensajeEn: hace(1) } });
    expect(await L.listarChats(OTRA, { ahora: AHORA })).toMatchObject([{ waId: "5492222222222" }]);
    expect((await L.listarChats(ANA, { ahora: AHORA }))?.map((c) => c.waId)).toEqual(["5491111111111"]);
  });

  it("ordena por último mensaje, con vista previa corta, no leídos y asignado", async () => {
    const a = await chat("5491111111111", { ultimoMensajeEn: hace(5), noLeidos: 3, ultimoMensajeTexto: "x".repeat(120), ultimoMensajeTipo: "TEXTO" });
    const b = await chat("5492222222222", { ultimoMensajeEn: hace(1), estado: "HUMANO", asignadoUserId: 2, nombre: "Lu", ultimoMensajeTexto: null, ultimoMensajeTipo: "IMAGEN" });
    const lista = (await L.listarChats(ANA, { ahora: AHORA }))!;
    expect(lista.map((c) => c.id)).toEqual([b.id, a.id]);
    expect(lista[0]).toMatchObject({ titulo: "Lu", asignadoNombre: "Ana", ultimoMensaje: "[Imagen]", atiendeElBot: false });
    expect(lista[1].ultimoMensaje).toHaveLength(120);
    expect(lista[1].noLeidos).toBe(3);
  });

  it("quién atiende: bot, sin asignar (sin el bot) y cada persona; abiertos por omisión", async () => {
    const bot = await chat("5490000000001", { estado: "BOT" });
    const mio = await chat("5490000000002", { estado: "HUMANO", asignadoUserId: 2 });
    const ajeno = await chat("5490000000003", { estado: "HUMANO", asignadoUserId: 3 });
    const pausado = await chat("5490000000004", { estado: "HUMANO", botPausadoHasta: hace(1) });
    const pausaVigente = await chat("5490000000005", { estado: "HUMANO", botPausadoHasta: new Date(AHORA.getTime() + 3_600_000) });
    const resuelto = await chat("5490000000006", { estado: "RESUELTO", resueltoPorUserId: 2 });
    const excluido = await chat("5490000000007", { estado: "BOT", botExcluido: true });
    const sinPausa = await chat("5490000000008", { estado: "HUMANO" });
    const ids = async (p: Record<string, unknown>) => (await L.listarChats(ANA, { ...p, ahora: AHORA }))!.map((c) => c.id).sort();
    expect(await ids({})).toHaveLength(7);
    expect(await ids({})).not.toContain(resuelto.id);
    expect(await ids({ quien: "bot" })).toEqual([bot.id, pausado.id].sort());
    expect(await ids({ quien: 2 })).toEqual([mio.id]);
    expect(await ids({ quien: 3 })).toEqual([ajeno.id]);
    expect(await ids({ quien: "sin-asignar" })).toEqual([pausaVigente.id, excluido.id, sinPausa.id].sort());
    expect(await ids({ estado: "resueltos" })).toEqual([resuelto.id]);
    expect(await ids({ estado: "resueltos", quien: 2 })).toEqual([resuelto.id]);
    expect(await ids({ estado: "resueltos", quien: 3 })).toEqual([]);
    expect(await ids({ quien: 2, canal: "INSTAGRAM" })).toEqual([]);
  });

  it("esperando respuesta: el último mensaje es del cliente, del que más espera al que menos (7 días)", async () => {
    const reciente = await chat("5490000000001", { ultimoMensajeEn: hace(1), ultimoEntranteEn: hace(1) });
    const viejo = await chat("5490000000002", { estado: "HUMANO", asignadoUserId: 2, ultimoMensajeEn: hace(5), ultimoEntranteEn: hace(5) });
    await chat("5490000000003", { ultimoMensajeEn: hace(1), ultimoEntranteEn: hace(2) }); // ya se le respondió
    await chat("5490000000004", { ultimoMensajeEn: hace(300), ultimoEntranteEn: hace(300) }); // abandonado
    await chat("5490000000005", { estado: "RESUELTO", ultimoMensajeEn: hace(1), ultimoEntranteEn: hace(1) });
    const lista = (await L.listarChats(ANA, { estado: "esperando", ahora: AHORA }))!;
    expect(lista.map((c) => c.id)).toEqual([viejo.id, reciente.id]);
  });

  it("busca por palabra en los mensajes (no en los SISTEMA) y devuelve el fragmento", async () => {
    const a = await chat("5490000000001", { nombre: "Ana" });
    const b = await chat("5490000000002", { nombre: "Beto" });
    const c = await chat("5490000000003", { nombre: "Caro" });
    await msg(a.id, { direccion: "SALIENTE", autor: "USUARIO", texto: "Te paso el presupuesto del Paquete Oro para tu fiesta" });
    await msg(b.id, { direccion: "SISTEMA", autor: "SISTEMA", texto: "paquete oro" });
    await msg(c.id, { texto: "hola" });
    const lista = (await L.listarChats(ANA, { q: "paquete oro", ahora: AHORA }))!;
    expect(lista.map((x) => x.id)).toEqual([a.id]);
    expect(lista[0].fragmento).toEqual({ antes: "Te paso el presupuesto del ", coincide: "Paquete Oro", despues: " para tu fiesta" });
    expect((await L.listarChats(ANA, { q: "caro", ahora: AHORA }))![0]).toMatchObject({ id: c.id, fragmento: null });
  });

  it("la búsqueda por palabra no mezcla instituciones", async () => {
    const a = await chat("5490000000001");
    await P.fotofficeWaMensaje.create({ data: { workspaceId: "w2", chatId: a.id, direccion: "ENTRANTE", autor: "CLIENTE", tipo: "TEXTO", texto: "secreto", createdAt: hace(1) } });
    expect(await L.listarChats(ANA, { q: "secreto", ahora: AHORA })).toEqual([]);
  });

  it("la lista no consulta los mensajes: la vista previa sale del propio chat", async () => {
    const c = await chat("5491111111111", { ultimoMensajeTexto: "del chat", ultimoMensajeTipo: "TEXTO" });
    await msg(c.id, { texto: "otro texto en la tabla de mensajes" });
    const espia = vi.spyOn(B.tablas.fotofficeWaMensaje, "findFirst");
    const espia2 = vi.spyOn(B.tablas.fotofficeWaMensaje, "findMany");
    expect((await L.listarChats(ANA, { ahora: AHORA }))![0].ultimoMensaje).toBe("del chat");
    expect(espia).not.toHaveBeenCalled();
    expect(espia2).not.toHaveBeenCalled();
    const sin = await chat("5492222222222");
    expect((await L.listarChats(ANA, { ahora: AHORA }))!.find((x) => x.id === sin.id)!.ultimoMensaje).toBeNull();
  });

  it("sin permiso de Clientes la búsqueda no entra a los nombres de las fichas", async () => {
    B.agregar("client", { id: "c1", workspaceId: "w1", kind: "PERSONA", firstName: "Marta", lastName: "Pérez" });
    const conFicha = await chat("5493410000002", { clientId: "c1", nombre: "Marti" });
    await chat("5493410000003", { nombre: "Otro" });
    const ids = async (ctx: typeof ANA, q: string) => (await L.listarChats(ctx, { q, ahora: AHORA }))!.map((c) => c.id);
    expect(await ids(ANA, "pérez")).toEqual([conFicha.id]);
    expect(await ids(LEO, "pérez")).toEqual([]);
    expect(await ids(LEO, "marti")).toEqual([conFicha.id]);
  });

  it("un filtro inventado se trata como todos", async () => {
    await chat("5490000000001");
    expect(await L.listarChats(ANA, { quien: "hack" as never, estado: "raro" as never, ahora: AHORA })).toHaveLength(1);
  });

  it("busca por nombre del perfil, por número y por nombre del cliente", async () => {
    B.agregar("client", { id: "c1", workspaceId: "w1", kind: "PERSONA", firstName: "Marta", lastName: "Pérez" });
    B.agregar("client", { id: "c-otro", workspaceId: "w2", kind: "PERSONA", firstName: "Marta", lastName: "Gómez" });
    const x = await chat("5493410000001", { nombre: "Julieta" });
    const y = await chat("5493410000002", { clientId: "c1" });
    await chat("5493410000003", { nombre: "Otro" });
    const buscar = async (q: string) => (await L.listarChats(ANA, { q, ahora: AHORA }))!.map((c) => c.id);
    expect(await buscar("julie")).toEqual([x.id]);
    expect(await buscar("341 0000002")).toEqual([y.id]);
    expect(await buscar("pérez")).toEqual([y.id]);
    expect(await buscar("zzz")).toEqual([]);
  });

  it("muestra el nombre del cliente sólo con permiso de Clientes", async () => {
    B.agregar("client", { id: "c1", workspaceId: "w1", kind: "PERSONA", firstName: "Marta", lastName: "Pérez" });
    await chat("5493410000002", { clientId: "c1", nombre: "Marti" });
    expect((await L.listarChats(ANA, { ahora: AHORA }))![0]).toMatchObject({ titulo: "Pérez, Marta", clienteNombre: "Pérez, Marta" });
    expect((await L.listarChats(LEO, { ahora: AHORA }))![0]).toMatchObject({ titulo: "Marti", clienteNombre: null });
  });

  it("devuelve como mucho 200 chats", async () => {
    for (let i = 0; i < 205; i++) await chat(`549${String(i).padStart(10, "0")}`);
    expect(await L.listarChats(ANA, { ahora: AHORA })).toHaveLength(200);
  });
});

describe("detalleChat", () => {
  it("sin permiso o de otra institución devuelve null", async () => {
    const c = await chat("5491111111111");
    expect(await L.detalleChat(SIN, c.id, AHORA)).toBeNull();
    expect(await L.detalleChat(OTRA, c.id, AHORA)).toBeNull();
    expect(await L.detalleChat(ANA, "../x", AHORA)).toBeNull();
    expect(await L.detalleChat(ANA, "no-existe", AHORA)).toBeNull();
  });

  it("trae los últimos 200 mensajes en orden, con el estado visible y sin datos internos", async () => {
    const c = await chat("5491111111111", { ultimoEntranteEn: hace(2) });
    for (let i = 0; i < 205; i++) await msg(c.id, { texto: `m${i}`, createdAt: new Date(AHORA.getTime() - (300 - i) * 60_000) });
    await msg(c.id, {
      direccion: "SALIENTE", autor: "USUARIO", texto: "pendiente", estadoEnvio: "PENDIENTE", clientToken: "secreto",
      media: { id: "m" }, createdAt: hace(0.5),
    });
    const d = (await L.detalleChat(ANA, c.id, AHORA))!;
    expect(d.mensajes).toHaveLength(200);
    expect(d.mensajes[0].texto).toBe("m6");
    const ultimo = d.mensajes[199];
    expect(ultimo).toMatchObject({ texto: "pendiente", estadoEnvio: "INCIERTO" });
    expect(Object.keys(ultimo)).not.toContain("clientToken");
    expect(Object.keys(ultimo)).not.toContain("media");
    expect(d.dentroDeVentana).toBe(true);
  });

  it("una foto bajada viene como archivo seguro, sin clave ni media", async () => {
    const c = await chat("5491111111111", { ultimoEntranteEn: hace(2) });
    await msg(c.id, {
      tipo: "IMAGEN", texto: null, createdAt: hace(1),
      media: { id: "meta", mimeType: "image/jpeg", descarga: "LISTO", clave: "bandeja/w1/c/m.jpg", bytes: 240000, ancho: 1600, alto: 1200 },
    });
    const m = (await L.detalleChat(ANA, c.id, AHORA))!.mensajes[0];
    expect(m.archivo).toEqual({ estado: "LISTO", mime: "image/jpeg", nombre: "foto.jpg", bytes: 240000, ancho: 1600, alto: 1200 });
    expect(JSON.stringify(m)).not.toContain("bandeja/w1");
    expect(Object.keys(m)).not.toContain("media");
  });

  it("fuera de las 24 h no se puede responder libre", async () => {
    const c = await chat("5491111111111", { ultimoEntranteEn: hace(30) });
    expect((await L.detalleChat(ANA, c.id, AHORA))!.dentroDeVentana).toBe(false);
  });

  it("resumen del cliente: nombre, ficha y cantidades según permisos", async () => {
    B.agregar("client", { id: "c1", workspaceId: "w1", kind: "PERSONA", firstName: "Marta", lastName: "Pérez" });
    const c = await chat("5491111111111", { clientId: "c1", estado: "HUMANO", asignadoUserId: 3 });
    const d = (await L.detalleChat(ANA, c.id, AHORA))!;
    expect(d.cliente).toMatchObject({ id: "c1", nombre: "Pérez, Marta", href: "/clientes/c1", consultas: 0, presupuestos: 0 });
    expect(d.asignadoNombre).toBe("leo@x.com");
    const sinClientes = (await L.detalleChat(LEO, c.id, AHORA))!;
    expect(sinClientes.cliente).toBeNull();
    expect(sinClientes.clienteOculto).toBe(true);
  });

  it("ignora un cliente de otra institución", async () => {
    B.agregar("client", { id: "c-w2", workspaceId: "w2", kind: "PERSONA", firstName: "Ajena" });
    const c = await chat("5491111111111", { clientId: "c-w2" });
    const d = (await L.detalleChat(ANA, c.id, AHORA))!;
    expect(d.cliente).toBeNull();
  });
});

describe("noLeidosDelWorkspace", () => {
  it("con filas devuelve la suma y sin filas 0", async () => {
    expect(await L.noLeidosDelWorkspace("w1")).toBe(0);
    await chat("5490000000001", { noLeidos: 4 });
    expect(await L.noLeidosDelWorkspace("w1")).toBe(4);
  });

  it("si la lectura falla (tabla sin migrar) devuelve 0", async () => {
    const espia = vi.spyOn(B.tablas.fotofficeWaChat, "aggregate").mockRejectedValueOnce(new Error("relation does not exist"));
    expect(await L.noLeidosDelWorkspace("w1")).toBe(0);
    espia.mockRestore();
  });

  it("usa una sola consulta agregada", async () => {
    await chat("5490000000001", { noLeidos: 2 });
    const a = vi.spyOn(B.tablas.fotofficeWaChat, "aggregate");
    const f = vi.spyOn(B.tablas.fotofficeWaChat, "findMany");
    await L.totalNoLeidos(LEO);
    expect(a).toHaveBeenCalledTimes(1);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("totalNoLeidos", () => {
  it("suma los no leídos del workspace; sin permiso, null", async () => {
    await chat("5490000000001", { noLeidos: 2 });
    await chat("5490000000002", { noLeidos: 3 });
    await chat("5490000000003", { noLeidos: 0 });
    await P.fotofficeWaChat.create({ data: { workspaceId: "w2", waId: "5499999999999", ultimoMensajeEn: hace(1), noLeidos: 9 } });
    expect(await L.totalNoLeidos(LEO)).toBe(5);
    expect(await L.totalNoLeidos(SIN)).toBeNull();
    expect(await L.totalNoLeidos(OTRA)).toBe(9);
  });
});

describe("buscarClientes", () => {
  it("pide Gestionar en la Bandeja y Ver en Clientes, busca sólo en el workspace", async () => {
    B.agregar("client", { id: "c1", workspaceId: "w1", kind: "PERSONA", firstName: "Marta", lastName: "Pérez", phone: "3415551234" });
    B.agregar("client", { id: "c2", workspaceId: "w2", kind: "PERSONA", firstName: "Marta", lastName: "Otra" });
    expect(await L.buscarClientes(LEO, "marta")).toBeNull();
    expect(await L.buscarClientes(ANA, "m")).toEqual([]);
    expect(await L.buscarClientes(ANA, "marta")).toEqual([{ id: "c1", nombre: "Pérez, Marta", telefono: "3415551234" }]);
    expect(await L.buscarClientes(ANA, "341 555")).toHaveLength(1);
    expect(await L.buscarClientes(ctxDe(5, { "whatsapp-inbox": "MANAGE" }), "marta")).toBeNull();
  });
});

describe("vista previa", () => {
  it("se arma con hasta 120 caracteres y el tipo, y la lista usa el tipo si no hay texto", async () => {
    const { vistaPreviaDe, textoDeVistaPrevia } = await import("./vista-previa");
    expect(vistaPreviaDe("a".repeat(500), "TEXTO").ultimoMensajeTexto).toHaveLength(120);
    expect(vistaPreviaDe("  ", "AUDIO")).toEqual({ ultimoMensajeTexto: null, ultimoMensajeTipo: "AUDIO" });
    expect(textoDeVistaPrevia({ ultimoMensajeTexto: null, ultimoMensajeTipo: "AUDIO" })).toBe("[Audio]");
    expect(textoDeVistaPrevia({ ultimoMensajeTexto: null, ultimoMensajeTipo: "XYZ" })).toBe("[Mensaje]");
    expect(textoDeVistaPrevia({ ultimoMensajeTexto: null, ultimoMensajeTipo: null })).toBeNull();
  });
});

describe("truncarSeguro", () => {
  const sinSuelto = (s: string) => !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s);

  it("un texto sin emoji que entra queda igual y uno largo se recorta a 120 con puntos", async () => {
    const { vistaPreviaDe, truncarSeguro } = await import("./vista-previa");
    expect(truncarSeguro("hola", 120)).toBe("hola");
    expect(vistaPreviaDe("a".repeat(120), "TEXTO").ultimoMensajeTexto).toBe("a".repeat(120));
    const largo = vistaPreviaDe("a".repeat(121), "TEXTO").ultimoMensajeTexto!;
    expect(largo).toBe(`${"a".repeat(119)}…`);
  });

  it("un emoji justo en el lugar 119 o 120 no se parte", async () => {
    const { vistaPreviaDe } = await import("./vista-previa");
    for (const antes of [118, 119, 120]) {
      const r = vistaPreviaDe(`${"a".repeat(antes)}😀${"b".repeat(10)}`, "TEXTO").ultimoMensajeTexto!;
      expect(sinSuelto(r)).toBe(true);
      expect(Array.from(r).length).toBeLessThanOrEqual(120);
    }
    const justo = vistaPreviaDe(`${"a".repeat(119)}😀`, "TEXTO").ultimoMensajeTexto!;
    expect(justo).toBe(`${"a".repeat(119)}😀`);
  });

  it("un emoji familiar (con uniones) en el límite no se parte", async () => {
    const { truncarSeguro } = await import("./vista-previa");
    const familia = "👨‍👩‍👧‍👦";
    const r = truncarSeguro(`${"a".repeat(118)}${familia}${"b".repeat(5)}`, 120);
    expect(sinSuelto(r)).toBe(true);
    // Nunca queda la familia a medias: o está entera o no está.
    expect(r.includes("👨") ? r.includes(familia) : true).toBe(true);
    expect(r.endsWith("…")).toBe(true);
  });
});

describe("canal Instagram", () => {
  it("listarChats({ canal: \"INSTAGRAM\" }) sólo trae Instagram; WhatsApp, sólo WhatsApp; todos, los dos", async () => {
    const wa = await chat("5491111111111");
    const ig = await chat("17841400000001", { canal: "INSTAGRAM", usuarioInstagram: "sofi.rodriguez" });
    const ids = async (canal?: "WHATSAPP" | "INSTAGRAM" | "todos") => (await L.listarChats(ANA, { canal, ahora: AHORA }))!.map((c) => c.id).sort();
    expect(await ids("INSTAGRAM")).toEqual([ig.id]);
    expect(await ids("WHATSAPP")).toEqual([wa.id]);
    expect(await ids("todos")).toEqual([wa.id, ig.id].sort());
    expect(await ids()).toEqual([wa.id, ig.id].sort());
  });

  it("buscar por número no ve el IGSID; buscar por @usuario sí encuentra el chat de Instagram", async () => {
    const wa = await chat("5493415551234");
    const ig = await chat("3415551234999", { canal: "INSTAGRAM", usuarioInstagram: "sofi.rodriguez" });
    expect((await L.listarChats(ANA, { q: "3415551234", ahora: AHORA }))!.map((c) => c.id)).toEqual([wa.id]);
    expect((await L.listarChats(ANA, { q: "@sofi", ahora: AHORA }))!.map((c) => c.id)).toEqual([ig.id]);
  });

  it("un canal inventado se trata como todos", async () => {
    await chat("5491111111111");
    await chat("17841400000001", { canal: "INSTAGRAM" });
    expect(await L.listarChats(ANA, { canal: "TELEGRAM" as never, ahora: AHORA })).toHaveLength(2);
  });

  it("sin ficha el título es @usuario, si no el nombre, si no «Instagram» (nunca el IGSID)", async () => {
    await chat("17841400000001", { canal: "INSTAGRAM", usuarioInstagram: "sofi.rodriguez", nombre: "Sofi", ultimoMensajeEn: hace(1) });
    await chat("17841400000002", { canal: "INSTAGRAM", nombre: "Mica", ultimoMensajeEn: hace(2) });
    await chat("17841400000003", { canal: "INSTAGRAM", ultimoMensajeEn: hace(3) });
    const lista = (await L.listarChats(ANA, { ahora: AHORA }))!;
    expect(lista.map((c) => c.titulo)).toEqual(["@sofi.rodriguez", "Mica", "Instagram"]);
    expect(lista[0]).toMatchObject({ canal: "INSTAGRAM", usuarioInstagram: "sofi.rodriguez" });
  });

  it("un chat de WhatsApp trae su canal y sin usuario de Instagram", async () => {
    await chat("5491111111111");
    expect((await L.listarChats(ANA, { ahora: AHORA }))![0]).toMatchObject({ canal: "WHATSAPP", usuarioInstagram: null, titulo: "5491111111111" });
  });

  it("detalleChat trae el canal, el usuario y el título de Instagram", async () => {
    const ig = await chat("17841400000001", { canal: "INSTAGRAM", usuarioInstagram: "sofi.rodriguez" });
    expect(await L.detalleChat(ANA, ig.id, AHORA)).toMatchObject({ canal: "INSTAGRAM", usuarioInstagram: "sofi.rodriguez", titulo: "@sofi.rodriguez" });
    const wa = await chat("5491111111111", { nombre: "Lu" });
    expect(await L.detalleChat(ANA, wa.id, AHORA)).toMatchObject({ canal: "WHATSAPP", usuarioInstagram: null, titulo: "Lu" });
  });
});
