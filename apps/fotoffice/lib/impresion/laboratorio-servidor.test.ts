import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
    tamanoDeObjeto: async (k: string) => R2.get(k)?.length ?? null,
    borrarObjetoImpresion: async (k: string) => void R2.delete(k),
  };
});
vi.mock("@/lib/ficha/adjuntos-r2", () => ({ clienteR2Privado: () => ({}), bucketR2Privado: () => "b", esNoEncontrado: () => false }));

const P = await import("./preparaciones");
const L = await import("./laboratorio-servidor");
const { propuestaAutomatica } = await import("./encuadre");

const CTX = { workspaceId: "ws-1", userId: 1, userLabel: "Sabi" };
const OTRO = { workspaceId: "ws-2", userId: 9, userLabel: "Otro" };
const P10 = { anchoMm: 102, altoMm: 152 };

async function jpg(ancho: number, alto: number) {
  return sharp({ create: { width: ancho, height: alto, channels: 3, background: { r: 120, g: 90, b: 70 } } }).jpeg().toBuffer();
}
async function prepConFotos(n: number) {
  const p = await L.crearPreparacionLaboratorio(CTX, { clientId: null });
  if (!p.ok) throw new Error(p.error);
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const foto = await jpg(600, 400);
    const s = await P.pedirSubidaOriginal(CTX, p.id, { nombre: `f${i}.jpg`, tipo: "image/jpeg", bytes: foto.length });
    if (!s.ok) throw new Error(s.error);
    R2.set(new URL(s.url).pathname.slice(1), foto);
    const c = await P.confirmarOriginal(CTX, s.originalId);
    if (!c.ok) throw new Error(c.error);
    ids.push(s.originalId);
  }
  return { prep: p.id, ids };
}
const item = (originalId: string, extra: Record<string, unknown> = {}) => ({
  originalId, medida: "10x15", plazo: "MANANA", papel: "MATE", cantidad: 2,
  receta: propuestaAutomatica(600, 400, P10), revisada: false, ...extra,
});

beforeEach(() => {
  R2.clear();
  B.vaciar();
  B.agregar("product", { id: "c10m", workspaceId: "ws-1", name: "Copia para mañana 10x15", priceArs: "800", costArs: "300", isActive: true, preferredProveedorId: "lab1" });
  B.agregar("product", { id: "c10s", workspaceId: "ws-1", name: "Copia próxima semana 10x15", priceArs: "600", costArs: "250", isActive: true, preferredProveedorId: "lab1" });
});

describe("laboratorio: guardar piezas", () => {
  it("guarda la pieza con medida, plazo, papel y cantidad, y la devuelve en el estado", async () => {
    const { prep, ids } = await prepConFotos(1);
    const r = await L.guardarPiezasLaboratorio(CTX, prep, [item(ids[0]!, { revisada: true })]);
    expect(r).toEqual({ ok: true, guardadas: 1 });
    const e = (await L.estadoLaboratorio(CTX, prep))!;
    expect(e.opciones.medidas.map((m) => m.medida)).toEqual(["10x15"]);
    expect(e.fotos[0]!.pieza).toMatchObject({ medida: "10x15", plazo: "MANANA", papel: "MATE", cantidad: 2, revisada: true });
    expect(e.fotos[0]!.vista).toBe(`/api/impresion/vista/${ids[0]}`);
    const fila = B.datos.fotofficePiezaImpresion[0]!;
    expect(fila).toMatchObject({ tipo: "COPIA", tamanoId: null });
  });

  it("rechaza una medida que no está en el catálogo", async () => {
    const { prep, ids } = await prepConFotos(1);
    const r = await L.guardarPiezasLaboratorio(CTX, prep, [item(ids[0]!, { medida: "30x40" })]);
    expect(r).toEqual({ ok: false, error: "Elegí un tamaño de la lista." });
  });

  it("rechaza cantidad 100 y 0", async () => {
    const { prep, ids } = await prepConFotos(1);
    expect((await L.guardarPiezasLaboratorio(CTX, prep, [item(ids[0]!, { cantidad: 100 })])).ok).toBe(false);
    expect((await L.guardarPiezasLaboratorio(CTX, prep, [item(ids[0]!, { cantidad: 0 })])).ok).toBe(false);
  });

  it("rechaza un recorte inválido y papel/plazo fuera de las opciones", async () => {
    const { prep, ids } = await prepConFotos(1);
    expect((await L.guardarPiezasLaboratorio(CTX, prep, [item(ids[0]!, { receta: { basura: 1 } })])).ok).toBe(false);
    expect((await L.guardarPiezasLaboratorio(CTX, prep, [item(ids[0]!, { papel: "SEDA" })])).ok).toBe(false);
    expect((await L.guardarPiezasLaboratorio(CTX, prep, [item(ids[0]!, { plazo: "AYER" })])).ok).toBe(false);
  });

  it("respeta los papeles encendidos en los ajustes", async () => {
    B.agregar("fotofficePrintSettings", { id: "s1", workspaceId: "ws-1", paperMatte: false, paperGlossy: true });
    const { prep, ids } = await prepConFotos(1);
    expect((await L.guardarPiezasLaboratorio(CTX, prep, [item(ids[0]!)])).ok).toBe(false);
    expect((await L.guardarPiezasLaboratorio(CTX, prep, [item(ids[0]!, { papel: "BRILLO" })])).ok).toBe(true);
  });

  it("no toca la preparación de otro workspace", async () => {
    const { prep, ids } = await prepConFotos(1);
    const r = await L.guardarPiezasLaboratorio(OTRO, prep, [item(ids[0]!)]);
    expect(r).toEqual({ ok: false, error: "Esa preparación no existe." });
    expect(await L.estadoLaboratorio(OTRO, prep)).toBeNull();
  });

  it("rechaza una preparación que no es de laboratorio, anulada o ya cobrada", async () => {
    const { prep, ids } = await prepConFotos(1);
    const fila = B.datos.fotofficePreparacionImpresion.find((x) => x.id === prep)!;
    fila.estado = "LISTA";
    expect((await L.guardarPiezasLaboratorio(CTX, prep, [item(ids[0]!)])).ok).toBe(false);
    fila.estado = "ANULADA";
    expect(await L.estadoLaboratorio(CTX, prep)).toBeNull();
    fila.estado = "PREPARANDO";
    fila.destino = "LOCAL";
    expect((await L.quitarFotoLaboratorio(CTX, prep, ids[0]!)).ok).toBe(false);
  });
});

describe("laboratorio: quitar foto", () => {
  it("borra la pieza y el original", async () => {
    const { prep, ids } = await prepConFotos(2);
    await L.guardarPiezasLaboratorio(CTX, prep, [item(ids[0]!)]);
    expect((await L.quitarFotoLaboratorio(CTX, prep, ids[0]!)).ok).toBe(true);
    expect(B.datos.fotofficePiezaImpresion).toHaveLength(0);
    expect((await L.estadoLaboratorio(CTX, prep))!.fotos.map((f) => f.originalId)).toEqual([ids[1]]);
  });
});

describe("laboratorio: renglones", () => {
  it("falla sin piezas", async () => {
    const { prep } = await prepConFotos(1);
    expect(await L.renglonesDeLaPreparacion("ws-1", prep)).toEqual({ ok: false, error: "Subí al menos una foto." });
  });

  it("falla con una foto LISTO sin pieza", async () => {
    const { prep, ids } = await prepConFotos(2);
    await L.guardarPiezasLaboratorio(CTX, prep, [item(ids[0]!)]);
    expect(await L.renglonesDeLaPreparacion("ws-1", prep)).toEqual({ ok: false, error: "Hay fotos sin tamaño: completalas o quitalas." });
  });

  it("ignora los originales PENDIENTE y arma un renglón por producto", async () => {
    const { prep, ids } = await prepConFotos(2);
    await L.guardarPiezasLaboratorio(CTX, prep, [item(ids[0]!, { cantidad: 3 }), item(ids[1]!, { plazo: "SEMANA", cantidad: 1 })]);
    B.agregar("fotofficeOriginalImpresion", { id: "pend", workspaceId: "ws-1", preparacionId: prep, key: "k", nombre: "p.jpg", tipo: "image/jpeg", estado: "PENDIENTE" });
    const r = await L.renglonesDeLaPreparacion("ws-1", prep);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.renglones.map((x) => [x.productId, x.cantidad]).sort()).toEqual([["c10m", 3], ["c10s", 1]]);
    expect(r.piezas).toHaveLength(2);
    expect(r.plazoFinal.get(ids[1]!)).toBe("SEMANA");
  });

  it("toma el proveedor de la regla del producto en el proyecto", async () => {
    B.agregar("fotofficeProductoProyecto", { id: "r1", workspaceId: "ws-1", productId: "c10m", circuitId: "x", order: 0, proveedorId: "labX" });
    const { prep, ids } = await prepConFotos(1);
    await L.guardarPiezasLaboratorio(CTX, prep, [item(ids[0]!)]);
    const r = await L.renglonesDeLaPreparacion("ws-1", prep);
    expect(r.ok && r.renglones[0]!.proveedorId).toBe("labX");
  });
});

describe("laboratorio: tope de fotos", () => {
  it("pedirSubidaOriginal con 200 originales dice el tope de laboratorio", async () => {
    const p = await L.crearPreparacionLaboratorio(CTX, { clientId: null });
    if (!p.ok) throw new Error(p.error);
    for (let i = 0; i < 200; i++) B.agregar("fotofficeOriginalImpresion", { id: `o${i}`, workspaceId: "ws-1", preparacionId: p.id, key: `k${i}`, nombre: "x.jpg", tipo: "image/jpeg", estado: "LISTO" });
    const r = await P.pedirSubidaOriginal(CTX, p.id, { nombre: "x.jpg", tipo: "image/jpeg", bytes: 10 });
    expect(r).toEqual({ ok: false, error: "Un pedido para laboratorio admite hasta 200 fotos." });
  });
});
