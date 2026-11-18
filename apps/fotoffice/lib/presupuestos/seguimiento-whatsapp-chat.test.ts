import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- la base en memoria tipa el cliente como mapa suelto
const P = B.prisma as Record<string, any>;

const { chatWhatsappParaSeguimiento, waIdParaSeguimiento } = await import("./seguimiento-whatsapp-servidor");

const AHORA = new Date("2026-11-20T13:00:00Z");
const WA = "5493410000000";
const chats = () => B.datos.fotofficeWaChat as Record<string, unknown>[];

describe("chatWhatsappParaSeguimiento", () => {
  beforeEach(() => {
    B.datos.fotofficeWaChat.length = 0;
    B.datos.fotofficeConsulta.length = 0;
  });

  it("sin chat de WhatsApp (consulta de Instagram): lo crea en BOT, sin entrantes y atado a la ficha", async () => {
    // El chat de Instagram del mismo cliente no cuenta: es otro canal.
    await P.fotofficeWaChat.create({ data: { workspaceId: "w1", canal: "INSTAGRAM", waId: "17841400000000001", estado: "BOT", ultimoMensajeEn: AHORA } });
    B.datos.fotofficeConsulta.push({ id: "q1", workspaceId: "w1", leadId: "l1", clientId: "cl1" });
    const chat = await chatWhatsappParaSeguimiento("w1", WA, "l1", "Lucía Pérez", AHORA);
    expect(chat).toEqual({ id: expect.any(String), estado: "BOT", ultimoEntranteEn: null });
    const wa = chats().filter((c) => c.canal === "WHATSAPP");
    expect(wa).toHaveLength(1);
    expect(wa[0]).toMatchObject({ workspaceId: "w1", waId: WA, nombre: "Lucía Pérez", clientId: "cl1", estado: "BOT", ultimoMensajeEn: AHORA, ultimoEntranteEn: null });
  });

  it("si ya existe, devuelve ése y no crea otro", async () => {
    const hay = await P.fotofficeWaChat.create({ data: { workspaceId: "w1", canal: "WHATSAPP", waId: WA, estado: "HUMANO", ultimoMensajeEn: AHORA, ultimoEntranteEn: AHORA } });
    expect(await chatWhatsappParaSeguimiento("w1", WA, "l1", null, AHORA)).toMatchObject({ id: hay.id, estado: "HUMANO" });
    expect(chats()).toHaveLength(1);
  });

  it("si otro proceso lo crea al mismo tiempo (P2002), usa el que quedó", async () => {
    const original = P.fotofficeWaChat.findUnique;
    let llamadas = 0;
    // La primera lectura no lo ve; antes del create, otro proceso lo crea.
    P.fotofficeWaChat.findUnique = async (a: unknown) => {
      llamadas++;
      if (llamadas === 1) {
        await P.fotofficeWaChat.create({ data: { workspaceId: "w1", canal: "WHATSAPP", waId: WA, estado: "BOT", ultimoMensajeEn: AHORA } });
        return null;
      }
      return original(a);
    };
    try {
      const chat = await chatWhatsappParaSeguimiento("w1", WA, "l1", null, AHORA);
      expect(chat.id).toBe(chats()[0].id);
      expect(chats()).toHaveLength(1);
    } finally {
      P.fotofficeWaChat.findUnique = original;
    }
  });
});

describe("waIdParaSeguimiento", () => {
  it("normaliza como el webhook y descarta lo que no es un teléfono", () => {
    expect(waIdParaSeguimiento("5493410000000")).toBe(WA);
    expect(waIdParaSeguimiento("+54 9 341 000-0000")).toBe(WA);
    expect(waIdParaSeguimiento("123")).toBeNull();
    expect(waIdParaSeguimiento("")).toBeNull();
  });
});
