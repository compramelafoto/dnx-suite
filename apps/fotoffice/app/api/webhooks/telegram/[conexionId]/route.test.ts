import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../../../../lib/circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const procesados: unknown[] = [];
vi.mock("@/lib/presupuesto-automatico/telegram-webhook", () => ({
  procesarUpdateTelegram: async (_c: unknown, u: unknown) => void procesados.push(u),
}));
const bandeja = vi.hoisted(() => ({ respuestas: [] as unknown[], botones: [] as unknown[] }));
vi.mock("@/lib/bandeja/telegram", () => ({
  atenderRespuesta: async (_c: unknown, u: unknown) => (bandeja.respuestas.push(u), true),
  atenderBoton: async (_c: unknown, u: unknown) => (bandeja.botones.push(u), true),
}));
// Fuera de un pedido de Next, `after` corre la tarea enseguida.
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: (fn: () => unknown) => void fn() }));

const { POST } = await import("./route");
const { hashDeSecreto } = await import("@/lib/telegram/webhook");

const SECRETO = "a".repeat(64);
const ID = "ckconexion000001";
const boton = { update_id: 9, callback_query: { id: "cb", from: { id: 555 }, message: { message_id: 1, chat: { id: 555 } }, data: "ap:ckaprobacion0001" } };
const post = (cuerpo: unknown, secreto: string | null = SECRETO, id = ID) =>
  POST(
    new Request(`http://x/api/webhooks/telegram/${id}`, {
      method: "POST",
      body: JSON.stringify(cuerpo),
      headers: secreto === null ? {} : { "x-telegram-bot-api-secret-token": secreto },
    }),
    { params: Promise.resolve({ conexionId: id }) },
  );

beforeEach(() => {
  B.vaciar();
  procesados.length = 0;
  B.agregar("fotofficeTelegramConexion", { id: ID, workspaceId: "ws-1", botId: "1", botUsername: "b", chatId: "555", webhookSecretHash: hashDeSecreto(SECRETO) });
});

describe("POST /api/webhooks/telegram/[conexionId]", () => {
  it("con el secreto correcto confirma y procesa el botón", async () => {
    const r = await post(boton);
    expect(r.status).toBe(200);
    expect(procesados).toEqual([expect.objectContaining({ tipo: "BOTON", data: "ap:ckaprobacion0001" })]);
  });

  it("sin secreto, con otro secreto o con una conexión que no existe: 401 y no procesa nada", async () => {
    expect((await post(boton, null)).status).toBe(401);
    expect((await post(boton, "b".repeat(64))).status).toBe(401);
    expect((await post(boton, SECRETO, "ckotraconexion01")).status).toBe(401);
    expect(procesados).toHaveLength(0);
  });

  it("lo que no entiende lo confirma igual (si no, Telegram reintenta) y no lo procesa", async () => {
    const r = await post({ update_id: 10, message: { chat: { id: 555, type: "private" }, text: "hola" } });
    expect(r.status).toBe(200);
    expect(procesados).toHaveLength(0);
  });

  it("una respuesta citando va a la Bandeja (responder al cliente), no a las cotizaciones", async () => {
    const r = await post({ update_id: 11, message: { message_id: 8, chat: { id: 555, type: "private" }, from: { id: 555 }, text: "/más corto", reply_to_message: { message_id: 1 } } });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
    expect(procesados).toHaveLength(0);
    expect(bandeja.respuestas.at(-1)).toMatchObject({ tipo: "RESPUESTA", texto: "/más corto", respondeA: "1" });
  });

  it("un botón «bj:» va a la Bandeja; el de aprobar, a las cotizaciones", async () => {
    await post({ ...boton, callback_query: { ...boton.callback_query, data: "bj:r:ckchat0000000001" } });
    expect(bandeja.botones.at(-1)).toMatchObject({ tipo: "BOTON", data: "bj:r:ckchat0000000001" });
    expect(procesados).toHaveLength(0);
  });
});
