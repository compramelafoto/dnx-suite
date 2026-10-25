import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const R2 = vi.hoisted(() => new Map<string, Buffer>());
const enviados = vi.hoisted(() => [] as { to: string; subject: string; text: string; attachments?: { filename: string; content: Uint8Array }[] }[]);
const respuesta = vi.hoisted(() => ({ status: "SENT" as string }));
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("./almacen", async () => {
  const real = await vi.importActual<typeof import("./almacen")>("./almacen");
  return {
    ...real,
    urlDeSubidaOriginal: async (clave: string) => `https://r2.test/${clave}`,
    leerObjeto: async (k: string) => { const b = R2.get(k); if (!b) throw new Error("no está"); return b; },
    guardarObjeto: async (k: string, b: Buffer) => void R2.set(k, b),
    copiarObjeto: async (a: string, b: string) => void R2.set(b, R2.get(a)!),
    tamanoDeObjeto: async (k: string) => R2.get(k)?.length ?? null,
    borrarObjetoImpresion: async (k: string) => void R2.delete(k),
  };
});
vi.mock("@/lib/ficha/adjuntos-r2", () => ({ clienteR2Privado: () => ({}), bucketR2Privado: () => "b", esNoEncontrado: () => false }));
vi.mock("@/lib/communications/load-workspace-sender", () => ({ loadWorkspaceSender: async () => ({ name: "DNX Estudio", replyTo: null }) }));
vi.mock("@/lib/communications/send-email", () => ({
  sendTransactionalEmail: async (m: (typeof enviados)[number]) => {
    enviados.push(m);
    return respuesta.status === "SENT" ? { status: "SENT", providerId: "re-1" } : { status: respuesta.status, detail: "falla" };
  },
}));

const C = await import("./configuracion");
const P = await import("./preparaciones");
const A = await import("./archivo-carnet");
const { recetaInicial } = await import("./receta");

const CTX = { workspaceId: "ws-1", userId: 1, userLabel: "Sabi" };

/** Preparación con la foto ya encuadrada (4 x 4 cm), como la deja el editor. */
async function conPieza(productId: string) {
  const p = await P.crearPreparacion(CTX, { productId, clientId: null });
  if (!p.ok) throw new Error(p.error);
  const foto = await sharp({ create: { width: 1200, height: 1600, channels: 3, background: { r: 120, g: 90, b: 70 } } }).jpeg().toBuffer();
  const s = await P.pedirSubidaOriginal(CTX, p.id, { nombre: "cara.jpg", tipo: "image/jpeg", bytes: foto.length });
  if (!s.ok) throw new Error(s.error);
  R2.set(new URL(s.url).pathname.slice(1), foto);
  const c = await P.confirmarOriginal(CTX, s.originalId);
  if (!c.ok) throw new Error(c.error);
  const g = await P.guardarPiezaCarnet(CTX, p.id, { originalId: s.originalId, anchoMm: 40, altoMm: 40, receta: recetaInicial() });
  if (!g.ok) throw new Error(g.error);
  return p.id;
}

beforeEach(async () => {
  R2.clear();
  B.vaciar();
  enviados.length = 0;
  respuesta.status = "SENT";
  B.agregar("product", { id: "impresa", workspaceId: "ws-1", name: "Foto carnet", priceArs: "3500", isActive: true });
  B.agregar("product", { id: "digital", workspaceId: "ws-1", name: "Foto carnet digital", priceArs: "3000", isActive: true });
  await C.asegurarConfiguracion("ws-1");
  const kodak = (await C.listarSalidas("ws-1")).find((s) => s.nombre === "Kodak 305")!;
  await C.guardarProduccion("ws-1", "impresa", { tipoPieza: "CARNET", salidaId: kodak.id, tamanoHojaId: kodak.tamanos[0]!.id, unidad: "HOJA" });
  await C.guardarProduccion("ws-1", "digital", { tipoPieza: "CARNET", salidaId: null, tamanoHojaId: null, unidad: "ARCHIVO" });
});

describe("foto carnet como archivo", () => {
  it("es la foto sola, a la medida y a 300 ppp", async () => {
    const prep = await conPieza("digital");
    const a = await A.archivoCarnet("ws-1", prep);
    expect(a?.nombre).toBe("foto-carnet-4x4.jpg");
    expect(a?.medida).toBe("4 x 4 cm");
    const meta = await sharp(a!.jpg).metadata();
    expect({ ancho: meta.width, alto: meta.height, formato: meta.format, ppp: meta.density }).toEqual({ ancho: 472, alto: 472, formato: "jpeg", ppp: 300 });
    // Otro negocio no la ve.
    expect(await A.archivoCarnet("ws-2", prep)).toBeNull();
  });

  it("el producto digital no arma plancha y queda entregado sin pasar por la impresora", async () => {
    const prep = await conPieza("digital");
    expect(await P.generarHojaCarnet(CTX, prep, { salidaId: null, tamanoId: null, fotos: null, copias: 1, conLineas: true })).toEqual({
      ok: false,
      error: "Este producto se entrega como archivo digital: no lleva plancha.",
    });
    await A.marcarArchivoEntregado(CTX, prep);
    expect((await P.preparacionPropia("ws-1", prep))?.estado).toBe("IMPRESA");
    // La de un producto impreso no se toca: espera la impresora.
    const impresa = await conPieza("impresa");
    await A.marcarArchivoEntregado(CTX, impresa);
    expect((await P.preparacionPropia("ws-1", impresa))?.estado).toBe("PREPARANDO");
  });

  it("se manda por mail, impresa o digital, con la foto adjunta y queda registrado", async () => {
    for (const producto of ["digital", "impresa"]) {
      const prep = await conPieza(producto);
      expect(await A.enviarFotoCarnetPorMail(CTX, prep, " ana@correo.com ")).toEqual({ ok: true });
    }
    expect(enviados).toHaveLength(2);
    expect(enviados[0]).toMatchObject({ to: "ana@correo.com", subject: "Tu foto carnet" });
    expect(enviados[0]!.text).toContain("4 x 4 cm");
    expect(enviados[0]!.text).toContain("DNX Estudio");
    expect(enviados[0]!.attachments?.[0]?.filename).toBe("foto-carnet-4x4.jpg");
    const registro = B.prisma.sentEmailLog as unknown as { findMany: (a: unknown) => Promise<unknown[]> };
    const log = await registro.findMany({ where: { templateKey: "FOTO_CARNET" } });
    expect(log).toHaveLength(2);
  });

  it("no manda a un mail inválido ni sin foto armada, y avisa si el envío falla", async () => {
    const prep = await conPieza("digital");
    expect(await A.enviarFotoCarnetPorMail(CTX, prep, "no-es-mail")).toEqual({ ok: false, error: "Ese mail no es válido." });
    const vacia = await P.crearPreparacion(CTX, { productId: "digital", clientId: null });
    if (!vacia.ok) throw new Error();
    expect(await A.enviarFotoCarnetPorMail(CTX, vacia.id, "ana@correo.com")).toEqual({ ok: false, error: "Primero armá la foto." });
    respuesta.status = "CONFIGURATION_ERROR";
    expect(await A.enviarFotoCarnetPorMail(CTX, prep, "ana@correo.com")).toEqual({
      ok: false,
      error: "El envío de mails no está configurado. Avisale al administrador.",
    });
    expect(enviados).toHaveLength(1);
  });
});
