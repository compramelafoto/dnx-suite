import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readLiveConfig } from "./config";
import { cifrarClave, columnasYoutube, descifrarClave } from "./secretos";

const env = { DNX_INTEGRATIONS_VAULT_MASTER_KEY: randomBytes(32).toString("base64") } as unknown as NodeJS.ProcessEnv;
const CLAVE = "abcd-efgh-ijkl-mnop-qrst";

describe("claves de destino guardadas", () => {
  it("se guardan cifradas: lo que va a la base no contiene la clave", () => {
    const cols = cifrarClave(CLAVE, env);
    expect(JSON.stringify(cols)).not.toContain(CLAVE);
    expect(cols.last4).toBe("qrst");
    expect(descifrarClave(cols, env)).toBe(CLAVE);
  });

  it("sin clave maestra no se guarda nada en claro: falla", () => {
    expect(() => cifrarClave(CLAVE, {} as NodeJS.ProcessEnv)).toThrow(/DNX_INTEGRATIONS_VAULT_MASTER_KEY/);
  });

  it("sin nada guardado devuelve null", () => {
    expect(descifrarClave({ ciphertext: null, nonce: null, authTag: null, keyVersion: null }, env)).toBeNull();
  });

  it("borrar deja las cinco columnas en null", () => {
    expect(Object.values(columnasYoutube(null)).every((v) => v === null)).toBe(true);
  });
});

describe("configuración de la plataforma", () => {
  it("sin las variables de Stream, no está habilitada y dice cuáles faltan", () => {
    const c = readLiveConfig({});
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.missing).toContain("STREAM_API_TOKEN");
  });

  it("con Stream configurado anda; webhook y baúl son opcionales", () => {
    const base = { STREAM_ACCOUNT_ID: "a", STREAM_API_TOKEN: "t", STREAM_SIGNING_KEY_ID: "k", STREAM_SIGNING_KEY_PEM: "p" };
    expect(readLiveConfig(base)).toMatchObject({ ok: true, webhookSecret: null, puedeRecordarClaves: false });
    expect(
      readLiveConfig({ ...base, STREAM_WEBHOOK_SECRET: "s", DNX_INTEGRATIONS_VAULT_MASTER_KEY: "m" }),
    ).toMatchObject({ ok: true, webhookSecret: "s", puedeRecordarClaves: true });
  });
});
