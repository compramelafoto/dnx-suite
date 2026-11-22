import { describe, expect, it } from "vitest";
import { baseDeIngreso, esHostDeMarca, hostDelPedido, origenDelPedido } from "./base-oauth";

const pedido = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

describe("baseDeIngreso", () => {
  it("en producción vuelve al dominio del pedido", () => {
    const env = { VERCEL_ENV: "production", APP_URL: "https://muestrasfotograficas.com" };
    expect(baseDeIngreso(pedido("https://muestrasdearte.com/api/auth/google"), env)).toBe("https://muestrasdearte.com");
    expect(baseDeIngreso(pedido("https://muestrasfotograficas.com/api/auth/google"), env)).toBe("https://muestrasfotograficas.com");
  });
  it("un host ajeno nunca se usa como base", () => {
    const env = { VERCEL_ENV: "production" };
    expect(baseDeIngreso(pedido("https://evil.io/api/auth/google"), env)).toBe("https://muestrasfotograficas.com");
    expect(baseDeIngreso(pedido("https://muestrasdearte.com/api/auth/google", { host: "evil.io" }), env)).toBe("https://muestrasfotograficas.com");
  });
  it("en local usa APP_URL", () => {
    expect(baseDeIngreso(pedido("http://localhost:3014/api/auth/google"), { APP_URL: "http://localhost:3014" })).toBe("http://localhost:3014");
  });
  it("la marca sale del encabezado Host aunque la URL interna sea otra", () => {
    const env = { VERCEL_ENV: "production" };
    expect(baseDeIngreso(pedido("http://127.0.0.1:3000/api/auth/google", { host: "muestrasdearte.com" }), env)).toBe("https://muestrasdearte.com");
    expect(baseDeIngreso(pedido("http://localhost:3034/api/auth/google", { host: "muestrasdearte.localhost:3034" }), { APP_URL: "http://localhost:3034" }))
      .toBe("http://muestrasdearte.localhost:3034");
  });
});

describe("hostDelPedido", () => {
  it("prefiere el encabezado Host y, sin él, usa la URL", () => {
    expect(hostDelPedido(pedido("http://127.0.0.1:3000/x", { host: "muestrasdearte.com" }))).toBe("muestrasdearte.com");
    expect(hostDelPedido(pedido("https://muestrasfotograficas.com/x"))).toBe("muestrasfotograficas.com");
  });
});

describe("esHostDeMarca", () => {
  it("acepta los dominios de las marcas y los de desarrollo, sin importar mayúsculas ni puerto", () => {
    for (const h of ["muestrasfotograficas.com", "WWW.muestrasfotograficas.com", "muestrasdearte.com:443", "www.muestrasdearte.com", "localhost:3014", "127.0.0.1:3034", "muestrasdearte.localhost:3034"]) {
      expect(esHostDeMarca(h)).toBe(true);
    }
  });
  it("rechaza cualquier otro, también los parecidos", () => {
    for (const h of ["evil.io", "muestrasdearte.com.evil.io", "evilmuestrasdearte.com", "muestrasdearte.co", "localhost.evil.io", "a b.localhost", ""]) {
      expect(esHostDeMarca(h)).toBe(false);
    }
  });
});

describe("origenDelPedido", () => {
  it("usa el Host de la marca con el protocolo de x-forwarded-proto", () => {
    expect(origenDelPedido(pedido("http://127.0.0.1:3000/api/auth/clave", { host: "muestrasdearte.com", "x-forwarded-proto": "https" }))).toBe("https://muestrasdearte.com");
    expect(origenDelPedido(pedido("http://127.0.0.1:3000/x", { host: "www.muestrasfotograficas.com", "x-forwarded-proto": "https, http" }))).toBe("https://www.muestrasfotograficas.com");
  });
  it("sin x-forwarded-proto (o con uno raro), el protocolo de la URL", () => {
    expect(origenDelPedido(pedido("http://localhost:3034/x", { host: "muestrasdearte.localhost:3034" }))).toBe("http://muestrasdearte.localhost:3034");
    expect(origenDelPedido(pedido("http://localhost:3034/x", { host: "muestrasdearte.localhost:3034", "x-forwarded-proto": "javascript" }))).toBe("http://muestrasdearte.localhost:3034");
  });
  it("un Host falsificado nunca se refleja: vuelve al origen de la URL", () => {
    expect(origenDelPedido(pedido("https://muestrasfotograficas.com/api/auth/google", { host: "evil.io", "x-forwarded-proto": "https" }))).toBe("https://muestrasfotograficas.com");
    expect(origenDelPedido(pedido("http://localhost:3034/x", { host: "muestrasdearte.com.evil.io" }))).toBe("http://localhost:3034");
  });
  it("sin Host, el origen de la URL", () => {
    expect(origenDelPedido(pedido("https://muestrasdearte.com/x"))).toBe("https://muestrasdearte.com");
  });
});
