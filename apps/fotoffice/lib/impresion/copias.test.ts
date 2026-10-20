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
const K = await import("./copias");
const M = await import("./impresion-multiple");
const { cambiarModo, propuestaAutomatica } = await import("./encuadre");
const { recetaInicial } = await import("./receta");

const CTX = { workspaceId: "ws-1", userId: 1, userLabel: "Sabi" };
const OTRO = { workspaceId: "ws-2", userId: 9, userLabel: "Otro" };
const P10 = { anchoMm: 102, altoMm: 152 };

async function jpg(ancho: number, alto: number) {
  return sharp({ create: { width: ancho, height: alto, channels: 3, background: { r: 120, g: 90, b: 70 } } }).jpeg().toBuffer();
}
/** Preparación de copias 10x15 con las fotos ya subidas y confirmadas (sin piezas). */
async function prepConFotos(medidas: [number, number][], productId = "copia10") {
  const p = await P.crearPreparacion(CTX, { productId, clientId: null });
  if (!p.ok) throw new Error(p.error);
  const ids: string[] = [];
  for (const [ancho, alto] of medidas) {
    const foto = await jpg(ancho, alto);
    const s = await P.pedirSubidaOriginal(CTX, p.id, { nombre: `foto-${ids.length + 1}.jpg`, tipo: "image/jpeg", bytes: foto.length });
    if (!s.ok) throw new Error(s.error);
    R2.set(new URL(s.url).pathname.slice(1), foto);
    const c = await P.confirmarOriginal(CTX, s.originalId);
    if (!c.ok) throw new Error(c.error);
    ids.push(s.originalId);
  }
  return { prep: p.id, ids };
}
/** Guarda la propuesta automática de cada foto, con la cantidad pedida (1 si no se dice). */
async function guardarPropuestas(prep: string, ids: string[], medidas: [number, number][], cantidades: number[] = ids.map(() => 1)) {
  const r = await K.guardarPiezasCopia(
    CTX,
    prep,
    ids.map((originalId, i) => ({ originalId, cantidad: cantidades[i]!, receta: propuestaAutomatica(medidas[i]![0], medidas[i]![1], P10), revisada: false })),
  );
  if (!r.ok) throw new Error(r.error);
}
const estadoDe = (prep: string) => B.datos.fotofficePreparacionImpresion.find((p) => p.id === prep)!.estado;

beforeEach(async () => {
  R2.clear();
  B.vaciar();
  B.agregar("product", { id: "copia10", workspaceId: "ws-1", name: "Copia 10x15", priceArs: "900", isActive: true });
  B.agregar("product", { id: "carnet", workspaceId: "ws-1", name: "Foto carnet", priceArs: "3500", isActive: true });
  await C.asegurarConfiguracion("ws-1");
  const kodak = (await C.listarSalidas("ws-1")).find((s) => s.nombre === "Kodak 305")!;
  const t10 = kodak.tamanos.find((t) => t.nombre === "10x15")!.id;
  await C.guardarProduccion("ws-1", "copia10", { tipoPieza: "COPIA", salidaId: kodak.id, tamanoHojaId: t10, unidad: "COPIA" });
  await C.guardarProduccion("ws-1", "carnet", { tipoPieza: "CARNET", salidaId: kodak.id, tamanoHojaId: t10, unidad: "HOJA" });
});

describe("copias: guardar y reabrir", () => {
  it("guarda la receta de cada foto y la devuelve para reabrir el editor", async () => {
    const medidas: [number, number][] = [[600, 400], [400, 600]];
    const { prep, ids } = await prepConFotos(medidas);
    await guardarPropuestas(prep, ids, medidas, [2, 1]);
    const e = await K.estadoCopias(CTX, prep);
    expect(e).toMatchObject({ papel: { nombre: "10x15", anchoMm: 102, altoMm: 152 }, salida: "Kodak 305" });
    expect(e!.fotos.map((f) => [f.originalId, f.nombre, f.ancho, f.alto])).toEqual([
      [ids[0], "foto-1.jpg", 600, 400],
      [ids[1], "foto-2.jpg", 400, 600],
    ]);
    expect(e!.fotos[0]!.pieza).toMatchObject({ receta: propuestaAutomatica(600, 400, P10), cantidad: 2, revisada: false, aviso: "PIXELADA" });
    expect(e!.fotos[0]!.hoja).toBeNull();
    expect(estadoDe(prep)).toBe("PREPARANDO");
    expect(await K.estadoCopias(OTRO, prep)).toBeNull();
  });

  it("rechaza cantidades fuera de rango, recetas inválidas o de otra proporción, y preparaciones que no son de copias", async () => {
    const { prep, ids } = await prepConFotos([[600, 400]]);
    const ok = { originalId: ids[0]!, cantidad: 1, receta: propuestaAutomatica(600, 400, P10), revisada: false };
    const CANTIDAD = { ok: false, error: "Las copias de cada foto tienen que ser entre 1 y 50." };
    const RECORTE = { ok: false, error: "El recorte de una foto no es válido. Volvé a armarla." };
    const NO_FOTO = { ok: false, error: "Esa foto no existe." };
    const NO_PREP = { ok: false, error: "Esa preparación no existe." };
    expect(await K.guardarPiezasCopia(CTX, prep, [{ ...ok, cantidad: 0 }])).toEqual(CANTIDAD);
    expect(await K.guardarPiezasCopia(CTX, prep, [{ ...ok, cantidad: 51 }])).toEqual(CANTIDAD);
    expect(await K.guardarPiezasCopia(CTX, prep, [{ ...ok, cantidad: 1.5 }])).toEqual(CANTIDAD);
    expect(await K.guardarPiezasCopia(CTX, prep, [{ ...ok, receta: { hola: 1 } }])).toEqual(RECORTE);
    // Sin orientación (una receta de carnet) no sirve para una copia.
    expect(await K.guardarPiezasCopia(CTX, prep, [{ ...ok, receta: recetaInicial() }])).toEqual(RECORTE);
    // La receta de una foto parada sobre esta foto acostada: saldría deformada.
    expect(await K.guardarPiezasCopia(CTX, prep, [{ ...ok, receta: propuestaAutomatica(400, 600, P10) }])).toEqual(RECORTE);
    expect(await K.guardarPiezasCopia(CTX, prep, [ok, ok])).toEqual(NO_FOTO);
    expect(await K.guardarPiezasCopia(CTX, prep, [])).toEqual({ ok: false, error: "No hay fotos para guardar." });
    expect(await K.guardarPiezasCopia(OTRO, prep, [ok])).toEqual(NO_PREP);
    const carnet = await prepConFotos([[600, 400]], "carnet");
    expect(await K.guardarPiezasCopia(CTX, carnet.prep, [{ ...ok, originalId: carnet.ids[0]! }])).toEqual(NO_PREP);
    // Una foto de otra preparación.
    const otra = await prepConFotos([[600, 400]]);
    expect(await K.guardarPiezasCopia(CTX, prep, [{ ...ok, originalId: otra.ids[0]! }])).toEqual(NO_FOTO);
    // Nada de lo rechazado quedó guardado.
    expect(B.datos.fotofficePiezaImpresion).toHaveLength(0);
    expect(await K.guardarPiezasCopia(CTX, prep, [ok])).toEqual({ ok: true, guardadas: 1 });
  });

  it("«Revisada» se marca al confirmar; un cambio de receta sin confirmar la borra, uno de cantidad no", async () => {
    const { prep, ids } = await prepConFotos([[600, 400]]);
    const receta = propuestaAutomatica(600, 400, P10);
    const revisada = async () => (await K.estadoCopias(CTX, prep))!.fotos[0]!.pieza!.revisada;
    await K.guardarPiezasCopia(CTX, prep, [{ originalId: ids[0]!, cantidad: 1, receta, revisada: true }]);
    expect(await revisada()).toBe(true);
    await K.guardarPiezasCopia(CTX, prep, [{ originalId: ids[0]!, cantidad: 3, receta, revisada: false }]);
    expect(await revisada()).toBe(true);
    const encajada = cambiarModo(receta, "ENCAJAR", { foto: { ancho: 600, alto: 400 }, papel: P10 });
    await K.guardarPiezasCopia(CTX, prep, [{ originalId: ids[0]!, cantidad: 3, receta: encajada, revisada: false }]);
    expect(await revisada()).toBe(false);
    expect(B.datos.fotofficePiezaImpresion).toHaveLength(1);
  });

  it("30 fotos en una preparación se guardan en una sola llamada; más de 60 no", async () => {
    const medidas = Array.from({ length: 30 }, () => [300, 200] as [number, number]);
    const { prep, ids } = await prepConFotos(medidas);
    await guardarPropuestas(prep, ids, medidas, ids.map(() => 2));
    const e = await K.estadoCopias(CTX, prep);
    expect(e!.fotos).toHaveLength(30);
    expect(e!.fotos.every((f) => f.pieza?.cantidad === 2)).toBe(true);
    const demasiadas = Array.from({ length: 61 }, (_, i) => ({ originalId: `x${i}`, cantidad: 1, receta: propuestaAutomatica(300, 200, P10), revisada: false }));
    expect(await K.guardarPiezasCopia(CTX, prep, demasiadas)).toEqual({ ok: false, error: "Una preparación admite hasta 60 fotos." });
  });

  it("el tope de 60 fotos vale para la preparación entera, no para cada llamada", async () => {
    const medidas = Array.from({ length: 60 }, () => [300, 200] as [number, number]);
    // Sin pasar por sharp (60 fotos reales hacen lenta la prueba): los originales ya confirmados.
    const p = await P.crearPreparacion(CTX, { productId: "copia10", clientId: null });
    if (!p.ok) throw new Error(p.error);
    const prep = p.id;
    const ids = medidas.map((_, i) => {
      B.agregar("fotofficeOriginalImpresion", {
        id: `foto${i + 1}`, workspaceId: "ws-1", preparacionId: prep, key: `k${i + 1}`, nombre: `foto-${i + 1}.jpg`, tipo: "image/jpeg", bytes: 1, estado: "LISTO", anchoPx: 300, altoPx: 200,
      });
      return `foto${i + 1}`;
    });
    const DEMASIADAS = { ok: false, error: "Una preparación admite hasta 60 fotos." };
    // La foto 61 ya no se puede ni pedir para subir.
    expect(await P.pedirSubidaOriginal(CTX, prep, { nombre: "foto-61.jpg", tipo: "image/jpeg", bytes: 100 })).toEqual(DEMASIADAS);
    await guardarPropuestas(prep, ids.slice(0, 30), medidas.slice(0, 30));
    await guardarPropuestas(prep, ids.slice(30), medidas.slice(30));
    expect(B.datos.fotofficePiezaImpresion).toHaveLength(60);
    // Volver a guardar fotos ya guardadas no suma.
    await guardarPropuestas(prep, ids.slice(0, 2), medidas.slice(0, 2), [3, 3]);
    // Una foto 61 que se coló (p. ej. dos pestañas subiendo a la vez) no se guarda en otra llamada.
    B.agregar("fotofficeOriginalImpresion", {
      id: "foto61", workspaceId: "ws-1", preparacionId: prep, key: "k61", nombre: "foto-61.jpg", tipo: "image/jpeg", bytes: 1, estado: "LISTO", anchoPx: 300, altoPx: 200,
    });
    expect(await K.guardarPiezasCopia(CTX, prep, [{ originalId: "foto61", cantidad: 1, receta: propuestaAutomatica(300, 200, P10), revisada: false }])).toEqual(DEMASIADAS);
    expect(B.datos.fotofficePiezaImpresion).toHaveLength(60);
  });

  it("elementos que no son fotos se rechazan sin romper", async () => {
    const { prep, ids } = await prepConFotos([[600, 400]]);
    const ok = { originalId: ids[0]!, cantidad: 1, receta: propuestaAutomatica(600, 400, P10), revisada: false };
    const NO_FOTO = { ok: false, error: "Esa foto no existe." };
    expect(await K.guardarPiezasCopia(CTX, prep, [null as never])).toEqual(NO_FOTO);
    expect(await K.guardarPiezasCopia(CTX, prep, [ok, 5 as never])).toEqual(NO_FOTO);
    expect(await K.guardarPiezasCopia(CTX, prep, ["x" as never])).toEqual(NO_FOTO);
    expect(B.datos.fotofficePiezaImpresion).toHaveLength(0);
  });

  it("si la foto se quita mientras se guarda, no queda una pieza sin original", async () => {
    const { prep, ids } = await prepConFotos([[600, 400]]);
    // Otra pestaña quita la foto justo entre la validación y la transacción (la relectura de
    // adentro es el único `count` de originales que hace el guardado).
    const tabla = B.tablas.fotofficeOriginalImpresion as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>;
    const real = tabla.count!;
    tabla.count = async (...a: unknown[]) => {
      const lista = B.datos.fotofficeOriginalImpresion;
      const i = lista.findIndex((o) => o.id === ids[0]);
      if (i >= 0) lista.splice(i, 1);
      return real(...a);
    };
    try {
      expect(await K.guardarPiezasCopia(CTX, prep, [{ originalId: ids[0]!, cantidad: 1, receta: propuestaAutomatica(600, 400, P10), revisada: false }])).toEqual({
        ok: false,
        error: "Esa foto no existe.",
      });
    } finally {
      tabla.count = real;
    }
    expect(B.datos.fotofficePiezaImpresion).toHaveLength(0);
  });

  it("quitar una foto borra su original, su vista previa y su pieza", async () => {
    const medidas: [number, number][] = [[600, 400], [400, 600]];
    const { prep, ids } = await prepConFotos(medidas);
    await guardarPropuestas(prep, ids, medidas);
    const antes = R2.size;
    expect(await K.quitarFotoCopia(CTX, prep, ids[0]!)).toEqual({ ok: true });
    expect(R2.size).toBe(antes - 2);
    expect((await K.estadoCopias(CTX, prep))!.fotos.map((f) => f.originalId)).toEqual([ids[1]]);
    expect(B.datos.fotofficePiezaImpresion).toHaveLength(1);
    expect((await K.quitarFotoCopia(OTRO, prep, ids[1]!)).ok).toBe(false);
  });

  it("una preparación de copias que se queda sin fotos vuelve a PREPARANDO aunque tenga hojas impresas", async () => {
    const medidas: [number, number][] = [[600, 400]];
    const { prep, ids } = await prepConFotos(medidas);
    await guardarPropuestas(prep, ids, medidas);
    const pieza = B.datos.fotofficePiezaImpresion[0]!;
    const kodak = (await C.listarSalidas("ws-1")).find((s) => s.nombre === "Kodak 305")!;
    const t10 = kodak.tamanos.find((t) => t.nombre === "10x15")!.id;
    // Una hoja de copia ya impresa (la arma la tarea siguiente; acá se pone a mano).
    B.agregar("fotofficeHojaImpresion", {
      id: "hoja-copia", workspaceId: "ws-1", preparacionId: prep, salidaId: kodak.id, tamanoId: t10, copias: 1,
      disposicion: { tipo: "COPIA", piezaId: pieza.id, piezaHuella: pieza.huella, acostada: true },
      finalKey: "final/hoja-copia.jpg", finalHuella: "abcdef0123456789",
    });
    B.agregar("fotofficeRegistroImpresion", { workspaceId: "ws-1", hojaId: "hoja-copia", salidaId: kodak.id, tamanoId: t10, hojas: 1, motivo: "NORMAL" });
    await P.recalcularEstado(B.prisma as never, "ws-1", prep);
    expect(estadoDe(prep)).toBe("IMPRESA");
    expect(await K.quitarFotoCopia(CTX, prep, ids[0]!)).toEqual({ ok: true });
    // La hoja impresa queda (su registro la nombra), pero no es la hoja de un carnet.
    expect(B.datos.fotofficeHojaImpresion.map((h) => h.id)).toEqual(["hoja-copia"]);
    expect(await P.hojasVigentes(B.prisma as never, "ws-1", prep)).toEqual({ hojas: [], faltan: 0 });
    expect(estadoDe(prep)).toBe("PREPARANDO");
  });
});

describe("estado según las hojas", () => {
  const sin = new Map<string, number>();
  it("sin hojas, o con alguna foto sin armar: PREPARANDO", () => {
    expect(P.estadoSegunHojas({ hojas: [], faltan: 0 }, sin)).toBe("PREPARANDO");
    expect(P.estadoSegunHojas({ hojas: [{ id: "a", copias: 1 }], faltan: 1 }, sin)).toBe("PREPARANDO");
  });
  it("todas armadas: LISTA hasta que cada una salió entera; después IMPRESA", () => {
    const v = { hojas: [{ id: "a", copias: 2 }, { id: "b", copias: 1 }], faltan: 0 };
    expect(P.estadoSegunHojas(v, sin)).toBe("LISTA");
    expect(P.estadoSegunHojas(v, new Map([["a", 1], ["b", 1]]))).toBe("LISTA");
    expect(P.estadoSegunHojas(v, new Map([["a", 2], ["b", 3]]))).toBe("IMPRESA");
  });
  it("lee la disposición de una hoja de copia y descarta la de carnet", () => {
    expect(P.disposicionDeCopia({ tipo: "COPIA", piezaId: "p1", piezaHuella: "h", acostada: true })).toEqual({ piezaId: "p1", piezaHuella: "h", acostada: true });
    expect(P.disposicionDeCopia({ pieza: { ancho: 1, alto: 1 }, posiciones: [] })).toBeNull();
    expect(P.disposicionDeCopia(null)).toBeNull();
  });
});

describe("copias: la hoja de cada foto", () => {
  it("arma una hoja por foto, del tamaño exacto y parada aunque la foto vaya acostada", async () => {
    const medidas: [number, number][] = [[600, 400], [400, 600]];
    const { prep, ids } = await prepConFotos(medidas);
    await guardarPropuestas(prep, ids, medidas, [2, 1]);
    const a = await K.generarHojaCopia(CTX, prep, ids[0]!);
    const b = await K.generarHojaCopia(CTX, prep, ids[1]!);
    if (!a.ok || !b.ok) throw new Error("no armó");
    expect([a.copias, b.copias]).toEqual([2, 1]);
    for (const h of [a, b]) {
      const d = (await P.datosParaImprimir("ws-1", h.hojaId))!;
      expect(d).toMatchObject({ anchoMm: 102, altoMm: 152, salida: "Kodak 305", tamano: "10x15" });
      const meta = await sharp(R2.get(d.finalKey)!).metadata();
      expect([meta.width, meta.height, meta.density]).toEqual([1205, 1795, 300]);
    }
    const hoja = B.datos.fotofficeHojaImpresion.find((h) => h.id === a.hojaId)!;
    expect(P.disposicionDeCopia(hoja.disposicion)).toMatchObject({ acostada: true });
  });

  it("PREPARANDO hasta que todas las fotos tienen hoja; después LISTA", async () => {
    const medidas: [number, number][] = [[600, 400], [400, 600]];
    const { prep, ids } = await prepConFotos(medidas);
    await guardarPropuestas(prep, ids, medidas);
    await K.generarHojaCopia(CTX, prep, ids[0]!);
    expect(estadoDe(prep)).toBe("PREPARANDO");
    await K.generarHojaCopia(CTX, prep, ids[1]!);
    expect(estadoDe(prep)).toBe("LISTA");
    expect((await K.estadoCopias(CTX, prep))!.fotos.every((f) => f.hoja !== null)).toBe(true);
  });

  it("sin cambios no vuelve a armar el archivo; si cambia la cantidad, sólo cambian las copias", async () => {
    const { prep, ids } = await prepConFotos([[600, 400]]);
    await guardarPropuestas(prep, ids, [[600, 400]]);
    const a = await K.generarHojaCopia(CTX, prep, ids[0]!);
    if (!a.ok) throw new Error(a.error);
    const clave = B.datos.fotofficeHojaImpresion.find((h) => h.id === a.hojaId)!.finalKey;
    await guardarPropuestas(prep, ids, [[600, 400]], [4]);
    expect((await K.estadoCopias(CTX, prep))!.fotos[0]!.hoja).toBeNull();
    expect(estadoDe(prep)).toBe("PREPARANDO");
    const b = await K.generarHojaCopia(CTX, prep, ids[0]!);
    if (!b.ok) throw new Error(b.error);
    expect(b).toMatchObject({ hojaId: a.hojaId, version: a.version, copias: 4 });
    expect(B.datos.fotofficeHojaImpresion.find((h) => h.id === b.hojaId)!.finalKey).toBe(clave);
    expect(B.datos.fotofficeHojaImpresion).toHaveLength(1);
  });

  it("cambiar la receta rehace la misma hoja (sin imprimir) y borra el archivo viejo", async () => {
    const { prep, ids } = await prepConFotos([[600, 400]]);
    const receta = propuestaAutomatica(600, 400, P10);
    await K.guardarPiezasCopia(CTX, prep, [{ originalId: ids[0]!, cantidad: 1, receta, revisada: false }]);
    const a = await K.generarHojaCopia(CTX, prep, ids[0]!);
    if (!a.ok) throw new Error(a.error);
    const vieja = B.datos.fotofficeHojaImpresion.find((h) => h.id === a.hojaId)!.finalKey as string;
    const encajada = cambiarModo(receta, "ENCAJAR", { foto: { ancho: 600, alto: 400 }, papel: P10 });
    await K.guardarPiezasCopia(CTX, prep, [{ originalId: ids[0]!, cantidad: 1, receta: encajada, revisada: false }]);
    const b = await K.generarHojaCopia(CTX, prep, ids[0]!);
    if (!b.ok) throw new Error(b.error);
    expect(b.hojaId).toBe(a.hojaId);
    expect(b.version).not.toBe(a.version);
    expect(R2.has(vieja)).toBe(false);
    expect(B.datos.fotofficeHojaImpresion).toHaveLength(1);
  });

  it("volver a una receta ya impresa no deja huérfana la hoja sin imprimir de la receta intermedia", async () => {
    const { prep, ids } = await prepConFotos([[600, 400]]);
    const recetaA = propuestaAutomatica(600, 400, P10);
    const recetaB = cambiarModo(recetaA, "ENCAJAR", { foto: { ancho: 600, alto: 400 }, papel: P10 });
    const guardar = (receta: unknown) => K.guardarPiezasCopia(CTX, prep, [{ originalId: ids[0]!, cantidad: 1, receta, revisada: false }]);
    await guardar(recetaA);
    const a = await K.generarHojaCopia(CTX, prep, ids[0]!);
    if (!a.ok) throw new Error(a.error);
    const hojaA = B.datos.fotofficeHojaImpresion.find((h) => h.id === a.hojaId)!;
    // La hoja A salió de la impresora (a mano: el registro múltiple llega en la tarea siguiente).
    B.agregar("fotofficeRegistroImpresion", { workspaceId: "ws-1", hojaId: a.hojaId, salidaId: hojaA.salidaId, tamanoId: hojaA.tamanoId, hojas: 1, motivo: "NORMAL" });
    await guardar(recetaB);
    const b = await K.generarHojaCopia(CTX, prep, ids[0]!);
    if (!b.ok) throw new Error(b.error);
    expect(b.hojaId).not.toBe(a.hojaId);
    const claveB = B.datos.fotofficeHojaImpresion.find((h) => h.id === b.hojaId)!.finalKey as string;
    expect(R2.has(claveB)).toBe(true);
    await guardar(recetaA);
    const otraVez = await K.generarHojaCopia(CTX, prep, ids[0]!);
    if (!otraVez.ok) throw new Error(otraVez.error);
    expect(otraVez.hojaId).toBe(a.hojaId);
    // La B (sin imprimir) ya no sirve: se fue su fila y su archivo.
    expect(B.datos.fotofficeHojaImpresion.map((h) => h.id)).toEqual([a.hojaId]);
    expect(R2.has(claveB)).toBe(false);
    expect(R2.has(hojaA.finalKey as string)).toBe(true);
    expect(estadoDe(prep)).toBe("IMPRESA");
  });

  it("quitar una foto con su hoja sin imprimir borra la fila de la hoja y su archivo", async () => {
    const medidas: [number, number][] = [[600, 400], [400, 600]];
    const { prep, ids } = await prepConFotos(medidas);
    await guardarPropuestas(prep, ids, medidas);
    const a = await K.generarHojaCopia(CTX, prep, ids[0]!);
    const b = await K.generarHojaCopia(CTX, prep, ids[1]!);
    if (!a.ok || !b.ok) throw new Error("no armó");
    const claveA = B.datos.fotofficeHojaImpresion.find((h) => h.id === a.hojaId)!.finalKey as string;
    expect(await K.quitarFotoCopia(CTX, prep, ids[0]!)).toEqual({ ok: true });
    expect(B.datos.fotofficeHojaImpresion.map((h) => h.id)).toEqual([b.hojaId]);
    expect(R2.has(claveA)).toBe(false);
    expect(estadoDe(prep)).toBe("LISTA");
  });

  it("sin pieza, de otra preparación o de otro negocio: no arma nada", async () => {
    const { prep, ids } = await prepConFotos([[600, 400]]);
    expect(await K.generarHojaCopia(CTX, prep, ids[0]!)).toEqual({ ok: false, error: "Primero armá la foto." });
    await guardarPropuestas(prep, ids, [[600, 400]]);
    expect((await K.generarHojaCopia(OTRO, prep, ids[0]!)).ok).toBe(false);
    const otra = await prepConFotos([[600, 400]]);
    expect((await K.generarHojaCopia(CTX, otra.prep, ids[0]!)).ok).toBe(false);
    expect(B.datos.fotofficeHojaImpresion).toHaveLength(0);
  });
});

describe("copias: imprimir todo y registrar", () => {
  async function armadas(medidas: [number, number][], cantidades: number[]) {
    const r = await prepConFotos(medidas);
    await guardarPropuestas(r.prep, r.ids, medidas, cantidades);
    for (const id of r.ids) {
      const h = await K.generarHojaCopia(CTX, r.prep, id);
      if (!h.ok) throw new Error(h.error);
    }
    return r;
  }

  it("imprimir todo: cada foto su hoja con sus copias; avisa las que faltan armar", async () => {
    const medidas: [number, number][] = [[600, 400], [400, 600], [500, 500]];
    const { prep, ids } = await prepConFotos(medidas);
    await guardarPropuestas(prep, ids, medidas, [2, 1, 3]);
    await K.generarHojaCopia(CTX, prep, ids[0]!);
    await K.generarHojaCopia(CTX, prep, ids[1]!);
    let d = (await P.datosParaImprimirPreparacion("ws-1", prep, false))!;
    expect(d.faltan).toBe(1);
    expect(d.hojas.map((h) => h.copias)).toEqual([2, 1]);
    expect(d.papel).toEqual({ anchoMm: 102, altoMm: 152, escalaXMil: 1000, escalaYMil: 1000, salida: "Kodak 305", tamano: "10x15" });
    await K.generarHojaCopia(CTX, prep, ids[2]!);
    d = (await P.datosParaImprimirPreparacion("ws-1", prep, false))!;
    expect(d.faltan).toBe(0);
    expect(M.paginas(d.hojas)).toHaveLength(6);
    expect(await P.datosParaImprimirPreparacion("ws-2", prep, false)).toBeNull();
  });

  it("registrar varias: con una copia mal queda LISTA y sólo esa falta; al reimprimirla, IMPRESA", async () => {
    const { prep } = await armadas([[600, 400], [400, 600]], [2, 1]);
    const d = (await P.datosParaImprimirPreparacion("ws-1", prep, false))!;
    const primera = d.hojas[0]!.hojaId;
    const x = M.registrosDeRespuesta(d.hojas, { [primera]: 1 });
    expect(await P.registrarImpresiones(CTX, prep, x.registros)).toEqual({ ok: true });
    expect(estadoDe(prep)).toBe("LISTA");
    expect((await P.datosParaImprimirPreparacion("ws-1", prep, true))!.hojas).toEqual([{ hojaId: primera, version: d.hojas[0]!.version, copias: 1 }]);
    expect(await P.registrarImpresiones(CTX, prep, [{ hojaId: primera, motivo: "NORMAL", hojas: 1 }])).toEqual({ ok: true });
    expect(estadoDe(prep)).toBe("IMPRESA");
    expect((await P.datosParaImprimirPreparacion("ws-1", prep, true))!.hojas).toEqual([]);
    expect(B.datos.fotofficeRegistroImpresion.map((r) => r.motivo).sort()).toEqual(["DESCARTADA", "NORMAL", "NORMAL", "NORMAL"]);
    expect(B.datos.fotofficeRegistroImpresion.every((r) => r.productId === "copia10")).toBe(true);
  });

  it("editar una foto después de imprimir: arma otra hoja, no pisa la impresa y sólo esa queda pendiente", async () => {
    const medidas: [number, number][] = [[600, 400], [400, 600]];
    const { prep, ids } = await armadas(medidas, [1, 1]);
    const d = (await P.datosParaImprimirPreparacion("ws-1", prep, false))!;
    await P.registrarImpresiones(CTX, prep, M.registrosDeRespuesta(d.hojas, {}).registros);
    expect(estadoDe(prep)).toBe("IMPRESA");
    const impresa = B.datos.fotofficeHojaImpresion.find((h) => h.id === d.hojas[0]!.hojaId)!;
    const claveImpresa = impresa.finalKey as string;

    const encajada = cambiarModo(propuestaAutomatica(600, 400, P10), "ENCAJAR", { foto: { ancho: 600, alto: 400 }, papel: P10 });
    await K.guardarPiezasCopia(CTX, prep, [{ originalId: ids[0]!, cantidad: 1, receta: encajada, revisada: true }]);
    expect(estadoDe(prep)).toBe("PREPARANDO");
    const nueva = await K.generarHojaCopia(CTX, prep, ids[0]!);
    if (!nueva.ok) throw new Error(nueva.error);

    expect(nueva.hojaId).not.toBe(impresa.id);
    expect(B.datos.fotofficeHojaImpresion.find((h) => h.id === impresa.id)).toMatchObject({ finalKey: claveImpresa });
    expect(R2.has(claveImpresa)).toBe(true);
    expect(estadoDe(prep)).toBe("LISTA");
    expect((await P.datosParaImprimirPreparacion("ws-1", prep, true))!.hojas.map((h) => h.hojaId)).toEqual([nueva.hojaId]);
    expect(B.datos.fotofficeRegistroImpresion).toHaveLength(2);
  });

  it("no registra hojas de otra preparación ni de otro negocio, ni respuestas raras", async () => {
    const a = await armadas([[600, 400]], [1]);
    const b = await armadas([[600, 400]], [1]);
    const hojaA = (await P.datosParaImprimirPreparacion("ws-1", a.prep, false))!.hojas[0]!.hojaId;
    expect((await P.registrarImpresiones(OTRO, a.prep, [{ hojaId: hojaA, motivo: "NORMAL", hojas: 1 }])).ok).toBe(false);
    expect((await P.registrarImpresiones(CTX, b.prep, [{ hojaId: hojaA, motivo: "NORMAL", hojas: 1 }])).ok).toBe(false);
    expect((await P.registrarImpresiones(CTX, a.prep, [{ hojaId: hojaA, motivo: "PRUEBA" as "NORMAL", hojas: 1 }])).ok).toBe(false);
    expect((await P.registrarImpresiones(CTX, a.prep, [{ hojaId: hojaA, motivo: "NORMAL", hojas: 0 }])).ok).toBe(false);
    expect((await P.registrarImpresiones(CTX, a.prep, [])).ok).toBe(false);
    expect((await P.registrarImpresiones(CTX, a.prep, [null as never])).ok).toBe(false);
    expect(B.datos.fotofficeRegistroImpresion).toHaveLength(0);
  });
});

describe("copias en la cola de Impresiones", () => {
  it("muestra cuántas fotos tiene y enlaza a imprimir lo que falta de toda la preparación", async () => {
    const medidas: [number, number][] = [[600, 400], [400, 600]];
    const { prep, ids } = await prepConFotos(medidas);
    await guardarPropuestas(prep, ids, medidas);
    const fila = (await P.colas("ws-1", new Date())).sinCobrar.find((f) => f.preparacionId === prep)!;
    expect(fila).toMatchObject({ fotos: 2, estado: "PREPARANDO", imprimirHref: `/imprimir/preparacion/${prep}?solo=pendientes` });
  });
});
