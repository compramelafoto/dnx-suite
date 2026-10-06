import { describe, expect, it } from "vitest";
import { MAX_PORTFOLIO_VIDEOS, parsePortfolioVideoUrl, parsePortfolioVideoUrls } from "./videos";

describe("parsePortfolioVideoUrl — YouTube", () => {
  it("la dirección larga de siempre", () => {
    expect(parsePortfolioVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      platform: "YOUTUBE",
      videoId: "dQw4w9WgXcQ",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
  });

  it("la corta de compartir", () => {
    expect(parsePortfolioVideoUrl("https://youtu.be/dQw4w9WgXcQ")?.videoId).toBe("dQw4w9WgXcQ");
  });

  it("un short", () => {
    expect(parsePortfolioVideoUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")?.videoId).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("una de embeber, que es lo que algunos pegan", () => {
    expect(parsePortfolioVideoUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")?.videoId).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("le saca la lista de reproducción y el minuto de inicio", () => {
    const r = parsePortfolioVideoUrl("https://youtu.be/dQw4w9WgXcQ?t=42&list=PLabc");
    expect(r?.videoId).toBe("dQw4w9WgXcQ");
  });

  it("sin www y sin https", () => {
    expect(parsePortfolioVideoUrl("youtube.com/watch?v=dQw4w9WgXcQ")?.videoId).toBe("dQw4w9WgXcQ");
  });

  it("rechaza un identificador que no tiene la forma de uno de YouTube", () => {
    expect(parsePortfolioVideoUrl("https://www.youtube.com/watch?v=corto")).toBeNull();
    expect(parsePortfolioVideoUrl("https://www.youtube.com/@uncanal")).toBeNull();
  });
});

describe("parsePortfolioVideoUrl — Vimeo", () => {
  it("la dirección normal", () => {
    expect(parsePortfolioVideoUrl("https://vimeo.com/123456789")).toEqual({
      platform: "VIMEO",
      videoId: "123456789",
      url: "https://vimeo.com/123456789",
    });
  });

  it("la del reproductor", () => {
    expect(parsePortfolioVideoUrl("https://player.vimeo.com/video/123456789")?.videoId).toBe(
      "123456789",
    );
  });

  it("una de un video privado, con su código de acceso", () => {
    const r = parsePortfolioVideoUrl("https://vimeo.com/123456789/abcdef1234");
    expect(r?.platform).toBe("VIMEO");
    expect(r?.videoId).toBe("123456789");
  });

  it("rechaza el perfil de alguien", () => {
    expect(parsePortfolioVideoUrl("https://vimeo.com/unusuario")).toBeNull();
  });
});

describe("parsePortfolioVideoUrl — Instagram y TikTok", () => {
  it("un reel de Instagram", () => {
    expect(parsePortfolioVideoUrl("https://www.instagram.com/reel/CxYz123AbCd/")).toEqual({
      platform: "INSTAGRAM",
      videoId: null,
      url: "https://www.instagram.com/reel/CxYz123AbCd/",
    });
  });

  it("un posteo de Instagram también entra: puede ser un video", () => {
    expect(parsePortfolioVideoUrl("https://www.instagram.com/p/CxYz123AbCd/")?.platform).toBe(
      "INSTAGRAM",
    );
  });

  it("un video de TikTok", () => {
    const r = parsePortfolioVideoUrl("https://www.tiktok.com/@alguien/video/7312345678901234567");
    expect(r?.platform).toBe("TIKTOK");
  });

  it("rechaza el perfil de Instagram: es una cuenta, no un video", () => {
    expect(parsePortfolioVideoUrl("https://www.instagram.com/juanperez/")).toBeNull();
  });
});

describe("parsePortfolioVideoUrl — cualquier otra red", () => {
  it("una dirección cualquiera queda como enlace, no como embebido", () => {
    const r = parsePortfolioVideoUrl("https://www.facebook.com/watch/?v=123456");
    expect(r).toEqual({
      platform: "OTRO",
      videoId: null,
      url: "https://www.facebook.com/watch/?v=123456",
    });
  });

  it("un sitio propio también", () => {
    expect(parsePortfolioVideoUrl("https://miestudio.com.ar/demo-reel")?.platform).toBe("OTRO");
  });

  it("le pone https a lo que viene sin esquema", () => {
    expect(parsePortfolioVideoUrl("miestudio.com.ar/reel")?.url).toBe("https://miestudio.com.ar/reel");
  });
});

describe("parsePortfolioVideoUrl — lo que no entra de ninguna forma", () => {
  it("rechaza javascript: y data:, que son el vector obvio", () => {
    expect(parsePortfolioVideoUrl("javascript:alert(1)")).toBeNull();
    expect(parsePortfolioVideoUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rechaza otros esquemas raros", () => {
    expect(parsePortfolioVideoUrl("file:///etc/passwd")).toBeNull();
    expect(parsePortfolioVideoUrl("ftp://algo.com/video.mp4")).toBeNull();
  });

  it("rechaza vacío y texto que no es una dirección", () => {
    expect(parsePortfolioVideoUrl("")).toBeNull();
    expect(parsePortfolioVideoUrl("mi demo reel")).toBeNull();
  });
});

describe("parsePortfolioVideoUrls", () => {
  const YT = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
  const VI = "https://vimeo.com/123456789";

  it("mantiene el orden en que se pegaron", () => {
    const r = parsePortfolioVideoUrls([VI, YT]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.videos.map((v) => v.platform)).toEqual(["VIMEO", "YOUTUBE"]);
  });

  it("descarta renglones vacíos: pegar deja líneas sueltas", () => {
    const r = parsePortfolioVideoUrls([YT, "", "  ", VI]);
    if (r.ok) expect(r.videos).toHaveLength(2);
  });

  it("saca repetidos", () => {
    const r = parsePortfolioVideoUrls([YT, "https://youtu.be/dQw4w9WgXcQ"]);
    if (r.ok) expect(r.videos).toHaveLength(1);
  });

  it("falla si alguno no se entiende, y dice cuál", () => {
    const r = parsePortfolioVideoUrls([YT, "javascript:alert(1)"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("javascript");
  });

  it("falla si se pasa del tope", () => {
    const muchos = Array.from(
      { length: MAX_PORTFOLIO_VIDEOS + 1 },
      (_, i) => `https://vimeo.com/${100000 + i}`,
    );
    const r = parsePortfolioVideoUrls(muchos);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(String(MAX_PORTFOLIO_VIDEOS));
  });

  it("una lista vacía es válida: así se saca la sección", () => {
    const r = parsePortfolioVideoUrls([]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.videos).toEqual([]);
  });
});
