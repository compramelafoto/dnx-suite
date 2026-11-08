import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

// El blog real pasa por @repo/content (Tiptap → HTML, transacciones): acá alcanza con anotar.
const blog = vi.hoisted(() => ({ creados: [] as Record<string, unknown>[], cambios: [] as Array<{ id: number; data: Record<string, unknown> }>, borrados: [] as number[] }));
vi.mock("@/lib/blog/admin-queries", () => ({
  createBlogPost: async (workspaceKey: string, data: Record<string, unknown>) => {
    const id = blog.creados.length + 100;
    blog.creados.push({ ...data, workspaceKey });
    await B.tablas.blogPost.create({ data: { id, platform: "fotoffice", workspaceKey, slug: data.slug, title: data.title, status: data.status } });
    return { id };
  },
  updateBlogPost: async (_ws: string, id: number, data: Record<string, unknown>) => {
    blog.cambios.push({ id, data });
    return { id };
  },
  deleteBlogPost: async (_ws: string, id: number) => {
    blog.borrados.push(id);
    return true;
  },
}));

// La subida real va a R2 y anota en BlogMedia: las pruebas pasan `subirImagen`.
vi.mock("@/lib/blog/storage", () => ({ uploadBlogImage: async () => ({ ok: false, error: "no se usa en las pruebas" }) }));

process.env.NEXT_PUBLIC_APP_URL = "https://fotoffice.test";

const F = await import("./flujo");
import type { SubirImagen } from "./flujo";
import type { ClientePeriodista } from "./redactor";

const WS = "cmv5z6qxwwmmhf0q5gp8qja1j";
const DESTINO = { token: "123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw", chatId: "555" };
const LUNES_9 = new Date("2026-11-09T12:00:00.000Z");

const parrafo = (n: number, prefijo = "palabra") => ({ tipo: "parrafo" as const, texto: Array.from({ length: n }, (_, i) => `${prefijo}${i}`).join(" ") });
const notaDeClaude = (extra: Record<string, unknown> = {}) => ({
  fuenteUrl: "https://www.petapixel.com/2026/11/05/nueva-camara/?utm_source=x",
  fuenteTitulo: "New camera announced",
  fuenteMedio: "PetaPixel",
  titulo: "Una cámara nueva para los que hacen bodas",
  bajada: "La marca presentó un modelo con sensor de alta resolución y video 8K.",
  cuerpo: [parrafo(200), { tipo: "subtitulo", texto: "Qué cambia" }, parrafo(200, "otra")],
  tema: "Nueva cámara de 60 MP para bodas",
  categoria: "equipos y lanzamientos",
  ...extra,
});
const respuesta = (obj: unknown, citas: string[] = []) => ({
  stop_reason: "end_turn",
  content: [
    {
      type: "text",
      text: "```json\n" + JSON.stringify(obj) + "\n```",
      citations: citas.length ? citas.map((c) => ({ type: "web_search_result_location", cited_text: c, url: "https://x.com", title: null, encrypted_index: "e" })) : null,
    },
  ],
});

function claude(respuestas: unknown[]) {
  const pedidos: Array<Record<string, unknown>> = [];
  return {
    pedidos,
    cliente: {
      beta: {
        messages: {
          create: async (body: Record<string, unknown>) => {
            pedidos.push(JSON.parse(JSON.stringify(body)));
            const r = respuestas.shift();
            if (!r) throw new Error("sin respuestas");
            return { ...(r as object), usage: { input_tokens: 1, output_tokens: 1 } } as never;
          },
        },
      },
    } as unknown as ClientePeriodista,
  };
}

function botApi() {
  const llamadas: { metodo: string; cuerpo: Record<string, unknown> }[] = [];
  let siguiente = 700;
  const f = (async (url: string, init?: RequestInit) => {
    const metodo = String(url).split("/").pop()!;
    llamadas.push({ metodo, cuerpo: JSON.parse(String(init?.body ?? "{}")) });
    const result = metodo === "sendMessage" || metodo === "sendPhoto" ? { message_id: ++siguiente } : true;
    return new Response(JSON.stringify({ ok: true, result }), { status: 200 });
  }) as typeof fetch;
  return { f, llamadas };
}

const sinPagina = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;

/** La página de la noticia (con su og:image) y la imagen misma. */
function webConImagen() {
  const pedidas: string[] = [];
  const f = (async (url: string) => {
    pedidas.push(String(url));
    if (String(url).endsWith("/portada.jpg")) return new Response(new Uint8Array(2048), { headers: { "content-type": "image/jpeg" } });
    return new Response('<head><meta property="og:image" content="https://cdn.petapixel.com/portada.jpg"><meta property="og:site_name" content="PetaPixel"></head><p>Texto de la nota original.</p>', {
      headers: { "content-type": "text/html" },
    });
  }) as unknown as typeof fetch;
  return { f, pedidas };
}

function deps(respuestas: unknown[], ahora = LUNES_9) {
  const c = claude(respuestas);
  const api = botApi();
  const subidas: Array<{ nombre: string; tipo: string; titulo: string; alt: string; bytes: number }> = [];
  return {
    c,
    api,
    subidas,
    d: {
      fetch: api.f,
      ahora: () => ahora,
      destino: async () => DESTINO,
      redactor: { cliente: c.cliente, fetch: sinPagina },
      subirImagen: (async (i) => {
        subidas.push({ nombre: i.nombre, tipo: i.tipo, titulo: i.titulo, alt: i.alt, bytes: i.bytes.byteLength });
        return `https://r2.fotoffice.test/blog-hero/${i.workspaceId}/${i.nombre}`;
      }) as SubirImagen,
    },
  };
}

beforeEach(() => {
  B.vaciar();
  blog.creados.length = 0;
  blog.cambios.length = 0;
  blog.borrados.length = 0;
  // La categoría Noticias ya existe (en la base real el id es numérico; la base en memoria inventa ids de texto).
  B.agregar("blogCategory", { id: 7, platform: "fotoffice", workspaceKey: WS, name: "Noticias", slug: "noticias" });
});

const filas = () => B.tablas.fotofficeAgentePropuesta.findMany({}) as Promise<Array<Record<string, unknown>>>;

describe("correrPeriodista", () => {
  it("crea el borrador en Noticias con la foto de la NOTICIA (copiada a R2, con crédito) y la manda con foto y botones", async () => {
    const { d, api, c, subidas } = deps([respuesta(notaDeClaude())]);
    const web = webConImagen();
    d.redactor.fetch = web.f;
    const r = await F.correrPeriodista({ motivo: "CRON" }, d);
    expect(r).toMatchObject({ estado: "CREADA" });

    // La página se baja una sola vez (texto + og:image) y después la imagen.
    expect(web.pedidas).toEqual(["https://www.petapixel.com/2026/11/05/nueva-camara/?utm_source=x", "https://cdn.petapixel.com/portada.jpg"]);
    expect(subidas).toEqual([{ nombre: "periodista-cdn.petapixel.com.jpg", tipo: "image/jpeg", titulo: "Foto: PetaPixel", alt: "Una cámara nueva para los que hacen bodas", bytes: 2048 }]);
    const nuestra = `https://r2.fotoffice.test/blog-hero/${WS}/periodista-cdn.petapixel.com.jpg`;

    const [p] = await filas();
    expect(p).toMatchObject({ estado: "PENDIENTE", workspaceId: WS, fuenteUrl: "https://petapixel.com/2026/11/05/nueva-camara", blogPostId: 100, telegramMessageId: "701" });
    const datos = p!.datos as Record<string, unknown>;
    expect(datos).toMatchObject({
      tema: "Nueva cámara de 60 MP para bodas",
      categoria: "equipos y lanzamientos",
      foto: { url: nuestra, original: "https://cdn.petapixel.com/portada.jpg", credito: { texto: "PetaPixel", enlace: "petapixel.com" } },
    });
    expect(datos).not.toHaveProperty("trabajo");
    expect((datos.uso as { costoUsd: number }).costoUsd).toBeGreaterThan(0);

    expect(blog.creados).toHaveLength(1);
    const post = blog.creados[0]!;
    expect(post).toMatchObject({ title: "Una cámara nueva para los que hacen bodas", status: "DRAFT", heroImageUrl: nuestra, ogImageUrl: nuestra, workspaceKey: WS });
    expect(post.categoryId).toBe(7);
    const contenido = JSON.stringify(post.contentJson);
    expect(contenido).toContain("https://www.petapixel.com/2026/11/05/nueva-camara/?utm_source=x");
    expect(contenido).toContain("Foto: PetaPixel — ");

    const foto = api.llamadas.find((l) => l.metodo === "sendPhoto")!;
    expect(foto.cuerpo).toMatchObject({ chat_id: "555", photo: nuestra, parse_mode: "HTML" });
    expect(String(foto.cuerpo.caption).length).toBeLessThanOrEqual(1024);
    expect(String(foto.cuerpo.caption)).toContain("https://fotoffice.test/website/blog/100");
    expect(String(foto.cuerpo.caption)).toContain("Foto: PetaPixel");
    expect(JSON.stringify(foto.cuerpo.reply_markup)).toContain(`pe:p:${p!.id}`);
    // Ya no se habla de portfolio con Claude.
    expect(JSON.stringify(c.pedidos[0])).not.toMatch(/trabajoId|portfolio/);
  });

  it("si la noticia no tiene imagen usable, la nota va sin foto (nada del portfolio) y el mensaje es texto", async () => {
    const { d, api, subidas } = deps([respuesta(notaDeClaude())]);
    expect((await F.correrPeriodista({ motivo: "CRON" }, d)).estado).toBe("CREADA");
    expect(subidas).toHaveLength(0);
    expect(blog.creados[0]).toMatchObject({ heroImageUrl: null });
    expect(JSON.stringify(blog.creados[0]!.contentJson)).not.toContain("Foto:");
    expect(api.llamadas.some((l) => l.metodo === "sendPhoto")).toBe(false);
    expect(String(api.llamadas.find((l) => l.metodo === "sendMessage")!.cuerpo.text)).toContain("Sin foto");
    expect(((await filas())[0]!.datos as Record<string, unknown>).foto).toBeNull();
  });

  it("si la subida a nuestro almacenamiento falla, también va sin foto", async () => {
    const { d, api } = deps([respuesta(notaDeClaude())]);
    d.redactor.fetch = webConImagen().f;
    d.subirImagen = async () => null;
    expect((await F.correrPeriodista({ motivo: "CRON" }, d)).estado).toBe("CREADA");
    expect(blog.creados[0]).toMatchObject({ heroImageUrl: null });
    expect(api.llamadas.some((l) => l.metodo === "sendPhoto")).toBe(false);
  });

  it("le pasa a Claude los temas de los últimos 45 días (con énfasis en los descartados de hoy) y los gustos", async () => {
    const vieja = { agente: "PERIODISTA", workspaceId: WS };
    await B.tablas.fotofficeAgentePropuesta.create({ data: { ...vieja, estado: "DESCARTADA", creadaEn: new Date("2026-11-09T11:00:00.000Z"), datos: { motivo: "CRON", tema: "World Press Photo 2026 en Barcelona", categoria: "muestras y exposiciones", resultado: "OTRA" } } });
    await B.tablas.fotofficeAgentePropuesta.create({ data: { ...vieja, estado: "PUBLICADA", creadaEn: new Date("2026-10-20T12:00:00.000Z"), datos: { motivo: "CRON", tema: "Concurso Fotográfico Rosario 2026", categoria: "concursos y premios", correccionesPedidas: ["más corto"] } } });
    await B.tablas.fotofficeAgentePropuesta.create({ data: { ...vieja, estado: "PUBLICADA", creadaEn: new Date("2026-08-01T12:00:00.000Z"), datos: { motivo: "CRON", tema: "Tema de agosto que ya no cuenta" } } });
    await B.tablas.fotofficeAgentePropuesta.create({ data: { ...vieja, estado: "FALLO", creadaEn: new Date("2026-11-08T12:00:00.000Z"), datos: { motivo: "CRON", tema: "Uno que falló" } } });
    const { d, c } = deps([respuesta(notaDeClaude())]);
    expect((await F.correrPeriodista({ motivo: "OTRA", forzar: true }, d)).estado).toBe("CREADA");
    const pedido = (c.pedidos[0]!.messages as Array<{ content: string }>)[0]!.content;
    expect(pedido).toMatch(/Daniel descartó HOY estos temas[^]*World Press Photo 2026 en Barcelona/);
    expect(pedido).toContain("- Concurso Fotográfico Rosario 2026 (publicada)");
    expect(pedido).not.toContain("Tema de agosto");
    expect(pedido).not.toContain("Uno que falló");
    expect(pedido).toContain("Publicó: concursos y premios (1).");
    expect(pedido).toContain("Al corregir suele pedir: notas más cortas (1).");
  });

  it("si elige el mismo tema que uno reciente (otro medio, mismo hecho), le pide otra elección una vez", async () => {
    await B.tablas.fotofficeAgentePropuesta.create({
      data: { agente: "PERIODISTA", estado: "DESCARTADA", workspaceId: WS, creadaEn: new Date("2026-11-09T11:00:00.000Z"), fuenteUrl: "https://elpais.com/wpp", datos: { motivo: "CRON", tema: "World Press Photo 2026 en Barcelona" } },
    });
    const repetida = notaDeClaude({ fuenteUrl: "https://lavanguardia.com/wpp-barcelona", tema: "La exposición World Press Photo abre en Barcelona" });
    const { d, c } = deps([respuesta(repetida), respuesta(notaDeClaude())]);
    expect((await F.correrPeriodista({ motivo: "OTRA", forzar: true }, d)).estado).toBe("CREADA");
    expect(c.pedidos).toHaveLength(2);
    expect(JSON.stringify(c.pedidos[1]!.messages)).toContain("ya habías elegido «La exposición World Press Photo abre en Barcelona» y no sirve (es el mismo tema que «World Press Photo 2026 en Barcelona»");
    const nueva = (await filas()).find((f) => f.estado === "PENDIENTE")!;
    expect((nueva.datos as Record<string, unknown>).tema).toBe("Nueva cámara de 60 MP para bodas");
    // El uso de las dos búsquedas queda sumado.
    expect((nueva.datos as { uso: { entrada: number } }).uso.entrada).toBe(2);
  });

  it("si insiste con el mismo tema, falla y avisa", async () => {
    await B.tablas.fotofficeAgentePropuesta.create({
      data: { agente: "PERIODISTA", estado: "PUBLICADA", workspaceId: WS, creadaEn: new Date("2026-11-02T12:00:00.000Z"), datos: { motivo: "CRON", tema: "World Press Photo 2026 en Barcelona" } },
    });
    const repetida = notaDeClaude({ tema: "World Press Photo en Barcelona" });
    const { d, api } = deps([respuesta(repetida), respuesta(repetida)]);
    const r = await F.correrPeriodista({ motivo: "CRON" }, d);
    expect(r.estado).toBe("FALLO");
    expect(r.mensaje).toContain("insistió");
    expect(blog.creados).toHaveLength(0);
    expect(String(api.llamadas.find((l) => l.metodo === "sendMessage")!.cuerpo.text)).toContain("no pudo preparar la nota");
  });

  it("idempotente: si ya hay una del día, el cron no hace nada; a mano sí; y nunca más de 3 por día", async () => {
    const primero = deps([respuesta(notaDeClaude())]);
    await F.correrPeriodista({ motivo: "CRON" }, primero.d);

    const segundo = deps([]);
    expect((await F.correrPeriodista({ motivo: "CRON" }, segundo.d)).estado).toBe("YA_HAY");
    expect(segundo.c.pedidos).toHaveLength(0);

    const manual = deps([respuesta(notaDeClaude({ fuenteUrl: "https://ejemplo.com.ar/otra-nota", tema: "Muestra de Annemarie Heinrich en Rosario", titulo: "Annemarie Heinrich vuelve a Rosario con una muestra" }))]);
    expect((await F.correrPeriodista({ motivo: "MANUAL", forzar: true }, manual.d)).estado).toBe("CREADA");

    await B.tablas.fotofficeAgentePropuesta.create({ data: { agente: "PERIODISTA", estado: "FALLO", workspaceId: WS, creadaEn: LUNES_9 } });
    const cuarto = deps([]);
    expect((await F.correrPeriodista({ motivo: "OTRA", forzar: true }, cuarto.d)).estado).toBe("TOPE");
    expect(cuarto.c.pedidos).toHaveLength(0);

    // Al otro día vuelve a correr.
    const martes = deps([], new Date("2026-11-10T12:00:00.000Z"));
    martes.d.redactor.cliente = claude([respuesta(notaDeClaude({ fuenteUrl: "https://ejemplo.com.ar/tercera", tema: "Convocatoria del Salón Nacional de Fotografía", titulo: "Abrió la convocatoria del Salón Nacional" }))]).cliente;
    expect((await F.correrPeriodista({ motivo: "CRON" }, martes.d)).estado).toBe("CREADA");
  });

  it("no repite una noticia ya usada (aunque venga con otra forma): falla y avisa", async () => {
    await B.tablas.fotofficeAgentePropuesta.create({
      data: { agente: "PERIODISTA", estado: "PUBLICADA", workspaceId: WS, fuenteUrl: "https://petapixel.com/2026/11/05/nueva-camara", creadaEn: new Date("2026-11-02T12:00:00.000Z") },
    });
    // Elige la ya usada, se le pide otra y vuelve a elegirla: falla.
    const { d, api, c } = deps([respuesta(notaDeClaude()), respuesta(notaDeClaude())]);
    const r = await F.correrPeriodista({ motivo: "CRON" }, d);
    expect(r.estado).toBe("FALLO");
    expect(c.pedidos).toHaveLength(2);
    expect(JSON.stringify(c.pedidos[0]!.messages)).toContain("https://petapixel.com/2026/11/05/nueva-camara");
    expect(JSON.stringify(c.pedidos[1]!.messages)).toContain("esa noticia ya la habíamos usado");
    expect(api.llamadas.find((l) => l.metodo === "sendMessage")!.cuerpo.text).toContain("no pudo preparar la nota");
    expect(blog.creados).toHaveLength(0);
    expect((await filas()).find((f) => f.estado === "FALLO" && f.creadaEn instanceof Date && (f.creadaEn as Date) >= LUNES_9)).toBeTruthy();
  });

  it("si copia frases de la fuente, le pide reescribirlas una vez", async () => {
    const copiada = parrafo(200).texto;
    const reescrita = { titulo: "Una cámara nueva para los que hacen bodas", bajada: notaDeClaude().bajada as string, cuerpo: [parrafo(200, "propia"), parrafo(200, "otra")] };
    const { d, c } = deps([respuesta(notaDeClaude(), [copiada]), respuesta(reescrita)]);
    const r = await F.correrPeriodista({ motivo: "CRON" }, d);
    expect(r.estado).toBe("CREADA");
    expect(c.pedidos).toHaveLength(2);
    expect(c.pedidos[1]!.tools).toBeUndefined();
    expect(JSON.stringify(blog.creados[0]!.contentJson)).toContain("propia0");
  });

  it("si sigue copiando después de reescribir, falla", async () => {
    const copiada = parrafo(200).texto;
    const igual = { titulo: "Una cámara nueva para los que hacen bodas", bajada: notaDeClaude().bajada as string, cuerpo: [parrafo(200), parrafo(200, "otra")] };
    const { d } = deps([respuesta(notaDeClaude(), [copiada]), respuesta(igual)]);
    expect((await F.correrPeriodista({ motivo: "CRON" }, d)).estado).toBe("FALLO");
    expect(blog.creados).toHaveLength(0);
  });

  it("sin canal listo no hace nada", async () => {
    const { d, c } = deps([]);
    expect((await F.correrPeriodista({ motivo: "CRON" }, { ...d, destino: async () => null })).estado).toBe("SIN_CANAL");
    expect(c.pedidos).toHaveLength(0);
    expect(await filas()).toHaveLength(0);
  });
});

async function propuestaCreada() {
  const { d } = deps([respuesta(notaDeClaude())]);
  const r = await F.correrPeriodista({ motivo: "CRON" }, d);
  return r.propuestaId!;
}

describe("publicar y descartar", () => {
  it("Publicar programa el borrador para hoy 11:00 AR; un segundo toque no hace nada", async () => {
    const id = await propuestaCreada();
    const r = await F.publicarPropuesta(id, { ahora: () => new Date("2026-11-09T12:10:00.000Z") });
    expect(r).toEqual({ ok: true, texto: "✅ Aprobada: sale publicada hoy a las 11:00." });
    expect(blog.cambios).toEqual([{ id: 100, data: expect.objectContaining({ status: "PUBLISHED", publishedAt: new Date("2026-11-09T14:00:00.000Z") }) }]);
    expect((await filas())[0]).toMatchObject({ estado: "PUBLICADA", datos: expect.objectContaining({ resultado: "PUBLICADA", tema: "Nueva cámara de 60 MP para bodas" }) });
    expect((await F.publicarPropuesta(id)).ok).toBe(false);
    expect(blog.cambios).toHaveLength(1);
  });

  it("aprobada después de las 11 sale enseguida", async () => {
    const id = await propuestaCreada();
    const ahora = new Date("2026-11-09T16:00:00.000Z");
    const r = await F.publicarPropuesta(id, { ahora: () => ahora });
    expect(r.texto).toContain("ahora mismo");
    expect(blog.cambios[0]!.data.publishedAt).toEqual(ahora);
  });

  it("Descartar deja la propuesta DESCARTADA y borra el borrador", async () => {
    const id = await propuestaCreada();
    expect((await F.descartarPropuesta(id)).ok).toBe(true);
    expect((await filas())[0]).toMatchObject({ estado: "DESCARTADA", datos: expect.objectContaining({ resultado: "DESCARTADA" }) });
    expect(blog.borrados).toEqual([100]);
    expect((await F.publicarPropuesta(id)).ok).toBe(false);
  });

  it("«Otra noticia» descarta y deja anotado el resultado OTRA (para aprender)", async () => {
    const id = await propuestaCreada();
    expect((await F.descartarPropuesta(id, { otra: true })).ok).toBe(true);
    expect((await filas())[0]).toMatchObject({ estado: "DESCARTADA", datos: expect.objectContaining({ resultado: "OTRA", categoria: "equipos y lanzamientos" }) });
  });
});

describe("corregirPropuesta", () => {
  const reescrita = { titulo: "Una cámara nueva que nombra a la SFPR", bajada: "La marca presentó un modelo con sensor de alta resolución y video 8K.", cuerpo: [parrafo(200, "sfpr"), parrafo(200, "otra")] };

  it("respondiendo al mensaje: reescribe, actualiza el borrador y manda la versión nueva", async () => {
    await propuestaCreada();
    const { d, api, c } = deps([respuesta(reescrita)]);
    await F.corregirPropuesta("701", "nombrá a la SFPR", d);
    expect(JSON.stringify(c.pedidos[0]!.messages)).toContain("nombrá a la SFPR");
    expect(blog.cambios[0]).toMatchObject({ id: 100, data: expect.objectContaining({ title: "Una cámara nueva que nombra a la SFPR" }) });
    // Sin foto de la noticia, la versión nueva va como texto.
    const nueva = api.llamadas.find((l) => l.metodo === "sendMessage" && String(l.cuerpo.text).includes("Periodista"))!;
    expect(String(nueva.cuerpo.text)).toContain("versión 2");
    expect(api.llamadas.find((l) => l.metodo === "editMessageReplyMarkup")!.cuerpo).toMatchObject({ message_id: 701 });
    const [p] = await filas();
    expect(p).toMatchObject({ correcciones: 1, telegramMessageId: "702" });
    // Se aprende el pedido y se suma lo gastado en la corrección (1 + 1 tokens de entrada).
    expect(p!.datos).toMatchObject({ correccionesPedidas: ["nombrá a la SFPR"], uso: { entrada: 2, salida: 2 } });
    // Responder al mensaje viejo también encuentra la propuesta.
    const otra = deps([respuesta(reescrita)]);
    await F.corregirPropuesta("701", "más corto", otra.d);
    expect((await filas())[0]).toMatchObject({ correcciones: 2, datos: expect.objectContaining({ correccionesPedidas: ["nombrá a la SFPR", "más corto"] }) });
  });

  it("con foto de la noticia, la versión corregida mantiene la foto y su crédito", async () => {
    const primero = deps([respuesta(notaDeClaude())]);
    primero.d.redactor.fetch = webConImagen().f;
    await F.correrPeriodista({ motivo: "CRON" }, primero.d);
    const { d, api } = deps([respuesta(reescrita)]);
    await F.corregirPropuesta("701", "nombrá a la SFPR", d);
    expect(api.llamadas.find((l) => l.metodo === "sendPhoto")!.cuerpo.photo).toBe(`https://r2.fotoffice.test/blog-hero/${WS}/periodista-cdn.petapixel.com.jpg`);
    expect(JSON.stringify(blog.cambios[0]!.data.contentJson)).toContain("Foto: PetaPixel — ");
  });

  it("tope de 5 correcciones", async () => {
    await propuestaCreada();
    await B.tablas.fotofficeAgentePropuesta.updateMany({ where: {}, data: { correcciones: 5 } });
    const { d, api, c } = deps([]);
    await F.corregirPropuesta("701", "otra vez", d);
    expect(c.pedidos).toHaveLength(0);
    expect(String(api.llamadas[0]!.cuerpo.text)).toContain("tope");
  });

  it("a un mensaje que no es de una propuesta pendiente le contesta que no la encontró", async () => {
    const { d, api } = deps([]);
    await F.corregirPropuesta("999", "hola", d);
    expect(String(api.llamadas[0]!.cuerpo.text)).toContain("No encontré");
  });
});

describe("página Agentes", () => {
  it("lista tema, categoría, foto y costo; resume gustos y suma el costo del mes", async () => {
    await propuestaCreada();
    await B.tablas.fotofficeAgentePropuesta.create({
      data: { agente: "PERIODISTA", estado: "PUBLICADA", workspaceId: WS, creadaEn: new Date("2026-11-03T12:00:00.000Z"), datos: { motivo: "CRON", categoria: "concursos y premios", uso: { entrada: 1_000_000, salida: 0, busquedas: 0 } } },
    });
    await B.tablas.fotofficeAgentePropuesta.create({
      data: { agente: "PERIODISTA", estado: "PUBLICADA", workspaceId: WS, creadaEn: new Date("2026-10-30T12:00:00.000Z"), datos: { motivo: "CRON", uso: { entrada: 1_000_000, salida: 0, busquedas: 0 } } },
    });
    const lista = (await F.ultimasPropuestas())!;
    expect(lista[0]).toMatchObject({ tema: "Nueva cámara de 60 MP para bodas", categoria: "equipos y lanzamientos", conFoto: false, resultado: null });
    expect(lista[0]!.costoUsd).toBeGreaterThan(0);

    const gustos = (await F.gustosDelPeriodista())!;
    expect(gustos.lineas).toContain("Publicó: concursos y premios (1).");

    const mes = (await F.costoDelMes(LUNES_9))!;
    // La de octubre no entra; la de noviembre cuesta USD 2 + lo poquito de la corrida de prueba.
    expect(mes.corridas).toBe(2);
    expect(mes.costoUsd).toBeGreaterThanOrEqual(2);
    expect(mes.costoUsd).toBeLessThan(2.01);
  });
});
