import { describe, expect, it } from "vitest";
import { extraerDelHtml, leerSitioPropio } from "./sitio";

const contexto = {
  ciudad: "Rosario", provincia: "Santa Fe", region: "CENTRO" as const, tipo: "FOTOGRAFO" as const, nicho: "ESCOLAR",
  googlePlaceId: "places/abc",
};

const PAGINA = `<!doctype html><html><head>
<title>Estudio Luz | Fotografía escolar en Rosario</title>
<meta property="og:site_name" content="Estudio Luz &amp; Sombra">
</head><body>
<a href="mailto:hola@estudioluz.com.ar?subject=Consulta">Escribinos</a>
<a href="mailto:otro@dominio-ajeno.com">ajeno</a>
<a href="tel:+54 341 555-1234">Llamanos</a>
<a href="https://wa.me/5493415551234?text=Hola">WhatsApp</a>
<a href="https://www.instagram.com/estudioluz/">IG</a>
<a href="https://www.facebook.com/estudioluzrosario">FB</a>
</body></html>`;

type Llamada = { url: string; init: RequestInit | undefined };

/** fetch falso: cada URL devuelve su respuesta; anota los pedidos. */
function fetchFalso(rutas: Record<string, () => Response>) {
  const llamadas: Llamada[] = [];
  const f = (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    llamadas.push({ url: u, init });
    const r = rutas[u];
    if (!r) throw new Error(`sin ruta ${u}`);
    return r();
  }) as typeof fetch;
  return { f, llamadas };
}

const html = (cuerpo: string) => () => new Response(cuerpo, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
const redireccion = (destino: string) => () => new Response(null, { status: 301, headers: { location: destino } });

describe("extraerDelHtml", () => {
  it("saca correos, teléfonos, WhatsApp, redes y el nombre de og:site_name", () => {
    const e = extraerDelHtml(PAGINA);
    expect(e.nombre).toBe("Estudio Luz & Sombra");
    expect(e.emails).toEqual(["hola@estudioluz.com.ar", "otro@dominio-ajeno.com"]);
    expect(e.telefonos).toEqual(["+54 341 555-1234"]);
    expect(e.whatsapps).toEqual(["https://wa.me/5493415551234?text=Hola"]);
    expect(e.instagram).toBe("https://www.instagram.com/estudioluz/");
    expect(e.facebook).toBe("https://www.facebook.com/estudioluzrosario");
  });

  it("sin og:site_name usa el <title> sin el sufijo", () => {
    expect(extraerDelHtml("<title> Foto Sur - Inicio </title>").nombre).toBe("Foto Sur");
    expect(extraerDelHtml("<title>Foto Sur | Casamientos</title>").nombre).toBe("Foto Sur");
    expect(extraerDelHtml("<p>nada</p>").nombre).toBeNull();
  });
});

describe("leerSitioPropio", () => {
  it("arma un candidato SITIO_PROPIO con la página final como fuente y valida cada dato", async () => {
    const { f, llamadas } = fetchFalso({ "https://estudioluz.com.ar/": html(PAGINA) });
    const c = await leerSitioPropio("https://estudioluz.com.ar/", contexto, { fetch: f });
    expect(c).not.toBeNull();
    expect(c!.nombre).toBe("Estudio Luz & Sombra");
    expect(c!.googlePlaceId).toBe("places/abc");
    expect(c!.datos.email).toEqual({ valor: "hola@estudioluz.com.ar", fuente: "SITIO_PROPIO", fuenteUrl: "https://estudioluz.com.ar/" });
    expect(c!.datos.telefono?.valor).toBe("+543415551234");
    expect(c!.datos.whatsapp?.valor).toBe("https://wa.me/543415551234");
    expect(c!.datos.instagram?.fuente).toBe("SITIO_PROPIO");
    expect(c!.datos.web).toMatchObject({ fuente: "SITIO_PROPIO", fuenteUrl: "https://estudioluz.com.ar/" });
    // Sin cookies ni credenciales, y las redirecciones se siguen a mano.
    expect(llamadas[0]!.init).toMatchObject({ credentials: "omit", redirect: "manual" });
  });

  it("sigue una redirección dentro del mismo dominio y usa la URL final", async () => {
    const { f } = fetchFalso({
      "http://estudioluz.com.ar/": redireccion("https://www.estudioluz.com.ar/inicio"),
      "https://www.estudioluz.com.ar/inicio": html(PAGINA),
    });
    const c = await leerSitioPropio("http://estudioluz.com.ar/", contexto, { fetch: f });
    expect(c?.datos.email?.fuenteUrl).toBe("https://www.estudioluz.com.ar/inicio");
  });

  it("no sigue una redirección a otro dominio", async () => {
    const { f, llamadas } = fetchFalso({ "https://estudioluz.com.ar/": redireccion("https://otro.com/") });
    expect(await leerSitioPropio("https://estudioluz.com.ar/", contexto, { fetch: f })).toBeNull();
    expect(llamadas).toHaveLength(1);
  });

  it("sólo http(s): otro esquema no se pide", async () => {
    const { f, llamadas } = fetchFalso({});
    expect(await leerSitioPropio("ftp://estudioluz.com.ar/", contexto, { fetch: f })).toBeNull();
    expect(await leerSitioPropio("javascript:alert(1)", contexto, { fetch: f })).toBeNull();
    expect(llamadas).toHaveLength(0);
  });

  it("sin nombre o sin ningún dato de contacto no hay candidato", async () => {
    const sinNombre = fetchFalso({ "https://a.com.ar/": html('<a href="mailto:x@a.com.ar">x</a>') });
    expect(await leerSitioPropio("https://a.com.ar/", contexto, { fetch: sinNombre.f })).toBeNull();
    const sinDatos = fetchFalso({ "https://a.com.ar/": html("<title>Estudio A</title>") });
    expect(await leerSitioPropio("https://a.com.ar/", contexto, { fetch: sinDatos.f })).toBeNull();
  });

  it("un error de red, un estado no 2xx o algo que no es HTML devuelven null", async () => {
    const roto = fetchFalso({});
    expect(await leerSitioPropio("https://a.com.ar/", contexto, { fetch: roto.f })).toBeNull();
    const error = fetchFalso({ "https://a.com.ar/": () => new Response("x", { status: 500 }) });
    expect(await leerSitioPropio("https://a.com.ar/", contexto, { fetch: error.f })).toBeNull();
    const pdf = fetchFalso({ "https://a.com.ar/": () => new Response(PAGINA, { status: 200, headers: { "content-type": "application/pdf" } }) });
    expect(await leerSitioPropio("https://a.com.ar/", contexto, { fetch: pdf.f })).toBeNull();
  });

  it("lee como mucho 1 MB", async () => {
    const relleno = "x".repeat(1_100_000);
    const { f } = fetchFalso({ "https://a.com.ar/": html(`<title>Estudio A</title>${relleno}<a href="mailto:x@a.com.ar">x</a>`) });
    // El correo queda después del primer mega: no se lee.
    expect(await leerSitioPropio("https://a.com.ar/", contexto, { fetch: f })).toBeNull();
  });
});
