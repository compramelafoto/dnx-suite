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
    copiarObjeto: async (a: string, b: string) => void R2.set(b, R2.get(a)!),
    tamanoDeObjeto: async (k: string) => R2.get(k)?.length ?? null,
    borrarObjetoImpresion: async (k: string) => void R2.delete(k),
  };
});
vi.mock("@/lib/ficha/adjuntos-r2", () => ({ clienteR2Privado: () => ({}), bucketR2Privado: () => "b", esNoEncontrado: () => false }));

const C = await import("./configuracion");
const P = await import("./preparaciones");
const { recetaInicial } = await import("./receta");

const CTX = { workspaceId: "ws-1", userId: 1, userLabel: "Sabi" };
const OTRO = { workspaceId: "ws-2", userId: 9, userLabel: "Otro" };
let kodakId = "", t10 = "";
/** La transacción de la base en memoria, con el tipo que espera `vincularConVenta`. */
const enTransaccion = (fn: (tx: Parameters<typeof P.vincularConVenta>[0]) => Promise<void>) =>
  (B.prisma.$transaction as (f: (tx: unknown) => Promise<void>) => Promise<void>)((tx) => fn(tx as Parameters<typeof P.vincularConVenta>[0]));

async function jpg(ancho = 1200, alto = 1600) {
  return sharp({ create: { width: ancho, height: alto, channels: 3, background: { r: 120, g: 90, b: 70 } } }).jpeg().toBuffer();
}
/** Crea preparación + original LISTO, como lo dejaría el editor. */
async function conOriginal(productId: string | null = "carnet") {
  const p = await P.crearPreparacion(CTX, { productId, clientId: null });
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
  B.agregar("product", { id: "remera", workspaceId: "ws-1", name: "Remera", priceArs: "1", isActive: true });
  await C.asegurarConfiguracion("ws-1");
  const kodak = (await C.listarSalidas("ws-1")).find((s) => s.nombre === "Kodak 305")!;
  kodakId = kodak.id;
  t10 = kodak.tamanos.find((t) => t.nombre === "10x15")!.id;
  await C.guardarProduccion("ws-1", "carnet", { tipoPieza: "CARNET", salidaId: kodakId, tamanoHojaId: t10, unidad: "HOJA" });
});

describe("preparaciones de impresión", () => {
  it("sólo se prepara un producto con producción de carnet o de copias", async () => {
    expect((await P.crearPreparacion(CTX, { productId: "remera", clientId: null })).ok).toBe(false);
    expect((await P.crearPreparacion(CTX, { productId: "carnet", clientId: null })).ok).toBe(true);
    expect((await P.crearPreparacion(CTX, { productId: null, clientId: null })).ok).toBe(true);
  });

  it("rechaza tipos y tamaños de archivo no permitidos", async () => {
    const p = await P.crearPreparacion(CTX, { productId: "carnet", clientId: null });
    if (!p.ok) throw new Error();
    expect((await P.pedirSubidaOriginal(CTX, p.id, { nombre: "x.pdf", tipo: "application/pdf", bytes: 10 })).ok).toBe(false);
    expect((await P.pedirSubidaOriginal(CTX, p.id, { nombre: "x.jpg", tipo: "image/jpeg", bytes: 61 * 1024 * 1024 })).ok).toBe(false);
    expect((await P.pedirSubidaOriginal(OTRO, p.id, { nombre: "x.jpg", tipo: "image/jpeg", bytes: 10 })).ok).toBe(false);
  });

  it("confirmar un archivo que no es imagen lo borra y avisa", async () => {
    const p = await P.crearPreparacion(CTX, { productId: "carnet", clientId: null });
    if (!p.ok) throw new Error();
    const basura = Buffer.from("no soy una foto");
    const s = await P.pedirSubidaOriginal(CTX, p.id, { nombre: "x.jpg", tipo: "image/jpeg", bytes: basura.length });
    if (!s.ok) throw new Error();
    const clave = new URL(s.url).pathname.slice(1);
    R2.set(clave, basura);
    const c = await P.confirmarOriginal(CTX, s.originalId);
    expect(c.ok).toBe(false);
    expect(R2.has(clave)).toBe(false);
  });

  it("de la foto a la hoja final: 6 carnets 4×4 en una 10x15 de la Kodak", async () => {
    const { prep, original } = await conOriginal();
    const pieza = await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta: { ...recetaInicial(), encuadre: { x: 0, y: 0.1, ancho: 1, alto: 0.75 } } });
    expect(pieza).toMatchObject({ ok: true, aviso: "OK" });
    const h = await P.generarHojaCarnet(CTX, prep, { salidaId: null, tamanoId: null, fotos: null, copias: 2, conLineas: true });
    expect(h).toMatchObject({ ok: true, fotosPorHoja: 6 });
    if (!h.ok) return;
    const datos = await P.datosParaImprimir("ws-1", h.hojaId);
    expect(datos).toMatchObject({ anchoMm: 102, altoMm: 152, copias: 2, salida: "Kodak 305", tamano: "10x15" });
    const meta = await sharp(R2.get(datos!.finalKey)!).metadata();
    expect([meta.width, meta.height, meta.density]).toEqual([1205, 1795, 300]);
  });

  it("generar dos veces sin cambios no vuelve a armar el archivo", async () => {
    const { prep, original } = await conOriginal();
    await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta: recetaInicial() });
    const a = await P.generarHojaCarnet(CTX, prep, { salidaId: null, tamanoId: null, fotos: null, copias: 1, conLineas: true });
    const b = await P.generarHojaCarnet(CTX, prep, { salidaId: null, tamanoId: null, fotos: null, copias: 3, conLineas: true });
    if (!a.ok || !b.ok) throw new Error();
    expect(b.hojaId).toBe(a.hojaId);
    expect((await P.datosParaImprimir("ws-1", b.hojaId))!.copias).toBe(3);
  });

  it("rearmar la misma hoja con otro contenido cambia su versión (la URL de la imagen no queda vieja en caché)", async () => {
    // Pantalla suelta: cambiar cuántas fotos van rehace la misma hoja (no tiene registros).
    const { prep, original } = await conOriginal(null);
    const base = { salidaId: kodakId, tamanoId: t10, fotos: null, copias: 1, conLineas: true };
    await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta: recetaInicial() });
    const a = await P.generarHojaCarnet(CTX, prep, base);
    if (!a.ok) throw new Error(a.error);
    const va = (await P.datosParaImprimir("ws-1", a.hojaId))!.version;
    expect(va).toBe(a.version);
    const b = await P.generarHojaCarnet(CTX, prep, { ...base, fotos: 2 });
    if (!b.ok) throw new Error(b.error);
    expect(b.hojaId).toBe(a.hojaId); // la misma hoja (sin imprimir) se rehace…
    const vb = (await P.datosParaImprimir("ws-1", b.hojaId))!.version;
    expect(vb).toBe(b.version);
    expect(vb).not.toBe(va); // …con otra versión
    const fila = (await P.colas("ws-1", new Date())).sinCobrar.find((f) => f.preparacionId === prep);
    expect(fila).toMatchObject({ hojaId: b.hojaId, hojaVersion: vb, cobrada: false });
  });

  it("una receta inválida no se guarda", async () => {
    const { prep, original } = await conOriginal();
    expect((await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta: { hola: 1 } })).ok).toBe(false);
    expect((await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 5, altoMm: 40, receta: recetaInicial() })).ok).toBe(false);
  });

  it("el carnet rechaza una receta ENCAJAR (la plancha no admite borde)", async () => {
    const { prep, original } = await conOriginal();
    const encajar = { ...recetaInicial(), modo: "ENCAJAR" as const, orientacion: "HORIZONTAL" as const, encuadre: { x: 0, y: -0.1, ancho: 1, alto: 1.2 } };
    const r = await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta: encajar });
    expect(r).toEqual({ ok: false, error: "El carnet se arma recortando la foto: no admite foto encajada con borde." });
  });

  it("registrar: NORMAL deja la preparación IMPRESA; DESCARTADA no; otro negocio no puede", async () => {
    const { prep, original } = await conOriginal();
    await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta: recetaInicial() });
    const h = await P.generarHojaCarnet(CTX, prep, { salidaId: null, tamanoId: null, fotos: null, copias: 1, conLineas: true });
    if (!h.ok) throw new Error();
    expect((await P.registrarImpresion(OTRO, h.hojaId, { motivo: "NORMAL", hojas: 1 })).ok).toBe(false);
    expect((await P.registrarImpresion(CTX, h.hojaId, { motivo: "DESCARTADA", hojas: 1 })).ok).toBe(true);
    let c = await P.colas("ws-1", new Date());
    expect(c.sinCobrar.find((f) => f.preparacionId === prep)?.estado).toBe("LISTA");
    expect((await P.registrarImpresion(CTX, h.hojaId, { motivo: "NORMAL", hojas: 1 })).ok).toBe(true);
    c = await P.colas("ws-1", new Date());
    expect(c.sinCobrar.find((f) => f.preparacionId === prep)?.estado).toBe("IMPRESA");
    expect(c.impresoHoy.map((r) => r.motivo).sort()).toEqual(["DESCARTADA", "NORMAL"]);
    expect(c.impresoHoy.every((r) => r.salida === "Kodak 305" && r.tamano === "10x15")).toBe(true);
  });

  it("colas: lo preparado sin cobrar aparece aunque se haya recargado el Mostrador", async () => {
    const { prep } = await conOriginal();
    const c = await P.colas("ws-1", new Date());
    expect(c.sinCobrar.map((f) => f.preparacionId)).toContain(prep);
    expect(c.paraImprimir).toHaveLength(0);
  });

  it("validarParaCobrar: producto distinto, repetida o anulada no se cobra", async () => {
    const { prep } = await conOriginal();
    expect((await P.validarParaCobrar("ws-1", [{ preparacionId: prep, productId: "remera" }])).ok).toBe(false);
    expect((await P.validarParaCobrar("ws-1", [{ preparacionId: prep, productId: "carnet" }, { preparacionId: prep, productId: "carnet" }])).ok).toBe(false);
    expect((await P.validarParaCobrar("ws-2", [{ preparacionId: prep, productId: "carnet" }])).ok).toBe(false);
    expect((await P.validarParaCobrar("ws-1", [{ preparacionId: prep, productId: "carnet" }])).ok).toBe(true);
    await P.anularPreparacion(CTX, prep);
    expect((await P.validarParaCobrar("ws-1", [{ preparacionId: prep, productId: "carnet" }])).ok).toBe(false);
  });

  it("no vincula una preparación ya cobrada (dos pestañas, mismo carnet)", async () => {
    const { prep } = await conOriginal();
    await enTransaccion((tx) => P.vincularConVenta(tx, CTX, [{ preparacionId: prep, saleItemId: "item-1" }], null));
    await expect(
      enTransaccion((tx) => P.vincularConVenta(tx, CTX, [{ preparacionId: prep, saleItemId: "item-2" }], null)),
    ).rejects.toBeInstanceOf(P.PreparacionNoVinculable);
    const c = await P.colas("ws-1", new Date());
    expect(c.paraImprimir.map((f) => f.preparacionId)).toEqual([prep]);
    expect(c.paraImprimir[0]!.cobrada).toBe(true); // la cola no ofrece "Anular" en lo cobrado
  });

  it("estadoPreparacion: original, pieza y la hoja vigente para reabrir el editor; otro negocio no ve nada", async () => {
    const { prep, original } = await conOriginal();
    expect(await P.estadoPreparacion(CTX, prep)).toEqual({
      cliente: null,
      original: { id: original, ancho: 1200, alto: 1600, vistaAncho: 1200, vistaAlto: 1600 },
      pieza: null,
      hoja: null,
    });
    const receta = { ...recetaInicial(), encuadre: { x: 0, y: 0.1, ancho: 1, alto: 0.75 } };
    await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta });
    const h = await P.generarHojaCarnet(CTX, prep, { salidaId: null, tamanoId: null, fotos: null, copias: 3, conLineas: true });
    if (!h.ok) throw new Error(h.error);
    const e = await P.estadoPreparacion(CTX, prep);
    expect(e?.pieza).toMatchObject({ anchoMm: 40, altoMm: 40, receta, aviso: "OK" });
    expect(e?.pieza?.ppp).toBeGreaterThan(200);
    expect(e?.hoja).toEqual({ id: h.hojaId, fotosPorHoja: h.fotosPorHoja, copias: 3, version: h.version });
    expect(await P.estadoPreparacion(OTRO, prep)).toBeNull();
    await P.anularPreparacion(CTX, prep);
    expect(await P.estadoPreparacion(CTX, prep)).toBeNull();
  });

  it("pantalla suelta: la impresora y la hoja se eligen, y tienen que ser del negocio y admitirse", async () => {
    const { prep, original } = await conOriginal(null);
    await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta: recetaInicial() });
    const epson = (await C.listarSalidas("ws-1")).find((s) => s.nombre === "Epson L800")!;
    const a4 = epson.tamanos.find((t) => t.nombre === "A4")!.id;
    const base = { fotos: null, copias: 1, conLineas: false };
    expect((await P.generarHojaCarnet(CTX, prep, { ...base, salidaId: null, tamanoId: null })).ok).toBe(false);
    expect((await P.generarHojaCarnet(CTX, prep, { ...base, salidaId: kodakId, tamanoId: a4 })).ok).toBe(false);
    expect((await P.generarHojaCarnet(OTRO, prep, { ...base, salidaId: epson.id, tamanoId: a4 })).ok).toBe(false);
    const h = await P.generarHojaCarnet(CTX, prep, { ...base, salidaId: epson.id, tamanoId: a4 });
    if (!h.ok) throw new Error(h.error);
    expect(await P.datosParaImprimir("ws-1", h.hojaId)).toMatchObject({ salida: "Epson L800", tamano: "A4", anchoMm: 210, altoMm: 297 });
    expect(await P.datosParaImprimir("ws-2", h.hojaId)).toBeNull();
  });

  it("carnet: un NORMAL en la hoja vigente la deja IMPRESA, como en la etapa 1 (con hojas = copias y también con menos)", async () => {
    const estado = (prep: string) => B.datos.fotofficePreparacionImpresion.find((p) => p.id === prep)!.estado;
    for (const hojas of [2, 1]) {
      const { prep, original } = await conOriginal();
      await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta: recetaInicial() });
      const h = await P.generarHojaCarnet(CTX, prep, { salidaId: null, tamanoId: null, fotos: null, copias: 2, conLineas: true });
      if (!h.ok) throw new Error(h.error);
      expect(estado(prep)).toBe("LISTA");
      expect(await P.registrarImpresion(CTX, h.hojaId, { motivo: "NORMAL", hojas })).toEqual({ ok: true });
      expect(estado(prep)).toBe("IMPRESA");
      // Para imprimir toda la preparación, ya no queda nada pendiente.
      expect((await P.datosParaImprimirPreparacion("ws-1", prep, true))!.hojas).toEqual([]);
    }
  });

  it("registrar una hoja: los mismos errores que en la etapa 1", async () => {
    const { prep, original } = await conOriginal();
    await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta: recetaInicial() });
    const h = await P.generarHojaCarnet(CTX, prep, { salidaId: null, tamanoId: null, fotos: null, copias: 1, conLineas: true });
    if (!h.ok) throw new Error(h.error);
    expect(await P.registrarImpresion(CTX, "no existe", { motivo: "PRUEBA" as "NORMAL", hojas: 1 })).toEqual({ ok: false, error: "Elegí cómo salió." });
    expect(await P.registrarImpresion(CTX, "no existe", { motivo: "NORMAL", hojas: 101 })).toEqual({ ok: false, error: "Las hojas tienen que ser entre 1 y 100." });
    expect(await P.registrarImpresion(CTX, "noexiste", { motivo: "NORMAL", hojas: 1 })).toEqual({ ok: false, error: "Esa hoja no existe." });
    await P.anularPreparacion(CTX, prep);
    expect(await P.registrarImpresion(CTX, h.hojaId, { motivo: "NORMAL", hojas: 1 })).toEqual({ ok: false, error: "Esa preparación no existe." });
    expect(B.datos.fotofficeRegistroImpresion).toHaveLength(0);
  });

  it("el día de Impreso hoy empieza a las 00:00 de Argentina", () => {
    // 02:30 UTC del 21 = 23:30 del 20 en Argentina.
    expect(P.inicioDelDiaArgentina(new Date("2026-10-21T02:30:00Z")).toISOString()).toBe("2026-10-20T03:00:00.000Z");
    expect(P.inicioDelDiaArgentina(new Date("2026-10-21T03:00:00Z")).toISOString()).toBe("2026-10-21T03:00:00.000Z");
  });

  it("editar la foto después de imprimir arma otra hoja y no pisa la impresa", async () => {
    const { prep, original } = await conOriginal();
    const base = { salidaId: null, tamanoId: null, fotos: null, copias: 1, conLineas: true };
    await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta: recetaInicial() });
    const a = await P.generarHojaCarnet(CTX, prep, base);
    if (!a.ok) throw new Error(a.error);
    const datosA = (await P.datosParaImprimir("ws-1", a.hojaId))!;
    expect((await P.registrarImpresion(CTX, a.hojaId, { motivo: "NORMAL", hojas: 1 })).ok).toBe(true);

    const otra = { ...recetaInicial(), encuadre: { x: 0, y: 0.1, ancho: 1, alto: 0.75 } };
    expect((await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta: otra })).ok).toBe(true);
    const b = await P.generarHojaCarnet(CTX, prep, base);
    if (!b.ok) throw new Error(b.error);

    expect(b.hojaId).not.toBe(a.hojaId);
    // La hoja impresa sigue igual: su fila, su archivo y el registro que la nombra.
    expect(B.datos.fotofficeHojaImpresion.find((h) => h.id === a.hojaId)).toMatchObject({ finalKey: datosA.finalKey });
    expect(R2.has(datosA.finalKey)).toBe(true);
    expect(B.datos.fotofficeRegistroImpresion).toHaveLength(1);
    expect(B.datos.fotofficeRegistroImpresion[0]!.hojaId).toBe(a.hojaId);
    // La nueva apunta a otro archivo, que existe.
    const datosB = (await P.datosParaImprimir("ws-1", b.hojaId))!;
    expect(datosB.finalKey).not.toBe(datosA.finalKey);
    expect(R2.has(datosB.finalKey)).toBe(true);
  });

  it("reimprimir una hoja vieja no marca IMPRESA lo que tiene una hoja más nueva sin imprimir", async () => {
    const { prep, original } = await conOriginal();
    const base = { salidaId: null, tamanoId: null, fotos: null, copias: 1, conLineas: true };
    await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta: recetaInicial() });
    const a = await P.generarHojaCarnet(CTX, prep, base);
    if (!a.ok) throw new Error(a.error);
    await P.registrarImpresion(CTX, a.hojaId, { motivo: "NORMAL", hojas: 1 });
    await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 35, altoMm: 45, receta: recetaInicial() });
    const b = await P.generarHojaCarnet(CTX, prep, base);
    if (!b.ok) throw new Error(b.error);
    const estado = async () => (await P.colas("ws-1", new Date())).sinCobrar.find((f) => f.preparacionId === prep)?.estado;
    expect(await estado()).toBe("LISTA");
    // "Reimprimir" la vieja desde Impreso hoy: queda registrada, pero la nueva sigue por imprimir.
    expect((await P.registrarImpresion(CTX, a.hojaId, { motivo: "NORMAL", hojas: 1 })).ok).toBe(true);
    expect(await estado()).toBe("LISTA");
    expect(B.datos.fotofficeRegistroImpresion).toHaveLength(2);
    expect((await P.registrarImpresion(CTX, b.hojaId, { motivo: "NORMAL", hojas: 1 })).ok).toBe(true);
    expect(await estado()).toBe("IMPRESA");
  });

  it("la purga borra a los 30 días archivos y filas, pero deja el registro", async () => {
    const { prep, original } = await conOriginal();
    await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta: recetaInicial() });
    const h = await P.generarHojaCarnet(CTX, prep, { salidaId: null, tamanoId: null, fotos: null, copias: 1, conLineas: true });
    if (!h.ok) throw new Error();
    await P.registrarImpresion(CTX, h.hojaId, { motivo: "NORMAL", hojas: 1 });
    expect(await P.purgarPreparaciones(new Date(Date.now() + 29 * 86_400_000))).toBe(0);
    expect(await P.purgarPreparaciones(new Date(Date.now() + 31 * 86_400_000))).toBe(1);
    expect(R2.size).toBe(0);
    expect(B.datos.fotofficeRegistroImpresion).toHaveLength(1);
    expect(B.datos.fotofficeRegistroImpresion[0]).toMatchObject({ workspaceId: "ws-1", hojaId: null });
  });

  it("un producto de copias también se prepara", async () => {
    B.agregar("product", { id: "copia10", workspaceId: "ws-1", name: "Copia 10x15", priceArs: "900", isActive: true });
    expect(await C.guardarProduccion("ws-1", "copia10", { tipoPieza: "COPIA", salidaId: kodakId, tamanoHojaId: t10, unidad: "COPIA" })).toEqual({ ok: true });
    expect((await P.crearPreparacion(CTX, { productId: "copia10", clientId: null })).ok).toBe(true);
  });

  it("las funciones del carnet no tocan una preparación de copias (no borran sus piezas ni sus hojas)", async () => {
    B.agregar("product", { id: "copia10", workspaceId: "ws-1", name: "Copia 10x15", priceArs: "900", isActive: true });
    await C.guardarProduccion("ws-1", "copia10", { tipoPieza: "COPIA", salidaId: kodakId, tamanoHojaId: t10, unidad: "COPIA" });
    const { prep, original } = await conOriginal("copia10");
    const NO = { ok: false, error: "Esa preparación no existe." };
    expect(await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta: recetaInicial() })).toEqual(NO);
    expect(await P.generarHojaCarnet(CTX, prep, { salidaId: null, tamanoId: null, fotos: null, copias: 1, conLineas: true })).toEqual(NO);
    expect(B.datos.fotofficePiezaImpresion).toHaveLength(0);
    expect(B.datos.fotofficeHojaImpresion).toHaveLength(0);
  });

  it("colas: el carnet enlaza a su hoja y no cuenta fotos de copias", async () => {
    const { prep, original } = await conOriginal();
    expect((await P.colas("ws-1", new Date())).sinCobrar.find((f) => f.preparacionId === prep)).toMatchObject({ fotos: 0, imprimirHref: null });
    await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta: recetaInicial() });
    const h = await P.generarHojaCarnet(CTX, prep, { salidaId: null, tamanoId: null, fotos: null, copias: 1, conLineas: true });
    if (!h.ok) throw new Error(h.error);
    const fila = (await P.colas("ws-1", new Date())).sinCobrar.find((f) => f.preparacionId === prep)!;
    expect(fila).toMatchObject({ fotos: 0, imprimirHref: `/imprimir/hoja/${h.hojaId}?v=${h.version}` });
  });

  it("carnet: receta A impresa, B armada sin imprimir y de vuelta a A: la hoja A vuelve a ser la vigente y B desaparece (fila y archivo)", async () => {
    const { prep, original } = await conOriginal();
    const estado = () => B.datos.fotofficePreparacionImpresion.find((p) => p.id === prep)!.estado;
    const armar = async (receta: ReturnType<typeof recetaInicial>) => {
      await P.guardarPiezaCarnet(CTX, prep, { originalId: original, anchoMm: 40, altoMm: 40, receta });
      const h = await P.generarHojaCarnet(CTX, prep, { salidaId: null, tamanoId: null, fotos: null, copias: 1, conLineas: true });
      if (!h.ok) throw new Error(h.error);
      return h;
    };
    const recetaA = recetaInicial();
    const recetaB = { ...recetaInicial(), encuadre: { x: 0, y: 0.1, ancho: 1, alto: 0.75 } };
    const a = await armar(recetaA);
    expect((await P.registrarImpresion(CTX, a.hojaId, { motivo: "NORMAL", hojas: 1 })).ok).toBe(true);
    const b = await armar(recetaB);
    expect(b.hojaId).not.toBe(a.hojaId);
    const claveB = B.datos.fotofficeHojaImpresion.find((x) => x.id === b.hojaId)!.finalKey as string;
    expect(R2.has(claveB)).toBe(true);
    const a2 = await armar(recetaA);
    expect(a2.hojaId).toBe(a.hojaId);
    expect(B.datos.fotofficeHojaImpresion.map((x) => x.id)).toEqual([a.hojaId]);
    expect(R2.has(claveB)).toBe(false);
    expect(estado()).toBe("LISTA");
  });
});
