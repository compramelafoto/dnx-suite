import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  INTEGRATIONS_MASTER_KEY_ENV,
  IntegrationsVaultError,
  decryptIntegrationSecret,
  encryptIntegrationSecret,
  requireIntegrationsMasterKey,
} from "./vault";

const masterKey = randomBytes(32);

describe("cifrado de credenciales de integraciones", () => {
  it("lo que se cifra se recupera igual", () => {
    const secreto = "1//0abcdefgHIJKLmnop-refresh-token";
    const blob = encryptIntegrationSecret(secreto, masterKey);
    expect(decryptIntegrationSecret(blob, masterKey)).toBe(secreto);
  });

  it("el texto cifrado no contiene el secreto", () => {
    const secreto = "token-secretisimo";
    const blob = encryptIntegrationSecret(secreto, masterKey);
    expect(blob.ciphertext).not.toContain(secreto);
    expect(JSON.stringify(blob)).not.toContain(secreto);
  });

  it("dos cifrados del mismo texto dan resultados distintos", () => {
    const a = encryptIntegrationSecret("mismo", masterKey);
    const b = encryptIntegrationSecret("mismo", masterKey);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.nonce).not.toBe(b.nonce);
  });

  it("con otra clave no se puede descifrar", () => {
    const blob = encryptIntegrationSecret("token", masterKey);
    expect(() => decryptIntegrationSecret(blob, randomBytes(32))).toThrow(IntegrationsVaultError);
  });

  it("un texto cifrado alterado no se acepta", () => {
    const blob = encryptIntegrationSecret("token", masterKey);
    const alterado = { ...blob, authTag: Buffer.from(randomBytes(16)).toString("base64") };
    expect(() => decryptIntegrationSecret(alterado, masterKey)).toThrow(IntegrationsVaultError);
  });

  it("sin clave maestra configurada se corta, y el error nombra la variable", () => {
    try {
      requireIntegrationsMasterKey({} as NodeJS.ProcessEnv);
      throw new Error("tendría que haber fallado");
    } catch (error) {
      expect(error).toBeInstanceOf(IntegrationsVaultError);
      expect((error as IntegrationsVaultError).code).toBe("MISSING_MASTER_KEY");
      expect((error as Error).message).toContain(INTEGRATIONS_MASTER_KEY_ENV);
    }
  });

  it("una clave maestra de largo equivocado se rechaza", () => {
    const env = { [INTEGRATIONS_MASTER_KEY_ENV]: randomBytes(16).toString("base64") };
    expect(() => requireIntegrationsMasterKey(env as NodeJS.ProcessEnv)).toThrow(
      IntegrationsVaultError,
    );
  });

  it("con la clave bien configurada devuelve 32 bytes", () => {
    const env = { [INTEGRATIONS_MASTER_KEY_ENV]: masterKey.toString("base64") };
    expect(requireIntegrationsMasterKey(env as NodeJS.ProcessEnv)).toHaveLength(32);
  });
});
