import { describe, expect, it } from "vitest";
import { anuncioDeMedia } from "../anuncio";
import {
  consultaDeAnuncioSinRespuesta,
  cualRecordatorio,
  marcaRecordatorioAnuncio,
  temaRecordable,
  textoRecordatorioAnuncio,
  type MensajeParaRecordar,
} from "./recordatorio-anuncio";

const T0 = new Date("2026-11-21T15:00:00Z"); // 12:00 en Argentina
const mas = (horas: number) => new Date(T0.getTime() + horas * 3_600_000);
const VHS = { anuncio: { texto: "¿TENÉS VHS GUARDADOS?" } };
const XV = { anuncio: { texto: "Sesión de 15 años" } };

const m = (direccion: string, autor: string, horas: number, extra: Partial<MensajeParaRecordar> = {}): MensajeParaRecordar => ({
  direccion, autor, texto: "x", media: null, createdAt: mas(horas), ...extra,
});
const base = (media: unknown) => [m("ENTRANTE", "CLIENTE", 0, { media }), m("SALIENTE", "BOT", 0.01)];

describe("temaRecordable", () => {
  it("reconoce los anuncios de VHS y de XV, y nada más", () => {
    expect(temaRecordable({ texto: "¿SABIAS QUE EN DNX DIGITALIZAMOS TUS VHS's?" })).toBe("VHS");
    expect(temaRecordable({ texto: "¿Edición y retoques en fotos de quinceañeras?" })).toBe("XV");
    expect(temaRecordable({ texto: "Fotos carnet AL INSTANTE" })).toBeNull();
  });
});

describe("cualRecordatorio", () => {
  it("el primero sale a la hora, aunque sea de madrugada", () => {
    const noche = new Date("2026-11-21T05:00:00Z"); // 02:00 en Argentina
    expect(cualRecordatorio(noche, new Date(noche.getTime() + 59 * 60_000), [])).toBeNull();
    expect(cualRecordatorio(noche, new Date(noche.getTime() + 61 * 60_000), [])).toBe(1);
  });
  it("no repite el primero", () => {
    expect(cualRecordatorio(T0, mas(2), [1])).toBeNull();
  });
  it("el segundo sale a las 22 h dentro del horario de 7 a 21 y una sola vez", () => {
    expect(cualRecordatorio(T0, mas(21.9), [1])).toBeNull();
    expect(cualRecordatorio(T0, mas(22), [1])).toBe(2);
    expect(cualRecordatorio(T0, mas(22.25), [1, 2])).toBeNull();
    expect(cualRecordatorio(T0, mas(22.25), [2])).toBeNull();
  });
  it("si el primero no llegó a salir, igual sale el segundo", () => {
    expect(cualRecordatorio(T0, mas(22), [])).toBe(2);
  });
});

describe("consultaDeAnuncioSinRespuesta", () => {
  it("llegó del anuncio, el bot contestó y el cliente no volvió a escribir", () => {
    expect(consultaDeAnuncioSinRespuesta(base(VHS), anuncioDeMedia, [])).toEqual({ tema: "VHS", ya: [] });
    expect(consultaDeAnuncioSinRespuesta(base(XV), anuncioDeMedia, [])).toEqual({ tema: "XV", ya: [] });
  });
  it("si el cliente contestó, o no vino de un anuncio, no hay recordatorio", () => {
    expect(consultaDeAnuncioSinRespuesta([...base(VHS), m("ENTRANTE", "CLIENTE", 0.5)], anuncioDeMedia, [])).toBeNull();
    expect(consultaDeAnuncioSinRespuesta(base(null), anuncioDeMedia, [])).toBeNull();
  });
  it("si una persona del estudio escribió, la charla ya la lleva ella", () => {
    expect(consultaDeAnuncioSinRespuesta([...base(VHS), m("SALIENTE", "CELULAR", 0.5)], anuncioDeMedia, [])).toBeNull();
  });
  it("lleva la cuenta de los recordatorios que ya salieron y corta si salió otro seguimiento", () => {
    const con1 = [...base(XV), m("SALIENTE", "BOT", 1), m("SISTEMA", "SISTEMA", 1, { texto: marcaRecordatorioAnuncio(1) })];
    expect(consultaDeAnuncioSinRespuesta(con1, anuncioDeMedia, [])).toEqual({ tema: "XV", ya: [1] });
    const otro = [...base(VHS), m("SISTEMA", "SISTEMA", 20, { texto: "Seguimiento de consulta enviado" })];
    expect(consultaDeAnuncioSinRespuesta(otro, anuncioDeMedia, ["Seguimiento de consulta enviado"])).toBeNull();
  });
});

describe("textoRecordatorioAnuncio", () => {
  it("usa el nombre de pila sólo si parece un nombre, y no habla de botones ni de bots", () => {
    const t = textoRecordatorioAnuncio("XV", 2, "laura gómez", "chat1");
    expect(t).toContain("Laura");
    expect(textoRecordatorioAnuncio("VHS", 2, "💙💛💙", "chat1")).toMatch(/^¡Hola! /);
    for (const tema of ["VHS", "XV"] as const)
      for (const n of [1, 2] as const)
        for (const id of ["a", "b", "c", "d"]) expect(textoRecordatorioAnuncio(tema, n, "Ana", id)).not.toMatch(/bot[oó]n|asistente|autom/i);
  });
  it("varía el texto entre chats", () => {
    const textos = new Set(["a", "b", "c", "d", "e", "f"].map((id) => textoRecordatorioAnuncio("XV", 1, "Ana", id)));
    expect(textos.size).toBeGreaterThan(1);
  });
});
