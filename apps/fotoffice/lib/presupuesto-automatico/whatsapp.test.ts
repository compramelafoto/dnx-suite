import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => (await import("../circuitos/base-en-memoria")).crearBaseEnMemoria());
const H = vi.hoisted(() => ({
  altas: [] as { categoriaId: string; origenId?: string | null; message?: string; contacto?: Record<string, unknown> }[],
  llegadas: [] as string[],
  argumentos: [] as unknown[][],
  resultado: "AVISADO",
  enPreparacionIg: false,
}));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/geocode/nominatim", () => ({ geocodingProvider: () => ({ search: async () => [] }) }));
vi.mock("@/lib/consultas/alta", () => ({
  altaDelSistema: (ws: string) => ({ workspaceId: ws }),
  altaDeConsulta: async (ctx: { workspaceId: string }, datos: { categoriaId: string }) => {
    H.altas.push(datos);
    const lead = B.agregar("serviceSalesLead", { workspaceId: ctx.workspaceId, metaJson: null }).id as string;
    return { ok: true, leadId: lead, clientId: "cli-1" };
  },
}));
vi.mock("./flujo", () => ({
  alLlegarConsulta: async (...a: unknown[]) => {
    const leadId = a[1] as string;
    H.argumentos.push(a);
    H.llegadas.push(leadId);
    return H.resultado;
  },
  enPreparacionParaWhatsapp: async () => false,
  enPreparacionParaInstagram: async () => H.enPreparacionIg,
  condicionEnPreparacionInstagram: (workspaceId: string, igChatId: string) => ({ workspaceId, igChatId }),
}));

const W = await import("./whatsapp");
const WS = "w1";
const chat = { id: "chat-1", waId: "5493410000000", clientId: null, nombre: null };

beforeEach(() => {
  B.vaciar();
  H.altas.length = 0;
  H.llegadas.length = 0;
  H.argumentos.length = 0;
  H.enPreparacionIg = false;
  H.resultado = "AVISADO";
  B.agregar("fotofficeConsultaCategoria", { id: "cat-xv", workspaceId: WS, name: "Fotografía o Video de Cumpleaños de 15", group: "EVENTO", order: 1, archivedAt: null });
  B.agregar("fotofficeConsultaCategoria", { id: "cat-inf", workspaceId: WS, name: "Cumpleaños Infantil", group: "EVENTO", order: 2, archivedAt: null });
  B.agregar("fotofficePresupuestoAutoCategoria", { workspaceId: WS, categoryId: "cat-xv", telegramEnabled: true });
});

const encender = () => B.agregar("fotofficePresupuestoAutoAjustes", { workspaceId: WS, porHoras: { encendido: true } });

describe("prepararDesdeWhatsapp con presupuesto por horas", () => {
  it("encendido: busca entre todas las categorías y guarda las horas antes de armar", async () => {
    encender();
    const r = await W.prepararDesdeWhatsapp(WS, chat, { tipo: "cumpleaños infantil", nombre: "Ana Pérez", horas: 3 });
    expect(r.ok).toBe(true);
    expect(H.altas[0]!.categoriaId).toBe("cat-inf");
    const lead = B.datos.serviceSalesLead[0]!;
    expect(lead.metaJson).toEqual({ porHoras: { horas: 3 } });
    expect(H.llegadas).toEqual([lead.id]);
  });

  it("un tipo sin categoría va a 'Evento', que se crea una sola vez", async () => {
    encender();
    await W.prepararDesdeWhatsapp(WS, chat, { tipo: "fiesta de egresados", nombre: "Ana Pérez", horas: 5 });
    await W.prepararDesdeWhatsapp(WS, { ...chat, waId: "5493410000001" }, { tipo: "fiesta de egresados", nombre: "Leo Gómez", horas: 5 });
    const eventos = B.datos.fotofficeConsultaCategoria.filter((c) => c.name === "Evento");
    expect(eventos).toHaveLength(1);
    expect(eventos[0]).toMatchObject({ group: "EVENTO" });
    expect(H.altas.map((a) => a.categoriaId)).toEqual([eventos[0]!.id, eventos[0]!.id]);
  });

  it("horas inválidas: registra igual, sin horas", async () => {
    encender();
    await W.prepararDesdeWhatsapp(WS, chat, { tipo: "cumpleaños infantil", nombre: "Ana Pérez", horas: 99 });
    expect(B.datos.serviceSalesLead[0]!.metaJson).toBeNull();
    expect(H.llegadas).toHaveLength(1);
  });

  it("si el recorrido queda apagado, no le promete nada al cliente: pasa a una persona", async () => {
    encender();
    H.resultado = "APAGADO";
    const r = await W.prepararDesdeWhatsapp(WS, chat, { tipo: "cumpleaños infantil", nombre: "Ana Pérez", horas: 3 });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/pasar_a_persona/);
  });

  it("'casamiento' es Boda y '15 años' es la de XV; varias coincidencias: le pasa la lista al bot (no cae en Evento)", async () => {
    encender();
    B.agregar("fotofficeConsultaCategoria", { id: "cat-boda", workspaceId: WS, name: "Boda", group: "BODA", order: 3, archivedAt: null });
    B.agregar("fotofficeConsultaCategoria", { id: "cat-adul", workspaceId: WS, name: "Cumpleaños Infantiles/adultos", group: "EVENTO", order: 4, archivedAt: null });
    await W.prepararDesdeWhatsapp(WS, chat, { tipo: "casamiento", nombre: "Ana Pérez", horas: 8 });
    await W.prepararDesdeWhatsapp(WS, { ...chat, waId: "5493410000002" }, { tipo: "15 años", nombre: "Ana Pérez", horas: 5 });
    expect(H.altas.map((a) => a.categoriaId)).toEqual(["cat-boda", "cat-xv"]);
    const r = await W.prepararDesdeWhatsapp(WS, { ...chat, waId: "5493410000003" }, { tipo: "cumpleaños", nombre: "Ana Pérez", horas: 3 });
    expect(r.ok).toBe(false);
    expect(r.message).toContain("Cumpleaños Infantil");
    expect(B.datos.fotofficeConsultaCategoria.some((c) => c.name === "Evento")).toBe(false);
  });

  it("si 'Evento' estaba archivada, la vuelve a activar en vez de fallar", async () => {
    encender();
    B.agregar("fotofficeConsultaCategoria", { id: "cat-ev", workspaceId: WS, name: "Evento", group: "EVENTO", order: 9, archivedAt: new Date() });
    await W.prepararDesdeWhatsapp(WS, chat, { tipo: "fiesta de egresados", nombre: "Ana Pérez", horas: 5 });
    expect(H.altas[0]!.categoriaId).toBe("cat-ev");
    expect(B.datos.fotofficeConsultaCategoria.find((c) => c.id === "cat-ev")!.archivedAt).toBeNull();
  });

  it("una categoría excluida no se arma: pasa a una persona sin registrar nada", async () => {
    B.agregar("fotofficePresupuestoAutoAjustes", { workspaceId: WS, porHoras: { encendido: true, categoriasExcluidas: ["cat-inf"] } });
    const r = await W.prepararDesdeWhatsapp(WS, chat, { tipo: "cumpleaños infantil", nombre: "Ana Pérez", horas: 3 });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/pasar_a_persona/);
    expect(H.altas).toHaveLength(0);
  });

  it("apagado: como antes, sólo las categorías con el interruptor", async () => {
    const r = await W.prepararDesdeWhatsapp(WS, chat, { tipo: "cumpleaños infantil", nombre: "Ana Pérez", horas: 3 });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/pasar_a_persona/);
    expect(H.altas).toHaveLength(0);
  });
});

describe("prepararDesdeWhatsapp desde un chat de Instagram", () => {
  const ig = { id: "chat-ig", waId: "17841400000000001", clientId: null, nombre: "Sofi", canal: "INSTAGRAM" as const, usuarioInstagram: "sofi.r" };

  it("con el WhatsApp que dio: lead con ese teléfono, origen «Instagram» (creado) y la aprobación atada al chat", async () => {
    encender();
    B.agregar("fotofficeOrigen", { id: "or-1", workspaceId: WS, name: "Recomendación", order: 1, archivedAt: null });
    const r = await W.prepararDesdeWhatsapp(WS, ig, { tipo: "15 años", nombre: "Sofía Rodríguez", horas: 5, whatsapp: "341 555-1234", detalle: "Fiesta en marzo" });
    expect(r.ok).toBe(true);
    const origen = B.datos.fotofficeOrigen.find((o) => o.name === "Instagram");
    expect(origen).toMatchObject({ workspaceId: WS, order: 2, archivedAt: null });
    expect(H.altas[0]).toMatchObject({ origenId: origen!.id, contacto: { nombre: "Sofía Rodríguez", telefono: "+5493415551234" } });
    expect(H.altas[0]!.message).toBe("Por Instagram (@sofi.r): Fiesta en marzo");
    expect(H.argumentos[0]!.slice(2, 4)).toEqual(["INSTAGRAM", { waId: "5493415551234", igChatId: "chat-ig" }]);
  });

  it("reusa el origen «Instagram» que ya existe (sin distinguir mayúsculas) y lo reactiva si estaba archivado", async () => {
    encender();
    B.agregar("fotofficeOrigen", { id: "or-ig", workspaceId: WS, name: "instagram", order: 4, archivedAt: new Date() });
    await W.prepararDesdeWhatsapp(WS, ig, { tipo: "15 años", nombre: "Sofía Rodríguez", horas: 5, whatsapp: "3415551234" });
    expect(B.datos.fotofficeOrigen).toHaveLength(1);
    expect(B.datos.fotofficeOrigen[0]).toMatchObject({ id: "or-ig", archivedAt: null });
    expect(H.altas[0]!.origenId).toBe("or-ig");
  });

  it("sin whatsapp: carga la consulta sin teléfono, con el correo, y le pide al bot pasar a persona", async () => {
    encender();
    const r = await W.prepararDesdeWhatsapp(WS, ig, { tipo: "15 años", nombre: "Sofía Rodríguez", horas: 5, email: "sofi@example.com" });
    expect(H.altas).toHaveLength(1);
    expect(H.altas[0]!.contacto).toMatchObject({ nombre: "Sofía Rodríguez", email: "sofi@example.com", telefono: null });
    expect(H.altas[0]!.message).toBe("Consulta por Instagram (@sofi.r).");
    expect(H.argumentos[0]!.slice(2, 4)).toEqual(["INSTAGRAM", { waId: null, igChatId: "chat-ig" }]);
    expect(r.message).toMatch(/pasar_a_persona/);
    expect(r.message).toMatch(/por acá/);
  });

  it("un número sin código de área no sirve: se carga sin teléfono y le pide al bot el número con la característica", async () => {
    encender();
    const r = await W.prepararDesdeWhatsapp(WS, ig, { tipo: "15 años", nombre: "Sofía Rodríguez", horas: 5, whatsapp: "555-1234" });
    expect(H.altas[0]!.contacto).toMatchObject({ telefono: null });
    expect(r.message).toMatch(/característica/);
    expect(r.message).toMatch(/pasar_a_persona/);
  });

  it("con ficha sin teléfono, el WhatsApp que dio se escribe en la ficha; si ya tenía otro, no se pisa", async () => {
    encender();
    B.agregar("client", { id: "cli-ig", workspaceId: WS, phone: null });
    B.agregar("client", { id: "cli-otro", workspaceId: WS, phone: "+5493410000009" });
    await W.prepararDesdeWhatsapp(WS, { ...ig, clientId: "cli-ig" }, { tipo: "15 años", nombre: "Sofía Rodríguez", horas: 5, whatsapp: "341 555-1234" });
    await W.prepararDesdeWhatsapp(WS, { ...ig, id: "chat-ig-2", clientId: "cli-otro" }, { tipo: "15 años", nombre: "Sofía Rodríguez", horas: 5, whatsapp: "341 555-1234" });
    expect(B.datos.client.find((c) => c.id === "cli-ig")!.phone).toBe("+5493415551234");
    expect(B.datos.client.find((c) => c.id === "cli-otro")!.phone).toBe("+5493410000009");
    expect(H.altas[0]!.contacto).toEqual({ clientId: "cli-ig" });
  });

  it("con una cotización en preparación para ese chat de Instagram no crea nada", async () => {
    encender();
    H.enPreparacionIg = true;
    const r = await W.prepararDesdeWhatsapp(WS, ig, { tipo: "15 años", nombre: "Sofía Rodríguez", horas: 5, whatsapp: "341 555-1234" });
    expect(r.message).toMatch(/en preparación/);
    expect(H.altas).toHaveLength(0);
  });

  it("si la cotización en preparación se cargó sin teléfono y ahora da un WhatsApp que sirve, se completa sin pisar nada", async () => {
    encender();
    H.enPreparacionIg = true;
    B.agregar("serviceSalesLead", { id: "lead-ig", workspaceId: WS, phone: null, metaJson: null });
    B.agregar("fotofficePresupuestoAprobacion", { id: "ap-ig", workspaceId: WS, leadId: "lead-ig", igChatId: "chat-ig", waId: null, status: "AVISADO", errorCode: null, createdAt: new Date() });
    const r = await W.prepararDesdeWhatsapp(WS, ig, { tipo: "15 años", nombre: "Sofía Rodríguez", whatsapp: "0341 15 555-1234" });
    expect(r.message).toMatch(/anoté su WhatsApp/);
    expect(B.datos.fotofficePresupuestoAprobacion[0]).toMatchObject({ waId: "5493415551234" });
    expect(B.datos.serviceSalesLead[0]).toMatchObject({ phone: "+5493415551234" });
    expect(H.altas).toHaveLength(0);
  });

  it("si lo da después y la ficha ya tenía otro teléfono, no lo pisa y lo anota en la consulta", async () => {
    encender();
    H.enPreparacionIg = true;
    B.agregar("client", { id: "cli-otro", workspaceId: WS, phone: "+5493410000009" });
    B.agregar("serviceSalesLead", { id: "lead-ig", workspaceId: WS, phone: "+5493410000009", message: "Consulta por Instagram (@sofi.r).", metaJson: null });
    B.agregar("fotofficePresupuestoAprobacion", { id: "ap-ig", workspaceId: WS, leadId: "lead-ig", igChatId: "chat-ig", waId: null, status: "AVISADO", errorCode: null, createdAt: new Date() });
    await W.prepararDesdeWhatsapp(WS, { ...ig, clientId: "cli-otro" }, { tipo: "15 años", nombre: "Sofía Rodríguez", whatsapp: "341 555-1234" });
    expect(B.datos.client[0]).toMatchObject({ phone: "+5493410000009" });
    expect(B.datos.serviceSalesLead[0]).toMatchObject({ phone: "+5493410000009", message: "Consulta por Instagram (@sofi.r). (WhatsApp que dio: +5493415551234)" });
    expect(B.datos.fotofficePresupuestoAprobacion[0]).toMatchObject({ waId: "5493415551234" });
  });
});

