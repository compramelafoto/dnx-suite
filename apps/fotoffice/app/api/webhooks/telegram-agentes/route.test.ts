import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../../../lib/circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));

const procesados: unknown[] = [];
vi.mock("@/lib/agentes/webhook-agentes", () => ({
  procesarUpdateAgentes: async (_c: unknown, u: unknown) => void procesados.push(u),
}));
vi.mock("next/server", async (original) => ({ ...(await original<typeof import("next/server")>()), after: (fn: () => unknown) => void fn() }));

const { POST } = await import("./route");
const { hashDeSecreto } = await import("@/lib/telegram/webhook");
const { CLAVE_CANAL_AGENTES } = await import("@/lib/agentes/canal-reglas");

const SECRETO = "a".repeat(64);
const post = (cuerpo: unknown, secreto: string | null = SECRETO) =>
  POST(
    new Request("http://x/api/webhooks/telegram-agentes", {
      method: "POST",
      body: JSON.stringify(cuerpo),
      headers: secreto === null ? {} : { "x-telegram-bot-api-secret-token": secreto },
    }),
  );
const respuesta = { update_id: 3, message: { message_id: 9, chat: { id: 555, type: "private" }, from: { id: 555 }, text: "más corto", reply_to_message: { message_id: 7 } } };

beforeEach(() => {
  B.vaciar();
  procesados.length = 0;
  B.agregar("systemSettings", {
    key: CLAVE_CANAL_AGENTES,
    value: JSON.stringify({ botId: "1", botUsername: "b", chatId: "555", chatNombre: null, webhookSecretHash: hashDeSecreto(SECRETO), linkCode: null, linkCodeExpiresAt: null, linkedAt: null }),
  });
});

describe("POST /api/webhooks/telegram-agentes", () => {
  it("con el secreto correcto confirma y procesa una respuesta (corrección)", async () => {
    const r = await post(respuesta);
    expect(r.status).toBe(200);
    expect(procesados).toEqual([expect.objectContaining({ tipo: "RESPUESTA", respondeA: "7", texto: "más corto" })]);
  });

  it("sin secreto, con otro o sin canal configurado: 401 y nada", async () => {
    expect((await post(respuesta, null)).status).toBe(401);
    expect((await post(respuesta, "b".repeat(64))).status).toBe(401);
    B.vaciar();
    expect((await post(respuesta)).status).toBe(401);
    expect(procesados).toHaveLength(0);
  });

  it("lo que no entiende lo confirma y lo ignora", async () => {
    const r = await post({ update_id: 4, message: { chat: { id: 555, type: "private" }, text: "hola" } });
    expect(await r.json()).toEqual({ ok: true, ignored: true });
    expect(procesados).toHaveLength(0);
  });
});
