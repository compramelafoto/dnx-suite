import { describe, expect, it } from "vitest";
import {
  VERCEL_PROTECTION_BYPASS_HEADER,
  buildProtectionBypassHeaders,
  protectionBypassStatus,
  resolveProtectionBypassSecret,
  withProtectionBypassHeaders,
} from "./protection-bypass.js";

describe("protection-bypass", () => {
  it("disabled cuando la variable no existe", () => {
    expect(resolveProtectionBypassSecret({})).toEqual({ enabled: false });
    expect(buildProtectionBypassHeaders({ env: {} })).toEqual({});
  });

  it("disabled cuando el secret está vacío o solo whitespace", () => {
    expect(resolveProtectionBypassSecret({ VERCEL_AUTOMATION_BYPASS_SECRET: "  " })).toEqual({
      enabled: false,
    });
  });

  it("inyecta header oficial cuando hay secret", () => {
    const env = { VERCEL_AUTOMATION_BYPASS_SECRET: "test-secret-value" };
    expect(buildProtectionBypassHeaders({ env })).toEqual({
      [VERCEL_PROTECTION_BYPASS_HEADER]: "test-secret-value",
    });
  });

  it("opcionalmente setea cookie header", () => {
    const headers = buildProtectionBypassHeaders({
      secret: "abc",
      setBypassCookie: true,
    });
    expect(headers["x-vercel-set-bypass-cookie"]).toBe("true");
  });

  it("status seguro no incluye el secret", () => {
    const status = protectionBypassStatus({
      VERCEL_AUTOMATION_BYPASS_SECRET: "super-secret",
    });
    expect(status).toEqual({
      enabled: true,
      header: VERCEL_PROTECTION_BYPASS_HEADER,
    });
    expect(JSON.stringify(status)).not.toContain("super-secret");
  });

  it("mergea headers sin pisar otros", () => {
    const merged = withProtectionBypassHeaders(
      { Accept: "application/json" },
      { secret: "s3cret" },
    );
    expect(merged.Accept).toBe("application/json");
    expect(merged[VERCEL_PROTECTION_BYPASS_HEADER]).toBe("s3cret");
  });
});
