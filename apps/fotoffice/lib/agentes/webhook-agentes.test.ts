import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: {} }));
vi.mock("./periodista/flujo", () => ({
  correrPeriodista: vi.fn(),
  publicarPropuesta: vi.fn(),
  descartarPropuesta: vi.fn(),
  corregirPropuesta: vi.fn(),
}));
vi.mock("./vendedor/modelos", () => ({
  procesarBotonVendedor: vi.fn(),
  corregirVendedor: vi.fn(),
  esMensajeDelVendedor: vi.fn(async () => false),
}));

const { procesarUpdateAgentes } = await import("./webhook-agentes");
import type { CanalAgentes } from "./canal-reglas";

const TOKEN = "123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw";
const ID = "ckpropuesta00000000000001";
const canal: CanalAgentes = {
  botId: "1",
  botUsername: "dnx_agentes_bot",
  chatId: "555",
  chatNombre: "Daniel",
  webhookSecretHash: "a".repeat(64),
  linkCode: null,
  linkCodeExpiresAt: null,
  linkedAt: "2026-11-07T12:00:00.000Z",
};

function botApi() {
  const llamadas: { metodo: string; cuerpo: Record<string, unknown> }[] = [];
  const f = (async (url: string, init?: RequestInit) => {
    llamadas.push({ metodo: String(url).split("/").pop()!, cuerpo: JSON.parse(String(init?.body ?? "{}")) });
    return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 });
  }) as typeof fetch;
  return { f, llamadas };
}

const boton = (data: string, de = "555") => ({ tipo: "BOTON" as const, callbackId: "cb", chatId: de, deId: de, messageId: "77", data });

function deps() {
  const api = botApi();
  const d = {
    fetch: api.f,
    token: TOKEN,
    publicar: vi.fn(async () => ({ ok: true, texto: "✅ Aprobada: sale publicada hoy a las 11:00." })),
    descartar: vi.fn(async () => ({ ok: true, texto: "❌ Descartada." })),
    correr: vi.fn(async () => ({ estado: "CREADA" as const, mensaje: "ok" })),
    corregir: vi.fn(async () => undefined),
    vincular: vi.fn(async () => undefined),
  };
  return { api, d };
}

describe("procesarUpdateAgentes", () => {
  it("Publicar desde el chat vinculado: aprueba, saca los botones y lo confirma", async () => {
    const { api, d } = deps();
    await procesarUpdateAgentes(canal, boton(`pe:p:${ID}`), d);
    expect(d.publicar).toHaveBeenCalledWith(ID);
    expect(api.llamadas.map((l) => l.metodo)).toEqual(["answerCallbackQuery", "editMessageReplyMarkup", "sendMessage"]);
    expect(api.llamadas[1]!.cuerpo).toMatchObject({ chat_id: "555", message_id: 77, reply_markup: { inline_keyboard: [] } });
  });

  it("Otra noticia: descarta y vuelve a correr con forzar", async () => {
    const { d } = deps();
    await procesarUpdateAgentes(canal, boton(`pe:o:${ID}`), d);
    expect(d.descartar).toHaveBeenCalledWith(ID, { otra: true });
    expect(d.correr).toHaveBeenCalledWith({ motivo: "OTRA", forzar: true }, undefined);
  });

  it("si la corrida nueva choca con el tope, se lo cuenta", async () => {
    const { api, d } = deps();
    d.correr.mockResolvedValueOnce({ estado: "TOPE" as never, mensaje: "El Periodista ya corrió 3 veces hoy" });
    await procesarUpdateAgentes(canal, boton(`pe:o:${ID}`), d);
    expect(String(api.llamadas.at(-1)!.cuerpo.text)).toContain("3 veces");
  });

  it("botones o respuestas de otro chat: silencio total", async () => {
    const { api, d } = deps();
    await procesarUpdateAgentes(canal, boton(`pe:p:${ID}`, "666"), d);
    await procesarUpdateAgentes(canal, { tipo: "RESPUESTA", chatId: "666", chatPrivado: true, deId: "666", messageId: "5", respondeA: "77", texto: "publicá" }, d);
    expect(d.publicar).not.toHaveBeenCalled();
    expect(d.corregir).not.toHaveBeenCalled();
    expect(api.llamadas).toHaveLength(0);
  });

  it("una respuesta del chat vinculado es una corrección", async () => {
    const { d } = deps();
    await procesarUpdateAgentes(canal, { tipo: "RESPUESTA", chatId: "555", chatPrivado: true, deId: "555", messageId: "5", respondeA: "77", texto: "más corto" }, d);
    expect(d.corregir).toHaveBeenCalledWith("77", "más corto", undefined);
  });

  it("un botón que no es del Periodista se contesta sin hacer nada", async () => {
    const { api, d } = deps();
    await procesarUpdateAgentes(canal, boton("ap:ckaprobacion0001"), d);
    expect(d.publicar).not.toHaveBeenCalled();
    expect(api.llamadas.map((l) => l.metodo)).toEqual(["answerCallbackQuery"]);
  });

  it("/start va al vínculo; sin token no hace nada", async () => {
    const { d } = deps();
    const start = { tipo: "START" as const, chatId: "555", chatPrivado: true, codigo: "ABCD234567", nombre: "Daniel" };
    await procesarUpdateAgentes(canal, start, d);
    expect(d.vincular).toHaveBeenCalledOnce();
    const sinToken = deps();
    await procesarUpdateAgentes(canal, boton(`pe:p:${ID}`), { ...sinToken.d, token: null });
    expect(sinToken.d.publicar).not.toHaveBeenCalled();
  });

  describe("Vendedor (ve:)", () => {
    const MODELO = "cmh7x2k9a0001qz8w3e5r6t7y";
    function conVendedor(delVendedor = true) {
      const { api, d } = deps();
      const vendedor = {
        boton: vi.fn(async () => ({ ok: true, texto: "✅ Aprobado." })),
        corregir: vi.fn(async () => undefined),
        esDelVendedor: vi.fn(async () => delVendedor),
      };
      return { api, d: { ...d, vendedor } };
    }
    const respuesta = (de = "555") => ({ tipo: "RESPUESTA" as const, chatId: de, chatPrivado: true, deId: de, messageId: "5", respondeA: "77", texto: "más corto" });

    it("ve:a aprueba y no toca las propuestas del Periodista", async () => {
      const { api, d } = conVendedor();
      await procesarUpdateAgentes(canal, boton(`ve:a:${MODELO}`), d);
      expect(d.vendedor.boton).toHaveBeenCalledWith({ accion: "APROBAR", id: MODELO }, undefined);
      expect(d.publicar).not.toHaveBeenCalled();
      expect(d.descartar).not.toHaveBeenCalled();
      expect(d.correr).not.toHaveBeenCalled();
      expect(api.llamadas.map((l) => l.metodo)).toEqual(["answerCallbackQuery", "editMessageReplyMarkup", "sendMessage"]);
      expect(api.llamadas[0]!.cuerpo).toMatchObject({ text: "✅ Aprobado." });
    });

    it("un ve: que no sale bien deja los botones", async () => {
      const { api, d } = conVendedor();
      d.vendedor.boton.mockResolvedValueOnce({ ok: false, texto: "Ese modelo ya no está propuesto." });
      await procesarUpdateAgentes(canal, boton(`ve:d:${MODELO}`), d);
      expect(d.vendedor.boton).toHaveBeenCalledWith({ accion: "DESCARTAR", id: MODELO }, undefined);
      expect(api.llamadas.map((l) => l.metodo)).toEqual(["answerCallbackQuery"]);
    });

    it("pe:p sigue publicando igual", async () => {
      const { api, d } = conVendedor();
      await procesarUpdateAgentes(canal, boton(`pe:p:${ID}`), d);
      expect(d.publicar).toHaveBeenCalledWith(ID);
      expect(d.vendedor.boton).not.toHaveBeenCalled();
      expect(api.llamadas.map((l) => l.metodo)).toEqual(["answerCallbackQuery", "editMessageReplyMarkup", "sendMessage"]);
    });

    it("ve:c sólo pide responder al mensaje", async () => {
      const { api, d } = conVendedor();
      await procesarUpdateAgentes(canal, boton(`ve:c:${MODELO}`), d);
      expect(d.vendedor.boton).not.toHaveBeenCalled();
      expect(d.vendedor.corregir).not.toHaveBeenCalled();
      expect(api.llamadas).toHaveLength(1);
      expect(api.llamadas[0]).toMatchObject({ metodo: "answerCallbackQuery", cuerpo: { text: "Respondé a este mensaje con lo que querés cambiar." } });
    });

    it("responder a un mensaje del Vendedor corrige el Vendedor, no el Periodista", async () => {
      const { d } = conVendedor(true);
      await procesarUpdateAgentes(canal, respuesta(), d);
      expect(d.vendedor.esDelVendedor).toHaveBeenCalledWith("77");
      expect(d.vendedor.corregir).toHaveBeenCalledWith("77", "más corto", undefined);
      expect(d.corregir).not.toHaveBeenCalled();

      const otro = conVendedor(false);
      await procesarUpdateAgentes(canal, respuesta(), otro.d);
      expect(otro.d.corregir).toHaveBeenCalledWith("77", "más corto", undefined);
      expect(otro.d.vendedor.corregir).not.toHaveBeenCalled();
    });

    it("si no se puede saber de quién es el mensaje, corrige el Periodista", async () => {
      const { d } = conVendedor();
      d.vendedor.esDelVendedor.mockRejectedValueOnce(new Error("falta la tabla"));
      await procesarUpdateAgentes(canal, respuesta(), d);
      expect(d.corregir).toHaveBeenCalledWith("77", "más corto", undefined);
      expect(d.vendedor.corregir).not.toHaveBeenCalled();
    });

    it("un ve: de otro chat se ignora", async () => {
      const { api, d } = conVendedor();
      await procesarUpdateAgentes(canal, boton(`ve:a:${MODELO}`, "666"), d);
      await procesarUpdateAgentes(canal, respuesta("666"), d);
      expect(d.vendedor.boton).not.toHaveBeenCalled();
      expect(d.vendedor.esDelVendedor).not.toHaveBeenCalled();
      expect(d.vendedor.corregir).not.toHaveBeenCalled();
      expect(api.llamadas).toHaveLength(0);
    });
  });
});
