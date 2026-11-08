import { describe, expect, it } from "vitest";
import { buscarYEscribir, reescribir, textoDeLaFuente, type ClientePeriodista } from "./redactor";

const parrafo = (n: number) => ({ tipo: "parrafo" as const, texto: Array.from({ length: n }, (_, i) => `palabra${i}`).join(" ") });
const nota = {
  fuenteUrl: "https://petapixel.com/2026/11/05/nueva-camara",
  fuenteTitulo: "Nueva cámara",
  fuenteMedio: "PetaPixel",
  titulo: "Una cámara nueva para los que hacen bodas",
  bajada: "La marca presentó un modelo con sensor de alta resolución y video 8K.",
  cuerpo: [parrafo(200), parrafo(200)],
  temaFoto: "casamiento",
  trabajoId: null,
};
const JSON_OK = "```json\n" + JSON.stringify(nota) + "\n```";

type Respuesta = { stop_reason: string; content: unknown[] };
const texto = (t: string, citas: string[] = []) => ({
  type: "text",
  text: t,
  citations: citas.length ? citas.map((c) => ({ type: "web_search_result_location", cited_text: c, url: "https://x.com", title: null, encrypted_index: "e" })) : null,
});

function clienteFalso(respuestas: Respuesta[]) {
  const pedidos: Array<{ body: Record<string, unknown>; opciones?: { timeout?: number } }> = [];
  const cliente: ClientePeriodista = {
    beta: {
      messages: {
        create: async (body, opciones) => {
          // Copia: el código agrega mensajes al mismo arreglo después.
          pedidos.push({ body: JSON.parse(JSON.stringify(body)), opciones });
          const r = respuestas.shift();
          if (!r) throw new Error("sin respuestas");
          return { ...r, usage: { input_tokens: 10, output_tokens: 5, server_tool_use: { web_search_requests: 1 } } } as never;
        },
      },
    },
  };
  return { cliente, pedidos };
}

const base = { hoy: "2026-11-09", excluidas: ["https://ya.usada.com/nota"], trabajos: [{ id: "ck1", titulo: "Casamiento", categoria: "Bodas" }] };
const hasta = () => Date.now() + 200_000;

describe("buscarYEscribir", () => {
  it("pide Sonnet 5.5 con búsqueda web (máx. 5) y sigue después de un pause_turn", async () => {
    const { cliente, pedidos } = clienteFalso([
      { stop_reason: "pause_turn", content: [{ type: "server_tool_use", id: "s1", name: "web_search", input: { query: "fotografía" } }] },
      { stop_reason: "end_turn", content: [texto(JSON_OK, ["la nueva cámara incorpora un sensor"])] },
    ]);
    const r = await buscarYEscribir({ ...base, hasta: hasta() }, { cliente });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.valor.titulo).toBe(nota.titulo);
      expect(r.extractos).toEqual(["la nueva cámara incorpora un sensor"]);
      expect(r.uso).toEqual({ entrada: 20, salida: 10, busquedas: 2 });
    }
    expect(pedidos).toHaveLength(2);
    const primero = pedidos[0]!.body;
    expect(primero.model).toBe("claude-sonnet-5-5");
    expect(primero.tools).toEqual([expect.objectContaining({ type: "web_search_20260209", name: "web_search", max_uses: 5 })]);
    expect(JSON.stringify(primero.messages)).toContain("https://ya.usada.com/nota");
    expect(JSON.stringify(primero.messages)).toContain("ck1 · Casamiento (Bodas)");
    // La segunda vuelta reenvía lo que vino (el turno pausado).
    const mensajes = pedidos[1]!.body.messages as Array<{ role: string }>;
    expect(mensajes.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("si el JSON no sirve, se lo pide corregido una vez", async () => {
    const { cliente, pedidos } = clienteFalso([
      { stop_reason: "end_turn", content: [texto("```json\n{\"titulo\": \"x\"}\n```")] },
      { stop_reason: "end_turn", content: [texto(JSON_OK)] },
    ]);
    const r = await buscarYEscribir({ ...base, hasta: hasta() }, { cliente });
    expect(r.ok).toBe(true);
    const mensajes = pedidos[1]!.body.messages as Array<{ role: string; content: unknown }>;
    expect(mensajes.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(String(mensajes[2]!.content)).toMatch(/no sirve todavía/);
  });

  it("dos veces mal: falla con el motivo", async () => {
    const { cliente } = clienteFalso([
      { stop_reason: "end_turn", content: [texto("nada")] },
      { stop_reason: "end_turn", content: [texto("tampoco")] },
    ]);
    const r = await buscarYEscribir({ ...base, hasta: hasta() }, { cliente });
    expect(r.ok === false && r.motivo).toMatch(/formato pedido/);
  });

  it("rechazo, corte por largo, error de la API o sin clave: falla sin lanzar", async () => {
    expect((await buscarYEscribir({ ...base, hasta: hasta() }, { cliente: clienteFalso([{ stop_reason: "refusal", content: [] }]).cliente })).ok).toBe(false);
    expect((await buscarYEscribir({ ...base, hasta: hasta() }, { cliente: clienteFalso([{ stop_reason: "max_tokens", content: [texto("{")] }]).cliente })).ok).toBe(false);
    expect((await buscarYEscribir({ ...base, hasta: hasta() }, { cliente: clienteFalso([]).cliente })).ok).toBe(false);
    const sinClave = await buscarYEscribir({ ...base, hasta: hasta() }, { cliente: null });
    expect(sinClave.ok === false && sinClave.motivo).toMatch(/ANTHROPIC_API_KEY/);
  });

  it("sin tiempo no llama", async () => {
    const { cliente, pedidos } = clienteFalso([]);
    const r = await buscarYEscribir({ ...base, hasta: Date.now() + 1000 }, { cliente });
    expect(r.ok).toBe(false);
    expect(pedidos).toHaveLength(0);
  });
});

describe("reescribir", () => {
  it("sin búsqueda web, con la nota y el pedido de Daniel", async () => {
    const { cliente, pedidos } = clienteFalso([
      { stop_reason: "end_turn", content: [texto(JSON.stringify({ titulo: nota.titulo, bajada: nota.bajada, cuerpo: nota.cuerpo }))] },
    ]);
    const r = await reescribir({ nota, fuente: { titulo: "Nueva cámara", url: nota.fuenteUrl }, pedido: "nombrá a la SFPR", hasta: hasta() }, { cliente });
    expect(r.ok).toBe(true);
    expect(pedidos[0]!.body.tools).toBeUndefined();
    expect(JSON.stringify(pedidos[0]!.body.messages)).toContain("nombrá a la SFPR");
  });
});

describe("textoDeLaFuente", () => {
  it("baja la página y devuelve el texto; si falla, vacío", async () => {
    const ok = (async () => new Response("<p>Hola &amp; chau</p>", { headers: { "content-type": "text/html" } })) as unknown as typeof fetch;
    expect(await textoDeLaFuente("https://x.com/a", { fetch: ok })).toBe("Hola & chau");
    const pdf = (async () => new Response("%PDF", { headers: { "content-type": "application/pdf" } })) as unknown as typeof fetch;
    expect(await textoDeLaFuente("https://x.com/a", { fetch: pdf })).toBe("");
    const roto = (async () => {
      throw new Error("red");
    }) as unknown as typeof fetch;
    expect(await textoDeLaFuente("https://x.com/a", { fetch: roto })).toBe("");
  });
});
