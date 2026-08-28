import { describe, expect, it } from "vitest";
import {
  normalizarSitioWeb,
  normalizarUrlRed,
  normalizarUsuarioRed,
  urlDeUsuario,
} from "./social";

describe("normalizarUsuarioRed", () => {
  it("acepta las cuatro formas en que la gente escribe el mismo Instagram", () => {
    const esperado = { ok: true, valor: "juanperez" };
    expect(normalizarUsuarioRed("instagram", "juanperez")).toEqual(esperado);
    expect(normalizarUsuarioRed("instagram", "@juanperez")).toEqual(esperado);
    expect(normalizarUsuarioRed("instagram", "instagram.com/juanperez")).toEqual(esperado);
    expect(
      normalizarUsuarioRed("instagram", "https://www.instagram.com/juanperez/?hl=es")
    ).toEqual(esperado);
  });

  it("normaliza mayúsculas y espacios sobrantes", () => {
    expect(normalizarUsuarioRed("instagram", "  @JuanPerez  ")).toEqual({
      ok: true,
      valor: "juanperez",
    });
  });

  it("vacío es válido: la red es opcional", () => {
    expect(normalizarUsuarioRed("instagram", "")).toEqual({ ok: true, valor: null });
    expect(normalizarUsuarioRed("instagram", "   ")).toEqual({ ok: true, valor: null });
    expect(normalizarUsuarioRed("instagram", null)).toEqual({ ok: true, valor: null });
  });

  it("rechaza un perfil de otra red pegado en el campo equivocado", () => {
    const r = normalizarUsuarioRed("instagram", "https://facebook.com/juanperez");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Instagram");
  });

  it("rechaza caracteres que Instagram no permite", () => {
    expect(normalizarUsuarioRed("instagram", "juan perez").ok).toBe(false);
    expect(normalizarUsuarioRed("instagram", "juan/perez").ok).toBe(false);
    expect(normalizarUsuarioRed("instagram", "a".repeat(31)).ok).toBe(false);
  });

  it("rechaza esquemas peligrosos", () => {
    expect(normalizarUsuarioRed("instagram", "javascript:alert(1)").ok).toBe(false);
    expect(normalizarUsuarioRed("instagram", "  JavaScript:alert(1)").ok).toBe(false);
  });

  it("tiktok admite el arroba y su propio largo máximo", () => {
    expect(normalizarUsuarioRed("tiktok", "@foto.rosario")).toEqual({
      ok: true,
      valor: "foto.rosario",
    });
    expect(normalizarUsuarioRed("tiktok", "a".repeat(25)).ok).toBe(false);
  });
});

describe("normalizarUrlRed", () => {
  it("conserva los perfiles viejos de Facebook con profile.php", () => {
    const r = normalizarUrlRed("facebook", "facebook.com/profile.php?id=100001");
    expect(r).toEqual({ ok: true, valor: "https://facebook.com/profile.php?id=100001" });
  });

  it("acepta las distintas formas de canal de YouTube", () => {
    expect(normalizarUrlRed("youtube", "https://youtube.com/@estudiofoto").ok).toBe(true);
    expect(normalizarUrlRed("youtube", "https://youtube.com/channel/UC123").ok).toBe(true);
    expect(normalizarUrlRed("youtube", "youtu.be/abc").ok).toBe(true);
  });

  it("rechaza una dirección de otra red", () => {
    expect(normalizarUrlRed("linkedin", "https://instagram.com/juan").ok).toBe(false);
  });

  it("vacío es válido", () => {
    expect(normalizarUrlRed("facebook", null)).toEqual({ ok: true, valor: null });
  });
});

describe("normalizarSitioWeb", () => {
  it("agrega https cuando lo escriben sin esquema", () => {
    expect(normalizarSitioWeb("www.estudiofoto.com.ar")).toEqual({
      ok: true,
      valor: "https://www.estudiofoto.com.ar/",
    });
  });

  it("respeta http cuando lo escribieron explícito", () => {
    const r = normalizarSitioWeb("http://estudiofoto.com.ar");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.valor?.startsWith("http://")).toBe(true);
  });

  it("rechaza algo que no es un dominio", () => {
    expect(normalizarSitioWeb("miweb").ok).toBe(false);
    expect(normalizarSitioWeb("localhost").ok).toBe(false);
  });

  it("rechaza esquemas peligrosos", () => {
    expect(normalizarSitioWeb("javascript:alert(1)").ok).toBe(false);
    expect(normalizarSitioWeb("data:text/html,<script>").ok).toBe(false);
  });

  it("rechaza direcciones absurdamente largas", () => {
    expect(normalizarSitioWeb(`https://a.com/${"x".repeat(600)}`).ok).toBe(false);
  });
});

describe("urlDeUsuario", () => {
  it("arma el enlace visible desde el usuario guardado", () => {
    expect(urlDeUsuario("instagram", "juanperez")).toBe("https://instagram.com/juanperez");
    expect(urlDeUsuario("tiktok", "juanperez")).toBe("https://tiktok.com/@juanperez");
  });
});
