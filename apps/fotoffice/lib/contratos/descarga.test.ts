import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const H = vi.hoisted(() => ({
  ctx: null as null | { workspaceId: string },
  libre: true,
  leer: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("./contexto", () => ({ contextoDeContratos: async () => H.ctx }));
vi.mock("./almacen", () => ({ leerObjetoContrato: (k: string) => H.leer(k) }));
vi.mock("@/lib/presupuestos/sitio", () => ({
  sitioDelWorkspace: async () => null,
  workspaceDelSlug: async (slug: string) => (slug === "dnxestudio" ? "ws-1" : slug === "otro" ? "ws-2" : null),
}));
vi.mock("../../app/w/[workspaceSlug]/contrato/[token]/visitante", () => ({
  visitanteDeAccion: async () => ({ permitido: H.libre, ipHash: null, userAgent: null }),
}));

const D = await import("./descarga");
const L = await import("./enlace");
const interna = await import("../../app/(shell)/contratos/[id]/pdf/route");
const publica = await import("../../app/w/[workspaceSlug]/contrato/[token]/pdf/route");

const PDF = new TextEncoder().encode("%PDF-1.7 contenido de prueba");
const HASH = createHash("sha256").update(PDF).digest("hex");
const VENCE = new Date("2099-01-01T00:00:00.000Z");
const CLAVE = "clave-enlace";
const TOKEN = L.tokenDeFirmante("f1", VENCE, CLAVE);

const params = <T,>(v: T) => ({ params: Promise.resolve(v) });
const req = new Request("https://app.test/x") as never;

beforeEach(() => {
  B.vaciar();
  H.ctx = { workspaceId: "ws-1" };
  H.libre = true;
  H.leer.mockReset().mockResolvedValue(PDF);
  vi.spyOn(console, "error").mockImplementation(() => {});
  B.agregar("fotofficeContrato", {
    id: "k1", workspaceId: "ws-1", pedidoId: "p1", clientId: "c1", number: "CON/7", name: "x", status: "FIRMADO", bodyText: "x", currentVersionId: "v1",
    pdfKey: "contratos/ws-1/k1/contrato-CON-7-v1.pdf", pdfHash: HASH,
  });
  B.agregar("fotofficeContratoVersion", { id: "v1", workspaceId: "ws-1", contratoId: "k1", number: 1, bodyText: "x", contentHash: "h", sentAt: new Date("2026-10-01T00:00:00Z") });
  B.agregar("fotofficeContratoFirmante", {
    id: "f1", workspaceId: "ws-1", versionId: "v1", orden: 1, name: "Ana", email: "a@x.com", tokenHash: L.hashDeToken(TOKEN), tokenExpiresAt: VENCE, signedAt: new Date("2026-10-02T00:00:00Z"),
  });
});

describe("pdfParaDescargar", () => {
  it("entrega el PDF del contrato de ese workspace con un nombre de archivo seguro", async () => {
    const r = await D.pdfParaDescargar("ws-1", "k1");
    expect(r).toMatchObject({ ok: true, nombre: "contrato-CON-7.pdf" });
    expect(H.leer).toHaveBeenCalledWith("contratos/ws-1/k1/contrato-CON-7-v1.pdf");
  });
  it("no entrega el de otra organización, uno sin PDF, uno no firmado ni uno cuya huella no coincide", async () => {
    expect(await D.pdfParaDescargar("ws-2", "k1")).toEqual({ ok: false });
    Object.assign(B.datos.fotofficeContrato[0]!, { status: "ENVIADO" });
    expect(await D.pdfParaDescargar("ws-1", "k1")).toEqual({ ok: false });
    Object.assign(B.datos.fotofficeContrato[0]!, { status: "FIRMADO", pdfKey: null });
    expect(await D.pdfParaDescargar("ws-1", "k1")).toEqual({ ok: false });
    Object.assign(B.datos.fotofficeContrato[0]!, { pdfKey: "contratos/ws-1/k1/contrato-CON-7-v1.pdf" });
    H.leer.mockResolvedValue(new Uint8Array([1, 2, 3]));
    expect(await D.pdfParaDescargar("ws-1", "k1")).toEqual({ ok: false });
    H.leer.mockRejectedValue(new Error("R2"));
    expect(await D.pdfParaDescargar("ws-1", "k1")).toEqual({ ok: false });
  });
});

describe("ruta interna /contratos/[id]/pdf", () => {
  it("con permiso de Ver baja el PDF como adjunto, privado y sin caché", async () => {
    const r = await interna.GET(req, params({ id: "k1" }));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="contrato-CON-7.pdf"');
    expect(r.headers.get("cache-control")).toContain("no-store");
    expect(r.headers.get("x-robots-tag")).toContain("noindex");
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(PDF);
  });
  it("sin sesión/permiso/módulo es 404 y no lee nada", async () => {
    H.ctx = null;
    expect((await interna.GET(req, params({ id: "k1" }))).status).toBe(404);
    expect(H.leer).not.toHaveBeenCalled();
  });
  it("un contrato de otra organización es 404", async () => {
    H.ctx = { workspaceId: "ws-2" };
    expect((await interna.GET(req, params({ id: "k1" }))).status).toBe(404);
    expect(H.leer).not.toHaveBeenCalled();
  });
  it("ids raros, contrato inexistente o sin PDF: 404", async () => {
    expect((await interna.GET(req, params({ id: "x".repeat(100) }))).status).toBe(404);
    expect((await interna.GET(req, params({ id: "no-existe" }))).status).toBe(404);
    Object.assign(B.datos.fotofficeContrato[0]!, { pdfKey: null });
    expect((await interna.GET(req, params({ id: "k1" }))).status).toBe(404);
  });
});

describe("ruta del firmante /w/[slug]/contrato/[token]/pdf", () => {
  it("con su token y el contrato firmado baja el PDF, también con el enlace vencido (ya firmó)", async () => {
    const r = await publica.GET(req, params({ workspaceSlug: "dnxestudio", token: TOKEN }));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-disposition")).toContain("contrato-CON-7.pdf");
    expect(new Uint8Array(await r.arrayBuffer())).toEqual(PDF);
    Object.assign(B.datos.fotofficeContratoFirmante[0]!, { tokenExpiresAt: new Date("2020-01-01T00:00:00Z") });
    expect((await publica.GET(req, params({ workspaceSlug: "dnxestudio", token: TOKEN }))).status).toBe(200);
  });
  it("un token inventado, de otra organización o de otra versión es 404", async () => {
    expect((await publica.GET(req, params({ workspaceSlug: "dnxestudio", token: "x".repeat(43) }))).status).toBe(404);
    expect((await publica.GET(req, params({ workspaceSlug: "otro", token: TOKEN }))).status).toBe(404);
    expect((await publica.GET(req, params({ workspaceSlug: "no-hay", token: TOKEN }))).status).toBe(404);
    Object.assign(B.datos.fotofficeContrato[0]!, { currentVersionId: "otra" });
    expect((await publica.GET(req, params({ workspaceSlug: "dnxestudio", token: TOKEN }))).status).toBe(404);
    expect(H.leer).not.toHaveBeenCalled();
  });
  it("mientras el contrato no esté firmado por todos, no hay PDF aunque exista la clave", async () => {
    Object.assign(B.datos.fotofficeContrato[0]!, { status: "FIRMADO_PARCIAL" });
    expect((await publica.GET(req, params({ workspaceSlug: "dnxestudio", token: TOKEN }))).status).toBe(404);
    Object.assign(B.datos.fotofficeContrato[0]!, { status: "ANULADO" });
    expect((await publica.GET(req, params({ workspaceSlug: "dnxestudio", token: TOKEN }))).status).toBe(404);
    expect(H.leer).not.toHaveBeenCalled();
  });
  it("sin PDF todavía: 404; con el freno por IP encendido: 429", async () => {
    Object.assign(B.datos.fotofficeContrato[0]!, { pdfKey: null });
    expect((await publica.GET(req, params({ workspaceSlug: "dnxestudio", token: TOKEN }))).status).toBe(404);
    H.libre = false;
    expect((await publica.GET(req, params({ workspaceSlug: "dnxestudio", token: TOKEN }))).status).toBe(429);
  });
});
