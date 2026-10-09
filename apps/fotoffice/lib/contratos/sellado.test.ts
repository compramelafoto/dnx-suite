import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PDFDocument } from "pdf-lib";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: async () => ({
    organizationName: "DNX Estudio", signature: { html: "<p>DNX</p>", text: "DNX" },
    contact: { email: "hola@dnx.test", phone: null, whatsapp: null, website: null, instagram: null, city: null },
  }),
}));

const S = await import("./sellado");
const P = await import("./pdf");
const F = await import("./firma");
const { huellaTexto } = await import("./huella");
const { pngConTrazo } = await import("./png-prueba");

const AHORA = new Date("2026-10-09T18:40:00.000Z");
const TEXTO = "# Contrato C-1\n\nCláusula **primera**: el niño y el pingüino.";
const PNG = pngConTrazo() as Uint8Array;

type Salida = { to: string; subject: string; attachments?: { filename: string; content: Uint8Array; contentType?: string }[] };
let enviados: Salida[];
let respuesta: { status: "SENT"; providerId: string } | { status: "PROVIDER_REJECTED"; detail: string };
const enviar = async (m: Salida) => {
  enviados.push(m);
  return respuesta as never;
};
const leer = vi.fn(async (clave: string): Promise<Uint8Array> => {
  if (clave.endsWith(".png")) return PNG;
  const f = guardados.get(clave);
  if (!f) throw new Error("no está");
  return f;
});
const guardados = new Map<string, Uint8Array>();
const subir = vi.fn(async (clave: string, bytes: Uint8Array) => void guardados.set(clave, bytes));
const deps = (extra: Record<string, unknown> = {}) => ({ ahora: () => AHORA, leer, subir, enviar, organizacion: "DNX Estudio", ...extra }) as never;

const contrato = () => B.datos.fotofficeContrato[0]!;
const tipos = () => B.datos.fotofficeContratoEvento.map((e) => e.type);

function sembrarFirmante(id: string, orden: number, extra: Record<string, unknown> = {}) {
  B.agregar("fotofficeContratoFirmante", {
    id, workspaceId: "ws-1", versionId: "v1", orden, name: orden === 1 ? "Gómez, Ana" : "Pérez, Luis", docNumber: "DNI 30.111.222",
    email: orden === 1 ? "ana@x.com" : "luis@x.com", tokenHash: `h-${id}`, tokenExpiresAt: new Date("2026-11-08T00:00:00Z"),
    typedName: orden === 1 ? "Ana Gómez" : "Luis Pérez", signatureKey: `contratos/ws-1/k1/${id}.png`, signedAt: new Date("2026-10-09T18:30:00Z"),
    verifiedAt: new Date("2026-10-09T18:28:00Z"), ipHash: "0123456789abcdef", userAgent: "Navegador/1", ...extra,
  });
}

beforeEach(() => {
  B.vaciar();
  enviados = [];
  guardados.clear();
  leer.mockClear();
  subir.mockClear();
  respuesta = { status: "SENT", providerId: "prov-1" };
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  B.agregar("fotofficeContrato", {
    id: "k1", workspaceId: "ws-1", pedidoId: "p1", clientId: "c1", number: "C-1", name: "Contrato de cobertura", status: "FIRMADO",
    bodyText: TEXTO, currentVersionId: "v1", signedAt: new Date("2026-10-09T18:30:00Z"), ownerUserId: 7,
  });
  B.agregar("fotofficeContratoVersion", { id: "v1", workspaceId: "ws-1", contratoId: "k1", number: 1, bodyText: TEXTO, contentHash: huellaTexto(TEXTO), sentAt: new Date("2026-10-01T12:00:00Z") });
  sembrarFirmante("f1", 1);
  sembrarFirmante("f2", 2);
  B.agregar("fotofficeContratoAjustes", { workspaceId: "ws-1", companyName: "DNX Estudio SRL", companySignatureKey: "contratos/ws-1/empresa/firma-1.png" });
});

describe("generarPdfContrato", () => {
  it("arma el PDF, lo guarda en R2 privado con su huella y deja el evento", async () => {
    const r = await P.generarPdfContrato("k1", deps());
    expect(r).toMatchObject({ ok: true, pdfKey: "contratos/ws-1/k1/contrato-C-1-v1.pdf", yaExistia: false });
    const bytes = guardados.get("contratos/ws-1/k1/contrato-C-1-v1.pdf")!;
    expect(subir).toHaveBeenCalledTimes(1);
    expect(subir.mock.calls[0]![0]).toBe("contratos/ws-1/k1/contrato-C-1-v1.pdf");
    expect(contrato()).toMatchObject({ pdfKey: "contratos/ws-1/k1/contrato-C-1-v1.pdf", pdfHash: createHash("sha256").update(bytes).digest("hex") });
    expect(tipos()).toEqual(["PDF_GENERADO"]);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
    const mupdf = await import("mupdf");
    const d = mupdf.Document.openDocument(Buffer.from(bytes), "application/pdf");
    const texto = d.loadPage(0).toStructuredText("").asText() + d.loadPage(1).toStructuredText("").asText();
    expect(texto).toContain("Contrato C-1");
    expect(texto).toContain("pingüino");
    expect(texto).toContain("DNX Estudio SRL");
    expect(texto).toContain("Luis Pérez");
    expect(texto).toContain(huellaTexto(TEXTO));
    expect(texto).toContain("a***@x.com");
    // Se leyeron las dos firmas de los firmantes y la de la empresa.
    expect(leer.mock.calls.map((c) => c[0]).sort()).toEqual(["contratos/ws-1/empresa/firma-1.png", "contratos/ws-1/k1/f1.png", "contratos/ws-1/k1/f2.png"]);
  });

  it("es idempotente: la segunda vez no genera ni sube nada", async () => {
    await P.generarPdfContrato("k1", deps());
    const hash = contrato().pdfHash;
    const r = await P.generarPdfContrato("k1", deps());
    expect(r).toMatchObject({ ok: true, yaExistia: true, pdfHash: hash });
    expect(subir).toHaveBeenCalledTimes(1);
    expect(tipos()).toEqual(["PDF_GENERADO"]);
  });

  it("sólo sella contratos firmados por todos (no borrador, no en papel, no con firmas faltantes)", async () => {
    Object.assign(contrato(), { status: "FIRMADO_PARCIAL" });
    expect(await P.generarPdfContrato("k1", deps())).toEqual({ ok: false, codigo: "NO_FIRMADO" });
    Object.assign(contrato(), { status: "FIRMADO", manualSignedAt: AHORA });
    expect(await P.generarPdfContrato("k1", deps())).toEqual({ ok: false, codigo: "NO_FIRMADO" });
    Object.assign(contrato(), { manualSignedAt: null });
    Object.assign(B.datos.fotofficeContratoFirmante[1]!, { signedAt: null });
    expect(await P.generarPdfContrato("k1", deps())).toEqual({ ok: false, codigo: "FALTAN_FIRMAS" });
    expect(await P.generarPdfContrato("no-existe", deps())).toEqual({ ok: false, codigo: "NO_EXISTE" });
    expect(subir).not.toHaveBeenCalled();
    expect(contrato().pdfKey).toBeNull();
  });

  it("no sella un texto que ya no coincide con su huella", async () => {
    Object.assign(B.datos.fotofficeContratoVersion[0]!, { bodyText: `${TEXTO} (cambiado)` });
    expect(await P.generarPdfContrato("k1", deps())).toEqual({ ok: false, codigo: "HUELLA_DISTINTA" });
    expect(subir).not.toHaveBeenCalled();
  });

  it("si no se puede leer una firma, no guarda nada y devuelve un código", async () => {
    leer.mockImplementationOnce(async () => {
      throw new Error("R2 caído");
    });
    const r = await P.generarPdfContrato("k1", deps());
    expect(r.ok).toBe(false);
    expect(subir).not.toHaveBeenCalled();
    expect(contrato().pdfKey).toBeNull();
    expect(tipos()).toEqual([]);
  });

  it("si subir falla se deshace todo: sin pdfKey ni evento", async () => {
    subir.mockRejectedValueOnce(new Error("R2 caído"));
    expect(await P.generarPdfContrato("k1", deps())).toEqual({ ok: false, codigo: "ERROR" });
    expect(contrato().pdfKey).toBeNull();
  });
});

describe("enviarPdfFirmado", () => {
  beforeEach(async () => {
    await P.generarPdfContrato("k1", deps());
  });

  it("manda el PDF adjunto a cada firmante y a la organización, y marca pdfSentAt", async () => {
    const r = await S.enviarPdfFirmado("k1", deps());
    expect(r).toBe("ENVIADO");
    expect(enviados.map((e) => e.to).sort()).toEqual(["ana@x.com", "hola@dnx.test", "luis@x.com"]);
    for (const e of enviados) {
      expect(e.subject).toBe("El contrato C-1 quedó firmado");
      expect(e.attachments).toHaveLength(1);
      expect(e.attachments![0]).toMatchObject({ filename: "contrato-C-1.pdf", contentType: "application/pdf" });
      expect(createHash("sha256").update(e.attachments![0]!.content).digest("hex")).toBe(contrato().pdfHash);
    }
    expect(contrato().pdfSentAt).toEqual(AHORA);
    expect(tipos()).toEqual(["PDF_GENERADO", "PDF_ENVIADO"]);
    expect(B.datos.fotofficeMessage.every((m) => m.entityType === "CONTRATO" && m.entityId === "k1")).toBe(true);
  });

  it("no repite a quien ya recibió: la segunda llamada no manda nada", async () => {
    await S.enviarPdfFirmado("k1", deps());
    enviados.length = 0;
    expect(await S.enviarPdfFirmado("k1", deps())).toBe("YA_ENVIADO");
    expect(enviados).toHaveLength(0);
  });

  it("una sola corrida gana la reserva aunque dos entren a la vez", async () => {
    const [a, b] = await Promise.all([S.enviarPdfFirmado("k1", deps()), S.enviarPdfFirmado("k1", deps())]);
    expect([a, b].sort()).toEqual(["ENVIADO", "YA_ENVIADO"]);
    expect(enviados).toHaveLength(3);
  });

  it("si el proveedor rechaza todo, suelta la reserva y se puede reintentar", async () => {
    respuesta = { status: "PROVIDER_REJECTED", detail: "HTTP 500" };
    expect(await S.enviarPdfFirmado("k1", deps())).toBe("PENDIENTE");
    expect(contrato().pdfSentAt).toBeNull();
    expect(tipos()).toEqual(["PDF_GENERADO"]);
    respuesta = { status: "SENT", providerId: "prov-2" };
    expect(await S.enviarPdfFirmado("k1", deps())).toBe("ENVIADO");
    expect(contrato().pdfSentAt).toEqual(AHORA);
  });

  it("si el archivo guardado no coincide con su huella, no manda nada", async () => {
    guardados.set(contrato().pdfKey as string, new Uint8Array([1, 2, 3]));
    expect(await S.enviarPdfFirmado("k1", deps())).toBe("ERROR");
    expect(enviados).toHaveLength(0);
    expect(contrato().pdfSentAt ?? null).toBeNull();
  });

  it("sin PDF todavía o contrato sin firmar: no hace nada", async () => {
    Object.assign(contrato(), { pdfKey: null });
    expect(await S.enviarPdfFirmado("k1", deps())).toBe("SIN_PDF");
    expect(await S.enviarPdfFirmado("no-existe", deps())).toBe("SIN_PDF");
    expect(enviados).toHaveLength(0);
  });

  it("dos firmantes con la misma dirección reciben una sola copia", async () => {
    Object.assign(B.datos.fotofficeContratoFirmante[1]!, { email: "ana@x.com" });
    await S.enviarPdfFirmado("k1", deps());
    expect(enviados.map((e) => e.to).sort()).toEqual(["ana@x.com", "hola@dnx.test"]);
  });
});

describe("finalizarContratoFirmado y alFirmarContrato", () => {
  it("genera y envía de una vez; repetirlo no duplica", async () => {
    expect(await S.finalizarContratoFirmado("k1", deps())).toEqual({ ok: true, pdf: "GENERADO", envio: "ENVIADO" });
    expect(await S.finalizarContratoFirmado("k1", deps())).toEqual({ ok: true, pdf: "YA_EXISTIA", envio: "YA_ENVIADO" });
    expect(enviados).toHaveLength(3);
  });

  it("alFirmarContrato nunca lanza, aunque el almacenamiento no esté configurado", async () => {
    await expect(F.alFirmarContrato("k1")).resolves.toBeUndefined();
    await expect(F.alFirmarContrato("no-existe")).resolves.toBeUndefined();
  });
});
