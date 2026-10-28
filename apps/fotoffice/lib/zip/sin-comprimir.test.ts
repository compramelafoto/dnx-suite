import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { armarZip, crc32 } from "./sin-comprimir";

const hayPython = spawnSync("python3", ["--version"]).status === 0;

describe("ZIP sin comprimir", () => {
  it("el CRC-32 da el valor de referencia", () => {
    expect(crc32(new TextEncoder().encode("123456789"))).toBe(0xcbf43926);
  });

  // `zipfile` de Python valida los CRC y lee el nombre en UTF-8 (bit 11), como Windows y macOS.
  it.skipIf(!hayPython)("un lector de ZIP lo abre entero y con los nombres con eñe", () => {
    const dir = mkdtempSync(join(tmpdir(), "zip-"));
    const a = new Uint8Array(5000).map((_, i) => i % 251);
    writeFileSync(
      join(dir, "x.zip"),
      armarZip([
        { nombre: "plancha-01.jpg", datos: a },
        { nombre: "Peña/notas.txt", datos: new TextEncoder().encode("hola") },
      ]),
    );
    const salida = execFileSync(
      "python3",
      [
        "-I",
        "-c",
        "import sys,zipfile,json\nz=zipfile.ZipFile(sys.argv[1])\nassert z.testzip() is None\nprint(json.dumps({i.filename:[i.file_size,sum(z.read(i))] for i in z.infolist()}))",
        join(dir, "x.zip"),
      ],
      { encoding: "utf8" },
    );
    expect(JSON.parse(salida)).toEqual({
      "plancha-01.jpg": [5000, a.reduce((s, x) => s + x, 0)],
      "Peña/notas.txt": [4, [..."hola"].reduce((s, ch) => s + ch.charCodeAt(0), 0)],
    });
  });
});
