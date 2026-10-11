import { createHash } from "node:crypto";
import { generateKeyPairSync } from "node:crypto";
import { PDFDocument, PDFPage } from "pdf-lib";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { certificatePayload, xmpPacket } from "@repo/muestras";
import { tablaFalsa } from "./base-falsa.test-util";

type Fila = Record<string, unknown>;
const t = vi.hoisted(() => ({ db: null as unknown as Record<string, unknown>, bucket: new Map<string, Buffer>() }));
const qr = vi.hoisted(() => ({ urls: [] as string[] }));
vi.mock("@repo/db", () => ({ prisma: new Proxy({}, { get: (_x, k: string) => t.db[k] }) }));
vi.mock("@/lib/fichas/cargar", () => ({ baseUrlPublica: () => "https://muestrasfotograficas.com" }));
vi.mock("@/lib/fichas/qr", () => ({
  matrizDelQr: (url: string) => {
    qr.urls.push(url);
    return [[true, false], [false, true]];
  },
}));
vi.mock("./r2-privado", () => ({
  leerPrivado: async (k: string) => t.bucket.get(k) ?? null,
  subirPrivado: async (k: string, b: Uint8Array) => void t.bucket.set(k, Buffer.from(b)),
}));
vi.mock("./mp", () => ({ leerOrden: vi.fn() }));

const cert = await import("./certificado");
const { jpegConXmp, archivoFirmado } = await import("./archivo-firmado");
const { verificarCodigo } = await import("./verificar");
const { certificarCopia } = await import("./conciliar");

const nuevaClave = () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  return {
    privada: Buffer.from(privateKey.export({ type: "pkcs8", format: "pem" }).toString()).toString("base64"),
    publica: publicKey.export({ type: "spki", format: "pem" }).toString(),
  };
};

const emitida = new Date("2026-11-14T15:00:00.000Z");
let copias: Fila[];
let pedidos: Fila[];
let eventos: Fila[];

beforeEach(() => {
  t.bucket.clear();
  qr.urls = [];
  const k = nuevaClave();
  vi.stubEnv("MUESTRAS_CERT_PRIVATE_KEY", k.privada);
  vi.stubEnv("MUESTRAS_CERT_KEY_ID", "mf-test-1");
  vi.stubEnv("MUESTRAS_CERT_OLD_PUBLIC_KEYS", "");
  copias = [{ id: "c1", offerId: "of1", orderId: "o1", kind: "COPY", number: 3, status: "ISSUED", isTest: false, issuedAt: emitida, certificateCode: null, voidedAt: null }];
  pedidos = [{ id: "o1", status: "PAID", copyId: "c1", offerId: "of1", buyerName: "Bea Compradora", buyerOnCertificate: false }];
  eventos = [];
  t.db = {
    culturalEditionCopy: tablaFalsa(copias, "c"),
    culturalSaleOrder: tablaFalsa(pedidos, "o"),
    culturalSaleEvent: tablaFalsa(eventos, "e"),
    culturalWorkOffer: tablaFalsa([{ id: "of1", activityId: "a1", activityWorkId: "aw1", authorUserId: 50, format: "PRINT", editionKind: "LIMITED", editionSize: 10, proofCount: 0, paper: "Hahnemühle Photo Rag 308 g", widthCm: 40, heightCm: 60 }], "of"),
    culturalActivity: {
      findUnique: async () => ({
        title: "Silos del litoral", venueName: "Centro Cultural", city: "Rosario", isVirtualOnly: false, slug: "silos", reviewStatus: "APPROVED",
        galleryMode: "FULL", visibility: null, startsAt: new Date("2026-10-01T03:00:00Z"), endsAt: new Date("2026-12-01T03:00:00Z"),
        works: [{ id: "aw1", isHighlight: true, sortOrder: 0, imageUrl: "https://pub.example/x.webp", authorProfile: { slug: "ana" } }],
      }),
    },
    culturalActivityWork: tablaFalsa([{ id: "aw1", title: "El río a la siesta", authorName: "Ana Pérez" }], "aw"),
    culturalSaleFile: tablaFalsa([{ id: "f1", activityWorkId: "aw1", sha256: "a".repeat(64), status: "READY", storageKey: "originales/50/aw1", widthPx: 64, heightPx: 48 }], "f"),
    culturalAuthorSignature: tablaFalsa([], "s"),
  };
});
afterEach(() => vi.unstubAllEnvs());

describe("firma Ed25519", () => {
  it("firma y verifica; un carácter cambiado invalida", () => {
    const { kid, signature } = cert.firmarCertificado('{"code":"ABC"}');
    expect(kid).toBe("mf-test-1");
    expect(cert.verificarFirma('{"code":"ABC"}', signature, kid)).toBe(true);
    expect(cert.verificarFirma('{"code":"ABD"}', signature, kid)).toBe(false);
    expect(cert.verificarFirma('{"code":"ABC"}', signature, "otro-kid")).toBe(false);
  });

  it("un kid viejo verifica con su clave pública anterior", () => {
    const vieja = nuevaClave();
    vi.stubEnv("MUESTRAS_CERT_PRIVATE_KEY", vieja.privada);
    vi.stubEnv("MUESTRAS_CERT_KEY_ID", "mf-viejo");
    const { signature } = cert.firmarCertificado("texto");
    vi.stubEnv("MUESTRAS_CERT_PRIVATE_KEY", nuevaClave().privada);
    vi.stubEnv("MUESTRAS_CERT_KEY_ID", "mf-nuevo");
    expect(cert.verificarFirma("texto", signature, "mf-viejo")).toBe(false);
    vi.stubEnv("MUESTRAS_CERT_OLD_PUBLIC_KEYS", JSON.stringify({ "mf-viejo": vieja.publica }));
    expect(cert.verificarFirma("texto", signature, "mf-viejo")).toBe(true);
    expect(Object.keys(cert.clavesPublicas()).sort()).toEqual(["mf-nuevo", "mf-viejo"]);
    expect(Object.values(cert.clavesPublicas()).join()).not.toContain("PRIVATE");
  });

  it("sin clave: error claro", () => {
    vi.stubEnv("MUESTRAS_CERT_PRIVATE_KEY", "");
    expect(() => cert.firmarCertificado("x")).toThrow(cert.FaltaLaClaveDelCertificado);
  });
});

const datos = (extra: Partial<Parameters<typeof cert.pdfDeCertificado>[0]> = {}) => ({
  codigo: "ABCDEFGHJKMN", kid: "mf-test-1", numero: "3/10", obra: "El río a la siesta", autor: "Ana Pérez",
  formato: "Copia impresa Fine Art · Hahnemühle · 40 × 60 cm", muestra: "Silos", sede: "Rosario", emitido: emitida,
  comprador: null, originalSha256: "a".repeat(64), firmaPng: null, prueba: false, ...extra,
});

describe("PDF del certificado y etiqueta", () => {
  it("una página A4 con el QR a /verificar/<código>", async () => {
    const bytes = await cert.pdfDeCertificado(datos());
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(1);
    expect(qr.urls).toEqual(["https://muestrasfotograficas.com/verificar/ABCDEFGHJKMN"]);
  });

  it("en prueba lleva la marca de agua; real, no", async () => {
    const espia = vi.spyOn(PDFPage.prototype, "drawText");
    await cert.pdfDeCertificado(datos({ prueba: true }));
    expect(espia.mock.calls.some((c) => String(c[0]).includes("CERTIFICADO DE PRUEBA"))).toBe(true);
    espia.mockClear();
    await cert.pdfDeCertificado(datos());
    expect(espia.mock.calls.some((c) => String(c[0]).includes("PRUEBA"))).toBe(false);
    espia.mockRestore();
  });

  it("con la firma escaneada del autor", async () => {
    const png = await sharp({ create: { width: 200, height: 60, channels: 3, background: "#ffffff" } }).png().toBuffer();
    await expect(cert.pdfDeCertificado(datos({ firmaPng: new Uint8Array(png) }))).resolves.toBeInstanceOf(Uint8Array);
  });

  it("la etiqueta: A4 con el QR del código", async () => {
    const doc = await PDFDocument.load(await cert.pdfDeEtiqueta(datos()));
    expect(Math.round(doc.getPage(0).getWidth())).toBe(595);
    expect(qr.urls).toEqual(["https://muestrasfotograficas.com/verificar/ABCDEFGHJKMN"]);
  });
});

describe("certificarCopia, archivo firmado y verificación", () => {
  it("firma el texto canónico; sin aceptar figurar, el comprador no va", async () => {
    expect(await certificarCopia("c1", emitida)).toBe("OK");
    const c = copias[0]!;
    expect(c.certificateCode).toMatch(/^[A-Z0-9]{12}$/);
    const payload = String(c.certificatePayload);
    expect(payload).not.toContain("Bea");
    expect(payload).toBe(certificatePayload({
      code: String(c.certificateCode), kid: "mf-test-1", activityTitle: "Silos del litoral", workTitle: "El río a la siesta", authorName: "Ana Pérez",
      format: "PRINT", editionKind: "LIMITED", kind: "COPY", number: 3, editionSize: 10, proofCount: 0, paper: "Hahnemühle Photo Rag 308 g",
      widthCm: 40, heightCm: 60, originalSha256: "a".repeat(64), issuedAt: emitida, buyerName: "Bea Compradora", buyerOnCertificate: false, isTest: false,
    }));
    expect(cert.verificarFirma(payload, String(c.certificateSignature), "mf-test-1")).toBe(true);
    // Idempotente.
    expect(await certificarCopia("c1", emitida)).toBe("YA_TENIA");
  });

  it("sin la clave no emite: alerta en el pedido y queda para el barrido", async () => {
    vi.stubEnv("MUESTRAS_CERT_PRIVATE_KEY", "");
    expect(await certificarCopia("c1", emitida)).toBe("SIN_CLAVE");
    expect(copias[0]!.certificateCode).toBeNull();
    expect(eventos.map((e) => e.detail)).toEqual([expect.stringMatching(/^ALERT_NO_CERT_KEY/)]);
  });

  it("verificar: válido, anulado y firma alterada", async () => {
    await certificarCopia("c1", emitida);
    const codigo = String(copias[0]!.certificateCode);
    const ok = await verificarCodigo(codigo.toLowerCase().replace(/(.{4})/g, "$1-"), new Date("2026-11-20T15:00:00Z"));
    expect(ok).toMatchObject({ encontrado: true, estado: "VALID", numero: "3/10", obra: "El río a la siesta", miniatura: "https://pub.example/x.webp", enlaceAutor: "/fotografos/ana" });
    expect(ok.encontrado && ok.comprador).toBeNull();

    copias[0]!.status = "VOIDED";
    copias[0]!.voidedAt = new Date("2026-11-18T15:00:00Z");
    const anulada = await verificarCodigo(codigo);
    expect(anulada).toMatchObject({ estado: "VOIDED" });
    expect(anulada.encontrado && anulada.titulo).toMatch(/anulada/);

    copias[0]!.status = "ISSUED";
    copias[0]!.certificatePayload = String(copias[0]!.certificatePayload).replace('"number":3', '"number":4');
    expect(await verificarCodigo(codigo)).toMatchObject({ estado: "INVALID_SIGNATURE", miniatura: null });
  });

  it("código mal escrito o inexistente: el mismo 'no encontrado'", async () => {
    expect(await verificarCodigo("hola")).toEqual({ encontrado: false });
    expect(await verificarCodigo("ABCDEFGHJKMN")).toEqual({ encontrado: false });
  });

  it("archivo firmado: JPEG con el XMP (código y firma) y queda guardado", async () => {
    const original = await sharp({ create: { width: 64, height: 48, channels: 3, background: "#336699" } }).png().toBuffer();
    // La huella guardada es la del archivo de verdad (se vuelve a verificar al armar la copia).
    (t.db.culturalSaleFile as { filas: Record<string, unknown>[] }).filas[0]!.sha256 = createHash("sha256").update(original).digest("hex");
    await certificarCopia("c1", emitida);
    t.bucket.set("originales/50/aw1", original);
    const a = await archivoFirmado("o1");
    expect(a).not.toBeNull();
    const meta = await sharp(a!.bytes).metadata();
    expect(meta.format).toBe("jpeg");
    expect([meta.width, meta.height]).toEqual([64, 48]);
    const xmp = meta.xmp!.toString();
    expect(xmp).toContain(String(copias[0]!.certificateCode));
    expect(xmp).toContain(String(copias[0]!.certificateSignature));
    expect(xmp).toContain("/verificar/");
    expect(t.bucket.has(`ventas/o1/${copias[0]!.certificateCode}.jpg`)).toBe(true);
  });

  it("archivo firmado: si el original del bucket no coincide con su huella, no se entrega", async () => {
    await certificarCopia("c1", emitida);
    t.bucket.set("originales/50/aw1", await sharp({ create: { width: 64, height: 48, channels: 3, background: "#000000" } }).png().toBuffer());
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await archivoFirmado("o1")).toBeNull();
    expect(t.bucket.has(`ventas/o1/${copias[0]!.certificateCode}.jpg`)).toBe(false);
    spy.mockRestore();
  });

  it("jpegConXmp incrusta el paquete", async () => {
    const img = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#000" } }).png().toBuffer();
    const out = await jpegConXmp(img, xmpPacket({ title: "T", creator: "A", rights: "R", webStatement: "https://x/verificar/ABC", code: "ABCDEFGHJKMN", edition: "1/2", originalSha256: "b".repeat(64), kid: "k", signature: "firma" }));
    expect((await sharp(out).metadata()).xmp!.toString()).toContain("<mf:code>ABCDEFGHJKMN</mf:code>");
  });

  it("el PDF guardado se genera una vez y después se lee del bucket", async () => {
    await certificarCopia("c1", emitida);
    const a = await cert.pdfGuardado("c1", "certificado");
    expect(a).toBeInstanceOf(Uint8Array);
    expect(t.bucket.has("ventas/o1/certificado.pdf")).toBe(true);
    const llamadas = qr.urls.length;
    await cert.pdfGuardado("c1", "certificado");
    expect(qr.urls.length).toBe(llamadas);
  });
});
