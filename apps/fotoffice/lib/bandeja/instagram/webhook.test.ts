import { describe, expect, it } from "vitest";
import { leerWebhookInstagram } from "./webhook";
import texto from "./__fixtures__/texto.json";
import imagen from "./__fixtures__/imagen.json";
import eco from "./__fixtures__/eco.json";
import anuncio from "./__fixtures__/anuncio.json";
import historia from "./__fixtures__/historia.json";
import borrado from "./__fixtures__/borrado.json";
import reaccion from "./__fixtures__/reaccion.json";

const CUENTA = "17841400000000001";
/** Arma un aviso con un solo ítem de `messaging`. */
const aviso = (item: unknown, id: string | undefined = CUENTA) => ({ object: "instagram", entry: [{ id, messaging: [item] }] });
const base = { sender: { id: "5550001" }, recipient: { id: CUENTA }, timestamp: 1700000000123 };

describe("leerWebhookInstagram", () => {
  it("texto entrante", () => {
    expect(leerWebhookInstagram(texto)).toEqual([{
      tipo: "ENTRANTE", canal: "INSTAGRAM", phoneNumberId: CUENTA, waId: "5550001", waMessageId: "m_texto",
      en: new Date(1700000000123), nombre: null, mensajeTipo: "TEXTO", texto: "Hola, quiero una cotización", media: null,
    }]);
  });
  it("la hora viene en milisegundos", () => {
    expect(leerWebhookInstagram(texto)[0].en?.toISOString()).toBe("2023-11-14T22:13:20.123Z");
  });
  it("imagen con url", () => {
    const [e] = leerWebhookInstagram(imagen);
    expect(e).toMatchObject({ mensajeTipo: "IMAGEN", texto: null, media: { url: "https://cdn.example/foto.jpg" } });
  });
  it.each([["audio", "AUDIO"], ["video", "VIDEO"], ["file", "DOCUMENTO"], ["share", "OTRO"], ["raro", "OTRO"]])("adjunto %s → %s", (t, esperado) => {
    const [e] = leerWebhookInstagram(aviso({ ...base, message: { mid: "m1", attachments: [{ type: t, payload: { url: "https://x/y" } }] } }));
    expect(e).toMatchObject({ mensajeTipo: esperado, media: { url: "https://x/y" } });
  });
  it("varios adjuntos: un evento por adjunto y el texto va en el primero", () => {
    const r = leerWebhookInstagram(aviso({ ...base, message: { mid: "m1", text: "mirá", attachments: [
      { type: "image", payload: { url: "https://x/1" } }, { type: "image", payload: { url: "https://x/2" } }, { type: "video", payload: { url: "https://x/3" } },
    ] } }));
    expect(r.map((e) => e.tipo === "ENTRANTE" && e.waMessageId)).toEqual(["m1", "m1:1", "m1:2"]);
    expect(r.map((e) => e.tipo === "ENTRANTE" && e.texto)).toEqual(["mirá", null, null]);
    expect(r.map((e) => e.tipo === "ENTRANTE" && e.media?.url)).toEqual(["https://x/1", "https://x/2", "https://x/3"]);
  });
  it("eco: el cliente es el destinatario y trae appId", () => {
    expect(leerWebhookInstagram(eco)).toEqual([{
      tipo: "ECO", canal: "INSTAGRAM", phoneNumberId: CUENTA, waId: "5550001", waMessageId: "m_eco",
      en: new Date(1700000005000), mensajeTipo: "TEXTO", texto: "Te paso el precio", media: { appId: "123456" },
    }]);
  });
  it("eco sin app_id no inventa media", () => {
    const [e] = leerWebhookInstagram(aviso({ sender: { id: CUENTA }, recipient: { id: "5550001" }, timestamp: 1, message: { mid: "e1", text: "hi", is_echo: true } }));
    expect(e).toMatchObject({ tipo: "ECO", waId: "5550001", media: null });
  });
  it("respuesta a una historia", () => {
    expect(leerWebhookInstagram(historia)[0]).toMatchObject({ mensajeTipo: "TEXTO", texto: "[respondió a tu historia] Qué linda!" });
  });
  it("mención en una historia", () => {
    const [e] = leerWebhookInstagram(aviso({ ...base, message: { mid: "m1", attachments: [{ type: "story_mention", payload: { url: "https://x/s" } }] } }));
    expect(e).toMatchObject({ mensajeTipo: "OTRO", texto: "[te mencionó en una historia]", media: { url: "https://x/s" } });
  });
  it("anuncio igual que anuncioDeReferral", () => {
    const [e] = leerWebhookInstagram(anuncio);
    expect(e).toMatchObject({ texto: "Info por favor", media: { anuncio: { id: "ad_99", tipo: "ad", titulo: "Sesión de 15 años", texto: "Reservá tu fecha" } } });
  });
  it("referral al costado del mensaje también cuenta", () => {
    const [e] = leerWebhookInstagram(aviso({ ...base, referral: { source_id: "ad_1", source_type: "ad", headline: "Promo" }, message: { mid: "m1", text: "hola" } }));
    expect(e).toMatchObject({ media: { anuncio: { id: "ad_1", titulo: "Promo" } } });
  });
  it("mensaje no soportado: llega como OTRO sin texto", () => {
    const [e] = leerWebhookInstagram(aviso({ ...base, message: { mid: "m1", is_unsupported: true } }));
    expect(e).toMatchObject({ tipo: "ENTRANTE", mensajeTipo: "OTRO", texto: null });
  });
  it("sin entry.id usa el destinatario (entrante) o el remitente (eco)", () => {
    expect(leerWebhookInstagram(aviso({ ...base, message: { mid: "m1", text: "a" } }, undefined))[0].phoneNumberId).toBe(CUENTA);
    const eco2 = { sender: { id: CUENTA }, recipient: { id: "5550001" }, timestamp: 1, message: { mid: "e1", text: "a", is_echo: true } };
    expect(leerWebhookInstagram(aviso(eco2, undefined))[0].phoneNumberId).toBe(CUENTA);
  });
  it("sin mid o sin timestamp legible", () => {
    expect(leerWebhookInstagram(aviso({ ...base, message: { text: "sin mid" } }))).toEqual([]);
    expect(leerWebhookInstagram(aviso({ ...base, timestamp: "x", message: { mid: "m1", text: "a" } }))[0].en).toBeNull();
  });
  it("borrado, reacción, visto, referral suelto y basura → nada", () => {
    expect(leerWebhookInstagram(borrado)).toEqual([]);
    expect(leerWebhookInstagram(reaccion)).toEqual([]);
    expect(leerWebhookInstagram(aviso({ ...base, read: { mid: "m1" } }))).toEqual([]);
    expect(leerWebhookInstagram(aviso({ ...base, referral: { source_id: "a", headline: "x" } }))).toEqual([]);
    for (const x of [null, undefined, "roto", 5, [], {}, { entry: "no" }, { object: "instagram", entry: [null, { messaging: [1, null] }] }]) {
      expect(leerWebhookInstagram(x)).toEqual([]);
    }
  });
});
