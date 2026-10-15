import { beforeEach, describe, expect, it, vi } from "vitest";

const H = vi.hoisted(() => ({ ctx: vi.fn(), filas: vi.fn() }));
vi.mock("@/lib/galerias/contexto", () => ({ contextoDeGalerias: H.ctx }));
vi.mock("@/lib/galerias/revision", () => ({ filasParaCsv: H.filas }));

const { GET } = await import("./route");
const params = (id = "g1", clienteId = "gc1") => ({ params: Promise.resolve({ id, clienteId }) });
const pedido = () => new Request("https://x.test/api");

beforeEach(() => {
  vi.clearAllMocks();
  H.ctx.mockResolvedValue({ workspaceId: "ws-1" });
  H.filas.mockResolvedValue({ filas: [{ fileName: "IMG_2.CR2", comentarios: ["Más luz"] }, { fileName: "Boda v1.2", comentarios: [] }], galeriaNumero: "G-1", clienteNombre: "Lucía Pérez" });
});

describe("GET exportar CSV", () => {
  it("pide el nivel Ver y, sin contexto, 404 sin leer nada", async () => {
    H.ctx.mockResolvedValue(null);
    const r = await GET(pedido(), params());
    expect(r.status).toBe(404);
    expect(H.ctx).toHaveBeenCalledWith("ver");
    expect(H.filas).not.toHaveBeenCalled();
  });
  it("cliente de otra galería o workspace: 404", async () => {
    H.filas.mockResolvedValue(null);
    expect((await GET(pedido(), params("g2", "gc1"))).status).toBe(404);
    expect(H.filas).toHaveBeenCalledWith({ workspaceId: "ws-1" }, "g2", "gc1");
  });
  it("devuelve un CSV para descargar, sin caché, con las tres columnas", async () => {
    const r = await GET(pedido(), params());
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toContain("text/csv");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="seleccion-g-1-lucia-perez.csv"');
    expect(r.headers.get("cache-control")).toBe("no-store");
    const csv = (await r.text()).replace("﻿", "").split("\r\n");
    expect(csv[0]).toBe("Archivo;Nombre sin extensión;Comentarios del cliente");
    expect(csv).toContain("IMG_2.CR2;IMG_2;Más luz");
    expect(csv).toContain("Boda v1.2;Boda v1.2;");
  });
});
