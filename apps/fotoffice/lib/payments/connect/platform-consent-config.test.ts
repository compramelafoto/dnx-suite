import { describe, expect, it } from "vitest";
import {
  buildPlatformConsentConfig,
  SPLIT_CONSENT_PRODUCTION_FLAG,
} from "./platform-consent-config";

const TOKEN = "APP_USR-token-de-la-plataforma";

describe("buildPlatformConsentConfig", () => {
  it("con la bandera encendida habilita la escritura en producción", () => {
    const config = buildPlatformConsentConfig(TOKEN, {
      [SPLIT_CONSENT_PRODUCTION_FLAG]: "true",
    });

    expect(config.environment).toBe("production");
    expect(config.allowProductionWrites).toBe(true);
  });

  it("con la bandera apagada no la habilita", () => {
    const config = buildPlatformConsentConfig(TOKEN, {});

    expect(config.environment).toBe("production");
    expect(config.allowProductionWrites).toBeUndefined();
  });

  it("no acepta cualquier valor como encendido", () => {
    const config = buildPlatformConsentConfig(TOKEN, {
      [SPLIT_CONSENT_PRODUCTION_FLAG]: "falso",
    });

    expect(config.allowProductionWrites).toBeUndefined();
  });
});
