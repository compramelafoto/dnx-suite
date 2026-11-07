import { describe, expect, it, vi } from "vitest";
import { leerResumenAlbumClf } from "./resumen";

function respuesta(status: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
}

const OK = { id: 1283, titulo: "Colación 7°", slug: "escuela-x", tienePreventa: true, preventaCierraEl: "2026-11-16T02:59:00.000Z" };

describe("leerResumenAlbumClf", () => {
  it("200: arma el resumen con la fecha como Date y pide la URL correcta", async () => {
    const f = vi.fn(async () => respuesta(200, OK));
    const r = await leerResumenAlbumClf({ tipo: "slug", slug: "escuela-x" }, { fetch: f as unknown as typeof fetch, baseUrl: "https://clf.test/" });
    expect(r).toEqual({ ok: true, resumen: { ...OK, preventaCierraEl: new Date("2026-11-16T02:59:00.000Z") } });
    expect(f.mock.calls[0]![0]).toBe("https://clf.test/api/public/album/escuela-x/resumen");
  });

  it("por id usa el número", async () => {
    const f = vi.fn(async () => respuesta(200, OK));
    await leerResumenAlbumClf({ tipo: "id", id: 1283 }, { fetch: f as unknown as typeof fetch, baseUrl: "https://clf.test" });
    expect(f.mock.calls[0]![0]).toBe("https://clf.test/api/public/album/1283/resumen");
  });

  it("404 → NO_EXISTE", async () => {
    const f = async () => respuesta(404, { error: "x" });
    expect(await leerResumenAlbumClf({ tipo: "slug", slug: "x" }, { fetch: f as unknown as typeof fetch })).toEqual({ ok: false, codigo: "NO_EXISTE" });
  });

  it.each([
    ["500", async () => respuesta(500, {})],
    ["excepción", async () => { throw new Error("caído"); }],
    ["forma inválida", async () => respuesta(200, { id: 1, titulo: "x" })],
    ["fecha inválida", async () => respuesta(200, { ...OK, preventaCierraEl: "mañana" })],
  ])("%s → SIN_CONEXION", async (_n, f) => {
    expect(await leerResumenAlbumClf({ tipo: "slug", slug: "x" }, { fetch: f as unknown as typeof fetch })).toEqual({ ok: false, codigo: "SIN_CONEXION" });
  });
});
