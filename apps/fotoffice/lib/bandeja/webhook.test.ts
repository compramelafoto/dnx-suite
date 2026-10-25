import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { firmaValida, leerWebhook } from "./webhook";

const fixture = (n: string): unknown => JSON.parse(readFileSync(join(__dirname, "__fixtures__", n), "utf8"));

describe("leerWebhook", () => {
  it("texto entrante: waId, nombre del perfil, hora y texto", () => {
    expect(leerWebhook(fixture("texto.json"))).toEqual([
      {
        tipo: "ENTRANTE", phoneNumberId: "106540352242922", waMessageId: "wamid.HBgNNTQ5MzQxMzQxOTg2ORUCABIYFjNFQjBDQTE1",
        waId: "5493413419869", nombre: "Lucía Pérez", en: new Date(1791558000 * 1000),
        mensajeTipo: "TEXTO", texto: "Hola, quería consultar por una sesión de fotos", media: null,
      },
    ]);
  });

  it("imagen con caption: el caption es el texto y el archivo queda en media", () => {
    const [e] = leerWebhook(fixture("imagen-con-caption.json"));
    expect(e).toMatchObject({
      tipo: "ENTRANTE", mensajeTipo: "IMAGEN", texto: "Así quiero el fondo",
      media: { id: "1234567890", mimeType: "image/jpeg", caption: "Así quiero el fondo" },
    });
  });

  it("estados: sent/delivered/read/failed con código de error; los desconocidos se ignoran", () => {
    const e = leerWebhook(fixture("estados.json"));
    expect(e).toHaveLength(3);
    expect(e[0]).toMatchObject({ tipo: "ESTADO", waMessageId: "wamid.OUT0001", estado: "ENTREGADO", errorCodigo: null });
    expect(e[1]).toMatchObject({ estado: "LEIDO" });
    expect(e[2]).toMatchObject({ estado: "FALLO", errorCodigo: "131047" });
  });

  it("eco: el cliente es el 'to', no el 'from'", () => {
    expect(leerWebhook(fixture("eco.json"))).toEqual([
      {
        tipo: "ECO", phoneNumberId: "106540352242922", waMessageId: "wamid.ECO0001", waId: "5493413419869",
        en: new Date(1791558200 * 1000), mensajeTipo: "TEXTO", texto: "Hola Lucía, ya te contesto", media: null,
      },
    ]);
  });

  it("lo desconocido: cambios ajenos se ignoran; tipo raro es OTRO; hora ilegible es null", () => {
    const e = leerWebhook(fixture("desconocido.json"));
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ tipo: "ENTRANTE", mensajeTipo: "OTRO", texto: null, en: null });
  });

  it("el móvil argentino sin 9 que manda Meta se unifica con el 9", () => {
    const json = structuredClone(fixture("texto.json")) as { entry: { changes: { value: { messages: { from: string }[] } }[] }[] };
    json.entry[0].changes[0].value.messages[0].from = "543413419869";
    expect(leerWebhook(json)[0]).toMatchObject({ waId: "5493413419869" });
  });

  it("sticker es IMAGEN; la reacción se ignora por completo (también como eco)", () => {
    const json = { entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "1" }, messages: [
      { from: "5493413419869", id: "w1", timestamp: "1", type: "sticker", sticker: { id: "55", mime_type: "image/webp" } },
      { from: "5493413419869", id: "w2", timestamp: "2", type: "reaction", reaction: { message_id: "w0", emoji: "👍" } },
    ] } }, { field: "smb_message_echoes", value: { metadata: { phone_number_id: "1" }, message_echoes: [
      { to: "5493413419869", id: "w3", timestamp: "3", type: "reaction", reaction: { message_id: "w0", emoji: "👍" } },
    ] } }] }] };
    const e = leerWebhook(json);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ tipo: "ENTRANTE", waMessageId: "w1", mensajeTipo: "IMAGEN", media: { id: "55", mimeType: "image/webp" } });
  });

  it("ubicación", () => {
    const json = { entry: [{ changes: [{ field: "messages", value: { metadata: { phone_number_id: "1" }, messages: [
      { from: "5493413419869", id: "w1", timestamp: "1", type: "location", location: { latitude: -32.9, longitude: -60.6, name: "Estudio" } },
    ] } }] }] };
    expect(leerWebhook(json)[0]).toMatchObject({ mensajeTipo: "UBICACION", texto: "Estudio", media: { latitude: -32.9, longitude: -60.6, nombre: "Estudio" } });
  });

  it.each([[null], [undefined], ["x"], [42], [[]], [{}], [{ entry: "x" }], [{ entry: [null, 3, { changes: [null, { value: 5 }] }] }]])(
    "basura %j -> lista vacía sin lanzar", (entrada) => {
      expect(leerWebhook(entrada)).toEqual([]);
    },
  );
});

describe("firmaValida", () => {
  const cuerpo = '{"hola":"mundo"}';
  const firma = (c: string, s: string) => `sha256=${createHmac("sha256", s).update(c).digest("hex")}`;

  it("acepta la firma correcta", () => expect(firmaValida(cuerpo, firma(cuerpo, "secreto"), "secreto")).toBe(true));
  it("rechaza otro secreto, otro cuerpo, sin prefijo, sin firma o de otro largo", () => {
    expect(firmaValida(cuerpo, firma(cuerpo, "otro"), "secreto")).toBe(false);
    expect(firmaValida(cuerpo + " ", firma(cuerpo, "secreto"), "secreto")).toBe(false);
    expect(firmaValida(cuerpo, firma(cuerpo, "secreto").slice(7), "secreto")).toBe(false);
    expect(firmaValida(cuerpo, null, "secreto")).toBe(false);
    expect(firmaValida(cuerpo, "sha256=abc", "secreto")).toBe(false);
    expect(firmaValida(cuerpo, "", "secreto")).toBe(false);
  });
});
