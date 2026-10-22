import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  argumentosRelleno,
  argumentosSalidaHls,
  crearSubidorHls,
  nombreDeSegmento,
  segmentosCompletos,
  validarPlaylist,
} from "./hls";

describe("argumentosSalidaHls", () => {
  it("720p H.264 ~2 Mbps, AAC 128k, segmentos .ts de 6 s numerados desde 1", () => {
    const a = argumentosSalidaHls("/t/hls", "[v720]", "[a720]");
    const s = a.join(" ");
    expect(s).toContain("-map [v720] -map [a720]");
    expect(s).toContain("-c:v libx264");
    expect(s).toContain("-preset veryfast");
    expect(s).toContain("-b:v 2000k");
    expect(s).toContain("-c:a aac -b:a 128k");
    // GOP fijo de 6 s a 30 cuadros: cada segmento empieza en un cuadro clave.
    expect(s).toContain("-g 180 -keyint_min 180 -sc_threshold 0");
    expect(s).toContain("-f hls -hls_time 6 -hls_playlist_type vod -hls_list_size 0");
    expect(s).toContain("-hls_segment_type mpegts");
    expect(s).toContain("-start_number 1");
    expect(a[a.indexOf("-hls_segment_filename") + 1]).toBe(path.join("/t/hls", "seg_%05d.ts"));
    expect(a.at(-1)).toBe(path.join("/t/hls", "index.m3u8"));
  });
});

describe("argumentosRelleno", () => {
  it("lee el final.mp4 por pipe y sólo escala a 1280×720 (la marca ya está quemada)", () => {
    const a = argumentosRelleno("pipe:3", "/t/hls");
    const s = a.join(" ");
    expect(s).toContain("-i pipe:3");
    expect(a[a.indexOf("-filter_complex") + 1]).toBe("[0:v:0]scale=1280:720,setsar=1,format=yuv420p[v720]");
    expect(s).toContain("-map [v720] -map 0:a:0?");
    expect(a.at(-1)).toBe(path.join("/t/hls", "index.m3u8"));
    expect(s).not.toContain("overlay");
  });
});

describe("segmentosCompletos", () => {
  it("un segmento está completo cuando ya existe uno posterior (o su temporal)", () => {
    expect(segmentosCompletos(["index.m3u8", "seg_00001.ts", "seg_00002.ts", "seg_00003.ts.tmp"], false)).toEqual([
      "seg_00001.ts",
      "seg_00002.ts",
    ]);
    expect(segmentosCompletos(["seg_00001.ts"], false)).toEqual([]);
    expect(segmentosCompletos(["seg_00001.ts", "seg_00002.ts.tmp"], false)).toEqual(["seg_00001.ts"]);
  });
  it("al terminar ffmpeg, todos los que no son temporales", () => {
    expect(segmentosCompletos(["seg_00002.ts", "seg_00001.ts", "seg_00003.ts.tmp", "index.m3u8.tmp"], true)).toEqual([
      "seg_00001.ts",
      "seg_00002.ts",
    ]);
  });
  it("ordena por número, no por texto, e ignora nombres raros", () => {
    expect(segmentosCompletos(["seg_100000.ts", "seg_99999.ts", "otro.ts", "seg_1.ts"], true)).toEqual([
      "seg_1.ts",
      "seg_99999.ts",
      "seg_100000.ts",
    ]);
  });
  it("nombreDeSegmento", () => {
    expect(nombreDeSegmento(1)).toBe("seg_00001.ts");
  });
});

describe("validarPlaylist", () => {
  const buena = "#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n#EXT-X-MEDIA-SEQUENCE:1\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXTINF:6.000000,\nseg_00001.ts\n#EXTINF:2.5,\nseg_00002.ts\n#EXT-X-ENDLIST\n";
  it("devuelve los segmentos de una VOD terminada", () => {
    expect(validarPlaylist(buena)).toEqual({ ok: true, segmentos: ["seg_00001.ts", "seg_00002.ts"] });
  });
  it("sin #EXT-X-ENDLIST no está terminada", () => {
    expect(validarPlaylist(buena.replace("#EXT-X-ENDLIST\n", "")).ok).toBe(false);
  });
  it("rechaza rutas o nombres que no son nuestros", () => {
    expect(validarPlaylist(buena.replace("seg_00002.ts", "../final.mp4")).ok).toBe(false);
    expect(validarPlaylist(buena.replace("seg_00002.ts", "https://otro/seg.ts")).ok).toBe(false);
  });
  it("sin segmentos o sin cabecera no sirve", () => {
    expect(validarPlaylist("#EXTM3U\n#EXT-X-ENDLIST\n").ok).toBe(false);
    expect(validarPlaylist("seg_00001.ts\n#EXT-X-ENDLIST\n").ok).toBe(false);
  });
});

describe("crearSubidorHls", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "hls-test-"));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  const escribir = (n: string, c = "x") => fs.writeFileSync(path.join(dir, n), c);
  const playlist = (n: number) =>
    `#EXTM3U\n#EXT-X-TARGETDURATION:6\n${Array.from({ length: n }, (_, i) => `#EXTINF:6,\n${nombreDeSegmento(i + 1)}\n`).join("")}#EXT-X-ENDLIST\n`;

  function armar(falla?: (clave: string) => boolean) {
    const subidos: { clave: string; tipo: string; cuerpo: string }[] = [];
    const s = crearSubidorHls({
      dir,
      prefijoHls: "digitalizacion/ws/g1/hls",
      subirArchivo: async (clave, cuerpo, tipo) => {
        if (falla?.(clave)) throw new Error("R2 caído");
        subidos.push({ clave, tipo, cuerpo: cuerpo.toString() });
      },
      intervaloMs: 10_000, // en las pruebas se avanza a mano con revisar()
      esperasMs: [1, 1],
      registrar: () => {},
    });
    return { s, subidos };
  }

  it("sube cada segmento completo apenas aparece el siguiente y lo borra del disco", async () => {
    const { s, subidos } = armar();
    escribir("seg_00001.ts", "a");
    await s.revisar();
    expect(subidos).toEqual([]);
    escribir("seg_00002.ts.tmp", "b");
    await s.revisar();
    expect(subidos.map((x) => x.clave)).toEqual(["digitalizacion/ws/g1/hls/seg_00001.ts"]);
    expect(subidos[0]!.tipo).toBe("video/mp2t");
    expect(fs.existsSync(path.join(dir, "seg_00001.ts"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "seg_00002.ts.tmp"))).toBe(true);
  });

  it("al terminar sube lo que falta y la playlist al final", async () => {
    const { s, subidos } = armar();
    escribir("seg_00001.ts");
    escribir("seg_00002.ts");
    await s.revisar();
    escribir("index.m3u8", playlist(2));
    expect(await s.terminar(true)).toBe(true);
    expect(subidos.map((x) => x.clave)).toEqual([
      "digitalizacion/ws/g1/hls/seg_00001.ts",
      "digitalizacion/ws/g1/hls/seg_00002.ts",
      "digitalizacion/ws/g1/hls/index.m3u8",
    ]);
    expect(subidos.at(-1)!.tipo).toBe("application/vnd.apple.mpegurl");
    expect(s.subioAlgo()).toBe(true);
  });

  it("si la playlist nombra un segmento que no se subió, no publica la playlist", async () => {
    const { s, subidos } = armar();
    escribir("seg_00001.ts");
    escribir("index.m3u8", playlist(2));
    expect(await s.terminar(true)).toBe(false);
    expect(subidos.map((x) => x.clave)).not.toContain("digitalizacion/ws/g1/hls/index.m3u8");
  });

  it("si un segmento no sube tras los reintentos, el HLS queda fallado y el resto se descarta del disco", async () => {
    const { s, subidos } = armar((c) => c.endsWith("seg_00001.ts"));
    escribir("seg_00001.ts");
    escribir("seg_00002.ts");
    escribir("seg_00003.ts");
    await s.revisar();
    expect(s.fallo()).toContain("R2 caído");
    expect(subidos).toEqual([]);
    expect(fs.readdirSync(dir).filter((n) => n.endsWith(".ts"))).toEqual(["seg_00003.ts"]);
    escribir("index.m3u8", playlist(3));
    expect(await s.terminar(true)).toBe(false);
    expect(fs.readdirSync(dir).filter((n) => n.endsWith(".ts"))).toEqual([]);
  });

  it("con demasiados segmentos esperando, abandona el HLS para no llenar la memoria", async () => {
    const subidos: string[] = [];
    const s = crearSubidorHls({
      dir,
      prefijoHls: "p/hls",
      subirArchivo: async (c) => void subidos.push(c),
      intervaloMs: 10_000,
      maxPendientes: 2,
      registrar: () => {},
    });
    for (let i = 1; i <= 4; i++) escribir(nombreDeSegmento(i));
    await s.revisar();
    expect(s.fallo()).toContain("pendientes");
    expect(subidos).toEqual([]);
  });

  it("terminar(false) no sube nada más", async () => {
    const { s, subidos } = armar();
    escribir("seg_00001.ts");
    escribir("index.m3u8", playlist(1));
    expect(await s.terminar(false)).toBe(false);
    expect(subidos).toEqual([]);
  });
});
