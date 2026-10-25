import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { armarZip, crc32 } from "./zip";

describe("ZIP de los pliegos", () => {
  it("calcula el CRC32 estándar", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  it("arma un ZIP válido que devuelve los mismos archivos", () => {
    const dir = mkdtempSync(join(tmpdir(), "zip-"));
    const a = new Uint8Array([0xff, 0xd8, 1, 2, 3]);
    const b = new TextEncoder().encode("hola ñandú");
    writeFileSync(join(dir, "libro.zip"), armarZip([{ nombre: "pliego-01.jpg", datos: a }, { nombre: "notas ñ.txt", datos: b }]));
    // Python lee bien los nombres en UTF-8 (el unzip de macOS no) y verifica el CRC de cada uno.
    execFileSync("python3", ["-c", "import sys,zipfile; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; z.extractall(sys.argv[2])", join(dir, "libro.zip"), join(dir, "salida")]);
    expect(new Uint8Array(readFileSync(join(dir, "salida", "pliego-01.jpg")))).toEqual(a);
    expect(readFileSync(join(dir, "salida", "notas ñ.txt"), "utf8")).toBe("hola ñandú");
  });
});
