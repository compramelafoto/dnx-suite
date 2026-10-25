import { describe, expect, it } from "vitest";
import { getConfig } from "./config";

const base = { DATABASE_URL: "x", R2_ENDPOINT: "e", R2_ACCESS_KEY_ID: "a", R2_SECRET_ACCESS_KEY: "s" };

describe("getConfig: bucket", () => {
  it("por defecto fotoffice-private", () => {
    expect(getConfig(base).bucket).toBe("fotoffice-private");
  });
  it("acepta R2_PRIVATE_BUCKET (el nombre que usa la app)", () => {
    expect(getConfig({ ...base, R2_PRIVATE_BUCKET: "priv" }).bucket).toBe("priv");
  });
  it("prioridad: FOTOFFICE_R2_BUCKET > FOTOFFICE_R2_PRIVATE_BUCKET > R2_PRIVATE_BUCKET", () => {
    const e = { ...base, R2_PRIVATE_BUCKET: "c", FOTOFFICE_R2_PRIVATE_BUCKET: "b" };
    expect(getConfig(e).bucket).toBe("b");
    expect(getConfig({ ...e, FOTOFFICE_R2_BUCKET: "a" }).bucket).toBe("a");
  });
  it("maxHoras por defecto 16", () => {
    expect(getConfig(base).maxHoras).toBe(16);
  });
});
