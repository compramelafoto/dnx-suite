import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fechaAlboomALocal, leerArticulo } from "./articulo";
import { leerGaleria } from "./galeria";
import { urlOriginal } from "./fotos";
import { leerPagina } from "./pagina";
import { esUrlDeTrabajoAlboom, leerTestimonios } from "./testimonios";
import { leerTrabajo } from "./trabajo";

/** HTML real del sitio viejo, bajado el 26/10 (ver `__fixtures__`). */
const fixture = (nombre: string) => readFileSync(path.join(__dirname, "__fixtures__", nombre), "utf8");
const SITIO = "https://www.dnxfotografia.com.ar";

describe("urlOriginal", () => {
  it("saca el recorte de alfred y deja la original de storage", () => {
    expect(
      urlOriginal("https://alfred.alboompro.com/crop/width/600/height/400/mode/jpeg/url/storage.alboom.ninja/sites/8403/albuns/1465286/x.jpg"),
    ).toBe("https://storage.alboom.ninja/sites/8403/albuns/1465286/x.jpg");
  });

  it("también con resize y con el ?t= que rompe la caché", () => {
    expect(urlOriginal("https://alfred.alboompro.com/resize/width/1200/scale/2/url/storage.alboom.ninja/sites/8403/galleries/1/a.JPG?t=15327")).toBe(
      "https://storage.alboom.ninja/sites/8403/galleries/1/a.JPG",
    );
    expect(urlOriginal("https://storage.alboom.ninja/sites/8403/x.jpg?t=1")).toBe("https://storage.alboom.ninja/sites/8403/x.jpg");
    expect(urlOriginal("https://cdn.alboompro.com/a/original_size/b.png?v=1")).toBe("https://cdn.alboompro.com/a/original_size/b.png");
  });

  it("una dirección de otro sitio queda igual", () => {
    expect(urlOriginal("https://otra.com/foto.jpg?x=1")).toBe("https://otra.com/foto.jpg?x=1");
  });
});

describe("fechaAlboomALocal", () => {
  it("«dd/mm/aaaa às hh:mm» → aaaa-mm-ddThh:mm, sin cambiar de zona", () => {
    expect(fechaAlboomALocal("27/01/2024 às 19:36")).toBe("2024-01-27T19:36");
    expect(fechaAlboomALocal("3/2/2020 às 9:05")).toBe("2020-02-03T09:05");
    expect(fechaAlboomALocal("27/01/2024")).toBe("2024-01-27T00:00");
    expect(fechaAlboomALocal("27 Jan 2024")).toBeNull();
    expect(fechaAlboomALocal("40/13/2024")).toBeNull();
  });
});

describe("leerArticulo", () => {
  it("89987: título, fecha, portada y cuerpo", () => {
    const a = leerArticulo(fixture("articulo-89987.html"), `${SITIO}/post/89987-tenemos-nuestro-estudio-en-funes-santa-fe`);
    expect(a.alboomId).toBe("89987");
    expect(a.titulo).toBe("Nos mudamos a Funes!");
    expect(a.fechaLocal).toBe("2024-01-27T19:36");
    expect(a.slugAlboom).toBe("tenemos-nuestro-estudio-en-funes-santa-fe");
    expect(a.categorias).toEqual([]);
    expect(a.portadaUrl).toBe("https://cdn.alboompro.com/5e0a303d7424db0001031c50_65b553b8bbf388000185d5d9/original_size/logo-dnx-amarillo-500px.png");
    expect(a.cuerpoHtml.startsWith("<p>Mi nombre es Daniel Cuart")).toBe(true);
    expect(a.cuerpoHtml).toContain(`<a href="https://www.dnxfotografia.com.ar/agenda"`);
    // Sólo el cuerpo: nada de la barra de compartir que viene después.
    expect(a.cuerpoHtml).not.toContain("share-options");
    expect(a.cuerpoHtml.endsWith("<p><br></p>")).toBe(true);
  });

  it("476452 por post.php: el número sale de la dirección y el slug de la canónica; trae el video", () => {
    const a = leerArticulo(fixture("articulo-476452.html"), `${SITIO}/post.php?id=476452`);
    expect(a.alboomId).toBe("476452");
    expect(a.slugAlboom).toBe("fotografia-escolar-sin-caos-como-ordenar-todo-el-proceso-con-compramelafoto");
    expect(a.titulo).toBe("📸 Fotografía escolar sin caos: cómo ordenar todo el proceso con ComprameLaFoto");
    expect(a.fechaLocal).toBe("2026-04-24T09:03");
    expect(a.cuerpoHtml).toContain(`<iframe src="https://www.youtube.com/embed/HR9pcjM0Cek"`);
  });

  it("sin número en la dirección lo saca del botón de «me gusta»", () => {
    const a = leerArticulo(fixture("articulo-89987.html"), `${SITIO}/post/tenemos-nuestro-estudio-en-funes-santa-fe`);
    expect(a.alboomId).toBe("89987");
  });

  it("una página que no es un artículo falla con un mensaje claro", () => {
    expect(() => leerArticulo(fixture("sobre.html"), `${SITIO}/post/1-x`)).toThrow(/título/);
  });
});

describe("leerTrabajo", () => {
  it("pf1 (Book Emma Pre XV): datos y las 27 fotos originales en orden", () => {
    const t = leerTrabajo(fixture("trabajo-1465286.html"), `${SITIO}/portfolio/books/1465286-book-emma-pre-xv`);
    expect(t).toMatchObject({
      alboomId: "1465286",
      categoriaSlug: "books",
      categoriaNombre: "Books!",
      slugAlboom: "book-emma-pre-xv",
      titulo: "Book Emma Pre XV",
      lugar: "Rosario, Santa Fe",
      fecha: "2025-03-14",
      videos: [],
    });
    expect(t.fotos).toHaveLength(27);
    expect(t.fotos[0]).toBe("https://storage.alboom.ninja/sites/8403/albuns/1465286/copia_de_dn105000.jpg");
    expect(t.fotos.every((f) => f.startsWith("https://storage.alboom.ninja/sites/8403/albuns/1465286/") && !f.includes("?"))).toBe(true);
    // Sin el <p> de más que pone Alboom alrededor.
    expect(t.descripcionHtml.startsWith("<p>&#x1F306;")).toBe(true);
    expect(t.descripcionHtml.endsWith("#FotosXV</p>")).toBe(true);
  });

  it("con /album.php?id= toma la categoría de la canónica", () => {
    const t = leerTrabajo(fixture("trabajo-1465286.html"), `${SITIO}/album.php?id=1465286`);
    expect(t.alboomId).toBe("1465286");
    expect(t.categoriaSlug).toBe("books");
  });
});

describe("leerGaleria", () => {
  it("g1 (Books): 204 fotos originales, sin videos", () => {
    const g = leerGaleria(fixture("galeria-12070.html"), `${SITIO}/gallery/12070-books`);
    expect(g.alboomId).toBe("12070");
    expect(g.titulo).toBe("Books");
    expect(g.fotos).toHaveLength(204);
    expect(g.fotos[0]).toBe("https://storage.alboom.ninja/sites/8403/galleries/12070/img_8464.JPG");
    expect(g.videos).toEqual([]);
  });

  it("los enlaces marcados como video van a videos", () => {
    const html = `<link rel="canonical" href="${SITIO}/gallery/5-x"><h1 class="cg__title">X</h1>
      <a class="cgci__link" data-is-video="false" href="https://storage.alboom.ninja/sites/8403/galleries/5/a.jpg?t=1"></a>
      <a class="cgci__link" data-is-video="true" href="https://www.youtube.com/watch?v=abc"></a>`;
    const g = leerGaleria(html, `${SITIO}/gallery/5-x`);
    expect(g.fotos).toEqual(["https://storage.alboom.ninja/sites/8403/galleries/5/a.jpg"]);
    expect(g.videos).toEqual(["https://www.youtube.com/watch?v=abc"]);
  });
});

describe("leerTestimonios", () => {
  const todos = leerTestimonios(fixture("portada.html"));

  it("la portada tiene 32, el primero de Gise y Fatu con su foto y su trabajo", () => {
    expect(todos).toHaveLength(32);
    expect(todos[0]).toMatchObject({
      nombre: "Gise y Fatu Broun",
      fotoUrl: "https://storage.alboom.ninja/sites/8403/testimonials/gyf.jpg",
      enlace: `${SITIO}/portfolio/fiestas/375817-giseyfatu`,
      trabajoAlboomUrl: `${SITIO}/portfolio/fiestas/375817-giseyfatu`,
    });
    // Texto completo, con los saltos de línea del autor.
    expect(todos[0].texto.startsWith("Gracias Dani por la buena onda")).toBe(true);
    expect(todos[0].texto.split("\n")).toHaveLength(4);
  });

  it("un enlace afuera del sitio es enlace pero no trabajo; sin enlace, ambos null", () => {
    expect(todos[1]).toMatchObject({ nombre: "Andrés Preumayr", enlace: "https://andrespreumayr.com/", trabajoAlboomUrl: null });
    expect(todos[2]).toMatchObject({ nombre: "Romina", enlace: null, trabajoAlboomUrl: null });
    expect(todos.filter((t) => t.trabajoAlboomUrl)).toHaveLength(4);
    expect(todos.every((t) => t.fotoUrl?.startsWith("https://storage.alboom.ninja/sites/8403/testimonials/"))).toBe(true);
  });

  it("decodifica emojis escritos como entidades", () => {
    expect(todos[1].texto.endsWith("Mil gracias Dani!! 🙌🏼🙌🏼")).toBe(true);
  });

  it("esUrlDeTrabajoAlboom", () => {
    expect(esUrlDeTrabajoAlboom(`${SITIO}/album.php?id=293824`)).toBe(true);
    expect(esUrlDeTrabajoAlboom(`${SITIO}/gallery/12070-books`)).toBe(true);
    expect(esUrlDeTrabajoAlboom("https://dnxfotografia.alboompro.com/proof/a/x")).toBe(false);
    expect(esUrlDeTrabajoAlboom(`${SITIO}/portfolio/fiestas`)).toBe(false);
  });
});

describe("leerPagina", () => {
  it("/sobre: una sección con título y texto, y la foto de portada", () => {
    const p = leerPagina(fixture("sobre.html"));
    expect(p.titulo).toBe("Acerca de");
    expect(p.portadaUrl).toBe("https://storage.alboom.ninja/sites/8403/img/sobre/fondo_presupuesto.jpg");
    expect(p.secciones).toHaveLength(1);
    expect(p.secciones[0].titulo).toBe("¿Quién está detrás de DNX FOTOGRAFÍA?");
    expect(p.secciones[0].html.startsWith(`<p style="text-align: center;">Soy fotógrafo de quinceañeras`)).toBe(true);
  });

  it("/agenda: la introducción y los 4 tipos de cita, cada uno con su botón del agendador", () => {
    const p = leerPagina(fixture("agenda.html"));
    expect(p.secciones.map((s) => s.titulo)).toEqual([
      "Agendá un turno.",
      "Entrevista Presencial",
      "Entrevista Online",
      "Sesión Fotográfica en Estudio",
      "Sesión Fotográfica en Exteriores",
    ]);
    const citas = p.secciones.slice(1);
    expect(citas.every((s) => s.botones.length === 1 && s.botones[0].texto === "Programar una cita")).toBe(true);
    expect(citas[0].botones[0].url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/appointments\/schedules\//);
    // Nada del código del agendador se cuela como texto.
    expect(p.secciones.some((s) => s.html.includes("schedulingButton"))).toBe(false);
  });

  it("/cursos: una sección por tarjeta de curso, con su imagen y su botón", () => {
    const p = leerPagina(fixture("cursos.html"));
    const inicial = p.secciones.find((s) => s.titulo === "CURSO DE FOTOGRAFÍA INICIAL");
    expect(inicial?.botones).toEqual([{ texto: "+ INFO", url: `${SITIO}/fotografia-inicial` }]);
    expect(inicial?.imagenes).toEqual(["https://cdn.alboompro.com/5e0a303d7424db0001031c50_677c6d9772b1140001238711/original_size/fotografia-nivel-inicial-2.png"]);
    expect(inicial?.html).toContain("Daniel Cuart");
    expect(p.secciones.some((s) => s.titulo === "Reseñas de algunos de nuestros alumn@s.")).toBe(true);
  });

  it("/cursoxv: detecta el formulario de preinscripción de Alboom", () => {
    const p = leerPagina(fixture("cursoxv.html"));
    expect(p.titulo).toBe("Taller de fotografía de XV");
    expect(p.secciones.filter((s) => s.formulario)).toHaveLength(1);
  });

  it("/imprimir: el iframe de ComprameLaFoto", () => {
    const p = leerPagina(fixture("imprimir.html"));
    expect(p.iframes).toEqual(["https://www.compramelafoto.com/dnxestudio2?embed=1"]);
    expect(p.secciones[0].iframes).toEqual(["https://www.compramelafoto.com/dnxestudio2?embed=1"]);
  });
});
