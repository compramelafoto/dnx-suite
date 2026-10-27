import { describe, expect, it } from "vitest";
import { historialParaElBot, type MensajeChat } from "./historial";

const cli = (texto: string | null, tipo = "TEXTO"): MensajeChat => ({ direccion: "ENTRANTE", autor: "CLIENTE", tipo, texto });
const bot = (texto: string): MensajeChat => ({ direccion: "SALIENTE", autor: "BOT", tipo: "TEXTO", texto });
const sis = (texto: string): MensajeChat => ({ direccion: "SISTEMA", autor: "SISTEMA", tipo: "TEXTO", texto });

describe("historialParaElBot", () => {
  it("el bloque final del cliente es el texto del turno; lo anterior, el historial", () => {
    const r = historialParaElBot([cli("hola"), bot("¡Hola! ¿En qué te ayudo?"), cli("quiero digitalizar VHS"), cli("son 3")]);
    expect(r).toEqual({
      history: [
        { role: "user", content: "hola" },
        { role: "assistant", content: "¡Hola! ¿En qué te ayudo?" },
      ],
      userText: "quiero digitalizar VHS\nson 3",
    });
  });

  it("omite los mensajes del sistema y une los del mismo rol", () => {
    const r = historialParaElBot([cli("hola"), sis("Tomó el chat Camila"), { direccion: "SALIENTE", autor: "USUARIO", tipo: "TEXTO", texto: "Hola, soy Camila" }, bot("Te ayudo"), cli("gracias")]);
    expect(r?.history).toEqual([
      { role: "user", content: "hola" },
      { role: "assistant", content: "Hola, soy Camila\nTe ayudo" },
    ]);
    expect(r?.userText).toBe("gracias");
  });

  it("si lo último no es del cliente, no hay nada que responder", () => {
    expect(historialParaElBot([cli("hola"), bot("¡Hola!")])).toBeNull();
    expect(historialParaElBot([])).toBeNull();
  });

  it("describe lo que no es texto", () => {
    const r = historialParaElBot([cli(null, "IMAGEN"), cli("esta foto en 15x21", "IMAGEN"), cli(null, "AUDIO")]);
    expect(r?.userText).toBe("[el cliente mandó una foto]\n[el cliente mandó una foto] esta foto en 15x21\n[el cliente mandó un audio]");
  });

  it("una foto bajada dice su resolución y hasta qué medida alcanza", () => {
    const foto = { direccion: "ENTRANTE", autor: "CLIENTE", tipo: "IMAGEN", texto: null, media: { id: "1", descarga: "LISTO", ancho: 1600, alto: 1200 } };
    expect(historialParaElBot([foto])?.userText).toBe(
      "[el cliente mandó una foto de 1600×1200 px; alcanza para imprimir hasta: 10x15, 13x18, 15x20, 15x21]",
    );
    const chica = { ...foto, media: { id: "1", descarga: "LISTO", ancho: 300, alto: 200 } };
    expect(historialParaElBot([chica])?.userText).toBe("[el cliente mandó una foto de 300×200 px; no alcanza para imprimir]");
  });

  it("una foto mandada como documento también dice su resolución", () => {
    const doc = { direccion: "ENTRANTE", autor: "CLIENTE", tipo: "DOCUMENTO", texto: null, media: { id: "1", mimeType: "image/jpeg", descarga: "LISTO", ancho: 4000, alto: 3000 } };
    expect(historialParaElBot([doc])?.userText).toMatch(/^\[el cliente mandó la foto original \(como documento\) de 4000×3000 px; alcanza para imprimir hasta: .*30x45\]$/);
  });

  it("si no se pudo bajar o es muy grande, lo dice", () => {
    const fallo = { direccion: "ENTRANTE", autor: "CLIENTE", tipo: "IMAGEN", texto: null, media: { id: "1", descarga: "FALLO" } };
    expect(historialParaElBot([fallo])?.userText).toBe("[el cliente mandó una foto pero no se pudo bajar: pedile que la reenvíe]");
    const grande = { ...fallo, tipo: "VIDEO", media: { id: "1", descarga: "GRANDE" } };
    expect(historialParaElBot([grande])?.userText).toBe("[el cliente mandó un archivo de más de 100 MB que no se pudo guardar]");
  });

  it("el historial empieza con el cliente y respeta el máximo", () => {
    const r = historialParaElBot([bot("Hola"), cli("a"), bot("b"), cli("c"), bot("d"), cli("e")], 3);
    expect(r?.history[0].role).toBe("user");
    expect(r?.history).toEqual([
      { role: "user", content: "c" },
      { role: "assistant", content: "d" },
    ]);
    expect(r?.userText).toBe("e");
  });
});
