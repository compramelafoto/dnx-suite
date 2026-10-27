import { beforeEach, describe, expect, it, vi } from "vitest";

const { docCount, docCreate, send, deleteObj } = vi.hoisted(() => ({
  docCount: vi.fn(),
  docCreate: vi.fn(),
  send: vi.fn(),
  deleteObj: vi.fn(),
}));

vi.mock("@repo/db", () => ({
  prisma: { fotofficeSitioDocumento: { count: docCount, create: docCreate } },
}));
vi.mock("@/lib/images/r2-client", () => ({
  deleteFotofficeR2Object: deleteObj,
  generateFotofficeR2Key: vi.fn(),
  getFotofficeR2Bucket: () => "bucket",
  getFotofficeR2Client: () => ({ send }),
  isFotofficeR2Configured: () => true,
}));

const { confirmarDocumento } = await import("./documentos.server");

const KEY = "fotoffice/website-documents/ws1/0f8fad5b-d9cb-469f-a165-70867728950e.pdf";
const base = { workspaceId: "ws1", key: KEY, titulo: "Lista", slug: "lista" };

/** R2: HEAD con 1000 bytes y primeros bytes `%PDF-`. */
function r2ConPdf() {
  send.mockImplementation(async (cmd: { constructor: { name: string } }) =>
    cmd.constructor.name === "HeadObjectCommand"
      ? { ContentLength: 1000 }
      : { Body: { transformToByteArray: async () => new TextEncoder().encode("%PDF-1.7") } },
  );
}

describe("confirmarDocumento", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteObj.mockResolvedValue({ ok: true });
    r2ConPdf();
  });

  it("registra un PDF nuevo", async () => {
    docCount.mockResolvedValue(0);
    docCreate.mockResolvedValue({ id: "doc1" });
    expect(await confirmarDocumento(base)).toEqual({ ok: true, valor: { id: "doc1" } });
    expect(deleteObj).not.toHaveBeenCalled();
  });

  it("una key ya registrada en otro documento: error y el archivo NO se borra", async () => {
    docCount.mockResolvedValue(1);
    const r = await confirmarDocumento(base);
    expect(r.ok).toBe(false);
    expect(docCreate).not.toHaveBeenCalled();
    expect(deleteObj).not.toHaveBeenCalled();
  });

  it("título inválido con una key registrada no borra; con una key libre, sí", async () => {
    docCount.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    expect((await confirmarDocumento({ ...base, titulo: " " })).ok).toBe(false);
    expect(deleteObj).not.toHaveBeenCalled();

    docCount.mockResolvedValue(0);
    expect((await confirmarDocumento({ ...base, titulo: " " })).ok).toBe(false);
    expect(deleteObj).toHaveBeenCalledWith(KEY);
  });

  it("dirección repetida (P2002): borra el archivo sólo si ningún documento lo usa", async () => {
    docCreate.mockRejectedValue({ code: "P2002" });
    docCount.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
    const r = await confirmarDocumento(base);
    expect(r).toEqual({ ok: false, error: "Ya hay otro documento con esa dirección. Elegí otra." });
    expect(deleteObj).not.toHaveBeenCalled();

    docCount.mockResolvedValue(0);
    await confirmarDocumento(base);
    expect(deleteObj).toHaveBeenCalledWith(KEY);
  });

  it("lo que no es PDF se borra", async () => {
    docCount.mockResolvedValue(0);
    send.mockImplementation(async (cmd: { constructor: { name: string } }) =>
      cmd.constructor.name === "HeadObjectCommand" ? { ContentLength: 1000 } : { Body: { transformToByteArray: async () => new TextEncoder().encode("<html>") } },
    );
    expect(await confirmarDocumento(base)).toEqual({ ok: false, error: "El archivo no es un PDF." });
    expect(deleteObj).toHaveBeenCalledWith(KEY);
  });
});
