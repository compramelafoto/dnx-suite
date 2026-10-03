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
    expect(decide("/reservas")).toEqual({ kind: "rewrite", pathname: "/w/sfpr/reservas" });
    expect(decide("/sorteos/abc")).toEqual({ kind: "rewrite", pathname: "/w/sfpr/sorteos/abc" });
  });

  it("/w/<slug> se sirve tal cual: redirigirlo hace un bucle con la reescritura", () => {
    expect(decide("/w/sfpr")).toEqual({ kind: "pass" });
    expect(decide("/w/sfpr/cursos", "?x=1")).toEqual({ kind: "pass" });
    // Lo que la reescritura produce, al volver a pasar por el proxy, no se toca.
    for (const p of ["/", "/blog", "/socios/ana"]) {
      const first = decide(p);
      expect(first.kind).toBe("rewrite");
      if (first.kind === "rewrite") expect(decide(first.pathname)).toEqual({ kind: "pass" });
    }
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
