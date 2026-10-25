import { describe, expect, it } from "vitest";
import { decideCustomDomainRoute, isFotofficeHost } from "./routing";

const ORIGIN = "https://fotoffice.com.ar";
const decide = (pathname: string, search = "") =>
  decideCustomDomainRoute({ pathname, search, slug: "sfpr", fotofficeOrigin: ORIGIN });

describe("decideCustomDomainRoute", () => {
  it("sirve el sitio con direcciones limpias", () => {
    expect(decide("/")).toEqual({ kind: "rewrite", pathname: "/w/sfpr" });
    expect(decide("/cursos")).toEqual({ kind: "rewrite", pathname: "/w/sfpr/cursos" });
    expect(decide("/blog/mi-articulo")).toEqual({ kind: "rewrite", pathname: "/w/sfpr/blog/mi-articulo" });
    expect(decide("/blog/rss.xml")).toEqual({ kind: "rewrite", pathname: "/w/sfpr/blog/rss.xml" });
    // En el panel son pantallas de gestión; en el dominio propio, secciones del sitio.
    expect(decide("/sorteos/abc")).toEqual({ kind: "rewrite", pathname: "/w/sfpr/sorteos/abc" });
  });

  it("los enlaces viejos con /w/<slug> saltan a la dirección limpia", () => {
    expect(decide("/w/sfpr")).toEqual({ kind: "redirect", url: "/" });
    expect(decide("/w/sfpr/cursos", "?x=1")).toEqual({ kind: "redirect", url: "/cursos?x=1" });
    expect(decide("/w/sfprx/cursos")).toEqual({ kind: "redirect", url: `${ORIGIN}/w/sfprx/cursos` });
  });

  it("el panel, la sesión y el ingreso van al dominio de FOTOFFICE", () => {
    expect(decide("/login", "?next=/portal")).toEqual({ kind: "redirect", url: `${ORIGIN}/login?next=/portal` });
    expect(decide("/portal")).toEqual({ kind: "redirect", url: `${ORIGIN}/portal` });
    expect(decide("/dashboard")).toEqual({ kind: "redirect", url: `${ORIGIN}/dashboard` });
    expect(decide("/entrar")).toEqual({ kind: "redirect", url: `${ORIGIN}/w/sfpr/entrar` });
    expect(decide("/w/sfpr/entrar")).toEqual({ kind: "redirect", url: `${ORIGIN}/w/sfpr/entrar` });
    expect(decide("/w/otra")).toEqual({ kind: "redirect", url: `${ORIGIN}/w/otra` });
  });

  it("las reservas se abren en FOTOFFICE, donde se reconoce al socio", () => {
    expect(decide("/reservas")).toEqual({ kind: "redirect", url: `${ORIGIN}/w/sfpr/reservas` });
    expect(decide("/reservas/abc", "?fecha=2026-10-05")).toEqual({
      kind: "redirect",
      url: `${ORIGIN}/w/sfpr/reservas/abc?fecha=2026-10-05`,
    });
    expect(decide("/w/sfpr/reservas/abc")).toEqual({ kind: "redirect", url: `${ORIGIN}/w/sfpr/reservas/abc` });
  });

  it("los enlaces de la comisión se abren en FOTOFFICE, donde está la sesión", () => {
    expect(decide("/proyecto/cmabc123")).toEqual({ kind: "redirect", url: `${ORIGIN}/w/sfpr/proyecto/cmabc123` });
    expect(decide("/reunion/cmabc123")).toEqual({ kind: "redirect", url: `${ORIGIN}/w/sfpr/reunion/cmabc123` });
    expect(decide("/w/sfpr/proyecto/cmabc123")).toEqual({ kind: "redirect", url: `${ORIGIN}/w/sfpr/proyecto/cmabc123` });
  });

  it("no toca recursos de Next, la API ni archivos", () => {
    expect(decide("/_next/data/x.json")).toEqual({ kind: "pass" });
    expect(decide("/api/w/sfpr/blog/views")).toEqual({ kind: "pass" });
    expect(decide("/fotoffice-logo.png")).toEqual({ kind: "pass" });
  });

  it("sin dirección de FOTOFFICE configurada, no inventa una", () => {
    expect(decideCustomDomainRoute({ pathname: "/login", search: "", slug: "sfpr", fotofficeOrigin: "" })).toEqual({ kind: "pass" });
  });
});

describe("isFotofficeHost", () => {
  it("reconoce los dominios de la plataforma", () => {
    expect(isFotofficeHost("fotoffice.com.ar", ORIGIN)).toBe(true);
    expect(isFotofficeHost("www.fotoffice.com.ar", ORIGIN)).toBe(true);
    expect(isFotofficeHost("localhost", ORIGIN)).toBe(true);
    expect(isFotofficeHost("fotoffice-git-x.vercel.app", ORIGIN)).toBe(true);
    expect(isFotofficeHost("sfpr.com.ar", ORIGIN)).toBe(false);
  });
});

describe("formulario insertable en el dominio propio", () => {
  it("/insertar[/<formulario>] se dibuja sin el armazón del sitio", () => {
    expect(decide("/insertar")).toEqual({ kind: "rewrite", pathname: "/formulario-insertado/sfpr/general" });
    expect(decide("/insertar/xv")).toEqual({ kind: "rewrite", pathname: "/formulario-insertado/sfpr/xv" });
    // El script de alto automático es un archivo estático: pasa sin tocar.
    expect(decide("/insertar.js")).toEqual({ kind: "pass" });
  });
});

describe("enlaces personales de módulos (galería, contrato, presupuesto)", () => {
  it("/galeria/<token> en el dominio propio se sirve internamente bajo /w/<slug> (sin redirigir a FOTOFFICE)", () => {
    expect(decide("/galeria/abc123")).toEqual({ kind: "rewrite", pathname: "/w/sfpr/galeria/abc123" });
    expect(decide("/contrato/abc123")).toEqual({ kind: "rewrite", pathname: "/w/sfpr/contrato/abc123" });
  });
  it("el enlace con /w/<slug> se limpia con un salto,", () => {
    expect(decide("/w/sfpr/galeria/abc123")).toEqual({ kind: "redirect", url: "/galeria/abc123" });
  });
});
