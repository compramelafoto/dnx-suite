import { describe, expect, it, vi } from "vitest";

/**
 * Firma real (local, sin red): la URL de subida lleva content-type y content-length dentro
 * de la firma y vence en 600 s; la de descarga vence en 300 s y fuerza la descarga.
 */
vi.mock("server-only", () => ({}));
process.env.R2_ACCOUNT_ID = "acc";
process.env.R2_ACCESS_KEY_ID = "AKIDEXAMPLE";
process.env.R2_SECRET_ACCESS_KEY = "secret";
process.env.R2_ENDPOINT = "https://acc.r2.cloudflarestorage.com";
process.env.R2_PRIVATE_BUCKET = "privado";

const R = await import("./adjuntos-r2");
const CLAVE = "adjuntos/ws1/123e4567-e89b-12d3-a456-426614174000";

describe("firma real", () => {
  it("subida: headers firmados y 600 s", async () => {
    const u = new URL(await R.urlDeSubida(CLAVE, "image/png", 2048));
    expect(u.host).toBe("privado.acc.r2.cloudflarestorage.com");
    expect(u.pathname).toBe(`/${CLAVE}`);
    expect(u.searchParams.get("X-Amz-Expires")).toBe("600");
    const firmados = u.searchParams.get("X-Amz-SignedHeaders")!.split(";");
    expect(firmados).toEqual(expect.arrayContaining(["content-length", "content-type", "host"]));
  });
  it("descarga: 300 s y attachment", async () => {
    const u = new URL(await R.urlDeDescarga(CLAVE, "dni.pdf"));
    expect(u.host).toBe("privado.acc.r2.cloudflarestorage.com");
    expect(u.pathname).toBe(`/${CLAVE}`);
    expect(u.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(u.searchParams.get("response-content-disposition")).toBe("attachment; filename*=UTF-8''dni.pdf");
  });
});
