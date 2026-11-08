import { describe, expect, it } from "vitest";
import { tokenConForma } from "./api";
import { aprobacionDelBoton, codigoDeVinculo, datoDeAprobar, hashDeSecreto, leerUpdate, secretoNuevo, secretoValido } from "./webhook";

describe("secreto del webhook", () => {
  it("acepta sólo el secreto cuyo hash está guardado", () => {
    const s = secretoNuevo();
    expect(s).toMatch(/^[a-f0-9]{64}$/);
    const hash = hashDeSecreto(s);
    expect(secretoValido(s, hash)).toBe(true);
    expect(secretoValido(`${s}x`, hash)).toBe(false);
    expect(secretoValido(secretoNuevo(), hash)).toBe(false);
  });

  it("sin encabezado, sin hash o con basura: no", () => {
    const hash = hashDeSecreto("abc");
    expect(secretoValido(null, hash)).toBe(false);
    expect(secretoValido("", hash)).toBe(false);
    expect(secretoValido("abc", null)).toBe(false);
    expect(secretoValido("abc", "no-es-hex")).toBe(false);
    expect(secretoValido("a".repeat(300), hash)).toBe(false);
  });

  it("los códigos de vínculo no repiten letras confusas", () => {
    for (let i = 0; i < 50; i++) expect(codigoDeVinculo()).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
  });
});

describe("leerUpdate", () => {
  it("/start con código en un chat privado", () => {
    const u = leerUpdate({ update_id: 1, message: { message_id: 5, chat: { id: 123456, type: "private" }, from: { id: 123456, first_name: "Daniel", last_name: "Cuart" }, text: "/start ABCD234567" } });
    expect(u).toEqual({ tipo: "START", chatId: "123456", chatPrivado: true, codigo: "ABCD234567", nombre: "Daniel Cuart" });
  });

  it("/start sin código y desde un grupo", () => {
    expect(leerUpdate({ message: { chat: { id: -100, type: "group" }, text: "/start" } })).toMatchObject({ tipo: "START", chatPrivado: false, codigo: null });
  });

  it("otros mensajes se ignoran", () => {
    expect(leerUpdate({ message: { chat: { id: 1, type: "private" }, text: "hola" } })).toEqual({ tipo: "OTRO" });
    expect(leerUpdate(null)).toEqual({ tipo: "OTRO" });
    expect(leerUpdate({ edited_message: {} })).toEqual({ tipo: "OTRO" });
  });

  it("un texto que responde a un mensaje del bot es una RESPUESTA", () => {
    const u = leerUpdate({
      message: { message_id: 90, chat: { id: 123456, type: "private" }, from: { id: 123456 }, text: "  más corto, nombrá a la SFPR ", reply_to_message: { message_id: 77 } },
    });
    expect(u).toEqual({ tipo: "RESPUESTA", chatId: "123456", chatPrivado: true, deId: "123456", messageId: "90", respondeA: "77", texto: "más corto, nombrá a la SFPR" });
  });

  it("una respuesta vacía, un comando o sin id del mensaje respondido se ignora; el texto largo se corta", () => {
    expect(leerUpdate({ message: { chat: { id: 1, type: "private" }, text: "  ", reply_to_message: { message_id: 3 } } })).toEqual({ tipo: "OTRO" });
    expect(leerUpdate({ message: { chat: { id: 1, type: "private" }, text: "/ayuda", reply_to_message: { message_id: 3 } } })).toEqual({ tipo: "OTRO" });
    expect(leerUpdate({ message: { chat: { id: 1, type: "private" }, text: "hola", reply_to_message: {} } })).toEqual({ tipo: "OTRO" });
    const largo = leerUpdate({ message: { chat: { id: 1, type: "private" }, text: "a".repeat(5000), reply_to_message: { message_id: 3 } } });
    expect(largo.tipo === "RESPUESTA" && largo.texto.length).toBe(2000);
  });

  it("/start respondiendo a un mensaje sigue siendo START", () => {
    expect(leerUpdate({ message: { chat: { id: 1, type: "private" }, text: "/start ABCD234567", reply_to_message: { message_id: 3 } } })).toMatchObject({ tipo: "START", codigo: "ABCD234567" });
  });

  it("el toque de un botón trae quién, desde qué chat y el dato", () => {
    const u = leerUpdate({
      callback_query: { id: "cb-1", from: { id: 123456 }, message: { message_id: 77, chat: { id: 123456 } }, data: "ap:ckaprobacion0001" },
    });
    expect(u).toEqual({ tipo: "BOTON", callbackId: "cb-1", chatId: "123456", deId: "123456", messageId: "77", data: "ap:ckaprobacion0001" });
  });

  it("un botón sin id o sin dato se ignora", () => {
    expect(leerUpdate({ callback_query: { from: { id: 1 }, data: "ap:x" } })).toEqual({ tipo: "OTRO" });
    expect(leerUpdate({ callback_query: { id: "a", from: { id: 1 } } })).toEqual({ tipo: "OTRO" });
  });
});

describe("dato de los botones y token", () => {
  it("ida y vuelta del botón Aprobar", () => {
    expect(aprobacionDelBoton(datoDeAprobar("ckaprobacion0001"))).toBe("ckaprobacion0001");
    expect(aprobacionDelBoton("xx:ckaprobacion0001")).toBeNull();
    expect(aprobacionDelBoton("ap:../../etc")).toBeNull();
    expect(datoDeAprobar("c".repeat(25)).length).toBeLessThanOrEqual(64);
  });

  it("forma del token de @BotFather", () => {
    expect(tokenConForma("123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw")).toBe(true);
    expect(tokenConForma("123456789AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw")).toBe(false);
    expect(tokenConForma("hola")).toBe(false);
  });
});
