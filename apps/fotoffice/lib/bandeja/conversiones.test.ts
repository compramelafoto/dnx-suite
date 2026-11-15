import { beforeEach, describe, expect, it, vi } from "vitest";
import { anuncioDeReferral } from "./anuncio";
import { clicMasReciente, cuerpoDelAviso } from "./conversiones";

vi.mock("server-only", () => ({}));
const db = {
  pedido: null as null | { clientId: string; totalArs: { toString(): string } },
  chats: [] as { id: string }[],
  mensajes: [] as { media: unknown; createdAt: Date }[],
};
vi.mock("@repo/db", () => ({
  prisma: {
    fotofficePedido: { findFirst: async () => db.pedido },
    fotofficeWaChat: { findMany: async () => db.chats },
    fotofficeWaMensaje: { findMany: async () => db.mensajes },
  },
}));
const conexion = { workspaceId: "w1", phoneNumberId: "299", wabaId: "288", displayPhone: null, modo: "REAL", pausaBotHoras: 4 };
vi.mock("./conexion", () => ({ leerConexion: async () => conexion }));
vi.mock("@/lib/integrations/whatsapp/credentials", () => ({ leerTokenWhatsapp: async () => "TOKEN" }));

const { avisarConversionAMeta } = await import("./conversiones-servidor");

const AHORA = new Date("2026-11-15T15:00:00Z");
const conClic = (clid: string, dias: number) => ({ media: { anuncio: { texto: "XV", ctwaClid: clid } }, createdAt: new Date(AHORA.getTime() - dias * 86_400_000) });

describe("anuncioDeReferral guarda el ctwa_clid", () => {
  it("lo toma del referral", () => {
    expect(anuncioDeReferral({ body: "XV", ctwa_clid: "ARAkLk" })).toEqual({ texto: "XV", ctwaClid: "ARAkLk" });
  });
});

describe("clicMasReciente", () => {
  it("elige el clic más nuevo dentro de 90 días e ignora mensajes sin clic", () => {
    const r = clicMasReciente([conClic("viejo", 100), conClic("medio", 30), { media: null, createdAt: AHORA }, conClic("nuevo", 2)], AHORA);
    expect(r?.ctwaClid).toBe("nuevo");
  });
  it("sin clic reciente → null", () => {
    expect(clicMasReciente([conClic("viejo", 120)], AHORA)).toBeNull();
  });
});

describe("cuerpoDelAviso", () => {
  it("venta con valor en pesos", () => {
    expect(cuerpoDelAviso({ evento: "Purchase", eventoId: "pedido-1", cuando: AHORA, wabaId: "288", ctwaClid: "C1", valorArs: 750000 })).toEqual({
      data: [{
        event_name: "Purchase", event_time: Math.floor(AHORA.getTime() / 1000), event_id: "pedido-1",
        action_source: "business_messaging", messaging_channel: "whatsapp",
        user_data: { whatsapp_business_account_id: "288", ctwa_clid: "C1" },
        custom_data: { currency: "ARS", value: 750000 },
      }],
    });
  });
  it("cotización sin valor", () => {
    const c = cuerpoDelAviso({ evento: "LeadSubmitted", eventoId: "cot-1", cuando: AHORA, wabaId: "288", ctwaClid: "C1", valorArs: 10 });
    expect(c.data[0]).not.toHaveProperty("custom_data");
    expect(c.data[0].event_name).toBe("LeadSubmitted");
  });
});

describe("avisarConversionAMeta", () => {
  beforeEach(() => {
    db.pedido = { clientId: "cli1", totalArs: { toString: () => "850000.00" } };
    db.chats = [{ id: "chat1" }];
    db.mensajes = [conClic("CLID9", 5)];
    conexion.modo = "REAL";
  });

  it("venta de un cliente que vino por anuncio: busca el dataset de la cuenta y manda Purchase con el total", async () => {
    const f = vi.fn(async (url: string) => {
      if (url.endsWith("/288/dataset")) return new Response(JSON.stringify({ data: [{ dataset_id: "1802307843823473" }] }));
      return new Response(JSON.stringify({ events_received: 1 }));
    });
    const r = await avisarConversionAMeta({ evento: "Purchase", workspaceId: "w1", eventoId: "pedido-p1", pedidoId: "p1" }, { fetch: f as unknown as typeof fetch, ahora: () => AHORA });
    expect(r).toEqual({ ok: true });
    const [url, init] = f.mock.calls[1] as unknown as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v21.0/1802307843823473/events");
    const cuerpo = JSON.parse(String(init.body));
    expect(cuerpo.data[0]).toMatchObject({ event_name: "Purchase", event_id: "pedido-p1", user_data: { ctwa_clid: "CLID9", whatsapp_business_account_id: "288" }, custom_data: { value: 850000 } });
  });

  it("sin anuncio no le manda nada a Meta", async () => {
    db.mensajes = [{ media: null, createdAt: AHORA }];
    const f = vi.fn();
    expect(await avisarConversionAMeta({ evento: "Purchase", workspaceId: "w1", eventoId: "x", pedidoId: "p1" }, { fetch: f as unknown as typeof fetch, ahora: () => AHORA })).toEqual({ ok: false, motivo: "SIN_ANUNCIO" });
    expect(f).not.toHaveBeenCalled();
  });

  it("conexión simulada → no avisa", async () => {
    conexion.modo = "SIMULADO";
    const f = vi.fn();
    expect(await avisarConversionAMeta({ evento: "LeadSubmitted", workspaceId: "w1", eventoId: "x", chatId: "chat1" }, { fetch: f as unknown as typeof fetch, ahora: () => AHORA })).toEqual({ ok: false, motivo: "SIN_CONEXION_REAL" });
  });

  it("si Meta rechaza, devuelve el código sin lanzar", async () => {
    const f = vi.fn(async (url: string) =>
      url.endsWith("/dataset") ? new Response(JSON.stringify({ data: [{ dataset_id: "D" }] })) : new Response(JSON.stringify({ error: { code: 100, error_subcode: 2804 } }), { status: 400 }),
    );
    expect(await avisarConversionAMeta({ evento: "LeadSubmitted", workspaceId: "w1", eventoId: "x", chatId: "chat1" }, { fetch: f as unknown as typeof fetch, ahora: () => AHORA })).toEqual({ ok: false, motivo: "META_400_100_2804" });
  });
});
