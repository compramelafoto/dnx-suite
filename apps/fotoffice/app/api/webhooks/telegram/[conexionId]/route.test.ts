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
});
