import { describe, expect, it } from "vitest";
import { reescribirPlaylist } from "./hls";

const VOD = "#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-TARGETDURATION:6\n#EXT-X-MEDIA-SEQUENCE:1\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-INDEPENDENT-SEGMENTS\n#EXTINF:6.000000,\nseg_00001.ts\n#EXTINF:2.000000,\nseg_00002.ts\n#EXT-X-ENDLIST\n";
const firmar = (n: string) => `https://r2.example/${n}?firma=1&x=2`;

describe("reescribirPlaylist", () => {
  it("cambia cada segmento por su URL firmada y deja las etiquetas igual", () => {
    const r = reescribirPlaylist(VOD, firmar);
    expect(r).not.toBeNull();
    const lineas = r!.split("\n");
    expect(lineas).toContain("https://r2.example/seg_00001.ts?firma=1&x=2");
    expect(lineas).toContain("https://r2.example/seg_00002.ts?firma=1&x=2");
    expect(lineas).toContain("#EXT-X-PLAYLIST-TYPE:VOD");
    expect(lineas).toContain("#EXT-X-ENDLIST");
    expect(r).not.toMatch(/^seg_/m);
  });
  it("tolera fines de línea de Windows", () => {
    expect(reescribirPlaylist(VOD.replace(/\n/g, "\r\n"), firmar)).toContain("https://r2.example/seg_00002.ts?firma=1&x=2");
  });
  it("una playlist sin terminar, sin cabecera o sin segmentos no se sirve", () => {
    expect(reescribirPlaylist(VOD.replace("#EXT-X-ENDLIST\n", ""), firmar)).toBeNull();
    expect(reescribirPlaylist(VOD.replace("#EXTM3U\n", ""), firmar)).toBeNull();
    expect(reescribirPlaylist("#EXTM3U\n#EXT-X-ENDLIST\n", firmar)).toBeNull();
  });
  it("nunca firma algo que no sea un segmento nuestro (rutas, URLs, claves de cifrado, mapas)", () => {
    expect(reescribirPlaylist(VOD.replace("seg_00002.ts", "../final.mp4"), firmar)).toBeNull();
    expect(reescribirPlaylist(VOD.replace("seg_00002.ts", "https://otro/seg.ts"), firmar)).toBeNull();
    expect(reescribirPlaylist(VOD.replace("#EXT-X-ENDLIST", '#EXT-X-KEY:METHOD=AES-128,URI="k"\n#EXT-X-ENDLIST'), firmar)).toBeNull();
    expect(reescribirPlaylist(VOD.replace("#EXT-X-INDEPENDENT-SEGMENTS", '#EXT-X-MAP:URI="init.mp4"'), firmar)).toBeNull();
  });
});
