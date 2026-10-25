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
