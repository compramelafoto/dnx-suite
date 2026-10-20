import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { crc32 as crc32Zlib } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ConstructorZip, MAX_ARCHIVOS_POR_ZIP, crc32, crc32Tabla, enBloques, fechaDos, nombreDentroDelZip, nombresUnicos, zipEnFlujo, type ArchivoParaZip } from "./zip";

const aleatorio = (n: number) => randomBytes(n);

async function* trozos(datos: Buffer, tamano: number): AsyncGenerator<Uint8Array> {
  for (let i = 0; i < datos.length; i += tamano) yield datos.subarray(i, i + tamano);
}
const archivo = (nombre: string, datos: Buffer, tamanoTrozo = 7000): ArchivoParaZip => ({ nombre, fecha: new Date("2026-10-11T15:30:10Z"), abrir: async () => trozos(datos, tamanoTrozo) });

async function armar(archivos: ArchivoParaZip[]) {
  const resultado = { archivos: 0, bytes: 0, omitidos: 0 };
  const piezas: Buffer[] = [];
  for await (const p of zipEnFlujo(archivos, resultado)) piezas.push(p);
  return { zip: Buffer.concat(piezas), resultado };
}

type EntradaLeida = { nombre: string; crc: number; tamano: number; datos: Buffer; banderas: number; metodo: number };

/** Lector independiente: sólo usa el directorio central (como hacen los programas de descompresión). */
function leerZip(zip: Buffer): EntradaLeida[] {
  const fin = zip.length - 22;
  expect(zip.readUInt32LE(fin)).toBe(0x06054b50);
  const total = zip.readUInt16LE(fin + 10);
  expect(zip.readUInt16LE(fin + 8)).toBe(total);
  const tamCentral = zip.readUInt32LE(fin + 12);
  const inicioCentral = zip.readUInt32LE(fin + 16);
  expect(inicioCentral + tamCentral).toBe(fin);
  const salida: EntradaLeida[] = [];
  let p = inicioCentral;
  for (let i = 0; i < total; i++) {
    expect(zip.readUInt32LE(p)).toBe(0x02014b50);
    const banderas = zip.readUInt16LE(p + 8);
    const metodo = zip.readUInt16LE(p + 10);
    const crc = zip.readUInt32LE(p + 16);
    const comprimido = zip.readUInt32LE(p + 20);
    const tamano = zip.readUInt32LE(p + 24);
    const largoNombre = zip.readUInt16LE(p + 28);
    const largoExtra = zip.readUInt16LE(p + 30);
    const largoComentario = zip.readUInt16LE(p + 32);
    const desplazamiento = zip.readUInt32LE(p + 42);
    const nombre = zip.subarray(p + 46, p + 46 + largoNombre).toString("utf8");
    expect(comprimido).toBe(tamano);
    // Encabezado local → datos → data descriptor.
    expect(zip.readUInt32LE(desplazamiento)).toBe(0x04034b50);
    const largoLocal = zip.readUInt16LE(desplazamiento + 26);
    const inicioDatos = desplazamiento + 30 + largoLocal + zip.readUInt16LE(desplazamiento + 28);
    const datos = zip.subarray(inicioDatos, inicioDatos + tamano);
    expect(zip.readUInt32LE(inicioDatos + tamano)).toBe(0x08074b50);
    expect(zip.readUInt32LE(inicioDatos + tamano + 4)).toBe(crc);
    expect(zip.readUInt32LE(inicioDatos + tamano + 8)).toBe(tamano);
    expect(zip.readUInt32LE(inicioDatos + tamano + 12)).toBe(tamano);
    salida.push({ nombre, crc, tamano, datos, banderas, metodo });
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  expect(p).toBe(fin);
  return salida;
}

describe("crc32", () => {
  it("la tabla propia coincide con zlib, también en trozos", () => {
    const d = aleatorio(100_000);
    expect(crc32Tabla(d)).toBe(crc32Zlib(d) >>> 0);
    expect(crc32(d)).toBe(crc32Tabla(d));
    const seguido = crc32(d.subarray(50_000), crc32(d.subarray(0, 50_000)));
    expect(seguido).toBe(crc32Tabla(d));
    expect(crc32Tabla(Buffer.from("123456789"))).toBe(0xcbf43926);
    expect(crc32Tabla(Buffer.alloc(0))).toBe(0);
  });
});

describe("nombres", () => {
  it("se limpian y no se repiten (sin distinguir mayúsculas), conservando la extensión", () => {
    expect(nombreDentroDelZip("../../etc/pasword.jpg")).toBe("_.._etc_pasword.jpg");
    expect(nombreDentroDelZip("   ")).toBe("archivo");
    expect(nombreDentroDelZip("a/b\\c:d.jpg")).toBe("a_b_c_d.jpg");
    expect(nombresUnicos(["IMG_1.jpg", "img_1.JPG", "IMG_1.jpg", "sin-extension", "sin-extension"])).toEqual([
      "IMG_1.jpg", "img_1 (2).JPG", "IMG_1 (3).jpg", "sin-extension", "sin-extension (2)",
    ]);
  });
  it("la fecha DOS usa la hora de Argentina y no baja de 1980", () => {
    const f = fechaDos(new Date("2026-10-11T15:30:10Z")); // 12:30:10 en Buenos Aires
    expect(f.hora).toBe((12 << 11) | (30 << 5) | 5);
    expect(f.fecha).toBe(((2026 - 1980) << 9) | (10 << 5) | 11);
    expect(fechaDos(new Date("1970-01-02T00:00:00Z")).fecha >> 9).toBe(0);
  });
});

describe("zipEnFlujo", () => {
  it("arma un ZIP válido: directorio central, CRC y datos de cada archivo (con nombres en UTF-8)", async () => {
    const a = aleatorio(300_000);
    const b = aleatorio(1);
    const c = Buffer.alloc(0);
    const d = aleatorio(70_001);
    const { zip, resultado } = await armar([archivo("Foto ñandú ✓.jpg", a), archivo("b.png", b), archivo("vacío.mp4", c), archivo("Foto ñandú ✓.jpg", d)]);
    expect(resultado).toEqual({ archivos: 4, bytes: zip.length, omitidos: 0 });
    const e = leerZip(zip);
    expect(e.map((x) => x.nombre)).toEqual(["Foto ñandú ✓.jpg", "b.png", "vacío.mp4", "Foto ñandú ✓ (2).jpg"]);
    for (const x of e) {
      expect(x.metodo).toBe(0);
      expect(x.banderas & 0x0008).toBe(0x0008);
      expect(x.banderas & 0x0800).toBe(0x0800);
      expect(x.crc).toBe(crc32Tabla(x.datos));
    }
    expect(e[0]!.datos.equals(a)).toBe(true);
    expect(e[1]!.datos.equals(b)).toBe(true);
    expect(e[2]!.tamano).toBe(0);
    expect(e[3]!.datos.equals(d)).toBe(true);
  });

  it("lo abren los programas de verdad: `unzip -t` y el módulo zipfile de Python", async () => {
    const dir = mkdtempSync(join(tmpdir(), "zip-prueba-"));
    try {
      const { zip } = await armar([archivo("uno.jpg", aleatorio(2_500_000), 65_536), archivo("dos ñ.mp4", aleatorio(123_457), 1000), archivo("tres.png", Buffer.alloc(0))]);
      const ruta = join(dir, "parte-1.zip");
      writeFileSync(ruta, zip);
      const tieneUnzip = spawnSync("unzip", ["-v"]).status !== null && !spawnSync("unzip", ["-v"]).error;
      if (tieneUnzip) {
        const salida = execFileSync("unzip", ["-t", ruta]).toString();
        expect(salida).toContain("No errors detected");
      }
      const py = spawnSync("python3", ["-c", "import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);print(z.testzip());print(len(z.namelist()))", ruta]);
      if (!py.error && py.status === 0) expect(py.stdout.toString().trim().split("\n")).toEqual(["None", "3"]);
      expect(tieneUnzip || !py.error).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("saltea los archivos que ya no existen y cuenta sólo los incluidos", async () => {
    const faltante: ArchivoParaZip = { nombre: "borrada.jpg", fecha: new Date(), abrir: async () => null };
    const { zip, resultado } = await armar([archivo("a.jpg", aleatorio(10)), faltante, archivo("c.jpg", aleatorio(20))]);
    expect(resultado.archivos).toBe(2);
    expect(resultado.omitidos).toBe(1);
    expect(leerZip(zip).map((x) => x.nombre)).toEqual(["a.jpg", "c.jpg"]);
  });

  it("con carpetas conserva las rutas (limpiando cada parte y sin `..`) y no repite nombres", async () => {
    const piezas: Buffer[] = [];
    const lista = [
      archivo("Pedido 8 - Juan/10x15 Brillo/1 copia/a.jpg", Buffer.from("a")),
      archivo("Pedido 8 - Juan/10x15 Brillo/1 copia/A.jpg", Buffer.from("b")),
      archivo("../x\u0001/b.jpg", Buffer.from("c")),
    ];
    for await (const p of zipEnFlujo(lista, undefined, { conCarpetas: true })) piezas.push(p);
    expect(leerZip(Buffer.concat(piezas)).map((e) => e.nombre)).toEqual([
      "Pedido 8 - Juan/10x15 Brillo/1 copia/a.jpg",
      "Pedido 8 - Juan/10x15 Brillo/1 copia/A (2).jpg",
      "archivo/x_/b.jpg",
    ]);
  });
  it("un ZIP vacío es válido (sólo el registro final)", async () => {
    const { zip } = await armar([]);
    expect(zip.length).toBe(22);
    expect(leerZip(zip)).toEqual([]);
  });

  it("no pide memoria de más: emite los datos trozo a trozo, tal cual llegan", async () => {
    const dato = aleatorio(10_000);
    const emitidos: number[] = [];
    for await (const p of zipEnFlujo([archivo("x.bin", dato, 1000)])) emitidos.push(p.length);
    // encabezado + 10 trozos de 1000 + descriptor + directorio central
    expect(emitidos.filter((n) => n === 1000)).toHaveLength(10);
  });
});

describe("límites sin ZIP64", () => {
  it("rechaza más de 65.535 archivos", () => {
    const z = new ConstructorZip();
    for (let i = 0; i < MAX_ARCHIVOS_POR_ZIP; i++) {
      z.encabezado(`f${i}`, new Date());
      z.cierre(0, 0);
    }
    expect(() => z.encabezado("uno-mas", new Date())).toThrow(/demasiados archivos/);
  });
  it("rechaza un archivo de 4 GB o más", () => {
    const z = new ConstructorZip();
    z.encabezado("grande.mp4", new Date());
    expect(() => z.cierre(0, 0x1_0000_0000)).toThrow(/4 GB/);
  });
  it("rechaza una parte cuyo directorio central quedaría pasado de 4 GB", () => {
    const z = new ConstructorZip();
    z.encabezado("a", new Date());
    z.datos(0xffff_ffa0);
    z.cierre(0, 0xffff_ffa0);
    expect(() => z.directorioCentral()).toThrow(/4 GB/);
  });
  it("exige cerrar un archivo antes de abrir otro", () => {
    const z = new ConstructorZip();
    z.encabezado("a", new Date());
    expect(() => z.encabezado("b", new Date())).toThrow();
  });
});

describe("enBloques", () => {
  async function* de(...partes: number[]): AsyncGenerator<Buffer> {
    for (const n of partes) yield Buffer.alloc(n, n);
  }
  it("todos los bloques miden lo mismo salvo el último, sin perder bytes", async () => {
    const salida: number[] = [];
    for await (const b of enBloques(de(3, 10, 1, 25, 4), 8)) salida.push(b.length);
    expect(salida).toEqual([8, 8, 8, 8, 8, 3]);
    expect(salida.reduce((s, n) => s + n, 0)).toBe(43);
  });
  it("conserva el contenido en orden", async () => {
    const origen = aleatorio(1000);
    async function* trozosDe(): AsyncGenerator<Buffer> {
      for (let i = 0; i < origen.length; i += 33) yield origen.subarray(i, i + 33);
    }
    const bloques: Buffer[] = [];
    for await (const b of enBloques(trozosDe(), 100)) bloques.push(Buffer.from(b));
    expect(Buffer.concat(bloques).equals(origen)).toBe(true);
    expect(bloques.slice(0, -1).every((b) => b.length === 100)).toBe(true);
  });
  it("un flujo vacío no emite nada y uno exacto no deja un bloque vacío", async () => {
    const a: Buffer[] = [];
    for await (const b of enBloques(de(), 8)) a.push(b);
    expect(a).toHaveLength(0);
    const c: number[] = [];
    for await (const b of enBloques(de(8, 8), 8)) c.push(b.length);
    expect(c).toEqual([8, 8]);
  });
});
