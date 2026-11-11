import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

process.env.NEXT_PUBLIC_APP_URL = "https://fotoffice.test";

const C = await import("./correos");
const M = await import("./motor");
const { CLAVE_AJUSTES_BUSCADOR, gastoDelMes } = await import("./gasto");
import type { Candidato, DatoConFuente } from "./contactos";
import type { DepsCorreos } from "./correos";
import type { buscarCorreo } from "./web";

const AHORA = new Date("2026-11-10T15:00:00.000Z");
const USO = { entrada: 1000, salida: 200, busquedas: 2 };
/** 1000 × 2/1e6 + 200 × 10/1e6 + 2 × 0,01 = USD 0,024. */
const MICROS_USO = 24_000;

type Contacto = Record<string, unknown> & { id: string; email: string | null; claveEmail: string | null };
type Evento = { contactoId: string; tipo: string; datos: Record<string, unknown> | null; autor: string };
const contactos = () => B.datos.dnxContacto as unknown as Contacto[];
const eventos = (tipo = "BUSQUEDA_CORREO") => (B.datos.dnxContactoEvento as unknown as Evento[]).filter((e) => e.tipo === tipo);
const porId = (id: string) => contactos().find((c) => c.id === id)!;

let n = 0;
function contacto(extra: Record<string, unknown> = {}): string {
  n++;
  const fila = B.agregar("dnxContacto", {
    tipo: "FOTOGRAFO", nichos: ["SOCIAL"], nombre: `Estudio ${n}`, ciudad: "Rosario", provincia: "Santa Fe", region: "CENTRO",
    instagram: `estudio${n}`, creadoPor: "BUSCADOR", creadoEn: new Date(AHORA.getTime() - (100 - n) * 60_000), ...extra,
  });
  return fila.id as string;
}

function ajustes(valor: Record<string, unknown> = {}) {
  const value = JSON.stringify({ topeGoogleUsd: 20, topeClaudeUsd: 30, pausado: false, avisoTope: {}, ...valor });
  const fila = B.datos.systemSettings.find((f) => f.key === CLAVE_AJUSTES_BUSCADOR);
  if (fila) fila.value = value;
  else B.agregar("systemSettings", { key: CLAVE_AJUSTES_BUSCADOR, value });
}

const correoDe = (email: string, fuenteUrl = "https://www.instagram.com/x"): DatoConFuente => ({ valor: email, fuente: "SITIO_PROPIO", fuenteUrl });

/** Búsqueda falsa con Claude: devuelve `email@<id>.com`… salvo que se diga otra cosa. */
function armar(extra: Partial<DepsCorreos> = {}, respuesta?: (nombre: string) => Awaited<ReturnType<typeof buscarCorreo>>) {
  const vistos: string[] = [];
  const sitios: string[] = [];
  const deps: DepsCorreos = {
    ahora: () => AHORA,
    reloj: () => 0,
    hasta: 600_000,
    sitio: async (web) => {
      sitios.push(web);
      return null;
    },
    buscar: async (c) => {
      vistos.push(c.nombre);
      if (respuesta) return respuesta(c.nombre);
      const local = c.nombre.toLowerCase().replace(/\s+/g, "");
      return { email: correoDe(`${local}@gmail.com`), uso: USO };
    },
    ...extra,
  };
  return { deps, vistos, sitios };
}

beforeEach(() => {
  B.vaciar();
  n = 0;
  ajustes();
});

describe("contactosSinCorreo", () => {
  it("primero los fotógrafos escolares o de turismo (en cualquier posición), después los otros fotógrafos, después los demás", async () => {
    const club = contacto({ tipo: "CLUB", nichos: ["ESCOLAR"] });
    const social = contacto({ nichos: ["SOCIAL"] });
    const turismo = contacto({ nichos: ["DEPORTIVA", "TURISTICA"] });
    const escolar = contacto({ nichos: ["SOCIAL", "EVENTOS", "ESCOLAR"] });
    const lista = await C.contactosSinCorreo(10);
    expect(lista.map((c) => c.id)).toEqual([turismo, escolar, social, club]);
  });

  it("deja afuera los que tienen correo, fusionados, NO_CONTACTAR, DESCARTADO y sin web ni redes", async () => {
    contacto({ email: "ya@tiene.com.ar" });
    contacto({ fusionadoEnId: "otro" });
    contacto({ estado: "NO_CONTACTAR" });
    contacto({ estado: "DESCARTADO" });
    contacto({ instagram: null });
    const bien = contacto({ instagram: null, facebook: "https://www.facebook.com/estudio" });
    expect((await C.contactosSinCorreo(10)).map((c) => c.id)).toEqual([bien]);
  });

  it("no repite uno ya intentado; uno que quedó para reintentar vuelve, hasta 3 veces", async () => {
    const hecho = contacto();
    const reintentar = contacto();
    const agotado = contacto();
    B.agregar("dnxContactoEvento", { contactoId: hecho, tipo: "BUSQUEDA_CORREO", autor: "BUSCADOR", datos: { resultado: "SIN_CORREO" } });
    B.agregar("dnxContactoEvento", { contactoId: reintentar, tipo: "BUSQUEDA_CORREO", autor: "BUSCADOR", datos: { resultado: "REINTENTAR" } });
    for (let i = 0; i < 3; i++) {
      B.agregar("dnxContactoEvento", { contactoId: agotado, tipo: "BUSQUEDA_CORREO", autor: "BUSCADOR", datos: { resultado: "REINTENTAR" } });
    }
    expect((await C.contactosSinCorreo(10)).map((c) => c.id)).toEqual([reintentar]);
  });
});

describe("completarCorreos", () => {
  it("completa el correo, deja el dato con su fuente y no lo repite en la corrida siguiente", async () => {
    const id = contacto({ telefono: "341 555 1234", nombre: "Estudio Luz" });
    const { deps, vistos } = armar();
    const r = await C.completarCorreos(deps);
    expect(r).toEqual({ intentados: 1, completados: 1, frenadoPor: null });
    expect(porId(id)).toMatchObject({ email: "estudioluz@gmail.com", claveEmail: "estudioluz@gmail.com", telefono: "341 555 1234", nombre: "Estudio Luz" });
    expect(B.datos.dnxContactoDato).toEqual([
      expect.objectContaining({ contactoId: id, campo: "email", valor: "estudioluz@gmail.com", fuente: "SITIO_PROPIO", fuenteUrl: "https://www.instagram.com/x" }),
    ]);
    expect(eventos("DATO_NUEVO")).toHaveLength(1);
    expect(eventos()[0]!.datos).toMatchObject({ resultado: "COMPLETADO", via: "CLAUDE", costoClaudeUsdMicros: MICROS_USO });
    // No se crean contactos nuevos.
    expect(contactos()).toHaveLength(1);

    const otra = await C.completarCorreos(deps);
    expect(otra.intentados).toBe(0);
    expect(vistos).toHaveLength(1);
  });

  it("toma como mucho 5 por corrida, en orden de prioridad", async () => {
    for (let i = 0; i < 4; i++) contacto({ tipo: "CLUB", nichos: [] });
    const escolares = [contacto({ nichos: ["ESCOLAR"] }), contacto({ nichos: ["TURISTICA"] })];
    const { deps } = armar();
    const r = await C.completarCorreos(deps);
    expect(r.intentados).toBe(C.MAX_CORREOS_POR_CORRIDA);
    expect(eventos().slice(0, 2).map((e) => e.contactoId)).toEqual(escolares);
  });

  it("con web, el correo de la web propia se guarda sin llamar a Claude", async () => {
    const id = contacto({ web: "https://estudioluz.com.ar", instagram: null });
    const { deps, vistos, sitios } = armar({
      sitio: async (web, t) => {
        sitios.push(web);
        expect(t.tipo).toBe("FOTOGRAFO");
        const c: Candidato = {
          tipo: "FOTOGRAFO", nichos: [], nombre: "Estudio Luz", ciudad: "Rosario", provincia: "Santa Fe", region: "CENTRO", creadoPor: "BUSCADOR",
          datos: {
            email: { valor: "hola@estudioluz.com.ar", fuente: "SITIO_PROPIO", fuenteUrl: "https://estudioluz.com.ar/" },
            telefono: { valor: "+543415551234", fuente: "SITIO_PROPIO", fuenteUrl: "https://estudioluz.com.ar/" },
          },
        };
        return c;
      },
    });
    const r = await C.completarCorreos(deps);
    expect(r.completados).toBe(1);
    expect(sitios).toEqual(["https://estudioluz.com.ar"]);
    expect(vistos).toHaveLength(0);
    // Sólo el email: el teléfono de la web no se toca.
    expect(porId(id)).toMatchObject({ email: "hola@estudioluz.com.ar", telefono: null });
    expect(eventos()[0]!.datos).toMatchObject({ resultado: "COMPLETADO", via: "SITIO_PROPIO", costoClaudeUsdMicros: 0 });
  });

  it("con web sin correo legible, recién ahí pregunta a Claude", async () => {
    contacto({ web: "https://estudioluz.com.ar" });
    const { deps, vistos, sitios } = armar();
    await C.completarCorreos(deps);
    expect(sitios).toHaveLength(1);
    expect(vistos).toHaveLength(1);
  });

  it("un correo que ya es de otro contacto no se asigna: queda DUPLICADO", async () => {
    contacto({ email: "estudioluz@gmail.com", claveEmail: "estudioluz@gmail.com", nombre: "El otro" });
    const id = contacto({ nombre: "Estudio Luz" });
    const { deps } = armar();
    const r = await C.completarCorreos(deps);
    expect(r).toMatchObject({ intentados: 1, completados: 0 });
    expect(porId(id).email).toBeNull();
    expect(B.datos.dnxContactoDato).toHaveLength(0);
    expect(eventos()[0]!.datos).toMatchObject({ resultado: "DUPLICADO", email: "estudioluz@gmail.com" });
  });

  it("no pisa un correo que la ficha ganó en el medio", async () => {
    const id = contacto({ nombre: "Estudio Luz" });
    const { deps } = armar({}, () => {
      porId(id).email = "puesto@amano.com.ar";
      return { email: correoDe("estudioluz@gmail.com"), uso: USO };
    });
    const r = await C.completarCorreos(deps);
    expect(r.completados).toBe(0);
    expect(porId(id).email).toBe("puesto@amano.com.ar");
    expect(eventos()[0]!.datos).toMatchObject({ resultado: "YA_TENIA" });
  });

  it("sin correo encontrado, el intento queda anotado con su costo", async () => {
    contacto();
    const { deps } = armar({}, () => ({ email: null, uso: USO }));
    const r = await C.completarCorreos(deps);
    expect(r).toEqual({ intentados: 1, completados: 0, frenadoPor: null });
    expect(eventos()[0]!.datos).toMatchObject({ resultado: "SIN_CORREO", costoClaudeUsdMicros: MICROS_USO });
    // El gasto del mes lo suma.
    expect((await gastoDelMes(AHORA)).claudeUsd).toBeCloseTo(0.024, 6);
  });

  it("Claude caído: no lanza, no gasta el intento y corta el paso", async () => {
    const a = contacto();
    contacto();
    const { deps, vistos } = armar({}, () => ({ email: null, uso: { entrada: 0, salida: 0, busquedas: 0 }, falla: "SERVICIO" }));
    const r = await C.completarCorreos(deps);
    expect(r).toEqual({ intentados: 0, completados: 0, frenadoPor: "CLAUDE_NO_DISPONIBLE" });
    expect(vistos).toHaveLength(1);
    expect(eventos()).toEqual([expect.objectContaining({ contactoId: a, datos: expect.objectContaining({ resultado: "REINTENTAR", falla: "SERVICIO" }) })]);
    // Vuelve a la cola.
    expect((await C.contactosSinCorreo(5)).map((c) => c.id)).toContain(a);
  });

  it("una llamada cortada se anota con el costo estimado", async () => {
    contacto();
    const { deps } = armar({}, () => ({ email: null, uso: { entrada: 0, salida: 0, busquedas: 0 }, falla: "CORTADA" }));
    const r = await C.completarCorreos(deps);
    expect(r.frenadoPor).toBe("TIEMPO");
    // 3 búsquedas × USD 0,01 + el piso de tokens (USD 0,014).
    expect(eventos()[0]!.datos).toMatchObject({ resultado: "REINTENTAR", costoClaudeUsdMicros: 44_000 });
  });

  it("si la búsqueda lanza, no lanza: queda ERROR y sigue con el próximo", async () => {
    contacto({ nombre: "Uno" });
    const dos = contacto({ nombre: "Dos" });
    const { deps } = armar({}, (nombre) => {
      if (nombre === "Uno") throw new Error("explotó");
      return { email: correoDe("dos@gmail.com"), uso: USO };
    });
    const r = await C.completarCorreos(deps);
    expect(r).toMatchObject({ intentados: 2, completados: 1 });
    expect(porId(dos).email).toBe("dos@gmail.com");
    expect(eventos().map((e) => e.datos?.resultado)).toEqual(["ERROR", "COMPLETADO"]);
  });

  it("sin tiempo no empieza ninguno", async () => {
    contacto();
    const { deps, vistos } = armar({ hasta: C.MARGEN_CORREO_MS - 1 });
    const r = await C.completarCorreos(deps);
    expect(r.frenadoPor).toBe("TIEMPO");
    expect(vistos).toHaveLength(0);
  });

  it("frena al llegar al tope de Claude dentro del paso", async () => {
    ajustes({ topeClaudeUsd: 2.02 });
    contacto();
    contacto();
    const { deps, vistos } = armar();
    const r = await C.completarCorreos(deps);
    // Con tope 2,02 y freno 2 antes, entra una llamada (gasta 0,024 y pasa los 0,02) y no otra.
    expect(r.frenadoPor).toBe("TOPE_CLAUDE");
    expect(vistos).toHaveLength(1);
  });
});

describe("el paso en la corrida del Buscador", () => {
  function armarMotor() {
    const mensajes: string[] = [];
    const vistos: string[] = [];
    const deps = {
      ahora: () => AHORA,
      reloj: () => 0,
      telegram: {
        fetch: (async (url: string | URL | Request, init?: RequestInit) => {
          if (String(url).endsWith("/sendMessage")) mensajes.push(String((JSON.parse(String(init?.body)) as { text: string }).text));
          return new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }), { status: 200 });
        }) as typeof fetch,
      },
      destino: async () => ({ token: "123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw", chatId: "555" }),
      claves: () => ({ google: false, claude: true }),
      sitio: async () => null,
      web: {
        descubrir: async () => ({ candidatos: [], uso: USO, descartados: 0 }),
        leer: async () => ({ candidato: null, uso: USO }),
        correo: async (c: { nombre: string }) => {
          vistos.push(c.nombre);
          return { email: correoDe(`${c.nombre.toLowerCase().replace(/\s+/g, "")}@gmail.com`), uso: USO };
        },
      },
    };
    return { deps, mensajes, vistos };
  }

  function sembrarRegiones(estado = "COMPLETA") {
    ["CENTRO", "BUENOS_AIRES_AMBA", "CUYO", "NOA", "NEA", "PATAGONIA"].forEach((r, i) =>
      B.agregar("dnxBuscadorRegion", { region: r, orden: i + 1, estado, iniciadaEn: new Date(AHORA.getTime() - 86_400_000) }),
    );
  }

  it("corre aunque no quede región por recorrer y lo informa en el resultado", async () => {
    sembrarRegiones();
    contacto({ nichos: ["ESCOLAR"] });
    const { deps } = armarMotor();
    const r = await M.correrBuscador({ presupuestoMs: 240_000, motivo: "CRON" }, deps);
    expect(r.frenadoPor).toBe("SIN_REGION");
    expect(r.correos).toEqual({ intentados: 1, completados: 1 });
  });

  it("con el tope de Claude del mes cumplido, el paso no corre", async () => {
    sembrarRegiones();
    B.agregar("dnxBuscadorTarea", {
      region: "PATAGONIA", provincia: "Chubut", ciudad: "Trelew", tipo: "CLUB", nicho: null, fuente: "WEB_SEARCH", consulta: "previo",
      prioridad: 1, estado: "HECHA", hechaEn: AHORA, tomadaEn: AHORA, costoGoogleUsdMicros: 0, costoClaudeUsdMicros: 28_000_000,
    });
    contacto();
    const { deps, vistos, mensajes } = armarMotor();
    const r = await M.correrBuscador({ presupuestoMs: 240_000, motivo: "CRON" }, deps);
    expect(vistos).toHaveLength(0);
    expect(r.correos).toEqual({ intentados: 0, completados: 0 });
    expect(r.frenadoPor).toBe("TOPE_CLAUDE");
    expect(mensajes.some((m) => m.includes("frenó Claude"))).toBe(true);
  });

  it("sin clave de Claude el paso no corre", async () => {
    sembrarRegiones();
    contacto({ web: "https://estudioluz.com.ar" });
    const { deps, vistos } = armarMotor();
    const r = await M.correrBuscador({ presupuestoMs: 240_000, motivo: "CRON" }, { ...deps, claves: () => ({ google: false, claude: false }) });
    expect(vistos).toHaveLength(0);
    expect(r.correos.intentados).toBe(0);
  });

  it("con contactos por intentar, las tareas le guardan tiempo al paso", async () => {
    sembrarRegiones("EN_ESPERA");
    B.datos.dnxBuscadorRegion.find((f) => f.region === "CENTRO")!.estado = "EN_CURSO";
    B.agregar("dnxBuscadorTarea", {
      region: "CENTRO", provincia: "Santa Fe", ciudad: null, tipo: "FOTOGRAFO", nicho: "ESCOLAR", fuente: "WEB_SEARCH",
      consulta: "x", paginas: 1, prioridad: 1, estado: "PENDIENTE", intentos: 0, costoGoogleUsdMicros: 0, costoClaudeUsdMicros: 0,
    });
    contacto();
    const { deps, vistos } = armarMotor();
    // 200 s: sin la reserva de 90 s la tarea web (que pide 120 s) entraría; con la reserva, no.
    const r = await M.correrBuscador({ presupuestoMs: 200_000, motivo: "CRON" }, deps);
    expect(r.procesadas).toBe(0);
    expect(vistos).toHaveLength(1);
  });

  it("el resumen de la región suma la línea de correos completados", async () => {
    sembrarRegiones();
    const a = contacto();
    const b = contacto();
    B.agregar("dnxContactoEvento", { contactoId: a, tipo: "BUSQUEDA_CORREO", autor: "BUSCADOR", datos: { resultado: "COMPLETADO" }, creadoEn: AHORA });
    B.agregar("dnxContactoEvento", { contactoId: b, tipo: "BUSQUEDA_CORREO", autor: "BUSCADOR", datos: { resultado: "SIN_CORREO" }, creadoEn: AHORA });
    B.agregar("dnxContactoEvento", { contactoId: b, tipo: "BUSQUEDA_CORREO", autor: "BUSCADOR", datos: { resultado: "REINTENTAR" }, creadoEn: AHORA });
    // De antes de que empezara la región: no cuenta.
    B.agregar("dnxContactoEvento", {
      contactoId: b, tipo: "BUSQUEDA_CORREO", autor: "BUSCADOR", datos: { resultado: "COMPLETADO" }, creadoEn: new Date(AHORA.getTime() - 3 * 86_400_000),
    });
    const texto = await M.resumenDeRegion("CENTRO");
    expect(texto).toContain("Correos completados: 1 de 2 intentados");
  });
});
