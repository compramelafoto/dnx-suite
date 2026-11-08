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

process.env.NEXT_PUBLIC_APP_URL = "https://fotoffice.test";

const F = await import("./flujo");
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
  temaFoto: "casamiento",
  trabajoId: "trabajo-elegido",
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

function deps(respuestas: unknown[], ahora = LUNES_9) {
  const c = claude(respuestas);
  const api = botApi();
  return {
    c,
    api,
    d: { fetch: api.f, ahora: () => ahora, destino: async () => DESTINO, redactor: { cliente: c.cliente, fetch: sinPagina } },
  };
}

beforeEach(() => {
  B.vaciar();
  blog.creados.length = 0;
  blog.cambios.length = 0;
  blog.borrados.length = 0;
  B.agregar("fotofficeTrabajoCategoria", { id: "cat-bodas", workspaceId: WS, nombre: "Bodas" });
  // La categoría Noticias ya existe (en la base real el id es numérico; la base en memoria inventa ids de texto).
  B.agregar("blogCategory", { id: 7, platform: "fotoffice", workspaceKey: WS, name: "Noticias", slug: "noticias" });
  B.agregar("fotofficeTrabajo", { id: "trabajo-elegido", workspaceId: WS, titulo: "Casamiento de Ana y Juan", categoriaId: "cat-bodas", estado: "PUBLICADO", portadaUrl: "/uploads/ana.jpg", fecha: null, orden: 0 });
});

const filas = () => B.tablas.fotofficeAgentePropuesta.findMany({}) as Promise<Array<Record<string, unknown>>>;

describe("correrPeriodista", () => {
  it("crea el borrador en Noticias con la foto del portfolio y manda la propuesta con foto y botones", async () => {
    const { d, api, c } = deps([respuesta(notaDeClaude())]);
    const r = await F.correrPeriodista({ motivo: "CRON" }, d);
    expect(r).toMatchObject({ estado: "CREADA" });

    const [p] = await filas();
    expect(p).toMatchObject({ estado: "PENDIENTE", workspaceId: WS, fuenteUrl: "https://petapixel.com/2026/11/05/nueva-camara", blogPostId: 100, telegramMessageId: "701" });

    expect(blog.creados).toHaveLength(1);
    const post = blog.creados[0]!;
    expect(post).toMatchObject({ title: "Una cámara nueva para los que hacen bodas", status: "DRAFT", heroImageUrl: "https://fotoffice.test/uploads/ana.jpg", workspaceKey: WS });
    expect(post.categoryId).toBe(7);
    expect(JSON.stringify(post.contentJson)).toContain("https://www.petapixel.com/2026/11/05/nueva-camara/?utm_source=x");

    const foto = api.llamadas.find((l) => l.metodo === "sendPhoto")!;
    expect(foto.cuerpo).toMatchObject({ chat_id: "555", photo: "https://fotoffice.test/uploads/ana.jpg", parse_mode: "HTML" });
    expect(String(foto.cuerpo.caption).length).toBeLessThanOrEqual(1024);
    expect(String(foto.cuerpo.caption)).toContain("https://fotoffice.test/website/blog/100");
    expect(JSON.stringify(foto.cuerpo.reply_markup)).toContain(`pe:p:${p!.id}`);
    // A Claude se le pasó la lista de trabajos.
    expect(JSON.stringify(c.pedidos[0]!.messages)).toContain("trabajo-elegido · Casamiento de Ana y Juan (Bodas)");
  });

  it("idempotente: si ya hay una del día, el cron no hace nada; a mano sí; y nunca más de 3 por día", async () => {
    const primero = deps([respuesta(notaDeClaude())]);
    await F.correrPeriodista({ motivo: "CRON" }, primero.d);

    const segundo = deps([]);
    expect((await F.correrPeriodista({ motivo: "CRON" }, segundo.d)).estado).toBe("YA_HAY");
    expect(segundo.c.pedidos).toHaveLength(0);

    const manual = deps([respuesta(notaDeClaude({ fuenteUrl: "https://ejemplo.com.ar/otra-nota" }))]);
    expect((await F.correrPeriodista({ motivo: "MANUAL", forzar: true }, manual.d)).estado).toBe("CREADA");

    await B.tablas.fotofficeAgentePropuesta.create({ data: { agente: "PERIODISTA", estado: "FALLO", workspaceId: WS, creadaEn: LUNES_9 } });
    const cuarto = deps([]);
    expect((await F.correrPeriodista({ motivo: "OTRA", forzar: true }, cuarto.d)).estado).toBe("TOPE");
    expect(cuarto.c.pedidos).toHaveLength(0);

    // Al otro día vuelve a correr.
    const martes = deps([], new Date("2026-11-10T12:00:00.000Z"));
    martes.d.redactor.cliente = claude([respuesta(notaDeClaude({ fuenteUrl: "https://ejemplo.com.ar/tercera" }))]).cliente;
    expect((await F.correrPeriodista({ motivo: "CRON" }, martes.d)).estado).toBe("CREADA");
  });

  it("no repite una noticia ya usada (aunque venga con otra forma): falla y avisa", async () => {
    await B.tablas.fotofficeAgentePropuesta.create({
      data: { agente: "PERIODISTA", estado: "PUBLICADA", workspaceId: WS, fuenteUrl: "https://petapixel.com/2026/11/05/nueva-camara", creadaEn: new Date("2026-11-02T12:00:00.000Z") },
    });
    const { d, api, c } = deps([respuesta(notaDeClaude())]);
    const r = await F.correrPeriodista({ motivo: "CRON" }, d);
    expect(r.estado).toBe("FALLO");
    expect(JSON.stringify(c.pedidos[0]!.messages)).toContain("https://petapixel.com/2026/11/05/nueva-camara");
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
    expect((await filas())[0]).toMatchObject({ estado: "PUBLICADA" });
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
    expect((await filas())[0]).toMatchObject({ estado: "DESCARTADA" });
    expect(blog.borrados).toEqual([100]);
    expect((await F.publicarPropuesta(id)).ok).toBe(false);
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
    const nueva = api.llamadas.find((l) => l.metodo === "sendPhoto")!;
    expect(String(nueva.cuerpo.caption)).toContain("versión 2");
    expect(api.llamadas.find((l) => l.metodo === "editMessageReplyMarkup")!.cuerpo).toMatchObject({ message_id: 701 });
    const [p] = await filas();
    expect(p).toMatchObject({ correcciones: 1, telegramMessageId: "702" });
    // Responder al mensaje viejo también encuentra la propuesta.
    const otra = deps([respuesta(reescrita)]);
    await F.corregirPropuesta("701", "más corto", otra.d);
    expect((await filas())[0]).toMatchObject({ correcciones: 2 });
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
