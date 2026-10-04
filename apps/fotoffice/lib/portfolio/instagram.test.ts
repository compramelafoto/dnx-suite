import { describe, expect, it } from "vitest";
import { normalizeInstagramPostUrl, parseInstagramPostUrls, MAX_INSTAGRAM_POSTS } from "./instagram";

describe("normalizeInstagramPostUrl", () => {
  it("acepta un posteo normal", () => {
    expect(normalizeInstagramPostUrl("https://www.instagram.com/p/CxYz123AbCd/")).toBe(
      "https://www.instagram.com/p/CxYz123AbCd/",
    );
  });

  it("acepta un reel", () => {
    expect(normalizeInstagramPostUrl("https://www.instagram.com/reel/CxYz123AbCd/")).toBe(
      "https://www.instagram.com/reel/CxYz123AbCd/",
    );
  });

  it("le saca los parámetros de seguimiento, que no aportan nada y ensucian", () => {
    expect(
      normalizeInstagramPostUrl("https://www.instagram.com/p/CxYz123AbCd/?igsh=abc&utm_source=x"),
    ).toBe("https://www.instagram.com/p/CxYz123AbCd/");
  });

  it("completa el https y el www de una dirección pegada a medias", () => {
    expect(normalizeInstagramPostUrl("instagram.com/p/CxYz123AbCd")).toBe(
      "https://www.instagram.com/p/CxYz123AbCd/",
    );
  });

  it("tolera espacios de sobra al pegar", () => {
    expect(normalizeInstagramPostUrl("  https://www.instagram.com/p/CxYz123AbCd/  ")).toBe(
      "https://www.instagram.com/p/CxYz123AbCd/",
    );
  });

  it("rechaza el perfil: es una cuenta, no un posteo", () => {
    expect(normalizeInstagramPostUrl("https://www.instagram.com/juanperez/")).toBeNull();
  });

  it("rechaza otro dominio, aunque diga instagram", () => {
    expect(normalizeInstagramPostUrl("https://instagram.fake.com/p/CxYz123AbCd/")).toBeNull();
    expect(normalizeInstagramPostUrl("https://noinstagram.com/p/CxYz123AbCd/")).toBeNull();
  });

  it("rechaza javascript: y data:, que son el vector obvio", () => {
    expect(normalizeInstagramPostUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeInstagramPostUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
  });

  it("rechaza vacío y basura", () => {
    expect(normalizeInstagramPostUrl("")).toBeNull();
    expect(normalizeInstagramPostUrl("cualquier cosa")).toBeNull();
  });

  it("rechaza un código con caracteres que Instagram no usa", () => {
    expect(normalizeInstagramPostUrl("https://www.instagram.com/p/con/barra/")).toBeNull();
    expect(normalizeInstagramPostUrl("https://www.instagram.com/p/con espacio/")).toBeNull();
  });
});

describe("parseInstagramPostUrls", () => {
  const UNO = "https://www.instagram.com/p/AAAAAAAAAAA/";
  const DOS = "https://www.instagram.com/p/BBBBBBBBBBB/";

  it("normaliza la lista entera", () => {
    const r = parseInstagramPostUrls(["instagram.com/p/AAAAAAAAAAA", DOS]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.urls).toEqual([UNO, DOS]);
  });

  it("descarta los renglones vacíos en vez de fallar: pegar deja líneas sueltas", () => {
    const r = parseInstagramPostUrls([UNO, "", "   ", DOS]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.urls).toEqual([UNO, DOS]);
  });

  it("saca los repetidos: el mismo posteo dos veces es un error de pegado", () => {
    const r = parseInstagramPostUrls([UNO, UNO, DOS]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.urls).toEqual([UNO, DOS]);
  });

  it("falla si alguno no es un posteo, y dice cuál", () => {
    const r = parseInstagramPostUrls([UNO, "https://www.instagram.com/juanperez/"]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("juanperez");
  });

  it("falla si se pasa del tope", () => {
    const muchos = Array.from(
      { length: MAX_INSTAGRAM_POSTS + 1 },
      (_, i) => `https://www.instagram.com/p/AAAAAAAAAA${i}/`,
    );
    const r = parseInstagramPostUrls(muchos);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(String(MAX_INSTAGRAM_POSTS));
  });

  it("una lista vacía es válida: es como se apaga la franja sin apagar el interruptor", () => {
    const r = parseInstagramPostUrls([]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.urls).toEqual([]);
  });
});
