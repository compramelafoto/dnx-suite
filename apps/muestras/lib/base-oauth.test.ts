import { describe, expect, it } from "vitest";
import { baseDeIngreso } from "./base-oauth";

describe("baseDeIngreso", () => {
  it("en producción vuelve al dominio del pedido", () => {
    const env = { VERCEL_ENV: "production", APP_URL: "https://muestrasfotograficas.com" };
    expect(baseDeIngreso(new Request("https://muestrasdearte.com/api/auth/google"), env)).toBe("https://muestrasdearte.com");
    expect(baseDeIngreso(new Request("https://muestrasfotograficas.com/api/auth/google"), env)).toBe("https://muestrasfotograficas.com");
  });
  it("un host ajeno nunca se usa como base", () => {
    const env = { VERCEL_ENV: "production" };
    expect(baseDeIngreso(new Request("https://evil.io/api/auth/google"), env)).toBe("https://muestrasfotograficas.com");
  });
  it("en local usa APP_URL", () => {
    expect(baseDeIngreso(new Request("http://localhost:3014/api/auth/google"), { APP_URL: "http://localhost:3014" })).toBe("http://localhost:3014");
  });
});
