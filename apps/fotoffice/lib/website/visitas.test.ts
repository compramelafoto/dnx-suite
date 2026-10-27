import { describe, expect, it } from "vitest";
import {
  diaArgentino,
  esBot,
  esDeOtroSitio,
  esPrefetch,
  normalizarRutaVisita,
  periodoDeVisitas,
  resumirVisitas,
  sumarDias,
  visitasPorSlug,
} from "./visitas";

const PAGINAS = new Set(["quien-soy", "precios"]);
const n = (ruta: string, paginas: ReadonlySet<string> = PAGINAS) => normalizarRutaVisita(ruta, "dnx", paginas);
const cabeceras = (h: Record<string, string>) => new Headers(h);

describe("normalizarRutaVisita", () => {
  it("la portada, con y sin /w/<slug>", () => {
    expect(n("/")).toBe("/");
    expect(n("/w/dnx")).toBe("/");
    expect(n("/w/dnx/")).toBe("/");
  });
  it("saca la consulta, el # , barras repetidas y la barra final, y pasa a minúsculas", () => {
    expect(n("/w/dnx/quien-soy/?utm_source=ig#arriba")).toBe("/quien-soy");
    expect(n("//Quien-Soy//")).toBe("/quien-soy");
    expect(n("/blog/mi-articulo?ref=x")).toBe("/blog/mi-articulo");
  });
  it("cuenta las secciones del sitio y las páginas propias publicadas", () => {
    expect(n("/trabajos/casamientos")).toBe("/trabajos/casamientos");
    expect(n("/w/dnx/cursos")).toBe("/cursos");
    expect(n("/precios")).toBe("/precios");
  });
  it("no cuenta una página propia que no existe ni una anidada", () => {
    expect(n("/no-existe")).toBeNull();
    expect(n("/quien-soy/otra")).toBeNull();
    expect(n("/quien-soy", new Set())).toBeNull();
  });
  it("no cuenta el sitio de otra institución", () => {
    expect(n("/w/otra/quien-soy")).toBeNull();
    expect(n("/w")).toBeNull();
  });
  it("no cuenta rutas con token (mismo criterio que la medición)", () => {
    expect(n("/w/dnx/pedido/abc123")).toBeNull();
    expect(n("/galeria/tok")).toBeNull();
    expect(n("/testimonio?t=abc")).toBeNull();
    expect(n("/cursos/foto/inscripcion/ok")).toBeNull();
    expect(n("/tienda/pedido/xyz")).toBeNull();
    expect(n("/trabajos?email=a@b.com")).toBeNull();
  });
  it("no cuenta la puerta, el insertado, los documentos ni la API", () => {
    for (const r of ["/entrar", "/insertar", "/d/propuesta", "/api/x", "/robots.txt", "/sitemap.xml"]) expect(n(r)).toBeNull();
  });
  it("no cuenta rutas raras, largas u hondas", () => {
    expect(n("")).toBeNull();
    expect(n("sin-barra")).toBeNull();
    expect(n(`/${"a".repeat(400)}`)).toBeNull();
    expect(n("/blog/a/b/c/d")).toBeNull();
    expect(n("/blog/<script>")).toBeNull();
    expect(n("/blog/%E0%A4%A")).toBeNull();
    expect(n("/blog/..")).toBeNull();
  });
});

describe("esBot", () => {
  it("reconoce buscadores, vistas previas y herramientas", () => {
    for (const ua of [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "WhatsApp/2.23.20.0",
      "curl/8.4.0",
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0 Safari/537.36",
      "Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0 Mobile Safari/537.36 Chrome-Lighthouse",
      "python-requests/2.31",
      "",
    ]) {
      expect(esBot(ua)).toBe(true);
    }
    expect(esBot(null)).toBe(true);
  });
  it("deja pasar navegadores comunes", () => {
    for (const ua of [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.1; rv:131.0) Gecko/20100101 Firefox/131.0",
    ]) {
      expect(esBot(ua)).toBe(false);
    }
  });
});

describe("esPrefetch y esDeOtroSitio", () => {
  it("detecta precargas", () => {
    expect(esPrefetch(cabeceras({ purpose: "prefetch" }))).toBe(true);
    expect(esPrefetch(cabeceras({ "sec-purpose": "prefetch;prerender" }))).toBe(true);
    expect(esPrefetch(cabeceras({ "next-router-prefetch": "1" }))).toBe(true);
    expect(esPrefetch(cabeceras({ "x-moz": "prefetch" }))).toBe(true);
    expect(esPrefetch(cabeceras({}))).toBe(false);
  });
  it("un pedido de otro sitio no cuenta; sin la cabecera, sí", () => {
    expect(esDeOtroSitio(cabeceras({ "sec-fetch-site": "cross-site" }))).toBe(true);
    expect(esDeOtroSitio(cabeceras({ "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(esDeOtroSitio(cabeceras({}))).toBe(false);
  });
});

describe("días en hora argentina", () => {
  it("a las 01:00 UTC todavía es el día anterior en Argentina", () => {
    expect(diaArgentino(new Date("2026-10-28T01:00:00Z"))).toBe("2026-10-27");
    expect(diaArgentino(new Date("2026-10-28T03:00:00Z"))).toBe("2026-10-28");
  });
  it("suma y resta días cruzando meses", () => {
    expect(sumarDias("2026-11-01", -1)).toBe("2026-10-31");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("resumirVisitas", () => {
  const filas = [
    { ruta: "/", dia: "2026-10-27", visitas: 5 },
    { ruta: "/", dia: "2026-10-25", visitas: 2 },
    { ruta: "/quien-soy", dia: "2026-10-27", visitas: 3 },
    { ruta: "/blog/x", dia: "2026-10-20", visitas: 10 }, // queda afuera de 7 días
  ];
  it("suma el período, ordena por página y rellena los días sin visitas", () => {
    const r = resumirVisitas(filas, 7, "2026-10-27");
    expect(r.total).toBe(10);
    expect(r.porPagina).toEqual([
      { ruta: "/", visitas: 7 },
      { ruta: "/quien-soy", visitas: 3 },
    ]);
    expect(r.porDia).toHaveLength(7);
    expect(r.porDia[0]).toEqual({ dia: "2026-10-21", visitas: 0 });
    expect(r.porDia[6]).toEqual({ dia: "2026-10-27", visitas: 8 });
  });
  it("por slug: la portada es la clave vacía y las rutas hondas no son páginas propias", () => {
    const r = resumirVisitas(filas, 30, "2026-10-27");
    expect(visitasPorSlug(r.porPagina)).toEqual({ "": 7, "quien-soy": 3 });
  });
  it("período: 7, 30 o 90; cualquier otra cosa es 30", () => {
    expect(periodoDeVisitas("7")).toBe(7);
    expect(periodoDeVisitas(["90"])).toBe(90);
    expect(periodoDeVisitas("365")).toBe(30);
    expect(periodoDeVisitas(undefined)).toBe(30);
  });
});
