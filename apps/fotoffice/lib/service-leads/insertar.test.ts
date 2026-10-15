import { readFileSync } from "node:fs";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import nextConfig from "@/next.config";
import {
  baseDelSitio,
  codigoMarcoConAltoAutomatico,
  codigoMarcoSimple,
  esFormularioInsertable,
  rutaInternaInsertada,
  urlInsertada,
  urlPublicaFormulario,
  urlScriptInsertar,
} from "./insertar";

const raiz = path.resolve(__dirname, "../..");
const leer = (rel: string) => readFileSync(path.join(raiz, rel), "utf8");

describe("rutaInternaInsertada", () => {
  it("lleva /w/<slug>/insertar a la ruta sin armazón de sitio", () => {
    expect(rutaInternaInsertada("/w/dnxestudio/insertar")).toBe("/formulario-insertado/dnxestudio/general");
    expect(rutaInternaInsertada("/w/dnxestudio/insertar/")).toBe("/formulario-insertado/dnxestudio/general");
    expect(rutaInternaInsertada("/w/dnxestudio/insertar/xv")).toBe("/formulario-insertado/dnxestudio/xv");
  });

  it("no toca el resto del sitio", () => {
    expect(rutaInternaInsertada("/w/dnxestudio")).toBeNull();
    expect(rutaInternaInsertada("/w/dnxestudio/xv")).toBeNull();
    expect(rutaInternaInsertada("/w/dnxestudio/insertar/xv/otra")).toBeNull();
    expect(rutaInternaInsertada("/w/dnxestudio/blog/insertar")).toBeNull();
    expect(rutaInternaInsertada("/insertar")).toBeNull();
  });

  it("sólo el general y el de XV tienen versión para insertar", () => {
    expect(esFormularioInsertable("general")).toBe(true);
    expect(esFormularioInsertable("xv")).toBe(true);
    expect(esFormularioInsertable("bodas")).toBe(false);
    expect(esFormularioInsertable(null)).toBe(false);
  });
});

describe("direcciones absolutas y códigos para pegar", () => {
  it("sin dominio propio usa FOTOFFICE bajo /w/<slug>", () => {
    const base = baseDelSitio({ customDomain: null, appOrigin: "https://fotoffice.com/", slug: "dnxestudio" });
    expect(base).toBe("https://fotoffice.com/w/dnxestudio");
    expect(urlPublicaFormulario(base!, "general")).toBe("https://fotoffice.com/w/dnxestudio");
    expect(urlPublicaFormulario(base!, "xv")).toBe("https://fotoffice.com/w/dnxestudio/xv");
    expect(urlInsertada(base!, "general")).toBe("https://fotoffice.com/w/dnxestudio/insertar");
    expect(urlInsertada(base!, "xv")).toBe("https://fotoffice.com/w/dnxestudio/insertar/xv");
    expect(urlScriptInsertar(base!)).toBe("https://fotoffice.com/insertar.js");
  });

  it("con dominio propio conectado usa ese dominio, sin /w/<slug>", () => {
    const base = baseDelSitio({ customDomain: "SFPR.com.ar", appOrigin: "https://fotoffice.com", slug: "sfpr" });
    expect(base).toBe("https://sfpr.com.ar");
    expect(urlInsertada(base!, "general")).toBe("https://sfpr.com.ar/insertar");
    expect(urlInsertada(base!, "xv")).toBe("https://sfpr.com.ar/insertar/xv");
    expect(urlScriptInsertar(base!)).toBe("https://sfpr.com.ar/insertar.js");
  });

  it("sin slug ni dominio, o sin dirección de la app, no hay enlace", () => {
    expect(baseDelSitio({ customDomain: null, appOrigin: "https://fotoffice.com", slug: null })).toBeNull();
    expect(baseDelSitio({ customDomain: null, appOrigin: "", slug: "dnxestudio" })).toBeNull();
  });

  it("arma los dos códigos con la dirección absoluta", () => {
    const url = "https://fotoffice.com/w/dnxestudio/insertar/xv";
    expect(codigoMarcoSimple({ url, titulo: "Consulta de XV" })).toBe(
      '<iframe src="https://fotoffice.com/w/dnxestudio/insertar/xv" title="Consulta de XV" height="900" style="border:0;width:100%" loading="lazy"></iframe>',
    );
    const conScript = codigoMarcoConAltoAutomatico({ url, titulo: "Consulta de XV", scriptUrl: "https://fotoffice.com/insertar.js" });
    expect(conScript).toContain('data-fotoffice-form');
    expect(conScript).toContain('src="https://fotoffice.com/w/dnxestudio/insertar/xv"');
    expect(conScript).toContain('<script src="https://fotoffice.com/insertar.js" async></script>');
  });

  it("escapa el título para que no rompa el HTML", () => {
    expect(codigoMarcoSimple({ url: "https://x.com/insertar", titulo: 'Bodas "VIP" <b>' })).toContain(
      'title="Bodas &quot;VIP&quot; &lt;b&gt;"',
    );
  });
});

describe("la página insertada", () => {
  const pagina = leer("app/formulario-insertado/[workspaceSlug]/[formSlug]/page.tsx");

  it("vive fuera de app/w/[workspaceSlug] y no dibuja el armazón del sitio", () => {
    expect(pagina).not.toMatch(/PublicSiteShell|WebsiteHeaderView|WebsiteFooterView|SiteFrame/);
    expect(pagina).toContain("<AltoInsertado>");
    expect(pagina).toMatch(/robots:\s*\{\s*index:\s*false/);
  });

  it("usa los mismos formularios (y la misma acción) que el sitio, en modo insertado", () => {
    expect(pagina).toMatch(/<PublicDynamicServiceLeadForm[^>]*insertado/);
    expect(pagina).toMatch(/<PublicServiceLeadForm[\s\S]*?insertado/);
    for (const rel of ["app/w/[workspaceSlug]/public-dynamic-service-lead-form.tsx", "app/w/[workspaceSlug]/xv/public-service-lead-form.tsx"]) {
      const fuente = leer(rel);
      expect(fuente).toContain("createServiceLead(payload)");
      expect(fuente).toContain("<CampoTrampa />");
      expect(fuente).toContain("if (insertado) return;");
    }
  });

  it("el proxy reescribe las direcciones públicas a la ruta interna", () => {
    expect(leer("proxy.ts")).toContain("rutaInternaInsertada(req.nextUrl.pathname)");
  });
});

describe("cabeceras", () => {
  async function cabecerasDe(ruta: string): Promise<Record<string, string>> {
    const reglas = (await nextConfig.headers!()) as { source: string; headers: { key: string; value: string }[] }[];
    const fuera: Record<string, string> = {};
    for (const regla of reglas) {
      const patron = new RegExp(
        "^" + regla.source.replace(/:[a-z]+\*/gi, ".*").replace(/:[a-z]+/gi, "[^/]+") + "$",
      );
      if (patron.test(ruta)) for (const h of regla.headers) fuera[h.key] = h.value;
    }
    return fuera;
  }

  it("el formulario insertable se deja enmarcar desde cualquier web y no se indexa", async () => {
    for (const ruta of ["/w/dnxestudio/insertar", "/w/dnxestudio/insertar/xv", "/insertar", "/insertar/xv"]) {
      const h = await cabecerasDe(ruta);
      expect(h["Content-Security-Policy"]).toBe("frame-ancestors *");
      expect(h["X-Robots-Tag"]).toBe("noindex, nofollow");
      expect(h["X-Frame-Options"]).toBeUndefined();
    }
  });

  it("el presupuesto sigue sin poder enmarcarse", async () => {
    for (const ruta of ["/w/dnxestudio/presupuesto/abc", "/presupuesto/abc"]) {
      const h = await cabecerasDe(ruta);
      expect(h["X-Frame-Options"]).toBe("DENY");
      expect(h["Content-Security-Policy"]).toBe("frame-ancestors 'none'");
    }
  });
});

describe("script de alto automático (public/insertar.js)", () => {
  function cargarScript(marcos: { src: string; contentWindow: unknown; style: { height?: string } }[]) {
    let escucha: ((e: { data: unknown; origin: string; source: unknown }) => void) | null = null;
    const ventana: Record<string, unknown> = {
      location: { href: "https://mi-web-wordpress.com/contacto" },
      addEventListener: vi.fn((tipo: string, fn: typeof escucha) => {
        if (tipo === "message") escucha = fn;
      }),
    };
    const documento = {
      querySelectorAll: () =>
        marcos.map((m) => ({ ...m, getAttribute: (k: string) => (k === "src" ? m.src : null), style: m.style })),
    };
    runInNewContext(leer("public/insertar.js"), { window: ventana, document: documento, URL, Number, Math, isFinite });
    return (e: { data: unknown; origin: string; source: unknown }) => escucha!(e);
  }

  it("ajusta el alto del marco que mandó el aviso, desde su propio origen", () => {
    const fuente = {};
    const style: { height?: string } = {};
    const avisar = cargarScript([{ src: "https://fotoffice.com/w/dnxestudio/insertar", contentWindow: fuente, style }]);
    avisar({ data: { type: "fotoffice-form-height", height: 812.4 }, origin: "https://fotoffice.com", source: fuente });
    expect(style.height).toBe("813px");
  });

  it("ignora avisos de otro origen o de otra ventana", () => {
    const fuente = {};
    const style: { height?: string } = {};
    const avisar = cargarScript([{ src: "https://fotoffice.com/w/dnxestudio/insertar", contentWindow: fuente, style }]);
    avisar({ data: { type: "fotoffice-form-height", height: 5000 }, origin: "https://malicioso.com", source: fuente });
    avisar({ data: { type: "fotoffice-form-height", height: 5000 }, origin: "https://fotoffice.com", source: {} });
    avisar({ data: { type: "otra-cosa", height: 5000 }, origin: "https://fotoffice.com", source: fuente });
    avisar({ data: { type: "fotoffice-form-height", height: -1 }, origin: "https://fotoffice.com", source: fuente });
    expect(style.height).toBeUndefined();
  });
});
