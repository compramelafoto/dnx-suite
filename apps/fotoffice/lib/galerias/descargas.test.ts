import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null, DbNull: null } }));
vi.mock("@/lib/presupuestos/sitio", () => ({
  sitioDelWorkspace: async (ws: string) => ({ workspaceId: ws, slug: "dnxestudio", customDomain: null, nombre: "DNX Estudio", logoUrl: null, whatsapp: null, email: null }),
  workspaceDelSlug: async () => "ws-1",
}));
vi.mock("./almacen", () => ({
  urlsDeLecturaPorLote: async () => new Map(),
  urlDeLecturaFoto: async (c: string) => `https://r2.test/${c}`,
  urlDeDescargaFoto: async (c: string) => `https://r2.test/${c}`,
  urlDeDescargaOriginal: async (c: string, n: { ascii: string }) => `https://r2.test/${c}?original=${n.ascii}`,
  urlDeReproduccionVideo: async (c: string) => `https://r2.test/${c}`,
}));
vi.mock("./almacen-descargas", () => ({
  almacenZipR2: {},
  urlDeDescargaParte: async (c: string, nombre: string) => `https://r2.test/${c}?zip=${encodeURIComponent(nombre)}`,
}));
const correo = vi.hoisted(() => ({ enviar: vi.fn() }));
vi.mock("./correos", () => ({ enviarCorreoGaleria: correo.enviar }));

const D = await import("./descargas");
const { tokenDeGaleriaCliente, hashDeToken } = await import("./enlace");
const { claveDeParte, MENSAJES_DESCARGA: M, MAX_PEDIDOS_POR_DIA } = await import("./descargas-reglas");
const { crc32Tabla } = await import("./zip");
import type { AlmacenZip } from "./almacen-descargas";

const MB = 1024 * 1024;
const GB = 1024 * MB;
const CLAVE = "clave-de-prueba";
const EMITIDO = new Date("2026-10-01T12:00:00.000Z");
const AHORA = new Date("2026-10-11T15:00:00.000Z");
const MIN = 60_000;
const DIA = 24 * 60 * MIN;
const token = (id: string) => tokenDeGaleriaCliente(id, EMITIDO, CLAVE);
const TOKEN1 = token("gc1");
const ctx = { workspaceId: "ws-1", userId: 7, userLabel: "Dani", role: "OWNER", acceso: {} } as never;

const descargas = () => B.datos.fotofficeGaleriaDescarga;
const descarga = (id: string) => descargas().find((d) => d.id === id)!;
const partes = (id: string) => descarga(id).parts as { tipo: string; n: number; key: string; estado: string; files: number; bytes: number; fileIds?: string[] }[];
const eventos = () => B.datos.fotofficeGaleriaEvento.map((e) => e.type);

/** Almacén en memoria con las reglas de R2: bloques iguales salvo el último y subida que sólo existe al completarse. */
function crearAlmacen() {
  const objetos = new Map<string, Buffer>();
  const subidas = new Map<string, { key: string; bloques: Map<number, Buffer> }>();
  const reg = { destruidos: 0, abortos: [] as string[], bloques: [] as number[], borrados: [] as string[], iniciadas: 0, fallarEnBloque: 0, lecturas: [] as string[] };
  let n = 0;
  const almacen: AlmacenZip = {
    async leer(clave) {
      reg.lecturas.push(clave);
      const o = objetos.get(clave);
      if (!o) return null;
      const flujo = (async function* () {
        for (let i = 0; i < o.length; i += 300) yield o.subarray(i, i + 300);
      })();
      return Object.assign(flujo, { destroy: () => void reg.destruidos++ });
    },
    async iniciarMultiparte(clave) {
      reg.iniciadas++;
      const id = `up-${++n}`;
      subidas.set(id, { key: clave, bloques: new Map() });
      return id;
    },
    async subirBloque(_c, uploadId, numero, cuerpo) {
      if (reg.fallarEnBloque && numero === reg.fallarEnBloque) throw Object.assign(new Error("boom"), { name: "InternalError" });
      const s = subidas.get(uploadId);
      if (!s) throw new Error("NoSuchUpload");
      s.bloques.set(numero, Buffer.from(cuerpo));
      reg.bloques.push(cuerpo.length);
      return `etag-${numero}`;
    },
    async completarMultiparte(_c, uploadId, bloques) {
      const s = subidas.get(uploadId);
      if (!s) throw new Error("NoSuchUpload");
      const ordenados = [...bloques].sort((a, b) => a.numero - b.numero);
      const tams = ordenados.map((b) => s.bloques.get(b.numero)!.length);
      // R2: todas las partes menos la última miden lo mismo.
      for (let i = 0; i < tams.length - 1; i++) expect(tams[i]).toBe(tams[0]);
      expect(tams[tams.length - 1]!).toBeLessThanOrEqual(tams[0]!);
      objetos.set(s.key, Buffer.concat(ordenados.map((b) => s.bloques.get(b.numero)!)));
      subidas.delete(uploadId);
    },
    async abortarMultiparte(_c, uploadId) {
      reg.abortos.push(uploadId);
      subidas.delete(uploadId);
    },
    async borrar(clave) {
      reg.borrados.push(clave);
      objetos.delete(clave);
    },
  };
  return { almacen, objetos, subidas, reg };
}

/** Lector mínimo del directorio central: nombres, CRC y datos de cada archivo. */
function leerZip(zip: Buffer) {
  const fin = zip.length - 22;
  expect(zip.readUInt32LE(fin)).toBe(0x06054b50);
  const total = zip.readUInt16LE(fin + 10);
  let p = zip.readUInt32LE(fin + 16);
  const salida: { nombre: string; datos: Buffer }[] = [];
  for (let i = 0; i < total; i++) {
    const crc = zip.readUInt32LE(p + 16);
    const tam = zip.readUInt32LE(p + 24);
    const ln = zip.readUInt16LE(p + 28);
    const off = zip.readUInt32LE(p + 42);
    const nombre = zip.subarray(p + 46, p + 46 + ln).toString("utf8");
    const ini = off + 30 + zip.readUInt16LE(off + 26) + zip.readUInt16LE(off + 28);
    const datos = zip.subarray(ini, ini + tam);
    expect(crc32Tabla(datos)).toBe(crc);
    salida.push({ nombre, datos });
    p += 46 + ln + zip.readUInt16LE(p + 30) + zip.readUInt16LE(p + 32);
  }
  return salida;
}

function sembrarCliente(id: string, extra: Record<string, unknown> = {}, galeriaId = "ge") {
  B.agregar("fotofficeGaleriaCliente", {
    id, workspaceId: "ws-1", galeriaId, clientId: null, name: "Ana Gómez", email: "ana@x.com", tokenHash: hashDeToken(token(id)), tokenIssuedAt: EMITIDO, ...extra,
  });
}
/** `bytes` es el tamaño que dice la base (el que usa el plan); el contenido real del objeto es `contenido`. */
function sembrarFoto(id: string, bytes = 5 * MB, extra: Record<string, unknown> = {}, galeriaId = "ge", ws = "ws-1") {
  B.agregar("fotofficeGaleriaFoto", {
    id, workspaceId: ws, galeriaId, fileName: `${id}.jpg`, originalKey: `galerias/${ws}/${galeriaId}/${id}/original`, status: "LISTA", sizeBytes: bytes, order: 0, mediaType: "FOTO",
    createdAt: new Date("2026-10-05T10:00:00Z"), ...extra,
  });
}
function contenidoDe(id: string) {
  return Buffer.from(`contenido de ${id} `.repeat(120));
}
function cargarOriginales(a: ReturnType<typeof crearAlmacen>, ...ids: string[]) {
  for (const id of ids) {
    const f = B.datos.fotofficeGaleriaFoto.find((x) => x.id === id)!;
    a.objetos.set(f.originalKey as string, contenidoDe(id));
  }
}
function sembrarDescarga(id: string, extra: Record<string, unknown> = {}) {
  B.agregar("fotofficeGaleriaDescarga", {
    id, workspaceId: "ws-1", galeriaId: "ge", galeriaClienteId: "gc1", status: "LISTA", totalFiles: 2, totalBytes: 10, requestedEmail: "ana@x.com",
    parts: [{ tipo: "ZIP", n: 1, key: claveDeParte("ws-1", "ge", id, 1), bytes: 100, files: 2, estado: "LISTA", fileIds: ["f1", "f2"] }],
    expiresAt: new Date(AHORA.getTime() + 5 * DIA), createdAt: new Date(AHORA.getTime() - MIN), updatedAt: new Date(AHORA.getTime() - MIN), ...extra,
  });
}

let a: ReturnType<typeof crearAlmacen>;
const avisos: string[] = [];
/** Como el real: reserva el aviso con `notifiedAt` para que no salga dos veces. */
const avisarFalso = async (id: string, ahora: Date) => {
  const fila = descarga(id);
  if (fila.notifiedAt) return;
  fila.notifiedAt = ahora;
  avisos.push(id);
};
const corrida = (extra: Partial<Parameters<typeof D.procesarDescargas>[0]> = {}, ahora = AHORA) =>
  D.procesarDescargas({ almacen: a.almacen, ahora: () => ahora, bloque: 1000, avisar: avisarFalso, ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  B.vaciar();
  a = crearAlmacen();
  avisos.length = 0;
  correo.enviar.mockReset().mockResolvedValue("ENVIADO");
  B.agregar("fotofficeGaleria", { id: "ge", workspaceId: "ws-1", proyectoId: "pr1", number: "G-1", name: "Entrega boda", kind: "ENTREGA", status: "PUBLICADA", orderMode: "NOMBRE" });
  B.agregar("fotofficeGaleria", { id: "gs", workspaceId: "ws-1", proyectoId: "pr1", number: "G-2", name: "Selección", kind: "SELECCION", status: "PUBLICADA", orderMode: "NOMBRE" });
  B.agregar("fotofficeGaleria", { id: "g-ajena", workspaceId: "ws-2", proyectoId: "pr9", number: "G-1", name: "Ajena", kind: "ENTREGA", status: "PUBLICADA", orderMode: "NOMBRE" });
  sembrarCliente("gc1");
  sembrarCliente("gc2", { name: "Beto", email: "beto@x.com" });
});

describe("crear el pedido", () => {
  it("planifica las partes en el orden natural de la galería, guarda el correo y deja constancia", async () => {
    sembrarFoto("IMG_10");
    sembrarFoto("IMG_2");
    sembrarFoto("IMG_1");
    sembrarFoto("pendiente", 5 * MB, { status: "PENDIENTE" });
    sembrarFoto("ajena", 5 * MB, {}, "g-ajena", "ws-2");
    const r = await D.pedirDescargaDeCliente("ws-1", TOKEN1, AHORA);
    expect(r).toMatchObject({ ok: true, yaEnCurso: false });
    if (!r.ok) throw new Error();
    const d = descarga(r.id);
    expect(d).toMatchObject({ workspaceId: "ws-1", galeriaId: "ge", galeriaClienteId: "gc1", status: "PENDIENTE", totalFiles: 3, requestedEmail: "ana@x.com" });
    expect(Number(d.totalBytes)).toBe(15 * MB);
    expect(partes(r.id)).toHaveLength(1);
    expect(partes(r.id)[0]).toMatchObject({ tipo: "ZIP", n: 1, key: `galerias/ws-1/ge/descargas/${r.id}/parte-1.zip`, estado: "PENDIENTE", fileIds: ["IMG_1", "IMG_2", "IMG_10"] });
    expect(eventos()).toContain("DESCARGA_PEDIDA");
    // No guarda nombres ni enlaces: sólo ids, números y el correo de aviso.
    expect(JSON.stringify(d, (_k, v) => (typeof v === "bigint" ? Number(v) : v))).not.toMatch(/Gómez|gc1.*token/);
  });

  it("reparte en partes de hasta 1 GB y deja «sueltos» (sin ZIP) los videos de más de 1 GB", async () => {
    for (let i = 1; i <= 15; i++) sembrarFoto(`f${String(i).padStart(2, "0")}`, 100 * MB);
    sembrarFoto("v-2gb", 2 * GB, { fileName: "z-video2.mp4", mediaType: "VIDEO" });
    sembrarFoto("v-5gb", 5 * GB, { fileName: "z-video5.mov", mediaType: "VIDEO" });
    const r = await D.pedirDescargaDeCliente("ws-1", TOKEN1, AHORA);
    if (!r.ok) throw new Error(r.error);
    const p = partes(r.id);
    const zips = p.filter((x) => x.tipo === "ZIP");
    expect(zips.length).toBe(2);
    expect(zips.map((x) => x.n)).toEqual([1, 2]);
    expect(zips.every((x) => x.bytes <= GB)).toBe(true);
    expect(p.filter((x) => x.tipo === "SUELTO")).toMatchObject([{ fotoId: "v-2gb", estado: "LISTA", bytes: 2 * GB }, { fotoId: "v-5gb", estado: "LISTA", bytes: 5 * GB }]);
    // Las fotos entran todas, una sola vez; los videos grandes no están en ningún ZIP.
    expect(zips.flatMap((x) => x.fileIds!).sort()).toEqual(Array.from({ length: 15 }, (_, i) => `f${String(i + 1).padStart(2, "0")}`));
  });

  it("si todo es «suelto» (sin nada que armar) queda LISTA de entrada", async () => {
    sembrarFoto("v-5gb", 5 * GB, { mediaType: "VIDEO" });
    const r = await D.pedirDescargaDeCliente("ws-1", TOKEN1, AHORA);
    if (!r.ok) throw new Error();
    expect(descarga(r.id).status).toBe("LISTA");
  });

  it("sólo en galerías de entrega; en una de selección, no", async () => {
    sembrarCliente("gcs", {}, "gs");
    sembrarFoto("fs", 5 * MB, {}, "gs");
    const r = await D.pedirDescargaDeCliente("ws-1", token("gcs"), AHORA);
    expect(r).toMatchObject({ ok: false, codigo: "NO_ENTREGA" });
    expect(descargas()).toHaveLength(0);
    expect(await D.crearPedidoDescarga({ workspaceId: "ws-1", galeriaId: "gs", galeriaClienteId: null, requestedEmail: null }, AHORA)).toMatchObject({ ok: false, codigo: "NO_ENTREGA" });
  });

  it("exige un correo válido del cliente: si no, pide al estudio que lo cargue", async () => {
    sembrarFoto("f1");
    sembrarCliente("gc3", { email: null });
    sembrarCliente("gc4", { email: "no-es-correo" });
    for (const id of ["gc3", "gc4"]) expect(await D.pedirDescargaDeCliente("ws-1", token(id), AHORA)).toEqual({ ok: false, error: M.sinCorreo, codigo: "GENERICO" });
    expect(descargas()).toHaveLength(0);
  });

  it("sin archivos listos no se crea nada", async () => {
    sembrarFoto("f1", 5 * MB, { status: "PENDIENTE" });
    expect(await D.pedirDescargaDeCliente("ws-1", TOKEN1, AHORA)).toMatchObject({ ok: false, codigo: "SIN_ARCHIVOS" });
  });

  it("un enlace desconocido, de otra organización o anulado no crea nada", async () => {
    sembrarFoto("f1");
    expect((await D.pedirDescargaDeCliente("ws-1", "x".repeat(43), AHORA)).ok).toBe(false);
    expect((await D.pedirDescargaDeCliente("ws-2", TOKEN1, AHORA)).ok).toBe(false);
    B.datos.fotofficeGaleriaCliente.find((c) => c.id === "gc1")!.revokedAt = new Date();
    expect((await D.pedirDescargaDeCliente("ws-1", TOKEN1, AHORA)).ok).toBe(false);
    expect(descargas()).toHaveLength(0);
  });

  it("un solo pedido activo por cliente: el segundo devuelve el mismo", async () => {
    sembrarFoto("f1");
    const r1 = await D.pedirDescargaDeCliente("ws-1", TOKEN1, AHORA);
    const r2 = await D.pedirDescargaDeCliente("ws-1", TOKEN1, AHORA);
    if (!r1.ok || !r2.ok) throw new Error();
    expect(r2).toEqual({ ok: true, id: r1.id, yaEnCurso: true });
    expect(descargas()).toHaveLength(1);
    // Otro cliente de la misma galería sí puede pedir el suyo.
    const r3 = await D.pedirDescargaDeCliente("ws-1", token("gc2"), AHORA);
    expect(r3).toMatchObject({ ok: true, yaEnCurso: false });
  });

  it("tope de 3 pedidos por cliente en 24 horas; pasado el día se puede de nuevo; no afecta a otro cliente", async () => {
    sembrarFoto("f1");
    for (let i = 0; i < MAX_PEDIDOS_POR_DIA; i++) {
      const r = await D.pedirDescargaDeCliente("ws-1", TOKEN1, new Date(AHORA.getTime() + i * MIN));
      if (!r.ok) throw new Error(r.error);
      descarga(r.id).status = "LISTA"; // terminó: ya no hay uno activo
    }
    const cuarto = await D.pedirDescargaDeCliente("ws-1", TOKEN1, new Date(AHORA.getTime() + 10 * MIN));
    expect(cuarto).toEqual({ ok: false, error: M.tope, codigo: "TOPE" });
    expect(descargas()).toHaveLength(3);
    expect(await D.pedirDescargaDeCliente("ws-1", token("gc2"), AHORA)).toMatchObject({ ok: true });
    expect(await D.pedirDescargaDeCliente("ws-1", TOKEN1, new Date(AHORA.getTime() + DIA + 5 * MIN))).toMatchObject({ ok: true, yaEnCurso: false });
  });

  it("el estado para la página: correo, activa, lista y tope", async () => {
    sembrarFoto("f1");
    const vacio = await D.estadoDescargaDeCliente("ws-1", "ge", "gc1", "ana@x.com", AHORA);
    expect(vacio).toEqual({ tieneCorreo: true, activa: false, lista: false, pedidosHoy: 0, topeAlcanzado: false });
    expect((await D.estadoDescargaDeCliente("ws-1", "ge", "gc1", null, AHORA)).tieneCorreo).toBe(false);
    sembrarDescarga("d1");
    sembrarDescarga("d2", { status: "ARMANDO" });
    sembrarDescarga("d3", { status: "VENCIDA" });
    expect(await D.estadoDescargaDeCliente("ws-1", "ge", "gc1", "ana@x.com", AHORA)).toMatchObject({ activa: true, lista: true, pedidosHoy: 3, topeAlcanzado: true });
    // Otro cliente no ve lo de este.
    expect(await D.estadoDescargaDeCliente("ws-1", "ge", "gc2", "beto@x.com", AHORA)).toMatchObject({ activa: false, lista: false, pedidosHoy: 0 });
  });
});

describe("armar: una parte por corrida", () => {
  async function pedirDos() {
    // Dos fotos de 600 MB según la base → dos partes; el contenido real es chico.
    sembrarFoto("a", 600 * MB, { fileName: "a ñ.jpg" });
    sembrarFoto("b", 600 * MB, { fileName: "b.jpg" });
    cargarOriginales(a, "a", "b");
    const r = await D.pedirDescargaDeCliente("ws-1", TOKEN1, AHORA);
    if (!r.ok) throw new Error(r.error);
    return r.id;
  }

  it("la primera corrida arma la parte 1 y deja el pedido en cola; la segunda arma la 2, lo deja LISTA con 7 días y avisa", async () => {
    const id = await pedirDos();
    expect(partes(id).map((p) => p.n)).toEqual([1, 2]);

    const r1 = await corrida();
    expect(r1).toMatchObject({ tomada: id, parteArmada: 1, terminada: false, fallo: false });
    expect(descarga(id).status).toBe("PENDIENTE");
    expect(partes(id).map((p) => p.estado)).toEqual(["LISTA", "PENDIENTE"]);
    expect(descarga(id).cursor).toBeNull();
    expect(a.objetos.has(`galerias/ws-1/ge/descargas/${id}/parte-1.zip`)).toBe(true);
    expect(a.objetos.has(`galerias/ws-1/ge/descargas/${id}/parte-2.zip`)).toBe(false);
    expect(avisos).toEqual([]);

    const r2 = await corrida({}, new Date(AHORA.getTime() + 5 * MIN));
    expect(r2).toMatchObject({ tomada: id, parteArmada: 2, terminada: true });
    const d = descarga(id);
    expect(d.status).toBe("LISTA");
    expect(partes(id).map((p) => p.estado)).toEqual(["LISTA", "LISTA"]);
    expect((d.expiresAt as Date).getTime()).toBe(AHORA.getTime() + 5 * MIN + 7 * DIA);
    expect(avisos).toEqual([id]);
    expect(eventos()).toContain("DESCARGA_LISTA");

    // Los ZIP son válidos y traen los archivos con su nombre y su contenido.
    const z1 = leerZip(a.objetos.get(`galerias/ws-1/ge/descargas/${id}/parte-1.zip`)!);
    const z2 = leerZip(a.objetos.get(`galerias/ws-1/ge/descargas/${id}/parte-2.zip`)!);
    expect(z1.map((x) => x.nombre)).toEqual(["a ñ.jpg"]);
    expect(z1[0]!.datos.equals(contenidoDe("a"))).toBe(true);
    expect(z2.map((x) => x.nombre)).toEqual(["b.jpg"]);
    expect(partes(id)[0]).toMatchObject({ files: 1, bytes: a.objetos.get(`galerias/ws-1/ge/descargas/${id}/parte-1.zip`)!.length });

    // Ya no hay nada más que hacer.
    expect(await corrida({}, new Date(AHORA.getTime() + 10 * MIN))).toMatchObject({ tomada: null, parteArmada: null });
  });

  it("sube en bloques iguales (menos el último) y no deja subidas colgadas", async () => {
    const id = await pedirDos();
    await corrida();
    expect(a.reg.bloques.length).toBeGreaterThan(1);
    expect(a.reg.bloques.slice(0, -1).every((n) => n === 1000)).toBe(true);
    expect(a.subidas.size).toBe(0);
    expect(descarga(id).status).toBe("PENDIENTE");
  });

  it("cuando una sola parte alcanza, termina en la primera corrida", async () => {
    sembrarFoto("a");
    sembrarFoto("b");
    cargarOriginales(a, "a", "b");
    const r = await D.pedirDescargaDeCliente("ws-1", TOKEN1, AHORA);
    if (!r.ok) throw new Error();
    expect(await corrida()).toMatchObject({ parteArmada: 1, terminada: true });
    expect(descarga(r.id).status).toBe("LISTA");
    expect(avisos).toEqual([r.id]);
  });

  it("toma los pedidos por orden de llegada, uno por corrida", async () => {
    sembrarFoto("a");
    cargarOriginales(a, "a");
    const r1 = await D.pedirDescargaDeCliente("ws-1", TOKEN1, AHORA);
    const r2 = await D.pedirDescargaDeCliente("ws-1", token("gc2"), new Date(AHORA.getTime() + MIN));
    if (!r1.ok || !r2.ok) throw new Error();
    expect((await corrida()).tomada).toBe(r1.id);
    expect(descarga(r2.id).status).toBe("PENDIENTE");
    expect((await corrida()).tomada).toBe(r2.id);
  });

  it("dos corridas a la vez no arman la misma parte dos veces (candado)", async () => {
    sembrarFoto("a");
    cargarOriginales(a, "a");
    const r = await D.pedirDescargaDeCliente("ws-1", TOKEN1, AHORA);
    if (!r.ok) throw new Error();
    const [x, y] = await Promise.all([corrida(), corrida()]);
    expect([x.tomada, y.tomada].filter(Boolean)).toEqual([r.id]);
    expect(a.reg.iniciadas).toBe(1);
    expect(avisos).toEqual([r.id]);
  });

  it("saltea lo que ya no existe: una foto borrada de la galería o un objeto que falta en R2", async () => {
    sembrarFoto("a");
    sembrarFoto("b");
    sembrarFoto("c");
    cargarOriginales(a, "a", "b", "c");
    const r = await D.pedirDescargaDeCliente("ws-1", TOKEN1, AHORA);
    if (!r.ok) throw new Error();
    B.datos.fotofficeGaleriaFoto.splice(B.datos.fotofficeGaleriaFoto.findIndex((f) => f.id === "b"), 1); // borrada
    a.objetos.delete("galerias/ws-1/ge/a/original"); // falta en R2
    await corrida();
    const z = leerZip(a.objetos.get(`galerias/ws-1/ge/descargas/${r.id}/parte-1.zip`)!);
    expect(z.map((x) => x.nombre)).toEqual(["c.jpg"]);
    expect(partes(r.id)[0]).toMatchObject({ estado: "LISTA", files: 1 });
  });
});

describe("retomar: se rehace la parte desde cero", () => {
  async function pedirUno() {
    sembrarFoto("a");
    cargarOriginales(a, "a");
    const r = await D.pedirDescargaDeCliente("ws-1", TOKEN1, AHORA);
    if (!r.ok) throw new Error();
    return r.id;
  }

  it("un ARMANDO con señales recientes no se toca; uno muerto (más de 6 minutos) lo retoma otra corrida", async () => {
    const id = await pedirUno();
    descarga(id).status = "ARMANDO";
    descarga(id).updatedAt = new Date(AHORA.getTime() - 5 * MIN);
    expect(await corrida()).toMatchObject({ tomada: null });
    expect(a.reg.iniciadas).toBe(0);
    descarga(id).updatedAt = new Date(AHORA.getTime() - 7 * MIN);
    expect(await corrida()).toMatchObject({ tomada: id, parteArmada: 1, terminada: true });
    expect(descarga(id).status).toBe("LISTA");
  });

  it("aborta la subida colgada de la corrida muerta y rehace la parte desde cero", async () => {
    const id = await pedirUno();
    const clave = `galerias/ws-1/ge/descargas/${id}/parte-1.zip`;
    // La corrida anterior dejó una subida a medias.
    const colgada = await a.almacen.iniciarMultiparte(clave, "application/zip");
    await a.almacen.subirBloque(clave, colgada, 1, Buffer.alloc(1000, 1));
    a.reg.abortos.length = 0;
    Object.assign(descarga(id), { status: "ARMANDO", updatedAt: new Date(AHORA.getTime() - 20 * MIN), cursor: { n: 1, uploadId: colgada, intentos: 0 } });
    await corrida();
    expect(a.reg.abortos[0]).toBe(colgada);
    expect(a.subidas.size).toBe(0);
    const z = leerZip(a.objetos.get(clave)!);
    expect(z.map((x) => x.nombre)).toEqual(["a.jpg"]);
    expect(descarga(id).status).toBe("LISTA");
    expect(descarga(id).cursor).toBeNull();
  });

  it("una corrida que muere tres veces deja el pedido en ERROR (sin armar de más)", async () => {
    const id = await pedirUno();
    Object.assign(descarga(id), { status: "ARMANDO", updatedAt: new Date(AHORA.getTime() - 20 * MIN), cursor: { n: 1, uploadId: "up-muerto", intentos: 2 } });
    const r = await corrida();
    expect(r.fallo).toBe(true);
    expect(descarga(id)).toMatchObject({ status: "ERROR" });
    expect(String(descarga(id).errorReason)).toMatch(/varios intentos/);
    expect(a.reg.iniciadas).toBe(0);
    expect(eventos()).toContain("DESCARGA_ERROR");
  });

  it("si falla la subida de un bloque: aborta, vuelve a la cola contando el intento y al tercero queda en ERROR", async () => {
    const id = await pedirUno();
    a.reg.fallarEnBloque = 1;
    for (let intento = 1; intento <= 2; intento++) {
      const r = await corrida({}, new Date(AHORA.getTime() + intento * 5 * MIN));
      expect(r.fallo).toBe(true);
      expect(descarga(id).status).toBe("PENDIENTE");
      expect(descarga(id).cursor).toEqual({ n: 1, uploadId: null, intentos: intento });
      expect(a.subidas.size).toBe(0);
    }
    const r3 = await corrida({}, new Date(AHORA.getTime() + 15 * MIN));
    expect(r3.fallo).toBe(true);
    expect(descarga(id).status).toBe("ERROR");
    expect(a.objetos.has(`galerias/ws-1/ge/descargas/${id}/parte-1.zip`)).toBe(false);
    expect(a.reg.abortos).toHaveLength(3);
    expect(avisos).toEqual([]);
  });

  it("si la parte tarda más que el presupuesto de tiempo se corta y cuenta como intento", async () => {
    const id = await pedirUno();
    const r = await corrida({ presupuestoMs: -1 });
    expect(r.fallo).toBe(true);
    expect(descarga(id).cursor).toEqual({ n: 1, uploadId: null, intentos: 1 });
    expect(a.subidas.size).toBe(0);
  });

  it("una corrida que perdió el candado no pisa el avance de otra", async () => {
    const id = await pedirUno();
    const original = a.almacen.completarMultiparte;
    a.almacen.completarMultiparte = async (...args) => {
      await original(...args);
      // Mientras tanto otra corrida terminó el pedido.
      Object.assign(descarga(id), { status: "LISTA" });
    };
    await corrida();
    expect(descarga(id).status).toBe("LISTA");
    // Su avance (la parte lista) no pisó el estado que dejó la otra corrida.
    expect(partes(id)[0]!.estado).toBe("PENDIENTE");
  });
});

describe("vencer", () => {
  it("a los 7 días pasa a VENCIDA y se borran sus partes; sólo las claves que son de esa descarga", async () => {
    sembrarDescarga("d-vieja", { expiresAt: new Date(AHORA.getTime() - MIN) });
    const mia = claveDeParte("ws-1", "ge", "d-vieja", 1);
    a.objetos.set(mia, Buffer.from("zip"));
    // Una clave de otra descarga metida en el JSON no se borra.
    const ajena = claveDeParte("ws-1", "ge", "otra", 1);
    a.objetos.set(ajena, Buffer.from("no tocar"));
    descarga("d-vieja").parts = [
      { tipo: "ZIP", n: 1, key: mia, bytes: 3, files: 1, estado: "LISTA", fileIds: ["f1"] },
      { tipo: "ZIP", n: 2, key: ajena, bytes: 3, files: 1, estado: "LISTA", fileIds: ["f2"] },
    ];
    sembrarDescarga("d-vigente");
    const r = await corrida();
    expect(r.vencidas).toBe(1);
    expect(descarga("d-vieja").status).toBe("VENCIDA");
    expect(descarga("d-vigente").status).toBe("LISTA");
    expect(a.reg.borrados).toEqual([mia]);
    expect(a.objetos.has(ajena)).toBe(true);
  });

  it("también vence una en ERROR; y si no se pudo borrar, queda para la próxima", async () => {
    sembrarDescarga("d-err", { status: "ERROR", expiresAt: new Date(AHORA.getTime() - MIN) });
    const original = a.almacen.borrar;
    a.almacen.borrar = async () => {
      throw new Error("R2 caído");
    };
    expect((await corrida()).vencidas).toBe(0);
    expect(descarga("d-err").status).toBe("ERROR");
    a.almacen.borrar = original;
    expect((await corrida()).vencidas).toBe(1);
    expect(descarga("d-err").status).toBe("VENCIDA");
  });
});

describe("el aviso por correo", () => {
  it("al cliente: con su enlace personal a /descargas y el vencimiento; no se manda dos veces", async () => {
    sembrarDescarga("d1");
    const r = await D.avisarDescargaLista("d1", AHORA, { appOrigin: "https://app.test", clave: CLAVE });
    expect(r).toBe("ENVIADO");
    expect(correo.enviar).toHaveBeenCalledTimes(1);
    const dato = correo.enviar.mock.calls[0]![0];
    expect(dato).toMatchObject({ workspaceId: "ws-1", clave: "GALERIA_DESCARGA_LISTA", galeriaId: "ge", para: "ana@x.com", nombre: "Ana Gómez", numero: "G-1", nombreGaleria: "Entrega boda" });
    expect(dato.enlace).toBe(`https://app.test/w/dnxestudio/galeria/${TOKEN1}/descargas`);
    expect(dato.vence).toBe("16 de octubre de 2026");
    expect(descarga("d1").notifiedAt).toEqual(AHORA);
    expect(await D.avisarDescargaLista("d1", AHORA, { appOrigin: "https://app.test", clave: CLAVE })).toBe("YA_AVISADA");
    expect(correo.enviar).toHaveBeenCalledTimes(1);
    expect(eventos()).toContain("DESCARGA_CORREO_ENVIADO");
  });

  it("pedido por el estudio: va al correo de quien lo pidió, con el enlace a la ficha", async () => {
    sembrarDescarga("d2", { galeriaClienteId: null, requestedEmail: "dani@estudio.com" });
    expect(await D.avisarDescargaLista("d2", AHORA, { appOrigin: "https://app.test", clave: CLAVE })).toBe("ENVIADO");
    expect(correo.enviar.mock.calls[0]![0]).toMatchObject({ para: "dani@estudio.com", nombre: "", enlace: "https://app.test/galerias/ge?tab=descargas" });
  });

  const OPC = { appOrigin: "https://app.test", clave: CLAVE };
  const aviso = (id: string) => descarga(id).cursor as { aviso?: { intentos: number; proximo: string | null; reservadaEn: string | null } } | null;

  it("si el correo no salió por el tope o por el proveedor, no se marca como enviado: espera 30 minutos o más y reintenta; por otros motivos se cierra", async () => {
    sembrarDescarga("d3", { expiresAt: new Date(AHORA.getTime() + 7 * DIA) });
    correo.enviar.mockResolvedValueOnce("TOPE");
    expect(await D.avisarDescargaLista("d3", AHORA, OPC)).toBe("TOPE");
    expect(descarga("d3").notifiedAt).toBeNull();
    expect(aviso("d3")!.aviso).toMatchObject({ intentos: 1, reservadaEn: null, proximo: new Date(AHORA.getTime() + 30 * MIN).toISOString() });
    // Antes de la espera no se vuelve a intentar.
    expect(await D.avisarDescargaLista("d3", new Date(AHORA.getTime() + 10 * MIN), OPC)).toBe("ESPERA");
    expect(correo.enviar).toHaveBeenCalledTimes(1);
    correo.enviar.mockResolvedValueOnce("APAGADA");
    const despues = new Date(AHORA.getTime() + 31 * MIN);
    expect(await D.avisarDescargaLista("d3", despues, OPC)).toBe("APAGADA");
    expect(descarga("d3").notifiedAt).toEqual(despues);
    expect(descarga("d3").cursor).toBeNull();
    // Una sola falla registrada en el historial aunque hubo dos intentos.
    expect(eventos().filter((e) => e === "DESCARGA_CORREO_NO_ENVIADO")).toHaveLength(1);
  });

  it("aunque @updatedAt se mueva en cada escritura, el reintento se corta (máx. 12 intentos y 24 h) y deja UN solo evento de falla", async () => {
    sembrarDescarga("d3", { expiresAt: new Date(AHORA.getTime() + 7 * DIA) });
    const tabla = B.tablas.fotofficeGaleriaDescarga;
    const original = tabla.updateMany;
    let tictac = 0;
    tabla.updateMany = async (a: Parameters<typeof original>[0]) => {
      const r = await original(a);
      for (const f of descargas()) f.updatedAt = new Date(Date.UTC(2030, 0, 1) + ++tictac * 1000); // como Prisma: cada escritura lo refresca
      return r;
    };
    try {
      correo.enviar.mockResolvedValue("NO_ENVIADO");
      for (let k = 0; k < 40; k++) await D.avisarDescargaLista("d3", new Date(AHORA.getTime() + k * 130 * MIN), OPC);
    } finally {
      tabla.updateMany = original;
    }
    expect(correo.enviar.mock.calls.length).toBeGreaterThanOrEqual(5);
    expect(correo.enviar.mock.calls.length).toBeLessThanOrEqual(12);
    expect(descarga("d3").notifiedAt).not.toBeNull(); // cerrado: ya no se insiste
    expect(eventos().filter((e) => e === "DESCARGA_CORREO_NO_ENVIADO")).toHaveLength(1);
    // Y el cron ya no la toma.
    const llamadas = correo.enviar.mock.calls.length;
    await D.procesarDescargas({ almacen: a.almacen, ahora: () => new Date(AHORA.getTime() + 50 * 130 * MIN) });
    expect(correo.enviar.mock.calls.length).toBe(llamadas);
  });

  it("una excepción transitoria (base caída) cuenta como no enviado y se reintenta; el éxito marca enviado recién cuando el proveedor aceptó", async () => {
    sembrarDescarga("d3", { expiresAt: new Date(AHORA.getTime() + 7 * DIA) });
    let notificadoAlEnviar: unknown = "no se llamó";
    correo.enviar.mockImplementationOnce(async () => {
      notificadoAlEnviar = descarga("d3").notifiedAt;
      throw new Error("base caída");
    });
    expect(await D.avisarDescargaLista("d3", AHORA, OPC)).toBe("ERROR");
    expect(notificadoAlEnviar).toBeNull();
    expect(descarga("d3").notifiedAt).toBeNull();
    expect(aviso("d3")!.aviso!.intentos).toBe(1);
    correo.enviar.mockImplementationOnce(async () => {
      notificadoAlEnviar = descarga("d3").notifiedAt;
      return "ENVIADO";
    });
    const t = new Date(AHORA.getTime() + 31 * MIN);
    expect(await D.avisarDescargaLista("d3", t, OPC)).toBe("ENVIADO");
    expect(notificadoAlEnviar).toBeNull(); // durante el envío todavía no figuraba como enviado
    expect(descarga("d3").notifiedAt).toEqual(t);
  });

  it("si la función murió con la reserva puesta, pasado el arriendo de 10 minutos otra corrida lo retoma; antes, no", async () => {
    sembrarDescarga("d3", { expiresAt: new Date(AHORA.getTime() + 7 * DIA), cursor: { aviso: { intentos: 1, proximo: null, reservadaEn: new Date(AHORA.getTime() - 2 * MIN).toISOString(), falloRegistrado: false } } });
    expect(await D.avisarDescargaLista("d3", AHORA, OPC)).toBe("YA_AVISADA");
    expect(correo.enviar).not.toHaveBeenCalled();
    descarga("d3").cursor = { aviso: { intentos: 1, proximo: null, reservadaEn: new Date(AHORA.getTime() - 11 * MIN).toISOString(), falloRegistrado: false } };
    expect(await D.avisarDescargaLista("d3", AHORA, OPC)).toBe("ENVIADO");
    expect(correo.enviar).toHaveBeenCalledTimes(1);
    expect(descarga("d3").notifiedAt).toEqual(AHORA);
  });

  it("con el enlace del cliente anulado no se manda nada (y no se reintenta)", async () => {
    sembrarDescarga("d4");
    B.datos.fotofficeGaleriaCliente.find((c) => c.id === "gc1")!.revokedAt = new Date();
    expect(await D.avisarDescargaLista("d4", AHORA, { appOrigin: "https://app.test", clave: CLAVE })).toBe("ERROR");
    expect(correo.enviar).not.toHaveBeenCalled();
  });

  it("el cron reintenta los avisos pendientes de las últimas 24 h, no de las más viejas", async () => {
    // d5 quedó lista hace 2 h; d6 hace 2 días; d7 ya se avisó. La edad sale de expiresAt, no de updatedAt.
    sembrarDescarga("d5", { expiresAt: new Date(AHORA.getTime() + 7 * DIA - 2 * 60 * MIN) });
    sembrarDescarga("d6", { expiresAt: new Date(AHORA.getTime() + 5 * DIA) });
    sembrarDescarga("d7", { expiresAt: new Date(AHORA.getTime() + 7 * DIA - 2 * 60 * MIN), notifiedAt: AHORA });
    const r = await corrida();
    expect(r.avisadas).toBe(1);
    expect(avisos).toEqual(["d5"]);
  });
});

describe("la página /descargas del cliente", () => {
  it("lista las partes de la descarga lista y vigente, sin claves de R2", async () => {
    sembrarDescarga("d1", {
      parts: [
        { tipo: "ZIP", n: 1, key: claveDeParte("ws-1", "ge", "d1", 1), bytes: 900 * MB, files: 80, estado: "LISTA", fileIds: [] },
        { tipo: "ZIP", n: 2, key: claveDeParte("ws-1", "ge", "d1", 2), bytes: 50 * MB, files: 5, estado: "LISTA", fileIds: [] },
        { tipo: "SUELTO", n: 1, fotoId: "v5", nombre: "boda.mov", bytes: 5 * GB, files: 1, estado: "LISTA" },
      ],
    });
    const v = await D.vistaDeDescargas("ws-1", TOKEN1, AHORA);
    expect(v).toMatchObject({ estado: "LISTA", descargaId: "d1", venceEl: "16 de octubre de 2026", cliente: { nombre: "Ana Gómez" }, galeria: { nombre: "Entrega boda" } });
    expect(v!.partes.map((p) => [p.tipo, p.n, p.tamano])).toEqual([["ZIP", 1, "900,0 MB"], ["ZIP", 2, "50,0 MB"], ["SUELTO", 1, "5,00 GB"]]);
    expect(JSON.stringify(v)).not.toContain("galerias/");
  });

  it("estados: armando, error, vencida (por fecha o por estado) y ninguna", async () => {
    expect((await D.vistaDeDescargas("ws-1", TOKEN1, AHORA))!.estado).toBe("NINGUNA");
    sembrarDescarga("d1", { status: "ARMANDO" });
    expect((await D.vistaDeDescargas("ws-1", TOKEN1, AHORA))).toMatchObject({ estado: "ARMANDO", partes: [] });
    descarga("d1").status = "ERROR";
    expect((await D.vistaDeDescargas("ws-1", TOKEN1, AHORA))!.estado).toBe("ERROR");
    descarga("d1").status = "VENCIDA";
    expect((await D.vistaDeDescargas("ws-1", TOKEN1, AHORA))).toMatchObject({ estado: "VENCIDA", descargaId: null });
    descarga("d1").status = "LISTA";
    descarga("d1").expiresAt = new Date(AHORA.getTime() - MIN);
    expect((await D.vistaDeDescargas("ws-1", TOKEN1, AHORA))!.estado).toBe("VENCIDA");
  });

  it("no ve las descargas de otro cliente de la misma galería ni de otra organización (IDOR)", async () => {
    sembrarDescarga("d-de-beto", { galeriaClienteId: "gc2" });
    expect((await D.vistaDeDescargas("ws-1", TOKEN1, AHORA))!.estado).toBe("NINGUNA");
    expect(await D.vistaDeDescargas("ws-2", TOKEN1, AHORA)).toBeNull();
    expect(await D.vistaDeDescargas("ws-1", "x".repeat(43), AHORA)).toBeNull();
    B.datos.fotofficeGaleriaCliente.find((c) => c.id === "gc1")!.revokedAt = new Date();
    expect(await D.vistaDeDescargas("ws-1", TOKEN1, AHORA)).toBeNull();
  });

  it("firma una parte por clic: attachment, con el nombre de la galería y la parte", async () => {
    sembrarDescarga("d1");
    const r = await D.urlDeParteDeCliente("ws-1", TOKEN1, "d1", "ZIP", 1, AHORA);
    expect(r).toMatchObject({ ok: true });
    if (!r.ok) throw new Error();
    expect(r.url).toContain(claveDeParte("ws-1", "ge", "d1", 1));
    expect(decodeURIComponent(r.url)).toContain("Entrega boda-parte-1.zip");
  });

  it("el archivo suelto se firma como original (5 min) sólo si es de esta galería", async () => {
    sembrarFoto("v5", 5 * GB, { fileName: "boda.mov", mediaType: "VIDEO" });
    sembrarFoto("v-ajeno", 5 * GB, { fileName: "ajeno.mov", mediaType: "VIDEO" }, "g-ajena", "ws-2");
    sembrarDescarga("d1", { parts: [{ tipo: "SUELTO", n: 1, fotoId: "v5", nombre: "boda.mov", bytes: 5 * GB, files: 1, estado: "LISTA" }] });
    const r = await D.urlDeParteDeCliente("ws-1", TOKEN1, "d1", "SUELTO", 1, AHORA);
    expect(r).toMatchObject({ ok: true });
    if (r.ok) expect(r.url).toContain("galerias/ws-1/ge/v5/original");
    // Un id de foto de otra organización metido en el JSON no se firma.
    descarga("d1").parts = [{ tipo: "SUELTO", n: 1, fotoId: "v-ajeno", nombre: "x", bytes: 1, files: 1, estado: "LISTA" }];
    expect(await D.urlDeParteDeCliente("ws-1", TOKEN1, "d1", "SUELTO", 1, AHORA)).toEqual({ ok: false, error: M.parteInvalida });
  });

  it("no firma si la descarga es de otro cliente, de otra galería u organización, no está lista o venció", async () => {
    sembrarDescarga("d-beto", { galeriaClienteId: "gc2" });
    expect(await D.urlDeParteDeCliente("ws-1", TOKEN1, "d-beto", "ZIP", 1, AHORA)).toEqual({ ok: false, error: M.noDisponible });
    sembrarDescarga("d-ws2", { workspaceId: "ws-2" });
    expect(await D.urlDeParteDeCliente("ws-1", TOKEN1, "d-ws2", "ZIP", 1, AHORA)).toEqual({ ok: false, error: M.noDisponible });
    sembrarDescarga("d-g2", { galeriaId: "gs" });
    expect(await D.urlDeParteDeCliente("ws-1", TOKEN1, "d-g2", "ZIP", 1, AHORA)).toEqual({ ok: false, error: M.noDisponible });
    sembrarDescarga("d-arm", { status: "ARMANDO" });
    expect(await D.urlDeParteDeCliente("ws-1", TOKEN1, "d-arm", "ZIP", 1, AHORA)).toEqual({ ok: false, error: M.noDisponible });
    sembrarDescarga("d-venc", { expiresAt: new Date(AHORA.getTime() - MIN) });
    expect(await D.urlDeParteDeCliente("ws-1", TOKEN1, "d-venc", "ZIP", 1, AHORA)).toEqual({ ok: false, error: M.noDisponible });
    // Token de otro cliente de la misma galería: no es su descarga.
    sembrarDescarga("d1");
    expect(await D.urlDeParteDeCliente("ws-1", token("gc2"), "d1", "ZIP", 1, AHORA)).toEqual({ ok: false, error: M.noDisponible });
    // Enlace anulado o desconocido.
    expect((await D.urlDeParteDeCliente("ws-1", "x".repeat(43), "d1", "ZIP", 1, AHORA)).ok).toBe(false);
  });

  it("valida lo que llega y que la clave guardada sea de esa descarga", async () => {
    sembrarDescarga("d1");
    for (const [id, tipo, n] of [[1, "ZIP", 1], ["d1", "OTRO", 1], ["d1", "ZIP", "1"], ["d1", "ZIP", 1.5], ["d1", "ZIP", 9], ["x".repeat(80), "ZIP", 1]] as const) {
      expect((await D.urlDeParteDeCliente("ws-1", TOKEN1, id, tipo, n, AHORA)).ok, String([id, tipo, n])).toBe(false);
    }
    descarga("d1").parts = [{ tipo: "ZIP", n: 1, key: claveDeParte("ws-1", "ge", "otra-descarga", 1), bytes: 1, files: 1, estado: "LISTA", fileIds: [] }];
    expect(await D.urlDeParteDeCliente("ws-1", TOKEN1, "d1", "ZIP", 1, AHORA)).toEqual({ ok: false, error: M.parteInvalida });
    descarga("d1").parts = [{ tipo: "ZIP", n: 1, key: claveDeParte("ws-2", "ge", "d1", 1), bytes: 1, files: 1, estado: "LISTA", fileIds: [] }];
    expect(await D.urlDeParteDeCliente("ws-1", TOKEN1, "d1", "ZIP", 1, AHORA)).toEqual({ ok: false, error: M.parteInvalida });
    descarga("d1").parts = [{ tipo: "ZIP", n: 1, key: claveDeParte("ws-1", "ge", "d1", 1), bytes: 1, files: 1, estado: "PENDIENTE", fileIds: [] }];
    expect(await D.urlDeParteDeCliente("ws-1", TOKEN1, "d1", "ZIP", 1, AHORA)).toEqual({ ok: false, error: M.parteInvalida });
  });
});

describe("el estudio", () => {
  it("«Preparar descarga» crea el pedido sin cliente, con el correo de quien lo pidió", async () => {
    sembrarFoto("f1");
    B.agregar("user", { id: 7, email: "dani@estudio.com" });
    const r = await D.prepararDescargaDelEstudio(ctx, "ge", AHORA);
    if (!r.ok) throw new Error(r.error);
    expect(descarga(r.id)).toMatchObject({ galeriaClienteId: null, requestedEmail: "dani@estudio.com", status: "PENDIENTE" });
    expect(B.datos.fotofficeGaleriaEvento.find((e) => e.type === "DESCARGA_PEDIDA")).toMatchObject({ actorUserId: 7, galeriaClienteId: null });
    // Uno activo a la vez y tope de 3 por día, también para el estudio.
    expect(await D.prepararDescargaDelEstudio(ctx, "ge", AHORA)).toEqual({ ok: true, id: r.id, yaEnCurso: true });
    descarga(r.id).status = "LISTA";
    for (let i = 0; i < 2; i++) {
      const x = await D.prepararDescargaDelEstudio(ctx, "ge", AHORA);
      if (!x.ok) throw new Error(x.error);
      descarga(x.id).status = "LISTA";
    }
    expect(await D.prepararDescargaDelEstudio(ctx, "ge", AHORA)).toMatchObject({ ok: false, codigo: "TOPE" });
  });

  it("no prepara de una galería de otra organización ni de selección", async () => {
    sembrarFoto("f1", 5 * MB, {}, "g-ajena", "ws-2");
    expect(await D.prepararDescargaDelEstudio(ctx, "g-ajena", AHORA)).toMatchObject({ ok: false, codigo: "NO_ENTREGA" });
    expect(await D.prepararDescargaDelEstudio(ctx, "gs", AHORA)).toMatchObject({ ok: false, codigo: "NO_ENTREGA" });
    expect(descargas()).toHaveLength(0);
  });

  it("lista los pedidos de la galería (con quién los pidió y su avance) y sólo los de su organización", async () => {
    sembrarDescarga("d1");
    sembrarDescarga("d2", { galeriaClienteId: null, status: "ARMANDO", parts: [
      { tipo: "ZIP", n: 1, key: claveDeParte("ws-1", "ge", "d2", 1), bytes: 1, files: 1, estado: "LISTA", fileIds: [] },
      { tipo: "ZIP", n: 2, key: claveDeParte("ws-1", "ge", "d2", 2), bytes: 1, files: 1, estado: "PENDIENTE", fileIds: [] },
    ] });
    sembrarDescarga("d3", { workspaceId: "ws-2", galeriaId: "g-ajena", galeriaClienteId: null });
    sembrarDescarga("d4", { expiresAt: new Date(AHORA.getTime() - MIN) });
    const l = await D.listarDescargasDeGaleria(ctx, "ge", AHORA);
    expect(l.map((x) => x.id).sort()).toEqual(["d1", "d2", "d4"]);
    expect(l.find((x) => x.id === "d1")).toMatchObject({ estado: "LISTA", quien: "Cliente: Ana Gómez", partes: [{ n: 1 }] });
    expect(l.find((x) => x.id === "d2")).toMatchObject({ estado: "ARMANDO", quien: "Pedida por el estudio", armadas: 1, totalPartes: 2, partes: [] });
    expect(l.find((x) => x.id === "d4")!.estado).toBe("VENCIDA");
    expect(await D.listarDescargasDeGaleria(ctx, "g-ajena", AHORA)).toEqual([]);
  });

  it("firma las partes sólo de su organización y galería", async () => {
    sembrarDescarga("d1");
    expect(await D.urlDeParteDelEstudio(ctx, "ge", "d1", "ZIP", 1, AHORA)).toMatchObject({ ok: true });
    expect(await D.urlDeParteDelEstudio(ctx, "gs", "d1", "ZIP", 1, AHORA)).toEqual({ ok: false, error: M.noDisponible });
    sembrarDescarga("d-ajena", { workspaceId: "ws-2", galeriaId: "g-ajena", galeriaClienteId: null, parts: [{ tipo: "ZIP", n: 1, key: claveDeParte("ws-2", "g-ajena", "d-ajena", 1), bytes: 1, files: 1, estado: "LISTA", fileIds: [] }] });
    expect(await D.urlDeParteDelEstudio(ctx, "g-ajena", "d-ajena", "ZIP", 1, AHORA)).toEqual({ ok: false, error: M.noDisponible });
    expect(await D.urlDeParteDelEstudio(ctx, "ge", "d-ajena", "ZIP", 1, AHORA)).toEqual({ ok: false, error: M.noDisponible });
  });
});

describe("turnos parejos, nombres y cierre de lecturas", () => {
  it("un pedido grande no deja esperando a los demás: el que acaba de armar una parte pasa al final", async () => {
    sembrarFoto("a", 600 * MB);
    sembrarFoto("b", 600 * MB);
    sembrarFoto("c", 600 * MB);
    cargarOriginales(a, "a", "b", "c");
    const grande = await D.pedirDescargaDeCliente("ws-1", TOKEN1, AHORA);
    B.agregar("fotofficeGaleria", { id: "ge2", workspaceId: "ws-1", proyectoId: "pr2", number: "G-3", name: "Otra", kind: "ENTREGA", status: "PUBLICADA", orderMode: "NOMBRE" });
    sembrarCliente("gc9", {}, "ge2");
    sembrarFoto("z", 5 * MB, {}, "ge2");
    cargarOriginales(a, "z");
    const chico = await D.pedirDescargaDeCliente("ws-1", token("gc9"), new Date(AHORA.getTime() + MIN));
    if (!grande.ok || !chico.ok) throw new Error();
    expect(partes(grande.id).length).toBeGreaterThanOrEqual(3);
    const orden: (string | null)[] = [];
    for (let k = 0; k < 4; k++) orden.push((await corrida({}, new Date(AHORA.getTime() + (2 + k * 5) * MIN))).tomada);
    expect(orden).toEqual([grande.id, chico.id, grande.id, grande.id]);
    expect(descarga(chico.id).status).toBe("LISTA");
  });

  it("los nombres repetidos quedan distintos entre partes (se extraen todas juntas en una carpeta)", async () => {
    sembrarFoto("a", 600 * MB, { fileName: "IMG_0001.jpg" });
    sembrarFoto("b", 600 * MB, { fileName: "IMG_0001.jpg" });
    cargarOriginales(a, "a", "b");
    const r = await D.pedirDescargaDeCliente("ws-1", TOKEN1, AHORA);
    if (!r.ok) throw new Error();
    await corrida();
    await corrida({}, new Date(AHORA.getTime() + 5 * MIN));
    const n1 = leerZip(a.objetos.get(`galerias/ws-1/ge/descargas/${r.id}/parte-1.zip`)!).map((x) => x.nombre);
    const n2 = leerZip(a.objetos.get(`galerias/ws-1/ge/descargas/${r.id}/parte-2.zip`)!).map((x) => x.nombre);
    expect([...n1, ...n2].sort()).toEqual(["IMG_0001 (2).jpg", "IMG_0001.jpg"]);
  });

  it("al cortar por tiempo se cierran las lecturas de R2 que quedaron abiertas", async () => {
    sembrarFoto("a");
    cargarOriginales(a, "a");
    const r = await D.pedirDescargaDeCliente("ws-1", TOKEN1, AHORA);
    if (!r.ok) throw new Error();
    expect((await corrida({ presupuestoMs: -1 })).fallo).toBe(true);
    expect(a.reg.destruidos).toBeGreaterThanOrEqual(1);
  });
});
