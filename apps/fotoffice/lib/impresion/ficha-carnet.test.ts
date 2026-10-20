import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { prisma as prismaReal } from "@repo/db";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const R2 = vi.hoisted(() => new Map<string, Buffer>());
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
vi.mock("@/lib/ficha/eventos", () => ({ registrarEventoPersona: vi.fn(async () => undefined) }));

const C = await import("./configuracion");
const P = await import("./preparaciones");
const F = await import("./ficha-carnet");

/** La tabla de adjuntos de la base en memoria, con los tipos de Prisma. */
const Adjuntos = B.prisma.fotofficeAttachment as unknown as typeof prismaReal.fotofficeAttachment;

const CTX = { workspaceId: "ws-1", userId: 1, userLabel: "Sabi" };

async function jpg(ancho = 1200, alto = 1600) {
  return sharp({ create: { width: ancho, height: alto, channels: 3, background: { r: 120, g: 90, b: 70 } } }).jpeg().toBuffer();
}
/** Crea preparación (con o sin cliente) + original LISTO, como lo dejaría el editor. */
async function conOriginal(productId: string | null, clientId: string | null) {
  const p = await P.crearPreparacion(CTX, { productId, clientId });
  if (!p.ok) throw new Error(p.error);
  const foto = await jpg();
  const s = await P.pedirSubidaOriginal(CTX, p.id, { nombre: "cara.jpg", tipo: "image/jpeg", bytes: foto.length });
  if (!s.ok) throw new Error(s.error);
  R2.set(new URL(s.url).pathname.slice(1), foto);
  const c = await P.confirmarOriginal(CTX, s.originalId);
  if (!c.ok) throw new Error(c.error);
  return { prep: p.id, original: s.originalId };
}

beforeEach(async () => {
  R2.clear();
  B.vaciar();
  B.agregar("product", { id: "carnet", workspaceId: "ws-1", name: "Foto carnet", priceArs: "3500", isActive: true });
  await C.asegurarConfiguracion("ws-1");
  const kodak = (await C.listarSalidas("ws-1")).find((s) => s.nombre === "Kodak 305")!;
  const t10 = kodak.tamanos.find((t) => t.nombre === "10x15")!.id;
  await C.guardarProduccion("ws-1", "carnet", { tipoPieza: "CARNET", salidaId: kodak.id, tamanoHojaId: t10, unidad: "HOJA" });
});

describe("el original de la foto carnet en la ficha del cliente", () => {
  it("con cliente, el original queda en su ficha como FOTO_CARNET y sin vencimiento, una sola vez", async () => {
    B.agregar("client", { id: "cli-1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Mica", lastName: "Gómez", businessName: null });
    const { prep } = await conOriginal("carnet", "cli-1");
    expect(await F.guardarOriginalesEnFicha(CTX, prep)).toBe(0); // ya se copió al confirmar
    const adj = await Adjuntos.findMany({ where: { workspaceId: "ws-1", clientId: "cli-1" } });
    expect(adj).toHaveLength(1);
    expect(adj[0]).toMatchObject({ origen: "FOTO_CARNET", status: "LISTO", purgeAfter: null });
    expect(adj[0].fileName).toMatch(/^Foto carnet original \d{2}-\d{2}-\d{4}\.jpg$/);
    expect(R2.has(adj[0].storageKey)).toBe(true);
  });

  it("sin cliente no guarda nada; al asignarlo después, sí", async () => {
    B.agregar("client", { id: "cli-1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Mica", lastName: "Gómez", businessName: null });
    const { prep } = await conOriginal("carnet", null);
    expect(await Adjuntos.count({ where: { workspaceId: "ws-1" } })).toBe(0);
    expect(await F.asignarCliente(CTX, prep, "cli-1")).toEqual({ ok: true });
    expect(await Adjuntos.count({ where: { workspaceId: "ws-1", clientId: "cli-1" } })).toBe(1);
  });

  it("la copia de la ficha sobrevive a la purga de la preparación", async () => {
    B.agregar("client", { id: "cli-1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Mica", lastName: "Gómez", businessName: null });
    await conOriginal("carnet", "cli-1");
    await P.purgarPreparaciones(new Date(Date.now() + 31 * 86_400_000));
    const adj = await Adjuntos.findMany({ where: { clientId: "cli-1" } });
    expect(R2.has(adj[0].storageKey)).toBe(true);
  });

  it("usar una foto anterior crea un original listo sin duplicar la ficha; la de otro cliente no", async () => {
    B.agregar("client", { id: "cli-1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Mica", lastName: "Gómez", businessName: null });
    B.agregar("client", { id: "cli-2", workspaceId: "ws-1", kind: "PERSONA", firstName: "Leo", lastName: "Paz", businessName: null });
    await conOriginal("carnet", "cli-1");
    const [anterior] = await F.fotosCarnetDelCliente("ws-1", "cli-1");
    const nueva = await P.crearPreparacion(CTX, { productId: "carnet", clientId: "cli-1" });
    if (!nueva.ok) throw new Error();
    expect(await F.usarFotoAnterior(CTX, nueva.id, anterior!.adjuntoId)).toMatchObject({ ok: true });
    expect(await Adjuntos.count({ where: { clientId: "cli-1" } })).toBe(1);
    const ajena = await P.crearPreparacion(CTX, { productId: "carnet", clientId: "cli-2" });
    if (!ajena.ok) throw new Error();
    expect((await F.usarFotoAnterior(CTX, ajena.id, anterior!.adjuntoId)).ok).toBe(false);
  });

  describe("corregir el cliente", () => {
    const fotosDe = (clientId: string) => Adjuntos.findMany({ where: { workspaceId: "ws-1", clientId, origen: "FOTO_CARNET", status: "LISTO" } });
    beforeEach(() => {
      B.agregar("client", { id: "cli-1", workspaceId: "ws-1", kind: "PERSONA", firstName: "Mica", lastName: "Gómez", businessName: null });
      B.agregar("client", { id: "cli-2", workspaceId: "ws-1", kind: "PERSONA", firstName: "Leo", lastName: "Paz", businessName: null });
    });

    it("de X a Y, la foto pasa a la ficha de Y", async () => {
      const { prep } = await conOriginal("carnet", "cli-1");
      const [antes] = await fotosDe("cli-1");
      expect(await F.asignarCliente(CTX, prep, "cli-2")).toEqual({ ok: true });
      expect(await fotosDe("cli-1")).toHaveLength(0);
      const enY = await fotosDe("cli-2");
      expect(enY).toHaveLength(1);
      expect(enY[0]!.id).toBe(antes!.id);
      expect(R2.has(enY[0]!.storageKey)).toBe(true);
      expect(await Adjuntos.count({ where: { workspaceId: "ws-1" } })).toBe(1);
    });

    it("de X a sin cliente, la foto se borra de la ficha (restaurable)", async () => {
      const { prep, original } = await conOriginal("carnet", "cli-1");
      expect(await F.asignarCliente(CTX, prep, null)).toEqual({ ok: true });
      expect(await fotosDe("cli-1")).toHaveLength(0);
      const [borrada] = await Adjuntos.findMany({ where: { workspaceId: "ws-1", clientId: "cli-1" } });
      expect(borrada).toMatchObject({ status: "BORRADO" });
      expect(borrada!.purgeAfter).toBeInstanceOf(Date);
      expect(B.datos.fotofficeOriginalImpresion.find((o) => o.id === original)).toMatchObject({ adjuntoId: null, adjuntoPropio: false });
    });

    it("una foto anterior de X usada en otra preparación no se mueve al corregir el cliente", async () => {
      await conOriginal("carnet", "cli-1");
      const [anterior] = await F.fotosCarnetDelCliente("ws-1", "cli-1");
      const nueva = await P.crearPreparacion(CTX, { productId: "carnet", clientId: "cli-1" });
      if (!nueva.ok) throw new Error();
      expect((await F.usarFotoAnterior(CTX, nueva.id, anterior!.adjuntoId)).ok).toBe(true);
      expect(await F.asignarCliente(CTX, nueva.id, "cli-2")).toEqual({ ok: true });
      expect((await fotosDe("cli-1")).map((a) => a.id)).toEqual([anterior!.adjuntoId]);
      expect(await fotosDe("cli-2")).toHaveLength(0);
    });

    it("una preparación cobrada no cambia de cliente", async () => {
      const { prep } = await conOriginal("carnet", "cli-1");
      await (B.prisma.$transaction as (f: (tx: unknown) => Promise<void>) => Promise<void>)((tx) =>
        P.vincularConVenta(tx as Parameters<typeof P.vincularConVenta>[0], "ws-1", [{ preparacionId: prep, saleItemId: "item-1" }], null),
      );
      expect(await F.asignarCliente(CTX, prep, "cli-2")).toEqual({ ok: false, error: "Esa preparación ya se cobró: el cliente es el de la venta." });
      expect(await fotosDe("cli-1")).toHaveLength(1);
    });
  });
});
