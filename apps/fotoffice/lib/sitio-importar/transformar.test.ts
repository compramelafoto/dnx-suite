import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateContentHtml } from "@repo/content";
import { websiteBlockSchema } from "@/lib/website/blocks";
import { leerArticulo } from "./alboom/articulo";
import { leerPagina } from "./alboom/pagina";
import { htmlArticuloAContenido, normalizarRutaVieja, paginaABloques, reescribirEnlace, type JSONContent } from "./transformar";

const fixture = (nombre: string) => readFileSync(path.join(__dirname, "alboom", "__fixtures__", nombre), "utf8");
const SITIO = "https://www.dnxfotografia.com.ar";

/** Todos los nodos del documento, aplanados. */
function nodos(doc: JSONContent): JSONContent[] {
  const out: JSONContent[] = [];
  const visitar = (n: JSONContent) => {
    out.push(n);
    n.content?.forEach(visitar);
  };
  visitar(doc);
  return out;
}
const enlaces = (doc: JSONContent) =>
  nodos(doc).flatMap((n) => (n.marks ?? []).filter((m) => m.type === "link").map((m) => m.attrs?.href as string));

describe("normalizarRutaVieja / reescribirEnlace", () => {
  it("normaliza mayúsculas, barra final y la consulta de post.php", () => {
    expect(normalizarRutaVieja(`${SITIO}/Portfolio/`)).toBe("/portfolio");
    expect(normalizarRutaVieja("http://dnxfotografia.com.ar/post.php?id=89987&x=1")).toBe("/post.php?id=89987");
    expect(normalizarRutaVieja(`${SITIO}/`)).toBe("/");
    expect(normalizarRutaVieja("https://maps.app.goo.gl/x")).toBeNull();
  });

  it("artículos y trabajos se encuentran también por número", () => {
    const mapa = new Map([
      ["/post.php?id=89987", "/blog/nos-mudamos-a-funes"],
      ["/album.php?id=375817", "/trabajos/fiestas/gise-y-fatu"],
      ["/agenda", "/agenda"],
    ]);
    expect(reescribirEnlace(`${SITIO}/post/89987-tenemos-nuestro-estudio/`, mapa)).toBe("/blog/nos-mudamos-a-funes");
    expect(reescribirEnlace(`${SITIO}/portfolio/fiestas/375817-giseyfatu`, mapa)).toBe("/trabajos/fiestas/gise-y-fatu");
    expect(reescribirEnlace(`${SITIO}/AGENDA`, mapa)).toBe("/agenda");
    // Lo que no está en el mapa queda igual (lo resuelven las redirecciones).
    expect(reescribirEnlace(`${SITIO}/cursos`, mapa)).toBe(`${SITIO}/cursos`);
    expect(reescribirEnlace("https://wa.link/ouegr0", mapa)).toBe("https://wa.link/ouegr0");
  });
});

describe("htmlArticuloAContenido", () => {
  it("89987: párrafos del editor, enlace interno reescrito y el externo intacto, sin vacíos al final", async () => {
    const a = leerArticulo(fixture("articulo-89987.html"), `${SITIO}/post/89987-tenemos-nuestro-estudio-en-funes-santa-fe`);
    const doc = await htmlArticuloAContenido(a.cuerpoHtml, new Map([["/agenda", "/agenda-un-turno"]]));
    expect(doc.type).toBe("doc");
    expect(doc.content?.[0]?.type).toBe("paragraph");
    expect(doc.content?.[0]?.content?.[0]?.text?.startsWith("Mi nombre es Daniel Cuart")).toBe(true);
    expect(enlaces(doc)).toContain("/agenda-un-turno");
    expect(enlaces(doc)).toContain("https://maps.app.goo.gl/nYS6DzjnPb5ZBF5Z9");
    expect(enlaces(doc).some((h) => h.includes("dnxfotografia.com.ar/agenda"))).toBe(false);
    const ultimo = doc.content?.at(-1);
    expect(ultimo?.type === "paragraph" && (ultimo.content ?? []).length > 0).toBe(true);
  });

  it("476452: el iframe de YouTube queda como nodo youtube y los <h1> bajan a <h2>", async () => {
    const a = leerArticulo(fixture("articulo-476452.html"), `${SITIO}/post.php?id=476452`);
    const doc = await htmlArticuloAContenido(a.cuerpoHtml, new Map());
    const videos = nodos(doc).filter((n) => n.type === "youtube");
    expect(videos).toHaveLength(1);
    expect(videos[0].attrs?.src).toContain("HR9pcjM0Cek");
    expect(doc.content?.[0]).toMatchObject({ type: "heading", attrs: { level: 2 } });
    expect(nodos(doc).some((n) => n.type === "heading" && n.attrs?.level === 1)).toBe(false);
    // Y el HTML que arma el blog al guardar dibuja el reproductor.
    expect(await generateContentHtml(doc)).toContain(`src="https://www.youtube.com/embed/HR9pcjM0Cek`);
  });

  it("un video con youtu.be o watch?v= también se convierte", async () => {
    const doc = await htmlArticuloAContenido(`<p>a</p><iframe src="https://www.youtube.com/watch?v=abc123"></iframe>`);
    expect(nodos(doc).find((n) => n.type === "youtube")?.attrs?.src).toContain("abc123");
  });
});

describe("paginaABloques", () => {
  const validos = (bloques: unknown[]) => bloques.every((b) => websiteBlockSchema.safeParse(b).success);

  it("/agenda: intro + 4 citas, cada una con texto, imagen y botón del agendador", () => {
    const bloques = paginaABloques(leerPagina(fixture("agenda.html")));
    expect(validos(bloques)).toBe(true);
    expect(bloques.map((b) => b.type)).toEqual([
      "RICH_TEXT", "IMAGE",
      ...Array.from({ length: 4 }, () => ["RICH_TEXT", "IMAGE", "CTA"]).flat(),
    ]);
    const cita = bloques[2];
    expect(cita.type === "RICH_TEXT" && cita.config.title).toBe("Entrevista Presencial");
    // Saneado: sin estilos en línea ni párrafos vacíos.
    expect(cita.type === "RICH_TEXT" && !cita.config.html.includes("style=")).toBe(true);
    expect(cita.type === "RICH_TEXT" && !/<p>(&nbsp;|\s)*<\/p>/.test(cita.config.html)).toBe(true);
    const cta = bloques[4];
    expect(cta.type === "CTA" && cta.config).toMatchObject({ buttonLabel: "Programar una cita", stylePreset: "solid" });
    expect(bloques.map((b) => b.id)).toEqual(bloques.map((_, i) => `alboom_${i}`));
    expect(bloques.map((b) => b.order)).toEqual(bloques.map((_, i) => i));
  });

  it("/imprimir: un solo bloque de contenido insertado con la tienda de ComprameLaFoto", () => {
    const bloques = paginaABloques(leerPagina(fixture("imprimir.html")));
    expect(bloques).toHaveLength(1);
    expect(bloques[0]).toMatchObject({ type: "EMBED", config: { url: "https://www.compramelafoto.com/dnxestudio2?embed=1", heightPx: 800 } });
  });

  it("/cursoxv: el formulario de Alboom pasa a formulario de presupuesto con su título", () => {
    const bloques = paginaABloques(leerPagina(fixture("cursoxv.html")));
    expect(validos(bloques)).toBe(true);
    const formularios = bloques.filter((b) => b.type === "INQUIRY_FORM");
    expect(formularios).toHaveLength(1);
    expect(formularios[0].type === "INQUIRY_FORM" && formularios[0].config.title?.startsWith("Para Pre-inscribirte")).toBe(true);
  });

  it("/cursos: los botones a páginas viejas se reescriben con el mapa", () => {
    const bloques = paginaABloques(leerPagina(fixture("cursos.html")), {
      mapaEnlaces: new Map([["/fotografia-inicial", "/fotografia-inicial"], ["/cursoxv", "/curso-xv"]]),
      prefijoId: "capacitate",
    });
    expect(validos(bloques)).toBe(true);
    const urls = bloques.flatMap((b) => (b.type === "CTA" ? [b.config.buttonUrl] : []));
    expect(urls).toContain("/fotografia-inicial");
    expect(urls).toContain("/curso-xv");
    expect(urls).toContain("https://wa.link/ouegr0");
    expect(bloques[0].id).toBe("capacitate_0");
  });

  it("3 fotos o más son una galería; un iframe de un sitio no permitido se descarta; YouTube es video", () => {
    const bloques = paginaABloques({
      titulo: "X",
      portadaUrl: null,
      iframes: ["https://evil.example.com/x", "https://www.youtube.com/embed/abc"],
      secciones: [
        {
          titulo: "Fotos",
          html: `<p>Hola <a href="${SITIO}/agenda">turno</a></p><script>alert(1)</script>`,
          imagenes: ["https://a.com/1.jpg", "https://a.com/2.jpg", "https://a.com/3.jpg"],
          botones: [],
          iframes: ["https://evil.example.com/x", "https://www.youtube.com/embed/abc"],
          formulario: false,
        },
      ],
    }, { mapaEnlaces: new Map([["/agenda", "/agenda"]]) });
    expect(bloques.map((b) => b.type)).toEqual(["RICH_TEXT", "GALLERY", "VIDEO"]);
    const texto = bloques[0];
    expect(texto.type === "RICH_TEXT" && texto.config.html).toBe(`<p>Hola <a href="/agenda">turno</a></p>`);
    const galeria = bloques[1];
    expect(galeria.type === "GALLERY" && galeria.config.photos.map((f) => f.url)).toEqual(["https://a.com/1.jpg", "https://a.com/2.jpg", "https://a.com/3.jpg"]);
  });
});
