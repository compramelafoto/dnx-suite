import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { parseWebsiteSections } from "@/lib/website/blocks";
import { parseSiteMenu } from "@/lib/website/site-menu";
import { compilarRedirecciones, resolverRedireccion } from "@/lib/website/redirecciones-reglas";
import { leerArticulo } from "./alboom/articulo";
import { leerTrabajo } from "./alboom/trabajo";
import { fechaArgentinaAUtc, importarSitioAlboom, recortarSlug, slugDeArticulo, type CopiarFoto } from "./cargar";
import { crearDestinoEnMemoria, estadoVacio } from "./destino";
import type { FuenteAlboom } from "./fuente";
import { informeEnMarkdown } from "./informe";

const fx = (n: string) => readFileSync(join(__dirname, "alboom", "__fixtures__", n), "utf8");
const BASE = "https://www.dnxfotografia.com.ar";

const SITEMAP = `<?xml version="1.0"?><urlset>
<url><loc>${BASE}/</loc></url>
<url><loc>${BASE}/post/89987-tenemos-nuestro-estudio-en-funes-santa-fe</loc></url>
<url><loc>${BASE}/sobre</loc></url><url><loc>${BASE}/cursos</loc></url><url><loc>${BASE}/prueba</loc></url>
<url><loc>${BASE}/los15depia</loc></url><url><loc>${BASE}/cursoxv</loc></url>
<url><loc>${BASE}/gallery/12070-books</loc></url></urlset>`;

const LISTADO = `<main><a href="/portfolio/books/1465286-book-emma-pre-xv">Emma</a>
<a href="/portfolio/fiestas/375817-giseyfatu">Gise</a>
<button id="loadMore" data-pages="2" data-page="1">Más</button></main>`;

const TRABAJO = fx("trabajo-1465286.html");

const PAGINAS: Record<string, string> = {
  "/": fx("portada.html"),
  "/sitemap.xml": SITEMAP,
  "/portfolio": LISTADO,
  "/galerias": fx("galerias.html"),
  "/gallery/12070-books": fx("galeria-12070.html"),
  "/portfolio/books/1465286-book-emma-pre-xv": TRABAJO,
  "/portfolio/fiestas/375817-giseyfatu": TRABAJO,
  "/portfolio/books/338458-mile": TRABAJO,
  "/post.php?id=89987": fx("articulo-89987.html"),
  "/post.php?id=476452": fx("articulo-476452.html"),
  "/sobre": fx("sobre.html"),
  "/cursos": fx("cursos.html"),
  "/agenda": fx("agenda.html"),
  "/imprimir": fx("imprimir.html"),
  "/cursoxv": fx("cursoxv.html"),
  "/tallerpresupuestos": fx("tallerpresupuestos.html"),
};

function fuenteDeFixtures(): FuenteAlboom & { pedidos: string[] } {
  const pedidos: string[] = [];
  return {
    pedidos,
    async traer(ruta, opciones = {}) {
      pedidos.push(ruta);
      if (ruta === "/portfolio?page=2") {
        return opciones.ajax ? { status: 200, html: `<a href="/portfolio/books/338458-mile">Mile</a>` } : { status: 403, html: "" };
      }
      const html = PAGINAS[ruta];
      return html === undefined ? { status: 404, html: "" } : { status: 200, html };
    },
  };
}

/** La primera foto del trabajo de prueba «da 404» en Alboom. */
const FOTO_ROTA = leerTrabajo(TRABAJO, `${BASE}/portfolio/books/1465286-book-emma-pre-xv`).fotos[0];

function copiadorFalso() {
  const fn = vi.fn<CopiarFoto>(async (url, prefijo) => {
    if (url === FOTO_ROTA) return { error: "respondió 404" };
    const key = `${prefijo}${Buffer.from(url).toString("base64url").slice(-24)}.jpg`;
    return { url: `https://media.test/${key}`, key, ancho: 1200, alto: 800, tipo: "image/jpeg", peso: 1000 };
  });
  return fn;
}

const PAGINAS_PRUEBA = [
  { slug: "quien-soy", alboom: "/sobre", titulo: "Quién soy", agregar: ["PRESUPUESTO" as const] },
  { slug: "agenda", alboom: "/agenda", titulo: "Agendá un turno", agregar: ["PRESUPUESTO" as const, "WHATSAPP" as const] },
  { slug: "capacitate", alboom: "/cursos", titulo: "Capacitate", agregar: ["TESTIMONIOS" as const] },
  { slug: "imprimi-tus-fotos", alboom: "/imprimir", titulo: "Imprimí tus fotos" },
  { slug: "curso-xv", alboom: "/cursoxv" },
  { slug: "taller-presupuestos", alboom: "/tallerpresupuestos" },
  { slug: "curso-celular", alboom: "/celular" },
];

const OPCIONES = {
  workspaceId: "cmv5z6qxwwmmhf0q5gp8qja1j",
  base: BASE,
  aplicar: false,
  slugPublico: "dnx-estudio",
  articulos: ["89987", "476452"],
  paginas: PAGINAS_PRUEBA,
};

async function correr(estado = estadoVacio()) {
  const destino = crearDestinoEnMemoria(estado);
  const copiarFoto = copiadorFalso();
  const fuente = fuenteDeFixtures();
  const informe = await importarSitioAlboom(OPCIONES, { fuente, destino, copiarFoto, ahora: () => new Date("2026-10-26T15:00:00Z") });
  return { informe, estado: destino.estado, copiarFoto, fuente };
}

describe("importarSitioAlboom", () => {
  it("carga artículos en borrador con la fecha argentina pasada a UTC y el autor", async () => {
    const { informe, estado } = await correr();
    expect(informe.articulos).toMatchObject({ creados: 2, existentes: 0, fallidos: 0 });
    expect(informe.autorBlog).toBe("creado");
    expect(estado.autores).toEqual([expect.objectContaining({ nombre: "Daniel Cuart", slug: "daniel-cuart" })]);
    const mudanza = estado.articulos.find((a) => a.data.title === "Nos mudamos a Funes!")!;
    expect(mudanza.data.status).toBe("DRAFT");
    expect(mudanza.createdAt.toISOString()).toBe("2024-01-27T22:36:00.000Z");
    expect(mudanza.data.publishedAt?.toISOString()).toBe("2024-01-27T22:36:00.000Z");
    expect(mudanza.data.authorId).toBe(estado.autores[0].id);
    for (const a of estado.articulos) expect(a.data.slug.length).toBeLessThanOrEqual(60);
    // El video de YouTube del 476452 queda como nodo del editor.
    const conVideo = estado.articulos.find((a) => JSON.stringify(a.data.contentJson).includes('"youtube"'));
    expect(conVideo).toBeTruthy();
  });

  it("carga trabajos y galerías publicados con su id de Alboom; una foto rota no frena el trabajo", async () => {
    const { informe, estado } = await correr();
    expect(informe.trabajos).toMatchObject({ creados: 4, fallidos: 4 });
    expect(estado.trabajos.map((t) => t.origenExternoId).sort()).toEqual(["12070", "1465286", "338458", "375817"]);
    for (const t of estado.trabajos) expect(t.estado).toBe("PUBLICADO");
    const emma = estado.trabajos.find((t) => t.origenExternoId === "1465286")!;
    expect(emma.fotos.length).toBeGreaterThan(5);
    expect(emma.fotos.some((f) => f.origenUrl === FOTO_ROTA)).toBe(false);
    expect(emma.fotos[0].r2Key?.startsWith(`fotoffice/site-trabajos/cmv5z6qxwwmmhf0q5gp8qja1j/${emma.id}/`)).toBe(true);
    expect(emma.destacado).toBe(true);
    expect(informe.fotos.fallidas).toContainEqual({ donde: expect.stringContaining("Trabajo 1465286"), url: FOTO_ROTA, error: "respondió 404" });
    const galeria = estado.trabajos.find((t) => t.origenExternoId === "12070")!;
    expect(estado.categoriasTrabajos.find((c) => c.id === galeria.categoriaId)?.slug).toBe("books");
    expect(estado.categoriasTrabajos.map((c) => c.nombre)).toEqual(["Books", "Fiestas de XV", "Bodas", "Arquitectura", "Graduaciones", "Videos"]);
  });

  it("carga los 32 testimonios publicados, con el permiso del sitio anterior y atados al trabajo", async () => {
    const { informe, estado } = await correr();
    expect(informe.testimonios.creados).toBe(32);
    expect(estado.testimonios[0].datos.autorNombre).toBe("Gise y Fatu Broun");
    for (const t of estado.testimonios) expect(t.consentimientoTexto).toBe("Publicado por el autor en el sitio anterior (Alboom)");
    const gise = estado.testimonios.find((t) => t.datos.autorNombre === "Gise y Fatu Broun")!;
    expect(gise.trabajoId).toBe(estado.trabajos.find((t) => t.origenExternoId === "375817")!.id);
    expect(gise.autorFotoKey?.startsWith("fotoffice/site-testimonios/cmv5z6qxwwmmhf0q5gp8qja1j/")).toBe(true);
  });

  it("arma páginas, portada y menú en el borrador del sitio", async () => {
    const { informe, estado } = await correr();
    expect(informe.paginas).toMatchObject({ creados: 6, fallidos: 1 });
    expect(informe.paginas.detalle.find((p) => p.slug === "curso-celular")?.error).toContain("404");
    const s = parseWebsiteSections(estado.borrador.sectionsJson);
    expect(Object.values(s.pageMeta).map((m) => m.slug).sort()).toEqual(["agenda", "capacitate", "curso-xv", "imprimi-tus-fotos", "quien-soy", "taller-presupuestos"]);
    expect(s.pages.capacitate.at(-1)?.type).toBe("TESTIMONIALS");
    expect(s.pages.home.map((b) => b.type)).toEqual(["HERO", "PORTFOLIO", "RICH_TEXT", "TESTIMONIALS", "BLOG_LATEST", "INQUIRY_FORM", "CONTACT"]);
    const hero = s.pages.home[0];
    expect(hero.type === "HERO" && hero.config.slides[0].imageUrl?.startsWith("https://media.test/fotoffice/site-trabajos/")).toBe(true);
    const contacto = s.pages.home.at(-1)!;
    expect(contacto.type === "CONTACT" && contacto.config.email).toBe("dnxfotografia@gmail.com");
    // Ninguna foto queda apuntando a Alboom.
    expect(JSON.stringify(s)).not.toMatch(/alboom\.ninja|alfred\.alboompro/);

    const menu = parseSiteMenu(estado.borrador.navJson)!;
    const visibles = menu.items.filter((i) => !i.hidden).map((i) => i.label);
    expect(visibles).toEqual(["Inicio", "Trabajos", "Blog", "Quién soy", "Pedí tu presupuesto", "Imprimí tus fotos", "Agendá un turno", "Capacitate", "Testimonios", "Tienda Online"]);
    expect(menu.items.find((i) => i.kind === "link")).toMatchObject({ url: "https://www.dnxshop.com.ar/", newTab: true });
  });

  it("deja las redirecciones del sitio viejo y lista las landings no migradas", async () => {
    const { informe, estado } = await correr();
    const tabla = compilarRedirecciones(estado.redirecciones);
    const emma = estado.trabajos.find((t) => t.origenExternoId === "1465286")!;
    const mudanza = estado.articulos.find((a) => a.data.title === "Nos mudamos a Funes!")!;
    expect(resolverRedireccion(tabla, "/Cursos/")).toEqual({ hacia: "/capacitate", codigo: 301 });
    expect(resolverRedireccion(tabla, "/post/89987-tenemos-nuestro-estudio-en-funes-santa-fe/")?.hacia).toBe(`/blog/${mudanza.data.slug}`);
    expect(resolverRedireccion(tabla, "/post.php?id=89987")?.hacia).toBe(`/blog/${mudanza.data.slug}`);
    expect(resolverRedireccion(tabla, "/portfolio/books/1465286-book-emma-pre-xv")?.hacia).toBe(`/trabajos/books/${emma.slug}`);
    expect(resolverRedireccion(tabla, "/album.php?id=1465286")?.hacia).toBe(`/trabajos/books/${emma.slug}`);
    expect(resolverRedireccion(tabla, "/portfolio/fiestas")?.hacia).toBe("/trabajos/fiestas-de-xv");
    expect(resolverRedireccion(tabla, "/cursoxv")?.hacia).toBe("/curso-xv");
    expect(resolverRedireccion(tabla, "/los15depia")?.hacia).toBe("/trabajos");
    expect(resolverRedireccion(tabla, "/proof/XyZ")).toEqual({ hacia: "https://dnxfotografia.alboompro.com/proof/XyZ", codigo: 302 });
    expect(informe.redirecciones.creadas).toBe(estado.redirecciones.length);
    expect(informe.landingsNoMigradas).toEqual([{ ruta: "/los15depia", url: `${BASE}/los15depia` }]);
    expect(estado.redirecciones.every((r) => r.origen === "alboom-prosite" || r.origen.startsWith("alboom-prosite:post="))).toBe(true);
    expect(informe.logo).toBe("copiado");
  });

  it("los enlaces al sitio viejo dentro de las páginas pasan a las rutas nuevas", async () => {
    const { estado } = await correr();
    expect(JSON.stringify(estado.borrador.sectionsJson)).not.toMatch(/https?:\/\/(www\.)?dnxfotografia\.com\.ar\/(sobre|cursos|contato)\b/);
  });

  it("una segunda corrida no crea nada ni vuelve a copiar fotos", async () => {
    const primera = await correr();
    const segunda = await correr(primera.estado);
    const i = segunda.informe;
    expect(i.articulos.creados + i.trabajos.creados + i.testimonios.creados + i.paginas.creados).toBe(0);
    expect(i.categoriasTrabajos.creados + i.redirecciones.creadas + i.trabajos.completados).toBe(0);
    expect(i.articulos.existentes).toBe(2);
    expect(i.trabajos.existentes).toBe(4);
    expect(i.testimonios.existentes).toBe(32);
    expect(i.paginas.existentes).toBe(6);
    expect(i.portada.estado).toBe("existente");
    expect(i.menu).toBe("existente");
    expect(i.logo).toBe("ya tenía");
    expect(i.autorBlog).toBe("existente");
    expect(segunda.estado.trabajos).toHaveLength(4);
    expect(segunda.estado.testimonios).toHaveLength(32);
    // Sólo se reintenta la foto que faltaba (una por cada trabajo que la tiene).
    for (const [url] of segunda.copiarFoto.mock.calls) expect(url).toBe(FOTO_ROTA);
  });

  it("si la primera corrida se cortó, completa las fotos que faltan", async () => {
    const primera = await correr();
    const emma = primera.estado.trabajos.find((t) => t.origenExternoId === "1465286")!;
    const total = emma.fotos.length;
    emma.fotos.splice(3);
    const segunda = await correr(primera.estado);
    expect(segunda.informe.trabajos.completados).toBe(1);
    expect(emma.fotos).toHaveLength(total);
  });

  it("marca los artículos que creó para publicarlos después, nunca un borrador que ya existía", async () => {
    const estado = estadoVacio();
    const slugMudanza = slugDeArticulo(leerArticulo(fx("articulo-89987.html"), `${BASE}/post.php?id=89987`));
    estado.articulos.push({ id: 999, createdAt: new Date(), data: { slug: slugMudanza, title: "Mío", status: "DRAFT" } as never });
    const { informe, estado: final } = await correr(estado);
    expect(informe.articulos).toMatchObject({ creados: 1, existentes: 1 });
    const marcas = final.redirecciones.filter((r) => r.origen.startsWith("alboom-prosite:post="));
    const creado = final.articulos.find((a) => a.id !== 999)!;
    expect(marcas).toEqual([{ desde: "/post.php?id=476452", hacia: `/blog/${creado.data.slug}`, codigo: 301, origen: `alboom-prosite:post=${creado.id}` }]);
    // La regla del artículo que ya estaba existe igual, pero sin marca.
    expect(final.redirecciones.find((r) => r.desde === "/post.php?id=89987")?.origen).toBe("alboom-prosite");
  });

  it("un trabajo importado que quedó en borrador se completa y se publica en la corrida siguiente", async () => {
    const primera = await correr();
    const emma = primera.estado.trabajos.find((t) => t.origenExternoId === "1465286")!;
    emma.estado = "BORRADOR";
    const segunda = await correr(primera.estado);
    expect(emma.estado).toBe("PUBLICADO");
    expect(segunda.informe.trabajos.completados).toBe(1);
    expect(segunda.informe.trabajos.detalle.find((d) => d.alboomId === "1465286")?.estado).toBe("completado");
  });

  it("avisa que el menú del borrador se reemplaza entero", async () => {
    const estado = estadoVacio();
    estado.borrador.navJson = { version: 2, items: [{ id: "page:home", kind: "page", page: "home", label: "Casa", hidden: false }] };
    const { informe } = await correr(estado);
    expect(informe.avisos.some((a) => a.includes("menú del borrador") && a.includes("reemplazó entero"))).toBe(true);
  });

  it("el informe en español lista contadores, fotos fallidas y landings", async () => {
    const { informe } = await correr();
    const md = informeEnMarkdown(informe);
    expect(md).toContain("Simulación");
    expect(md).toContain("/los15depia");
    expect(md).toContain(FOTO_ROTA);
    expect(md).toMatch(/Artículos.*2 nuevos/);
  });
});

describe("ayudas", () => {
  it("fecha argentina → UTC", () => {
    expect(fechaArgentinaAUtc("2024-01-27T19:36").toISOString()).toBe("2024-01-27T22:36:00.000Z");
  });

  it("slug de artículo: limpio del plan, o el de Alboom recortado a 60 en un guion", () => {
    expect(slugDeArticulo({ alboomId: "446766", slugAlboom: "que-es-compramelafoto-2-2", titulo: "x" })).toBe("que-es-comprame-la-foto");
    expect(slugDeArticulo({ alboomId: "320993", slugAlboom: "servicioqr", titulo: "x" })).toBe("servicioqr");
    const largo = slugDeArticulo({
      alboomId: "45061",
      slugAlboom: "entrevista-enfoque-creativo-a-dnxfotografia-alboom-flujo-de-trabajo-empresa-de-fotografia-argentina-rosario-volga",
      titulo: "x",
    });
    expect(largo.length).toBeLessThanOrEqual(60);
    expect(largo).toBe("entrevista-enfoque-creativo-a-dnxfotografia-alboom-flujo-de");
    expect(recortarSlug("abc", 60)).toBe("abc");
  });
});
