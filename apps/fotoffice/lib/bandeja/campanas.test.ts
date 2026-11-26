import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/integrations/whatsapp/credentials", () => ({ leerTokenWhatsapp: vi.fn(async () => "tok") }));

const C = await import("./campanas");
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- la base en memoria tipa el cliente como mapa suelto
const P = B.prisma as Record<string, any>;
const AHORA = new Date("2026-11-24T15:00:00.000Z");
const dias = (n: number) => new Date(AHORA.getTime() - n * 86_400_000);
const respuesta = (status: number, cuerpo: unknown) => vi.fn(async () => new Response(JSON.stringify(cuerpo), { status }));

beforeEach(() => {
  B.vaciar();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("consultarAnuncio", () => {
  it("guarda el nombre, el conjunto y la campaña", async () => {
    const f = respuesta(200, { id: "120", name: "Chatea con nosotros", adset: { name: "Rosario 25-45" }, campaign: { id: "999", name: "XV Noviembre" } });
    await C.consultarAnuncio("w1", "120", { fetch: f, ahora: AHORA, titulo: "Chatea" });
    expect((f.mock.calls[0] as unknown as [string])[0]).toMatch(/\/120\?fields=name,adset%7Bname%7D,campaign%7Bid,name%7D$/);
    expect(B.datos.fotofficeMetaAnuncio[0]).toMatchObject({ workspaceId: "w1", adId: "120", titulo: "Chatea", adName: "Chatea con nosotros", adsetName: "Rosario 25-45", campaignId: "999", campaignName: "XV Noviembre", error: null, intentos: 1, consultadoEn: AHORA });
  });
  it("sin permiso o con Meta caída guarda el error sin lanzar; un id raro no se consulta", async () => {
    await C.consultarAnuncio("w1", "121", { fetch: respuesta(403, { error: { code: 200, type: "OAuthException" } }), ahora: AHORA });
    expect(B.datos.fotofficeMetaAnuncio[0]).toMatchObject({ adId: "121", campaignId: null, error: "META_200", intentos: 1 });
    await C.consultarAnuncio("w1", "122", { fetch: vi.fn(async () => { throw new Error("red"); }), ahora: AHORA });
    expect(B.datos.fotofficeMetaAnuncio[1]).toMatchObject({ adId: "122", error: "RED" });
    const f = vi.fn();
    await C.consultarAnuncio("w1", "12/../x", { fetch: f });
    expect(f).not.toHaveBeenCalled();
  });
});

describe("campanasRecientes", () => {
  it("agrupa los chats de los últimos 90 días por campaña (o por anuncio sin campaña), por cantidad", async () => {
    B.agregar("fotofficeMetaAnuncio", { id: "a1", workspaceId: "w1", adId: "1", campaignId: "999", campaignName: "XV Noviembre", titulo: "Chatea" });
    B.agregar("fotofficeMetaAnuncio", { id: "a2", workspaceId: "w1", adId: "2", campaignId: "999", campaignName: "XV Noviembre" });
    B.agregar("fotofficeMetaAnuncio", { id: "a3", workspaceId: "w1", adId: "3", titulo: "Sesión de 15 años" });
    const chat = (anuncioId: string | null, d: number, ws = "w1") => P.fotofficeWaChat.create({ data: { workspaceId: ws, waId: String(Math.random()), anuncioId, ultimoMensajeEn: dias(d) } });
    await chat("1", 1); await chat("2", 2); await chat("3", 3); await chat("1", 200); await chat(null, 1); await chat("1", 1, "w2");
    expect(await C.campanasRecientes("w1", AHORA)).toEqual([
      { valor: "999", nombre: "XV Noviembre", chats: 2 },
      { valor: "ad:3", nombre: "Anuncio «Sesión de 15 años» (sin campaña)", chats: 1 },
      { valor: "sin-anuncio", nombre: "Sin anuncio", chats: 1 },
    ]);
  });
});

describe("anunciosParaReintentar", () => {
  it("los que no tienen campaña, con menos de 7 intentos y sin consultar en las últimas 20 h", async () => {
    B.agregar("fotofficeMetaAnuncio", { id: "a1", workspaceId: "w1", adId: "1", intentos: 1, consultadoEn: dias(2) });
    B.agregar("fotofficeMetaAnuncio", { id: "a2", workspaceId: "w1", adId: "2", intentos: 1, consultadoEn: new Date(AHORA.getTime() - 3_600_000) });
    B.agregar("fotofficeMetaAnuncio", { id: "a3", workspaceId: "w1", adId: "3", intentos: 7, consultadoEn: dias(2) });
    B.agregar("fotofficeMetaAnuncio", { id: "a4", workspaceId: "w1", adId: "4", campaignId: "9", intentos: 1, consultadoEn: dias(2) });
    B.agregar("fotofficeMetaAnuncio", { id: "a5", workspaceId: "w1", adId: "5" });
    expect((await C.anunciosParaReintentar(AHORA)).map((a) => a.adId).sort()).toEqual(["1", "5"]);
  });
});
