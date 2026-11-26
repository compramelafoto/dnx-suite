import { describe, expect, it } from "vitest";
import { avisoDeMensaje, botonesDelChat, botonesDerivar, escapar, leerBotonBandeja, tarjetaDeDerivacion } from "./telegram-puro";

const ID = "cmv5z6qxwwmmhf0q5gp8qja1j"; // 25 caracteres, como un cuid real

describe("escapar", () => {
  it("escapa el HTML de Telegram", () => expect(escapar("a <b> & \"c\"")).toBe("a &lt;b&gt; &amp; \"c\""));
});

describe("tarjetaDeDerivacion", () => {
  it("dice quién derivó, el cliente, el resumen, los últimos mensajes, la espera y la ventana en hora argentina", () => {
    const t = tarjetaDeDerivacion({
      quien: "Sabina", titulo: "María <López>", canal: "WHATSAPP", campana: null, resumen: "Quiere XV el 14/2.",
      ultimos: [{ deCliente: true, autor: null, texto: "¿Incluye video?" }, { deCliente: false, autor: "Sabina", texto: "Te consulto" }],
      esperaMinutos: 8, ventanaHasta: new Date("2026-11-24T18:40:00.000Z"),
    });
    expect(t).toContain("📥 <b>Sabina te derivó un chat</b>");
    expect(t).toContain("María &lt;López&gt; · WhatsApp");
    expect(t).toContain("Resumen: Quiere XV el 14/2.");
    expect(t).toContain("👤 ¿Incluye video?");
    expect(t).toContain("🏢 (Sabina) Te consulto");
    expect(t).toContain("⏱ espera hace 8 min · ventana de 24 h abierta hasta 15:40");
  });
  it("sin resumen ni ventana lo dice", () => {
    const t = tarjetaDeDerivacion({ quien: null, titulo: "Juan", canal: "INSTAGRAM", campana: "XV Nov", resumen: null, ultimos: [], esperaMinutos: null, ventanaHasta: null });
    expect(t).toContain("📥 <b>Te asignaron un chat</b>");
    expect(t).toContain("Juan · Instagram · Campaña XV Nov");
    expect(t).toContain("ventana de 24 h cerrada");
    expect(t).not.toContain("Resumen:");
  });
});

describe("avisoDeMensaje", () => {
  it("texto o archivo", () => {
    expect(avisoDeMensaje("María", "TEXTO", "hola <3")).toBe("💬 <b>María</b>: hola &lt;3");
    expect(avisoDeMensaje("María", "IMAGEN", null)).toBe("📷 <b>María</b> mandó una foto");
    expect(avisoDeMensaje("María", "AUDIO", null)).toBe("🎤 <b>María</b> mandó un audio");
  });
});

describe("botones", () => {
  it("todos los callback_data entran en 64 bytes con ids reales", () => {
    const teclados = [botonesDelChat(ID, "https://x/bandeja/" + ID), botonesDerivar(ID, [{ userId: 1234567890, nombre: "Camila" }])];
    for (const t of teclados) for (const fila of t.inline_keyboard) for (const b of fila) if ("callback_data" in b) expect(Buffer.byteLength(b.callback_data)).toBeLessThanOrEqual(64);
  });
  it("se leen de vuelta y rechazan lo inventado", () => {
    expect(leerBotonBandeja(`bj:dv:${ID}`)).toEqual({ accion: "dv", chatId: ID });
    expect(leerBotonBandeja(`bj:bk:${ID}`)).toEqual({ accion: "bk", chatId: ID });
    expect(leerBotonBandeja(`bj:r:${ID}`)).toEqual({ accion: "r", chatId: ID });
    expect(leerBotonBandeja(`bj:d:${ID}:7`)).toEqual({ accion: "d", chatId: ID, destino: 7 });
    expect(leerBotonBandeja(`bj:d:${ID}:bot`)).toEqual({ accion: "d", chatId: ID, destino: "bot" });
    expect(leerBotonBandeja(`bj:t:${ID}`)).toEqual({ accion: "t", avisoId: ID });
    for (const malo of ["ap:123", "bj:x:abc", `bj:d:${ID}:-1`, `bj:d:${ID}:0`, "bj:r:", "bj:r:a b", `bj:d:${ID}:7:8`]) expect(leerBotonBandeja(malo)).toBeNull();
  });
});
