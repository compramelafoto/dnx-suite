import { describe, expect, it } from "vitest";
import {
  VENTANA_HORAS,
  alDevolver,
  alEco,
  alEntrante,
  alResolver,
  alResponderDesdePanel,
  alTomar,
  atiendeElBot,
  puedeResponderLibre,
  type EstadoChat,
} from "./reglas";

const AHORA = new Date("2026-10-09T15:00:00.000Z");
const h = (n: number) => new Date(AHORA.getTime() + n * 3600_000);
const chat = (p: Partial<EstadoChat> = {}): EstadoChat => ({
  estado: "BOT", asignadoUserId: null, botPausadoHasta: null, ultimoEntranteEn: null, ...p,
});

describe("atiendeElBot", () => {
  it("BOT: sí", () => expect(atiendeElBot(chat(), AHORA)).toBe(true));
  it("RESUELTO: no", () => expect(atiendeElBot(chat({ estado: "RESUELTO" }), AHORA)).toBe(false));
  it("HUMANO sin asignar y pausa vigente: no", () => {
    expect(atiendeElBot(chat({ estado: "HUMANO", botPausadoHasta: h(1) }), AHORA)).toBe(false);
  });
  it("HUMANO sin asignar y pausa vencida: sí", () => {
    expect(atiendeElBot(chat({ estado: "HUMANO", botPausadoHasta: h(-1) }), AHORA)).toBe(true);
  });
  it("HUMANO sin asignar y sin pausa registrada: no atiende el bot (a falla, calla)", () => {
    expect(atiendeElBot(chat({ estado: "HUMANO" }), AHORA)).toBe(false);
  });
  it("HUMANO asignado nunca vuelve solo, aunque la pausa haya vencido", () => {
    expect(atiendeElBot(chat({ estado: "HUMANO", asignadoUserId: 7, botPausadoHasta: h(-100) }), AHORA)).toBe(false);
  });
  it("pausa que vence justo ahora: ya vencida", () => {
    expect(atiendeElBot(chat({ estado: "HUMANO", botPausadoHasta: AHORA }), AHORA)).toBe(true);
  });
});

describe("puedeResponderLibre (ventana de 24 h)", () => {
  it("sin entrante: no", () => expect(puedeResponderLibre(chat(), AHORA)).toBe(false));
  it("hace 23 h 59 min: sí", () => {
    expect(puedeResponderLibre(chat({ ultimoEntranteEn: new Date(AHORA.getTime() - (24 * 60 - 1) * 60_000) }), AHORA)).toBe(true);
  });
  it("hace exactamente 24 h: no", () => {
    expect(puedeResponderLibre(chat({ ultimoEntranteEn: h(-VENTANA_HORAS) }), AHORA)).toBe(false);
  });
  it("hace 25 h: no", () => expect(puedeResponderLibre(chat({ ultimoEntranteEn: h(-25) }), AHORA)).toBe(false));
});

describe("alEntrante", () => {
  it("siempre registra la hora del entrante", () => {
    expect(alEntrante(chat(), AHORA).parche.ultimoEntranteEn).toEqual(AHORA);
  });
  it("en BOT no cambia el estado ni genera mensaje de sistema", () => {
    const r = alEntrante(chat(), AHORA);
    expect(r.parche.estado).toBeUndefined();
    expect(r.sistema).toBeUndefined();
  });
  it("RESUELTO sin asignado se reabre en BOT", () => {
    const r = alEntrante(chat({ estado: "RESUELTO" }), AHORA);
    expect(r.parche.estado).toBe("BOT");
    expect(r.sistema?.texto).toBe("Se reabrió con un mensaje nuevo");
  });
  it("RESUELTO con asignado se reabre en HUMANO y conserva al responsable", () => {
    const r = alEntrante(chat({ estado: "RESUELTO", asignadoUserId: 3 }), AHORA);
    expect(r.parche.estado).toBe("HUMANO");
    expect(r.parche.asignadoUserId).toBeUndefined();
    expect(r.sistema?.texto).toBe("Se reabrió con un mensaje nuevo");
  });
  it("HUMANO tomado sigue igual", () => {
    const r = alEntrante(chat({ estado: "HUMANO", asignadoUserId: 3 }), AHORA);
    expect(r.parche.estado).toBeUndefined();
    expect(r.sistema).toBeUndefined();
  });
});

describe("alEco (respuesta desde el celular)", () => {
  it("pasa a HUMANO con pausa de N horas y no cambia al asignado", () => {
    const r = alEco(chat({ asignadoUserId: 4 }), AHORA, "Hola, ya te contesto", 4);
    expect(r.parche).toEqual({ estado: "HUMANO", botPausadoHasta: h(4) });
    expect("asignadoUserId" in r.parche).toBe(false);
    expect(r.sistema).toBeUndefined();
  });
  it("usa las horas configuradas", () => {
    expect(alEco(chat(), AHORA, "ok", 1).parche.botPausadoHasta).toEqual(h(1));
  });
  it("'#bot' devuelve al bot sin pausa y deja mensaje de sistema", () => {
    const r = alEco(chat({ estado: "HUMANO", botPausadoHasta: h(2) }), AHORA, "#bot", 4);
    expect(r.parche).toEqual({ estado: "BOT", botPausadoHasta: null, asignadoUserId: null });
    expect(r.sistema?.texto).toBe("Devuelto al bot desde el celular");
  });
  it("'#bot' tolera espacios y mayúsculas, y texto después", () => {
    expect(alEco(chat(), AHORA, "  #BOT  ", 4).parche.estado).toBe("BOT");
    expect(alEco(chat(), AHORA, "#bot gracias", 4).parche.estado).toBe("BOT");
  });
  it("'#botella' no es '#bot'", () => {
    expect(alEco(chat(), AHORA, "#botella", 4).parche.estado).toBe("HUMANO");
  });
  it("eco sin texto (foto, audio) también pausa", () => {
    expect(alEco(chat(), AHORA, null, 4).parche.estado).toBe("HUMANO");
  });
  it("eco en un chat RESUELTO lo reabre y deja constancia", () => {
    const r = alEco(chat({ estado: "RESUELTO" }), AHORA, "hola", 4);
    expect(r.parche).toEqual({ estado: "HUMANO", botPausadoHasta: h(4) });
    expect(r.sistema?.texto).toBe("Se reabrió desde el celular");
  });
  it("eco en un chat que no estaba resuelto no deja mensaje de sistema", () => {
    expect(alEco(chat({ estado: "BOT" }), AHORA, "hola", 4).sistema).toBeUndefined();
  });
});

describe("alTomar / alDevolver / alResolver", () => {
  it("tomar: HUMANO, asignado, sin pausa, y deja constancia con el nombre", () => {
    const r = alTomar(chat({ botPausadoHasta: h(2) }), 9, "Camila");
    expect(r.parche).toEqual({ estado: "HUMANO", asignadoUserId: 9, botPausadoHasta: null });
    expect(r.sistema?.texto).toBe("Camila tomó el chat");
  });
  it("devolver al bot: BOT, sin asignado ni pausa", () => {
    const r = alDevolver(9, "Camila");
    expect(r.parche).toEqual({ estado: "BOT", asignadoUserId: null, botPausadoHasta: null });
    expect(r.sistema?.texto).toBe("Camila devolvió el chat al bot");
  });
  it("resolver: RESUELTO", () => {
    const r = alResolver(9, "Sabina");
    expect(r.parche).toEqual({ estado: "RESUELTO" });
    expect(r.sistema?.texto).toBe("Sabina marcó el chat como resuelto");
  });
});

describe("alResponderDesdePanel", () => {
  it("sin haberlo tomado lo toma automáticamente", () => {
    const r = alResponderDesdePanel(chat(), 9, "Camila");
    expect(r.parche).toEqual({ estado: "HUMANO", asignadoUserId: 9, botPausadoHasta: null });
    expect(r.sistema?.texto).toBe("Camila tomó el chat");
  });
  it("RESUELTO también se toma", () => {
    expect(alResponderDesdePanel(chat({ estado: "RESUELTO" }), 9, "Camila").parche.estado).toBe("HUMANO");
  });
  it("si ya lo tiene esa persona no cambia nada", () => {
    const r = alResponderDesdePanel(chat({ estado: "HUMANO", asignadoUserId: 9 }), 9, "Camila");
    expect(r.parche).toEqual({});
    expect(r.sistema).toBeUndefined();
  });
  it("si lo tiene otra persona, responder lo toma para quien responde", () => {
    const r = alResponderDesdePanel(chat({ estado: "HUMANO", asignadoUserId: 4 }), 9, "Camila");
    expect(r.parche.asignadoUserId).toBe(9);
    expect(r.sistema?.texto).toBe("Camila tomó el chat");
  });
  it("HUMANO sin asignar (por eco) se toma", () => {
    expect(alResponderDesdePanel(chat({ estado: "HUMANO", botPausadoHasta: h(1) }), 9, "Camila").parche.asignadoUserId).toBe(9);
  });
});
