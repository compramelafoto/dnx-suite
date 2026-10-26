import { describe, expect, it } from "vitest";
import { isAllowedEmbedUrl, toVideoEmbedUrl } from "./embed-hosts";

describe("toVideoEmbedUrl", () => {
  it("youtu.be, watch y shorts de YouTube pasan al reproductor embebido", () => {
    expect(toVideoEmbedUrl("https://youtu.be/abc123")).toBe("https://www.youtube.com/embed/abc123");
    expect(toVideoEmbedUrl("https://www.youtube.com/watch?v=abc123&t=3")).toBe("https://www.youtube.com/embed/abc123");
    expect(toVideoEmbedUrl("https://youtube.com/shorts/abc_123-X")).toBe("https://www.youtube.com/embed/abc_123-X");
  });

  it("Vimeo pasa al reproductor de Vimeo", () => {
    expect(toVideoEmbedUrl("https://vimeo.com/76979871")).toBe("https://player.vimeo.com/video/76979871");
    expect(toVideoEmbedUrl("https://player.vimeo.com/video/76979871")).toBe("https://player.vimeo.com/video/76979871");
  });

  it("cualquier otra cosa devuelve null", () => {
    expect(toVideoEmbedUrl("javascript:alert(1)")).toBeNull();
    expect(toVideoEmbedUrl("http://youtu.be/abc123")).toBeNull();
    expect(toVideoEmbedUrl("https://evil.com/watch?v=abc123")).toBeNull();
    expect(toVideoEmbedUrl("https://www.youtube.com.evil.com/watch?v=abc123")).toBeNull();
    expect(toVideoEmbedUrl("https://www.youtube.com/watch")).toBeNull();
    expect(toVideoEmbedUrl("https://vimeo.com/no-es-id")).toBeNull();
    expect(toVideoEmbedUrl("")).toBeNull();
    expect(toVideoEmbedUrl("no es url")).toBeNull();
  });
});

describe("isAllowedEmbedUrl", () => {
  it("acepta CompraMeLaFoto, YouTube, Vimeo y Google Maps embed por https", () => {
    expect(isAllowedEmbedUrl("https://www.compramelafoto.com/dnxestudio2?embed=1")).toBe(true);
    expect(isAllowedEmbedUrl("https://compramelafoto.com/x")).toBe(true);
    expect(isAllowedEmbedUrl("https://www.youtube.com/embed/abc")).toBe(true);
    expect(isAllowedEmbedUrl("https://player.vimeo.com/video/1")).toBe(true);
    expect(isAllowedEmbedUrl("https://www.google.com/maps/embed?pb=x")).toBe(true);
  });

  it("rechaza http, hosts ajenos, trampas de host y otras rutas de Google", () => {
    expect(isAllowedEmbedUrl("http://compramelafoto.com")).toBe(false);
    expect(isAllowedEmbedUrl("https://evil.com/compramelafoto.com")).toBe(false);
    expect(isAllowedEmbedUrl("https://compramelafoto.com.evil.com/")).toBe(false);
    expect(isAllowedEmbedUrl("https://user@evil.com@www.compramelafoto.com.evil.com/")).toBe(false);
    expect(isAllowedEmbedUrl("https://www.google.com/search")).toBe(false);
    expect(isAllowedEmbedUrl("https://www.google.com/maps/embedx")).toBe(false);
    expect(isAllowedEmbedUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedEmbedUrl("")).toBe(false);
  });
});
