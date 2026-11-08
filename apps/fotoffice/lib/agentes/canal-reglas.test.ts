import { describe, expect, it } from "vitest";
import { codigoVigente, decidirVinculo, enlaceVinculoAgentes, escribirCanal, esDelChatVinculado, leerCanal, type CanalAgentes } from "./canal-reglas";

const AHORA = new Date("2026-11-09T12:00:00.000Z");
const canal = (extra: Partial<CanalAgentes> = {}): CanalAgentes => ({
  botId: "1",
  botUsername: "dnx_agentes_bot",
  chatId: null,
  chatNombre: null,
  webhookSecretHash: "a".repeat(64),
  linkCode: "ABCD234567",
  linkCodeExpiresAt: "2026-11-09T12:20:00.000Z",
  linkedAt: null,
  ...extra,
});

describe("canal de agentes en SystemSettings", () => {
  it("ida y vuelta del JSON; basura o nada es 'sin canal'", () => {
    const c = canal({ chatId: "555" });
    expect(leerCanal(escribirCanal(c))).toEqual(c);
    expect(leerCanal(null)).toBeNull();
    expect(leerCanal("no es json")).toBeNull();
    expect(leerCanal(JSON.stringify({ botId: "1" }))).toBeNull();
    expect(leerCanal(JSON.stringify({ ...c, webhookSecretHash: "corto" }))).toBeNull();
  });

  it("el enlace abre el bot con el código", () => {
    expect(enlaceVinculoAgentes("dnx_agentes_bot", "ABCD234567")).toBe("https://t.me/dnx_agentes_bot?start=ABCD234567");
  });

  it("el código vale 30 minutos", () => {
    expect(codigoVigente(canal(), AHORA)).toBe("ABCD234567");
    expect(codigoVigente(canal(), new Date("2026-11-09T12:21:00.000Z"))).toBeNull();
    expect(codigoVigente(canal({ linkCode: null }), AHORA)).toBeNull();
  });
});

describe("decidirVinculo", () => {
  it("vincula un chat privado con el código vigente", () => {
    expect(decidirVinculo(canal(), { chatId: "555", chatPrivado: true, codigo: "ABCD234567" }, AHORA)).toBe("VINCULAR");
  });

  it("código vencido, otro código, grupo o sin código: silencio para desconocidos", () => {
    expect(decidirVinculo(canal(), { chatId: "555", chatPrivado: true, codigo: "ABCD234567" }, new Date("2026-11-09T13:00:00.000Z"))).toBe("IGNORAR");
    expect(decidirVinculo(canal(), { chatId: "555", chatPrivado: true, codigo: "OTROCODIGO" }, AHORA)).toBe("IGNORAR");
    expect(decidirVinculo(canal(), { chatId: "-100", chatPrivado: false, codigo: "ABCD234567" }, AHORA)).toBe("IGNORAR");
    expect(decidirVinculo(canal(), { chatId: "555", chatPrivado: true, codigo: null }, AHORA)).toBe("IGNORAR");
  });

  it("el chat ya vinculado que toca Iniciar de nuevo recibe 'ya vinculado'", () => {
    expect(decidirVinculo(canal({ chatId: "555", linkCode: null }), { chatId: "555", chatPrivado: true, codigo: null }, AHORA)).toBe("YA_VINCULADO");
  });
});

describe("esDelChatVinculado", () => {
  it("sólo el chat vinculado, y la persona tiene que ser la misma", () => {
    const c = canal({ chatId: "555" });
    expect(esDelChatVinculado(c, "555", "555")).toBe(true);
    expect(esDelChatVinculado(c, "555", null)).toBe(true);
    expect(esDelChatVinculado(c, "555", "666")).toBe(false);
    expect(esDelChatVinculado(c, "666", "666")).toBe(false);
    expect(esDelChatVinculado(c, null, "555")).toBe(false);
    expect(esDelChatVinculado(canal(), "555", "555")).toBe(false);
    expect(esDelChatVinculado(null, "555", "555")).toBe(false);
  });
});
