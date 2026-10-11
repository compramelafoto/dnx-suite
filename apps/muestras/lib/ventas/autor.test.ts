import { createHash } from "node:crypto";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  culturalActivityWork: { findUnique: vi.fn(), findMany: vi.fn() },
  culturalExhibitorWork: { findMany: vi.fn() },
  culturalContestWork: { findMany: vi.fn() },
  culturalSaleSetup: { findUnique: vi.fn() },
  culturalSaleAuthorTerms: { upsert: vi.fn() },
  culturalWorkOffer: { count: vi.fn(), create: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() },
  culturalEditionCopy: { count: vi.fn(), findMany: vi.fn() },
  culturalSaleFile: { findUnique: vi.fn(), upsert: vi.fn() },
  culturalAuthorSignature: { upsert: vi.fn() },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
}));
const usuarioActual = vi.hoisted(() => ({ valor: null as null | { id: number; esSuperAdmin: boolean; email: string; name: string | null } }));
const r2 = vi.hoisted(() => ({ urlDeSubida: vi.fn(), leerPrivado: vi.fn(), subirPrivado: vi.fn(), existePrivado: vi.fn(), borrarPrivado: vi.fn() }));
vi.mock("@repo/db", () => ({ prisma: db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: async () => usuarioActual.valor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("./r2-privado", () => r2);

const autor = await import("./autor");
const { resetRateLimit } = await import("@/lib/limite");

const ana = { id: 50, esSuperAdmin: false, email: "ana@x", name: "Ana" };
const otro = { id: 51, esSuperAdmin: false, email: "o@x", name: "Otro" };
let contestSaleConsent: string;
let setup: Record<string, unknown> | null;
let oferta: Record<string, unknown> | null;
let archivo: Record<string, unknown> | null;

function fd(o: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
}
const ofertaBase = (extra: Record<string, unknown> = {}) => ({
  id: "of1", activityId: "a1", activityWorkId: "aw1", authorUserId: 50, format: "PRINT", editionKind: "LIMITED", editionSize: 10, proofCount: 2,
  priceArs: 100_000, approvedPriceArs: null, paper: "Hahnemühle Photo Rag 308 g", widthCm: 40, heightCm: 60, status: "DRAFT", reviewNote: null, firstSoldAt: null,
  ...extra,
});
const impresa = (extra: Record<string, string> = {}) =>
  fd({ activityWorkId: "aw1", formato: "PRINT", edicion: "LIMITED", copias: "10", pruebas: "2", precio: "100000", papel: "Hahnemühle Photo Rag 308 g", ancho: "40", alto: "60", declaracion: "on", ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  usuarioActual.valor = ana;
  contestSaleConsent = "ACCEPTED";
  setup = { id: "s1", activityId: "a1", splitVersion: 3, platformFeeBps: 1500, organizerBps: 2500, photographerBps: 6000 };
  oferta = ofertaBase();
  archivo = null;
  db.culturalActivityWork.findUnique.mockImplementation(async (q: { where: { id: string } }) => (["aw1", "aw2"].includes(q.where.id) ? { id: q.where.id, activityId: "a1" } : null));
  // aw1: obra de expositor de Ana; aw2: obra de concurso de Ana (vendible sólo con la venta aceptada).
  db.culturalExhibitorWork.findMany.mockImplementation(async (q: { where: { exhibitor: { userId?: number } } }) =>
    q.where.exhibitor.userId === undefined || q.where.exhibitor.userId === 50 ? [{ activityWorkId: "aw1", priceArs: 90_000, exhibitor: { userId: 50 } }] : []);
  db.culturalContestWork.findMany.mockImplementation(async (q: { where: { authorUserId: unknown; saleConsent: string } }) =>
    (q.where.authorUserId === 50 && contestSaleConsent === q.where.saleConsent ? [{ activityWorkId: "aw2", authorUserId: 50 }] : []));
  db.culturalActivityWork.findMany.mockImplementation(async (q: { where: { id: { in: string[] } } }) =>
    q.where.id.in.map((id) => ({ id, title: id === "aw1" ? "Silos" : "Delta", imageUrl: "https://pub/x.webp", authorName: "Ana", sortOrder: 0 })));
  db.culturalSaleSetup.findUnique.mockImplementation(async () => setup);
  db.culturalSaleAuthorTerms.upsert.mockResolvedValue({});
  db.culturalWorkOffer.count.mockResolvedValue(0);
  db.culturalWorkOffer.create.mockResolvedValue({ id: "of-nueva" });
  db.culturalWorkOffer.findFirst.mockImplementation(async (q: { where: { id: string; authorUserId: number } }) =>
    oferta && oferta.id === q.where.id && oferta.authorUserId === q.where.authorUserId ? oferta : null);
  db.culturalWorkOffer.updateMany.mockImplementation(async (q: { data: Record<string, unknown> }) => {
    oferta = { ...oferta!, ...q.data };
    return { count: 1 };
  });
  db.culturalEditionCopy.count.mockResolvedValue(0);
  db.culturalEditionCopy.findMany.mockResolvedValue([]);
  db.culturalSaleFile.findUnique.mockImplementation(async () => archivo);
  db.culturalSaleFile.upsert.mockImplementation(async (q: { create: Record<string, unknown>; update: Record<string, unknown> }) => (archivo = archivo ? { ...archivo, ...q.update } : q.create));
  db.culturalAuthorSignature.upsert.mockResolvedValue({});
  db.$transaction.mockImplementation(async (fn: (t: typeof db) => Promise<unknown>) => fn(db));
  db.$queryRaw.mockResolvedValue([]);
  r2.urlDeSubida.mockResolvedValue("https://r2.example/firmada");
  r2.subirPrivado.mockResolvedValue(undefined);
  r2.borrarPrivado.mockResolvedValue(undefined);
});

describe("obras vendibles", () => {
  it("otra cuenta no puede proponer sobre la obra de Ana", async () => {
    usuarioActual.valor = otro;
    expect(await autor.guardarOferta(impresa())).toEqual({ ok: false, errores: ["La muestra no existe."] });
    expect(db.culturalWorkOffer.create).not.toHaveBeenCalled();
  });

  it("una obra de concurso sin la venta aceptada no aparece", async () => {
    contestSaleConsent = "PENDING";
    expect(await autor.guardarOferta(impresa({ activityWorkId: "aw2" }))).toEqual({ ok: false, errores: ["La muestra no existe."] });
    contestSaleConsent = "ACCEPTED";
    expect(await autor.guardarOferta(impresa({ activityWorkId: "aw2" }))).toMatchObject({ ok: true });
  });
});

describe("aceptarReparto", () => {
  it("guarda la versión vigente con los porcentajes", async () => {
    expect(await autor.aceptarReparto(fd({ activityId: "a1", splitVersion: "3" }))).toEqual({ ok: true });
    expect(db.culturalSaleAuthorTerms.upsert.mock.calls[0]![0].create).toMatchObject({ activityId: "a1", userId: 50, splitVersion: 3, organizerBps: 2500, photographerBps: 6000, platformFeeBps: 1500 });
  });
  it("con una versión vieja → pide recargar", async () => {
    expect(await autor.aceptarReparto(fd({ activityId: "a1", splitVersion: "2" }))).toEqual({ ok: false, errores: ["El reparto cambió: recargá la página."] });
    expect(db.culturalSaleAuthorTerms.upsert).not.toHaveBeenCalled();
  });
  it("sin obras vendibles en esa muestra → no existe", async () => {
    usuarioActual.valor = otro;
    expect(await autor.aceptarReparto(fd({ activityId: "a1", splitVersion: "3" }))).toEqual({ ok: false, errores: ["La muestra no existe."] });
  });
});

describe("guardarOferta", () => {
  it("crea una impresa de edición limitada en borrador", async () => {
    expect(await autor.guardarOferta(impresa())).toEqual({ ok: true, id: "of-nueva" });
    expect(db.culturalWorkOffer.create.mock.calls[0]![0].data).toMatchObject({
      activityId: "a1", activityWorkId: "aw1", authorUserId: 50, format: "PRINT", editionKind: "LIMITED", editionSize: 10, proofCount: 2,
      priceArs: 100_000, paper: "Hahnemühle Photo Rag 308 g", widthCm: 40, heightCm: 60, status: "DRAFT",
    });
  });
  it("una oferta inválida → mensaje", async () => {
    const r = await autor.guardarOferta(impresa({ precio: "500" }));
    expect(r).toEqual({ ok: false, errores: ["El precio va de $1.000 a $20.000.000, en pesos enteros."] });
  });
  it("la séptima oferta de una obra → mensaje", async () => {
    db.culturalWorkOffer.count.mockResolvedValue(6);
    expect(await autor.guardarOferta(impresa())).toEqual({ ok: false, errores: ["Cada obra puede tener hasta 6 formatos."] });
    expect(db.culturalWorkOffer.create).not.toHaveBeenCalled();
  });
  it("edición limitada sin la declaración → mensaje", async () => {
    const f = impresa();
    f.delete("declaracion");
    expect(await autor.guardarOferta(f)).toEqual({ ok: false, errores: ["Marcá la declaración de la edición limitada."] });
  });
  it("una copia digital única no pide declaración", async () => {
    expect(await autor.guardarOferta(fd({ activityWorkId: "aw1", formato: "DIGITAL", edicion: "UNIQUE", precio: "50000" }))).toMatchObject({ ok: true });
    expect(db.culturalWorkOffer.create.mock.calls[0]![0].data).toMatchObject({ format: "DIGITAL", editionSize: 1, paper: null, widthCm: null });
  });
  it("editar un formato con cambios pedidos que todavía vende borra el precio aprobado si cambia algo más que el precio", async () => {
    oferta = ofertaBase({ status: "CHANGES_REQUESTED", approvedPriceArs: 100_000 });
    expect(await autor.guardarOferta(impresa({ id: "of1", papel: "Canson Baryta 310 g" }))).toMatchObject({ ok: true });
    expect(oferta).toMatchObject({ paper: "Canson Baryta 310 g", approvedPriceArs: null });
  });
  it("bajar N por debajo del número más alto ocupado (aunque sea de prueba) → mensaje", async () => {
    oferta = ofertaBase({ status: "CHANGES_REQUESTED" });
    const filas = [
      { id: "c7", number: 7, status: "ISSUED", reservedUntil: null, isTest: true, kind: "COPY" },
      { id: "p2", number: 2, status: "ISSUED", reservedUntil: null, isTest: false, kind: "PROOF" },
    ];
    db.culturalEditionCopy.findMany.mockImplementation(async (q: { where: { kind: string } }) => filas.filter((f) => f.kind === q.where.kind));
    expect(await autor.guardarOferta(impresa({ id: "of1", copias: "5" }))).toEqual({
      ok: false, errores: ["Ya hay una copia con el número 7: la edición no puede tener menos de 7 copias."],
    });
    expect(await autor.guardarOferta(impresa({ id: "of1", copias: "7" }))).toMatchObject({ ok: true });
  });
  it("bajar las P/A por debajo de la mayor emitida → mensaje", async () => {
    oferta = ofertaBase({ status: "CHANGES_REQUESTED" });
    db.culturalEditionCopy.findMany.mockImplementation(async (q: { where: { kind: string } }) =>
      q.where.kind === "PROOF" ? [{ id: "p2", number: 2, status: "ISSUED", reservedUntil: null, isTest: false, kind: "PROOF" }] : []);
    expect(await autor.guardarOferta(impresa({ id: "of1", pruebas: "1" }))).toEqual({
      ok: false, errores: ["Ya se emitió la P/A 2: no puede haber menos de 2 pruebas de autor."],
    });
    expect(oferta).toMatchObject({ proofCount: 2 });
  });
  it("un formato ya enviado no se edita (se cambia el precio o se retira)", async () => {
    oferta = ofertaBase({ status: "APPROVED", approvedPriceArs: 100_000 });
    expect(await autor.guardarOferta(impresa({ id: "of1" }))).toEqual({ ok: false, errores: ["Este formato ya fue enviado: podés cambiar el precio o retirarlo."] });
  });
});

describe("transiciones del autor", () => {
  it("proponer un borrador lo manda a revisión", async () => {
    expect(await autor.proponerOferta("of1")).toEqual({ ok: true });
    expect(oferta).toMatchObject({ status: "PROPOSED" });
  });
  it("cambiar el precio de una aprobada → PROPOSED con el precio aprobado intacto", async () => {
    oferta = ofertaBase({ status: "APPROVED", approvedPriceArs: 100_000 });
    expect(await autor.cambiarPrecio("of1", 130_000)).toEqual({ ok: true });
    expect(oferta).toMatchObject({ status: "PROPOSED", priceArs: 130_000, approvedPriceArs: 100_000 });
  });
  it("otra cuenta no toca el formato", async () => {
    usuarioActual.valor = otro;
    expect(await autor.retirarOferta("of1")).toEqual({ ok: false, errores: ["Ese formato no existe."] });
  });
  it("pedir las P/A deja la marca para la organización", async () => {
    oferta = ofertaBase({ status: "APPROVED", approvedPriceArs: 100_000 });
    expect(await autor.pedirPruebaDeAutor("of1")).toEqual({ ok: true });
    expect(String(oferta!.reviewNote)).toMatch(/^Pedido de P\/A:/);
    // Cuenta las P/A del mismo ambiente con el que las emite la organización (sandbox → de prueba).
    expect(db.culturalEditionCopy.count.mock.calls.at(-1)![0].where).toMatchObject({ offerId: "of1", kind: "PROOF", isTest: true });
  });
  it("pedir las P/A en producción cuenta sólo las reales", async () => {
    vi.stubEnv("MUESTRAS_MP_ENV", "production");
    oferta = ofertaBase({ status: "APPROVED", approvedPriceArs: 100_000 });
    await autor.pedirPruebaDeAutor("of1");
    expect(db.culturalEditionCopy.count.mock.calls.at(-1)![0].where).toMatchObject({ isTest: false });
    vi.unstubAllEnvs();
  });
});

describe("original", () => {
  it("una subida de 90 MB → mensaje", async () => {
    expect(await autor.pedirSubidaDeOriginal("aw1", { mime: "image/jpeg", bytes: 90 * 1024 * 1024 })).toEqual({ ok: false, errores: ["El original puede pesar hasta 80 MB."] });
    expect(r2.urlDeSubida).not.toHaveBeenCalled();
  });
  it("da una URL firmada con una clave propia", async () => {
    const r = await autor.pedirSubidaDeOriginal("aw1", { mime: "image/tiff", bytes: 50_000_000 });
    expect(r).toMatchObject({ ok: true, url: "https://r2.example/firmada" });
    expect((r as { clave: string }).clave).toMatch(/^originales\/50\/aw1-[a-z0-9]{12}$/);
  });
  it("con una copia ya emitida no se puede reemplazar", async () => {
    db.culturalEditionCopy.count.mockResolvedValue(1);
    expect(await autor.pedirSubidaDeOriginal("aw1", { mime: "image/jpeg", bytes: 1000 })).toEqual({ ok: false, errores: ["Esta obra ya vendió copias (o tiene una compra en curso): el original no se puede cambiar."] });
  });
  it("confirmar calcula el SHA-256, mide y lo deja listo", async () => {
    const png = await sharp({ create: { width: 30, height: 20, channels: 3, background: "#808080" } }).png().toBuffer();
    r2.existePrivado.mockResolvedValue({ bytes: png.length, contentType: "image/png" });
    r2.leerPrivado.mockResolvedValue(png);
    const clave = "originales/50/aw1-abcdefghijkl";
    expect(await autor.confirmarOriginal("aw1", clave)).toEqual({ ok: true });
    expect(archivo).toMatchObject({
      activityWorkId: "aw1", activityId: "a1", authorUserId: 50, storageKey: clave, status: "READY", mime: "image/png", widthPx: 30, heightPx: 20,
      sha256: createHash("sha256").update(png).digest("hex"), bytes: png.length,
    });
  });
  it("una compra real en curso (reserva vigente) también deja fijo el original", async () => {
    db.culturalEditionCopy.count.mockImplementation(async (q: { where: { isTest: boolean; OR: Record<string, unknown>[] } }) => {
      expect(q.where.isTest).toBe(false);
      expect(q.where.OR).toContainEqual({ status: "RESERVED", reservedUntil: { gt: expect.any(Date) } });
      return 1;
    });
    expect((await autor.pedirSubidaDeOriginal("aw1", { mime: "image/jpeg", bytes: 1000 })).ok).toBe(false);
  });
  it("confirmar hace cola por obra (también la primera vez, sin fila que bloquear)", async () => {
    const png = await sharp({ create: { width: 30, height: 20, channels: 3, background: "#808080" } }).png().toBuffer();
    r2.existePrivado.mockResolvedValue({ bytes: png.length, contentType: "image/png" });
    r2.leerPrivado.mockResolvedValue(png);
    await autor.confirmarOriginal("aw1", "originales/50/aw1-abcdefghijkl");
    const cola = db.$queryRaw.mock.calls.find((c) => (c[0] as string[]).join("?").includes("pg_advisory_xact_lock"));
    expect(cola?.[1]).toBe("muestras-original:aw1");
    const orden = db.$queryRaw.mock.calls.map((c) => (c[0] as string[]).join("?"));
    expect(orden.findIndex((x) => x.includes("pg_advisory_xact_lock"))).toBeLessThan(orden.findIndex((x) => x.includes('"CulturalSaleFile"')));
  });
  it("un archivo que no es imagen queda rechazado con el motivo", async () => {
    const basura = Buffer.from("esto no es una imagen");
    r2.existePrivado.mockResolvedValue({ bytes: basura.length, contentType: "image/jpeg" });
    r2.leerPrivado.mockResolvedValue(basura);
    expect(await autor.confirmarOriginal("aw1", "originales/50/aw1-abcdefghijkl")).toEqual({ ok: false, errores: ["No es una imagen JPEG, PNG o TIFF válida."] });
    expect(archivo).toMatchObject({ status: "REJECTED", problem: "No es una imagen JPEG, PNG o TIFF válida." });
  });
  it("una clave ajena no se confirma", async () => {
    expect(await autor.confirmarOriginal("aw1", "originales/51/aw1-abcdefghijkl")).toEqual({ ok: false, errores: ["No encontramos el archivo subido. Probá de nuevo."] });
    expect(r2.leerPrivado).not.toHaveBeenCalled();
  });
});

describe("firma", () => {
  it("se guarda recortada en firmas/<userId>.png", async () => {
    const firma = await sharp({ create: { width: 400, height: 200, channels: 3, background: "#ffffff" } })
      .composite([{ input: await sharp({ create: { width: 100, height: 20, channels: 3, background: "#000000" } }).png().toBuffer(), left: 150, top: 90 }])
      .png()
      .toBuffer();
    const f = new FormData();
    f.set("firma", new Blob([new Uint8Array(firma)], { type: "image/png" }), "firma.png");
    expect(await autor.guardarFirma(f)).toEqual({ ok: true });
    const [clave, bytes, tipo] = r2.subirPrivado.mock.calls[0]!;
    expect(clave).toBe("firmas/50.png");
    expect(tipo).toBe("image/png");
    const meta = await sharp(bytes as Buffer).metadata();
    expect(meta.width).toBeLessThan(400);
    expect(db.culturalAuthorSignature.upsert.mock.calls[0]![0].create).toEqual({ userId: 50, storageKey: "firmas/50.png" });
  });
  it("más del tope (una acción no acepta 1 MB): mensaje claro, sin leerla ni subirla", async () => {
    const { FIRMA_MAX_BYTES, FIRMA_DEMASIADO_GRANDE } = await import("./firma-tope");
    expect(FIRMA_MAX_BYTES).toBeLessThan(1024 * 1024);
    const f = new FormData();
    f.set("firma", new Blob([new Uint8Array(FIRMA_MAX_BYTES + 1)], { type: "image/jpeg" }), "firma.jpg");
    expect(await autor.guardarFirma(f)).toEqual({ ok: false, errores: [FIRMA_DEMASIADO_GRANDE] });
    expect(r2.subirPrivado).not.toHaveBeenCalled();
  });
  it("un archivo de otro tipo → mensaje", async () => {
    const f = new FormData();
    f.set("firma", new Blob(["x"], { type: "application/pdf" }), "firma.pdf");
    expect(await autor.guardarFirma(f)).toEqual({ ok: false, errores: ["La firma tiene que ser PNG o JPEG."] });
  });
});
