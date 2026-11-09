import { describe, expect, it } from "vitest";
import type { ClienteClaude } from "../claude";
import type { LugarPlaces } from "./places";
import { descubrirEnProvincia, leerLugar, validarCandidato } from "./web";

type Respuesta = { stop_reason: string; content: unknown[] };
const texto = (t: string) => ({ type: "text", text: t, citations: null });
const json = (o: unknown) => texto("```json\n" + JSON.stringify(o) + "\n```");

/** Cliente falso de Claude (mismo patrón que `periodista/redactor.test.ts`). */
function clienteFalso(respuestas: Respuesta[]) {
  const pedidos: Array<Record<string, unknown>> = [];
  const cliente: ClienteClaude = {
    beta: {
      messages: {
        create: async (body) => {
          pedidos.push(JSON.parse(JSON.stringify(body)) as Record<string, unknown>);
          const r = respuestas.shift();
          if (!r) throw new Error("sin respuestas");
          return { ...r, usage: { input_tokens: 10, output_tokens: 5, server_tool_use: { web_search_requests: 1 } } } as never;
        },
      },
    },
  };
  return { cliente, pedidos };
}

const fin = (contenido: unknown): Respuesta => ({ stop_reason: "end_turn", content: [json(contenido)] });

const tarea = { provincia: "Santa Fe", region: "CENTRO" as const, tipo: "FOTOGRAFO" as const, nicho: "ESCOLAR" };

/** Un candidato tal como lo arma el código antes de validar. */
function bruto(datos: Record<string, unknown>) {
  return {
    tipo: "FOTOGRAFO", nichos: ["ESCOLAR"], nombre: "Estudio Luz", ciudad: "Rosario", provincia: "Santa Fe",
    region: "CENTRO", creadoPor: "BUSCADOR", datos,
  };
}

describe("descubrirEnProvincia", () => {
  it("descubrir devuelve candidatos válidos con su fuente", async () => {
    const { cliente, pedidos } = clienteFalso([
      fin({
        candidatos: [
          {
            nombre: "Estudio Luz",
            ciudad: "Rosario",
            datos: {
              web: { valor: "https://www.estudioluz.com.ar", fuenteUrl: "https://www.estudioluz.com.ar/" },
              email: { valor: "Hola@EstudioLuz.com.ar", fuenteUrl: "https://estudioluz.com.ar/contacto" },
              telefono: { valor: "0341 155-123456", fuenteUrl: "https://directoriofotos.com/rosario" },
              instagram: { valor: "https://instagram.com/estudioluz", fuenteUrl: "https://www.instagram.com/estudioluz/" },
              facebook: null,
            },
          },
        ],
      }),
    ]);
    const r = await descubrirEnProvincia(tarea, { cliente });
    expect(r.descartados).toBe(0);
    expect(r.candidatos).toHaveLength(1);
    const c = r.candidatos[0]!;
    expect(c).toMatchObject({
      tipo: "FOTOGRAFO", nichos: ["ESCOLAR"], nombre: "Estudio Luz", ciudad: "Rosario", provincia: "Santa Fe",
      region: "CENTRO", creadoPor: "BUSCADOR",
    });
    expect(c.datos.web).toEqual({ valor: "https://www.estudioluz.com.ar", fuente: "SITIO_PROPIO", fuenteUrl: "https://www.estudioluz.com.ar/" });
    expect(c.datos.email).toEqual({ valor: "hola@estudioluz.com.ar", fuente: "SITIO_PROPIO", fuenteUrl: "https://estudioluz.com.ar/contacto" });
    // Visto en un directorio: dato de terceros.
    expect(c.datos.telefono?.fuente).toBe("WEB_SEARCH");
    expect(c.datos.instagram?.fuente).toBe("SITIO_PROPIO");
    expect(c.datos.facebook).toBeUndefined();
    // Búsqueda web con tope de 5 y el pedido habla de la provincia.
    const primero = pedidos[0]!;
    expect(primero.tools).toEqual([expect.objectContaining({ name: "web_search", max_uses: 5 })]);
    expect(JSON.stringify(primero.messages)).toContain("Santa Fe");
    expect(String((primero.system as Array<{ text: string }>)[0]!.text)).toMatch(/NUNCA inventes/);
  });

  it("cuenta los descartados y no se cae si Claude falla", async () => {
    const { cliente } = clienteFalso([
      fin({ candidatos: [{ nombre: "Sin datos", ciudad: "Rosario", datos: {} }, { nombre: "", datos: {} }] }),
    ]);
    const r = await descubrirEnProvincia(tarea, { cliente });
    expect(r.candidatos).toEqual([]);
    expect(r.descartados).toBe(2);

    const roto = clienteFalso([]);
    const r2 = await descubrirEnProvincia(tarea, { cliente: roto.cliente });
    expect(r2.candidatos).toEqual([]);
    expect(r2.descartados).toBe(0);
    expect(r2.uso.entrada).toBe(0);
  });
});

describe("validarCandidato", () => {
  it("descarta el email de un dominio ajeno", () => {
    const r = validarCandidato(
      bruto({
        web: { valor: "estudioluz.com.ar", fuenteUrl: "https://estudioluz.com.ar" },
        email: { valor: "contacto@directoriofotos.com", fuenteUrl: "https://directoriofotos.com/rosario" },
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.candidato.datos.email).toBeUndefined();
      expect(r.candidato.datos.web?.valor).toBe("estudioluz.com.ar");
    }
  });

  it("acepta gmail aunque la web sea propia", () => {
    const r = validarCandidato(
      bruto({
        web: { valor: "https://estudioluz.com.ar", fuenteUrl: "https://estudioluz.com.ar" },
        email: { valor: "estudioluz@gmail.com", fuenteUrl: "https://estudioluz.com.ar/contacto" },
      }),
    );
    expect(r.ok && r.candidato.datos.email?.valor).toBe("estudioluz@gmail.com");
  });

  it("descarta datos sin fuenteUrl", () => {
    const r = validarCandidato(
      bruto({
        web: { valor: "https://estudioluz.com.ar", fuenteUrl: "https://estudioluz.com.ar" },
        email: { valor: "estudioluz@gmail.com" },
        telefono: { valor: "0341 155-123456", fuenteUrl: null },
        instagram: { valor: "@estudioluz", fuenteUrl: "javascript:alert(1)" },
        facebook: { valor: "https://facebook.com/estudioluz", fuenteUrl: "data:text/html,hola" },
        whatsapp: { valor: "341155123456", fuenteUrl: "ftp://estudioluz.com.ar" },
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.keys(r.candidato.datos)).toEqual(["web"]);
  });

  it("descarta un teléfono ilegible y el email inválido", () => {
    const r = validarCandidato(
      bruto({
        web: { valor: "https://estudioluz.com.ar", fuenteUrl: "https://estudioluz.com.ar" },
        telefono: { valor: "llamanos", fuenteUrl: "https://estudioluz.com.ar" },
        email: { valor: "no es un correo", fuenteUrl: "https://estudioluz.com.ar" },
      }),
    );
    expect(r.ok && Object.keys(r.candidato.datos)).toEqual(["web"]);
  });

  it("guarda teléfono y WhatsApp normalizados, nunca el texto del modelo", () => {
    const r = validarCandidato(
      bruto({
        telefono: { valor: "0341 155-551234 (llamanos!)", fuenteUrl: "https://estudioluz.com.ar" },
        whatsapp: { valor: "javascript:alert(1)//wa.me/5493415551234", fuenteUrl: "https://estudioluz.com.ar" },
      }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.candidato.datos.telefono?.valor).toBe("+543415551234");
      expect(r.candidato.datos.whatsapp?.valor).toBe("https://wa.me/543415551234");
    }
    const r2 = validarCandidato(bruto({ whatsapp: { valor: "341 155551234", fuenteUrl: "https://estudioluz.com.ar" } }));
    expect(r2.ok && r2.candidato.datos.whatsapp?.valor).toBe("https://wa.me/543415551234");
  });

  it("descarta el candidato sin ningún dato de contacto", () => {
    const r = validarCandidato(
      bruto({
        email: { valor: "contacto@directoriofotos.com", fuenteUrl: "https://directoriofotos.com/rosario" },
        web: null,
      }),
    );
    expect(r.ok).toBe(false);
    expect(validarCandidato("cualquier cosa").ok).toBe(false);
    expect(validarCandidato({ ...bruto({}), tipo: "MARCIANO" }).ok).toBe(false);
  });
});

describe("leerLugar", () => {
  const lugar: LugarPlaces = {
    placeId: "ChIJ123", nombre: "Estudio Luz", web: "https://estudioluz.com.ar", direccion: "Córdoba 1000, Rosario", lat: null, lng: null,
  };
  const t = { ciudad: "Rosario", provincia: "Santa Fe", region: "CENTRO" as const, tipo: "FOTOGRAFO" as const, nicho: null };

  it("leerLugar no guarda nada con fuente Google y lleva el placeId", async () => {
    const { cliente, pedidos } = clienteFalso([
      fin({
        candidato: {
          nombre: "Estudio Luz",
          datos: {
            web: { valor: "https://estudioluz.com.ar", fuenteUrl: "https://estudioluz.com.ar/", fuente: "GOOGLE_PLACES" },
            telefono: { valor: "0341 4123456", fuenteUrl: "https://www.google.com/maps/place/Estudio+Luz" },
            whatsapp: { valor: "https://wa.me/5493415123456", fuenteUrl: "https://maps.app.goo.gl/abc" },
            email: { valor: "hola@estudioluz.com.ar", fuenteUrl: "https://estudioluz.com.ar/contacto" },
          },
        },
      }),
    ]);
    const r = await leerLugar(lugar, t, { cliente });
    expect(r.candidato).not.toBeNull();
    const c = r.candidato!;
    expect(c.googlePlaceId).toBe("ChIJ123");
    expect(c.lat ?? null).toBeNull();
    expect(c.lng ?? null).toBeNull();
    expect(c.ciudad).toBe("Rosario");
    expect(c.nichos).toEqual([]);
    expect(Object.keys(c.datos).sort()).toEqual(["email", "web"]);
    for (const d of Object.values(c.datos)) {
      expect(d!.fuente).toBe("SITIO_PROPIO");
      expect(d!.fuenteUrl).not.toMatch(/google|goo\.gl/);
    }
    const primero = pedidos[0]!;
    expect(primero.tools).toEqual([expect.objectContaining({ name: "web_search", max_uses: 3 })]);
    expect(JSON.stringify(primero.messages)).toContain("https://estudioluz.com.ar");
  });

  it("sin web pide buscar por nombre y ciudad; si Claude no encuentra, null", async () => {
    const { cliente, pedidos } = clienteFalso([fin({ candidato: null })]);
    const r = await leerLugar({ ...lugar, web: null }, t, { cliente });
    expect(r.candidato).toBeNull();
    expect(JSON.stringify(pedidos[0]!.messages)).toContain("buscá su sitio o su perfil por el nombre y la ciudad");
    expect(r.uso.entrada).toBe(10);
  });

  it("si el modelo no devuelve nombre, leerLugar no usa el de Places", async () => {
    const { cliente } = clienteFalso([
      fin({ candidato: { nombre: "  ", datos: { web: { valor: "https://estudioluz.com.ar", fuenteUrl: "https://estudioluz.com.ar" } } } }),
    ]);
    const r = await leerLugar(lugar, t, { cliente });
    expect(r.candidato).toBeNull();
    expect(r.uso.entrada).toBe(10);
  });

  it("suma el uso de Claude de todas las vueltas", async () => {
    const { cliente } = clienteFalso([
      { stop_reason: "pause_turn", content: [{ type: "server_tool_use", id: "s1", name: "web_search", input: { query: "estudio luz" } }] },
      { stop_reason: "end_turn", content: [texto("no hay json acá")] },
      fin({ candidato: { nombre: "Estudio Luz", datos: { web: { valor: "https://estudioluz.com.ar", fuenteUrl: "https://estudioluz.com.ar" } } } }),
    ]);
    const r = await leerLugar(lugar, t, { cliente });
    expect(r.candidato?.datos.web?.fuente).toBe("SITIO_PROPIO");
    // Tres respuestas: la pausada, la que no tenía JSON y la corregida.
    expect(r.uso.entrada).toBe(30);
    expect(r.uso.salida).toBe(15);
    expect(r.uso.busquedas).toBe(3);
    expect(r.uso.costoUsd).toBeGreaterThan(0);
  });
});
