import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => (await import("../circuitos/base-en-memoria")).crearBaseEnMemoria());
const H = vi.hoisted(() => ({ altas: [] as { categoriaId: string }[], llegadas: [] as string[], resultado: "AVISADO" }));
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
  alLlegarConsulta: async (_ws: string, leadId: string) => {
    H.llegadas.push(leadId);
    return H.resultado;
  },
  enPreparacionParaWhatsapp: async () => false,
}));

const W = await import("./whatsapp");
const WS = "w1";
const chat = { id: "chat-1", waId: "5493410000000", clientId: null, nombre: null };

beforeEach(() => {
  B.vaciar();
  H.altas.length = 0;
  H.llegadas.length = 0;
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
