import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));

process.env.NEXT_PUBLIC_APP_URL = "https://fotoffice.test";

const M = await import("./motor");
const { CLAVE_AJUSTES_BUSCADOR } = await import("./gasto");
import type { Candidato } from "./contactos";
import type { DepsMotor } from "./motor";
import type { LugarPlaces } from "./places";
import type { REGIONES } from "./tipos";

type Tarea = {
  id: string; region: string; fuente: string; estado: string; intentos: number; tomadaEn: Date | null; hechaEn: Date | null;
  costoGoogleUsdMicros: number; costoClaudeUsdMicros: number; resultado: Record<string, unknown> | null;
};
type FilaRegion = { region: string; estado: string; completadaEn: Date | null; resumenEnviadoEn: Date | null };

const AHORA = new Date("2026-11-10T15:00:00.000Z");
const tareas = () => B.datos.dnxBuscadorTarea as unknown as Tarea[];
const regiones = () => B.datos.dnxBuscadorRegion as unknown as FilaRegion[];
const tareaPorId = (id: string) => tareas().find((t) => t.id === id)!;
const region = (r: string) => regiones().find((x) => x.region === r)!;

const ORDEN: Array<(typeof REGIONES)[number]> = ["CENTRO", "BUENOS_AIRES_AMBA", "CUYO", "NOA", "NEA", "PATAGONIA"];

function sembrarRegiones(enCurso: string | null = "CENTRO") {
  ORDEN.forEach((r, i) => B.agregar("dnxBuscadorRegion", { region: r, orden: i + 1, estado: r === enCurso ? "EN_CURSO" : "EN_ESPERA" }));
}

let n = 0;
function agregarTarea(extra: Record<string, unknown> = {}): string {
  n++;
  const fila = B.agregar("dnxBuscadorTarea", {
    region: "CENTRO", provincia: "Santa Fe", ciudad: extra.fuente === "WEB_SEARCH" ? null : `Ciudad ${n}`, tipo: "FOTOGRAFO",
    nicho: "ESCOLAR", fuente: "GOOGLE_PLACES", consulta: `consulta ${n}`, paginas: 1, prioridad: 1, ...extra,
  });
  return fila.id as string;
}

/** Escribe los ajustes del Buscador (pisa la fila si ya está). */
function ajustes(valor: Record<string, unknown>) {
  const value = JSON.stringify({ topeGoogleUsd: 20, topeClaudeUsd: 30, pausado: false, avisoTope: {}, ...valor });
  const fila = B.datos.systemSettings.find((f) => f.key === CLAVE_AJUSTES_BUSCADOR);
  if (fila) fila.value = value;
  else B.agregar("systemSettings", { key: CLAVE_AJUSTES_BUSCADOR, value });
}

/** Gasto ya hecho este mes (en otra región, terminada). */
function gastoPrevio(micros: { google?: number; claude?: number; llamadas?: number }) {
  B.agregar("dnxBuscadorTarea", {
    region: "PATAGONIA", provincia: "Chubut", ciudad: "Trelew", tipo: "CLUB", nicho: null, fuente: "GOOGLE_PLACES", consulta: "previo",
    prioridad: 1, estado: "HECHA", hechaEn: AHORA, tomadaEn: AHORA, costoGoogleUsdMicros: micros.google ?? 0,
    costoClaudeUsdMicros: micros.claude ?? 0, resultado: micros.llamadas ? { llamadas: { TEXT_SEARCH_ENTERPRISE: micros.llamadas } } : null,
  });
}

const USO = { entrada: 100, salida: 50, busquedas: 1 };
const lugar = (i: number, web: string | null = null): LugarPlaces => ({ placeId: `places/${i}`, nombre: `Nombre de Google ${i}`, web, direccion: "Calle 1", lat: null, lng: null });

function candidato(nombre: string, extra: Partial<Candidato> = {}): Candidato {
  const dominio = nombre.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com.ar";
  return {
    tipo: "FOTOGRAFO", nichos: ["ESCOLAR"], nombre, ciudad: "Rosario", provincia: "Santa Fe", region: "CENTRO", creadoPor: "BUSCADOR",
    datos: {
      web: { valor: `https://${dominio}`, fuente: "SITIO_PROPIO", fuenteUrl: `https://${dominio}/` },
      email: { valor: `hola@${dominio}`, fuente: "SITIO_PROPIO", fuenteUrl: `https://${dominio}/contacto` },
    },
    ...extra,
  };
}

/** Deps falsos: Telegram anota los mensajes; reloj y ahora fijos salvo que se pidan. */
function armarDeps(extra: Partial<DepsMotor> = {}) {
  const mensajes: string[] = [];
  const telegram = {
    fetch: (async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith("/sendMessage")) mensajes.push(String((JSON.parse(String(init?.body)) as { text: string }).text));
      return new Response(JSON.stringify({ ok: true, result: { message_id: mensajes.length } }), { status: 200 });
    }) as typeof fetch,
  };
  let k = 0;
  const llamadas = { places: 0, descubrir: 0, leer: 0, sitio: 0 };
  const deps: DepsMotor = {
    ahora: () => AHORA,
    reloj: () => 0,
    places: async () => {
      llamadas.places++;
      return { lugares: [], llamadas: { TEXT_SEARCH_ENTERPRISE: 1 } };
    },
    web: {
      descubrir: async () => {
        llamadas.descubrir++;
        k++;
        return { candidatos: [candidato(`Web ${k}`)], uso: USO, descartados: 0 };
      },
      leer: async (l) => {
        llamadas.leer++;
        return { candidato: candidato(`Leido ${l.placeId}`, { googlePlaceId: l.placeId }), uso: USO };
      },
    },
    sitio: async () => {
      llamadas.sitio++;
      return null;
    },
    telegram,
    destino: async () => ({ token: "123456789:AAHdqTcvCH1vGWJxfSeofSAs0K5PALDsaw", chatId: "555" }),
    claves: () => ({ google: true, claude: true }),
    ...extra,
  };
  return { deps, mensajes, llamadas };
}

const correr = (deps: DepsMotor, presupuestoMs = 600_000) => M.correrBuscador({ presupuestoMs, motivo: "CRON" }, deps);

beforeEach(() => {
  B.vaciar();
  n = 0;
  // Sin fila de ajustes el Buscador arranca en pausa: las pruebas lo quieren andando.
  ajustes({});
});

describe("correrBuscador", () => {
  it("procesa tareas hasta agotar el presupuesto de tiempo", async () => {
    sembrarRegiones();
    for (let i = 0; i < 5; i++) agregarTarea({ fuente: "WEB_SEARCH", provincia: `Provincia ${i}` });
    let reloj = 0;
    const { deps } = armarDeps({ reloj: () => reloj });
    const descubrir = deps.web!.descubrir;
    deps.web = { ...deps.web!, descubrir: async (...a) => { reloj += 1000; return descubrir(...a); } };
    // 120 s de margen para empezar una búsqueda web + 2,5 s: entran tres de un segundo cada una.
    const r = await correr(deps, 122_500);
    expect(r.procesadas).toBe(3);
    expect(r.nuevos).toBe(3);
    expect(r.frenadoPor).toBeNull();
    expect(tareas().filter((t) => t.estado === "HECHA")).toHaveLength(3);
    expect(tareas().filter((t) => t.estado === "PENDIENTE")).toHaveLength(2);
    expect(region("CENTRO").estado).toBe("EN_CURSO");
  });

  it("una tarea tomada por otra corrida no se procesa dos veces", async () => {
    sembrarRegiones();
    const tomada = agregarTarea({ fuente: "WEB_SEARCH", estado: "EN_CURSO", tomadaEn: new Date(AHORA.getTime() - 5 * 60_000), intentos: 1 });
    const { deps, llamadas } = armarDeps();
    const r = await correr(deps);
    expect(r.procesadas).toBe(0);
    expect(llamadas.descubrir).toBe(0);
    expect(tareaPorId(tomada)).toMatchObject({ estado: "EN_CURSO", intentos: 1 });
    // Con una tarea en curso la región no se cierra.
    expect(region("CENTRO").estado).toBe("EN_CURSO");
  });

  it("si otra corrida la toma entre la lectura y la toma, sigue con otra", async () => {
    sembrarRegiones();
    const a = agregarTarea({ fuente: "WEB_SEARCH", provincia: "A" });
    const b = agregarTarea({ fuente: "WEB_SEARCH", provincia: "B" });
    const original = B.tablas.dnxBuscadorTarea.updateMany;
    let robada = false;
    B.tablas.dnxBuscadorTarea.updateMany = async (args) => {
      if (!robada && (args.where as { id?: unknown } | undefined)?.id === a) {
        robada = true;
        return { count: 0 };
      }
      return original(args);
    };
    try {
      const { deps } = armarDeps();
      const r = await correr(deps);
      expect(r.procesadas).toBe(1);
      expect(tareaPorId(b).estado).toBe("HECHA");
    } finally {
      B.tablas.dnxBuscadorTarea.updateMany = original;
    }
  });

  it("una tarea EN_CURSO vieja vuelve a PENDIENTE", async () => {
    sembrarRegiones();
    const vieja = agregarTarea({ fuente: "WEB_SEARCH", estado: "EN_CURSO", tomadaEn: new Date(AHORA.getTime() - 21 * 60_000), intentos: 1 });
    agregarTarea({ fuente: "WEB_SEARCH", provincia: "Otra" });
    const { deps } = armarDeps();
    // Sin tiempo para procesar: sólo se ve el rescate.
    const r = await correr(deps, 0);
    expect(r.procesadas).toBe(0);
    expect(tareaPorId(vieja).estado).toBe("PENDIENTE");
  });

  it("con Google frenado, las tareas de web siguen y las de Places quedan PENDIENTE", async () => {
    sembrarRegiones();
    gastoPrevio({ google: 18_000_000 });
    const places = agregarTarea({ fuente: "GOOGLE_PLACES" });
    const web = agregarTarea({ fuente: "WEB_SEARCH", provincia: "Otra" });
    const { deps, llamadas, mensajes } = armarDeps();
    const r = await correr(deps);
    expect(r.frenadoPor).toBe("TOPE_GOOGLE");
    expect(r.regionCerrada).toBeNull();
    expect(tareaPorId(web).estado).toBe("HECHA");
    expect(tareaPorId(places)).toMatchObject({ estado: "PENDIENTE", intentos: 0 });
    expect(llamadas.places).toBe(0);
    expect(region("CENTRO").estado).toBe("EN_CURSO");
    expect(mensajes).toHaveLength(1);
    expect(mensajes[0]).toContain("Google");
  });

  it("con Claude frenado no procesa nada y avisa una sola vez por mes", async () => {
    sembrarRegiones();
    gastoPrevio({ claude: 28_000_000 });
    agregarTarea({ fuente: "GOOGLE_PLACES" });
    agregarTarea({ fuente: "WEB_SEARCH", provincia: "Otra" });
    const { deps, llamadas, mensajes } = armarDeps();
    const r1 = await correr(deps);
    const r2 = await correr(deps);
    expect(r1).toMatchObject({ procesadas: 0, frenadoPor: "TOPE_CLAUDE" });
    expect(r2).toMatchObject({ procesadas: 0, frenadoPor: "TOPE_CLAUDE" });
    expect(llamadas).toMatchObject({ places: 0, descubrir: 0, leer: 0 });
    expect(mensajes).toHaveLength(1);
    expect(mensajes[0]).toContain("Claude");
    expect(mensajes[0]).toContain("USD 28,00");
    expect(mensajes[0]).not.toMatch(/plata/i);
  });

  it("pausado no hace nada", async () => {
    sembrarRegiones();
    ajustes({ pausado: true });
    agregarTarea({ fuente: "WEB_SEARCH" });
    const { deps, llamadas } = armarDeps();
    expect(await correr(deps)).toMatchObject({ procesadas: 0, frenadoPor: "PAUSADO" });
    expect(llamadas.descubrir).toBe(0);
  });

  it("sin región en curso activa la primera EN_ESPERA por orden (nunca una PAUSADA)", async () => {
    B.agregar("dnxBuscadorRegion", { region: "CENTRO", orden: 1, estado: "COMPLETA" });
    B.agregar("dnxBuscadorRegion", { region: "BUENOS_AIRES_AMBA", orden: 2, estado: "PAUSADA" });
    B.agregar("dnxBuscadorRegion", { region: "CUYO", orden: 3, estado: "EN_ESPERA" });
    const { deps } = armarDeps();
    await correr(deps, 0);
    expect(region("CUYO").estado).toBe("EN_CURSO");
    expect(region("BUENOS_AIRES_AMBA").estado).toBe("PAUSADA");
    expect(region("CENTRO").estado).toBe("COMPLETA");
    expect(tareas().some((t) => t.region === "CUYO")).toBe(true);
  });

  it("sin regiones por recorrer devuelve SIN_REGION", async () => {
    B.agregar("dnxBuscadorRegion", { region: "CENTRO", orden: 1, estado: "COMPLETA" });
    B.agregar("dnxBuscadorRegion", { region: "CUYO", orden: 3, estado: "PAUSADA" });
    const { deps } = armarDeps();
    expect(await correr(deps)).toMatchObject({ procesadas: 0, frenadoPor: "SIN_REGION", regionCerrada: null });
  });

  it("tres errores dejan la tarea en FALLO", async () => {
    sembrarRegiones();
    const t = agregarTarea({ fuente: "GOOGLE_PLACES" });
    agregarTarea({ fuente: "WEB_SEARCH", provincia: "Otra", estado: "HECHA" });
    const { deps, mensajes } = armarDeps({ places: async () => ({ error: "HTTP", detalle: "500 caído" }) });
    await correr(deps);
    expect(tareaPorId(t)).toMatchObject({ estado: "PENDIENTE", intentos: 1 });
    await correr(deps);
    expect(tareaPorId(t)).toMatchObject({ estado: "PENDIENTE", intentos: 2 });
    const r = await correr(deps);
    expect(tareaPorId(t)).toMatchObject({ estado: "FALLO", intentos: 3 });
    // Sin pendientes, la región se cierra (con la mitad en FALLO).
    expect(r.regionCerrada).toBe("CENTRO");
    expect(mensajes.at(-1)).not.toContain("500 caído");
  });

  it("al no quedar pendientes cierra la región, manda el resumen y activa la siguiente", async () => {
    sembrarRegiones();
    agregarTarea({ fuente: "WEB_SEARCH" });
    const { deps, mensajes } = armarDeps();
    const r = await correr(deps);
    expect(r.regionCerrada).toBe("CENTRO");
    expect(region("CENTRO")).toMatchObject({ estado: "COMPLETA", completadaEn: AHORA, resumenEnviadoEn: AHORA });
    expect(region("BUENOS_AIRES_AMBA").estado).toBe("EN_CURSO");
    expect(mensajes).toHaveLength(1);
    expect(mensajes[0]).toContain("Región Centro lista");
    expect(mensajes[0]).toContain("https://fotoffice.test/admin/contactos-dnx?region=CENTRO");
    expect(mensajes[0]).not.toContain("fallaron");
  });

  it("más de 20 % de FALLO agrega el aviso al resumen", async () => {
    sembrarRegiones();
    agregarTarea({ fuente: "WEB_SEARCH" });
    agregarTarea({ fuente: "WEB_SEARCH", provincia: "B", estado: "HECHA" });
    agregarTarea({ fuente: "WEB_SEARCH", provincia: "C", estado: "FALLO", intentos: 3 });
    const { deps, mensajes } = armarDeps();
    await correr(deps);
    expect(mensajes).toHaveLength(1);
    expect(mensajes[0]).toContain("1 de 3 búsquedas fallaron");
  });

  it("no guarda nada con fuente GOOGLE_PLACES ni el nombre de Places", async () => {
    sembrarRegiones();
    const t = agregarTarea({ fuente: "GOOGLE_PLACES" });
    const { deps, llamadas } = armarDeps({ places: async () => ({ lugares: [lugar(1, "https://sitio1.com.ar"), lugar(2)], llamadas: { TEXT_SEARCH_ENTERPRISE: 1 } }) });
    await correr(deps);
    expect(llamadas.leer).toBe(2);
    const datos = B.datos.dnxContactoDato as unknown as Array<{ fuente: string }>;
    expect(datos.length).toBeGreaterThan(0);
    expect(datos.some((d) => d.fuente === "GOOGLE_PLACES")).toBe(false);
    const contactos = B.datos.dnxContacto as unknown as Array<{ nombre: string; googlePlaceId: string | null }>;
    expect(contactos.map((c) => c.googlePlaceId).sort()).toEqual(["places/1", "places/2"]);
    expect(contactos.some((c) => c.nombre.includes("Nombre de Google"))).toBe(false);
    expect(tareaPorId(t)).toMatchObject({ estado: "HECHA", hechaEn: AHORA });
    expect(tareaPorId(t).resultado).toMatchObject({ encontrados: 2, nuevos: 2, actualizados: 0, descartados: 0, llamadas: { TEXT_SEARCH_ENTERPRISE: 1 } });
  });

  it("un placeId que ya existe no gasta Claude", async () => {
    sembrarRegiones();
    B.agregar("dnxContacto", { tipo: "FOTOGRAFO", nombre: "Ya estaba", googlePlaceId: "places/1", creadoPor: "BUSCADOR" });
    agregarTarea({ fuente: "GOOGLE_PLACES" });
    const { deps, llamadas } = armarDeps({ places: async () => ({ lugares: [lugar(1, "https://x.com.ar")], llamadas: { TEXT_SEARCH_ENTERPRISE: 1 } }) });
    await correr(deps);
    expect(llamadas.leer).toBe(0);
    expect(llamadas.sitio).toBe(0);
  });

  it("si la web propia alcanza, no se llama a Claude", async () => {
    sembrarRegiones();
    const t = agregarTarea({ fuente: "GOOGLE_PLACES" });
    const { deps, llamadas } = armarDeps({
      places: async () => ({ lugares: [lugar(1, "https://propio.com.ar")], llamadas: { TEXT_SEARCH_ENTERPRISE: 1 } }),
      sitio: async (web, ctx) => {
        llamadas.sitio++;
        expect(web).toBe("https://propio.com.ar");
        return candidato("Propio", { googlePlaceId: ctx.googlePlaceId });
      },
    });
    await correr(deps);
    expect(llamadas.sitio).toBe(1);
    expect(llamadas.leer).toBe(0);
    expect(tareaPorId(t).costoClaudeUsdMicros).toBe(0);
  });

  it("el costo de Google se cobra llamada por llamada respetando el cupo gratis", async () => {
    sembrarRegiones();
    gastoPrevio({ llamadas: 999 });
    const t = agregarTarea({ fuente: "GOOGLE_PLACES", paginas: 2 });
    const { deps } = armarDeps({ places: async () => ({ lugares: [], llamadas: { TEXT_SEARCH_ENTERPRISE: 2 } }) });
    await correr(deps);
    // La llamada 1000 es gratis; la 1001 cuesta USD 0,035.
    expect(tareaPorId(t).costoGoogleUsdMicros).toBe(35_000);
  });

  it("el costo se acumula en cada intento, también cuando falla", async () => {
    sembrarRegiones();
    gastoPrevio({ llamadas: 1000 });
    const t = agregarTarea({ fuente: "GOOGLE_PLACES", paginas: 3 });
    agregarTarea({ fuente: "WEB_SEARCH", provincia: "Otra", estado: "HECHA" });
    const { deps } = armarDeps({ places: async () => ({ error: "CUOTA", detalle: "429", llamadas: { TEXT_SEARCH_ENTERPRISE: 2 } }) });
    await correr(deps);
    expect(tareaPorId(t)).toMatchObject({ estado: "PENDIENTE", costoGoogleUsdMicros: 70_000 });
    await correr(deps);
    expect(tareaPorId(t)).toMatchObject({ estado: "PENDIENTE", costoGoogleUsdMicros: 140_000 });
    expect(tareaPorId(t).resultado).toMatchObject({ llamadas: { TEXT_SEARCH_ENTERPRISE: 4 } });
    expect(tareaPorId(t).hechaEn).toBeNull();
  });

  it("el costo de Claude de cada lugar queda anotado en la tarea", async () => {
    sembrarRegiones();
    const t = agregarTarea({ fuente: "GOOGLE_PLACES" });
    const { deps } = armarDeps({
      places: async () => ({ lugares: [lugar(1)], llamadas: { TEXT_SEARCH_ENTERPRISE: 1 } }),
      web: {
        descubrir: async () => ({ candidatos: [], uso: USO, descartados: 0 }),
        leer: async (l) => ({ candidato: candidato("Uno", { googlePlaceId: l.placeId }), uso: { entrada: 1_000_000, salida: 0, busquedas: 0 } }),
      },
    });
    await correr(deps);
    expect(tareaPorId(t).costoClaudeUsdMicros).toBe(2_000_000);
  });

  it("si cruza el tope de Claude a mitad de una tarea de Places, corta y la tarea vuelve a PENDIENTE", async () => {
    sembrarRegiones();
    gastoPrevio({ claude: 27_500_000 });
    const t = agregarTarea({ fuente: "GOOGLE_PLACES" });
    const { deps, llamadas, mensajes } = armarDeps({
      places: async () => ({ lugares: [lugar(1), lugar(2)], llamadas: { TEXT_SEARCH_ENTERPRISE: 1 } }),
      web: {
        descubrir: async () => ({ candidatos: [], uso: USO, descartados: 0 }),
        leer: async (l) => {
          llamadas.leer++;
          return { candidato: candidato(`L${l.placeId}`, { googlePlaceId: l.placeId }), uso: { entrada: 500_000, salida: 0, busquedas: 0 } };
        },
      },
    });
    const r = await correr(deps);
    expect(llamadas.leer).toBe(1);
    expect(r.frenadoPor).toBe("TOPE_CLAUDE");
    expect(tareaPorId(t)).toMatchObject({ estado: "PENDIENTE", intentos: 0, costoClaudeUsdMicros: 1_000_000 });
    expect((B.datos.dnxContacto as unknown[]).length).toBe(1);
    expect(mensajes).toHaveLength(1);
  });

  it("si Claude no responde, la tarea de web es un error (no una búsqueda vacía)", async () => {
    sembrarRegiones();
    const t = agregarTarea({ fuente: "WEB_SEARCH" });
    agregarTarea({ fuente: "WEB_SEARCH", provincia: "Otra", estado: "HECHA" });
    const { deps } = armarDeps({
      web: {
        descubrir: async () => ({ candidatos: [], uso: { entrada: 0, salida: 0, busquedas: 0 }, descartados: 0 }),
        leer: async () => ({ candidato: null, uso: USO }),
      },
    });
    await correr(deps);
    expect(tareaPorId(t)).toMatchObject({ estado: "PENDIENTE", intentos: 1 });
  });

  it("si no queda tiempo para Claude, la tarea vuelve a PENDIENTE sin gastar un intento", async () => {
    sembrarRegiones();
    const t = agregarTarea({ fuente: "WEB_SEARCH" });
    let reloj = 0;
    const { deps } = armarDeps({
      reloj: () => reloj,
      web: {
        // Así contesta `conversar` cuando quedan menos de 15 s: sin llamar a Claude.
        descubrir: async () => {
          reloj = 125_000;
          return { candidatos: [], uso: { entrada: 0, salida: 0, busquedas: 0 }, descartados: 0 };
        },
        leer: async () => ({ candidato: null, uso: USO }),
      },
    });
    const r = await correr(deps, 130_000);
    expect(r.procesadas).toBe(1);
    expect(tareaPorId(t)).toMatchObject({ estado: "PENDIENTE", intentos: 0 });
    expect(region("CENTRO").estado).toBe("EN_CURSO");
  });

  it("una tarea cortada por tiempo tres veces no relee un lugar y termina HECHA parcial", async () => {
    sembrarRegiones();
    const t = agregarTarea({ fuente: "GOOGLE_PLACES", paginas: 3 });
    let reloj = 0;
    const leidos: string[] = [];
    const { deps } = armarDeps({
      reloj: () => reloj,
      places: async () => ({ lugares: [1, 2, 3, 4, 5].map((i) => lugar(i)), llamadas: { TEXT_SEARCH_ENTERPRISE: 3 } }),
      web: {
        descubrir: async () => ({ candidatos: [], uso: USO, descartados: 0 }),
        // Claude no encuentra nada y tarda 50 s: después de cada lugar no queda margen para otro.
        leer: async (l) => {
          leidos.push(l.placeId);
          reloj += 50_000;
          return { candidato: null, uso: USO };
        },
      },
    });
    for (let i = 0; i < 2; i++) {
      await correr(deps, 100_000);
      expect(tareaPorId(t)).toMatchObject({ estado: "PENDIENTE", intentos: 0 });
    }
    await correr(deps, 100_000);
    expect(leidos).toEqual(["places/1", "places/2", "places/3"]);
    expect(tareaPorId(t)).toMatchObject({ estado: "HECHA", hechaEn: AHORA });
    expect(tareaPorId(t).resultado).toMatchObject({ parcial: true, cortes: 3, vistos: ["places/1", "places/2", "places/3"], llamadas: { TEXT_SEARCH_ENTERPRISE: 9 } });
  });

  it("no empieza un lugar nuevo con menos de 90 s", async () => {
    sembrarRegiones();
    const t = agregarTarea({ fuente: "GOOGLE_PLACES" });
    let reloj = 0;
    const { deps, llamadas } = armarDeps({
      reloj: () => reloj,
      // La búsqueda en Google tarda: después quedan 89 s.
      places: async () => {
        reloj = 1_000;
        return { lugares: [lugar(1)], llamadas: { TEXT_SEARCH_ENTERPRISE: 1 } };
      },
    });
    await correr(deps, 90_000);
    expect(llamadas.leer).toBe(0);
    expect(llamadas.sitio).toBe(0);
    expect(tareaPorId(t)).toMatchObject({ estado: "PENDIENTE", intentos: 0 });
  });

  it("una EN_CURSO vieja que ya gastó sus intentos queda en FALLO", async () => {
    sembrarRegiones();
    const vieja = agregarTarea({ fuente: "WEB_SEARCH", estado: "EN_CURSO", tomadaEn: new Date(AHORA.getTime() - 21 * 60_000), intentos: 3 });
    agregarTarea({ fuente: "WEB_SEARCH", provincia: "Otra" });
    const { deps } = armarDeps();
    await correr(deps, 0);
    expect(tareaPorId(vieja).estado).toBe("FALLO");
  });

  it("si no se puede leer el gasto del mes, la llamada a Places se anota igual a precio lleno", async () => {
    sembrarRegiones();
    const t = agregarTarea({ fuente: "GOOGLE_PLACES" });
    const original = B.tablas.dnxBuscadorTarea.findMany;
    let romper = false;
    B.tablas.dnxBuscadorTarea.findMany = async (args) => {
      // Sólo la lectura del mes (`gastoDelMes` filtra con OR), y una sola vez.
      if (romper && args?.where && "OR" in args.where) {
        romper = false;
        throw new Error("base caída");
      }
      return original(args);
    };
    try {
      const { deps } = armarDeps({
        places: async () => {
          romper = true;
          return { lugares: [], llamadas: { TEXT_SEARCH_ENTERPRISE: 2 } };
        },
      });
      await correr(deps);
      expect(tareaPorId(t).costoGoogleUsdMicros).toBe(70_000);
      expect(tareaPorId(t).resultado).toMatchObject({ llamadas: { TEXT_SEARCH_ENTERPRISE: 2 } });
    } finally {
      B.tablas.dnxBuscadorTarea.findMany = original;
    }
  });

  it("pasa los ids de los contactos nuevos a clf si está", async () => {
    sembrarRegiones();
    agregarTarea({ fuente: "WEB_SEARCH" });
    const vistos: string[][] = [];
    const { deps } = armarDeps({ clf: async (ids) => void vistos.push(ids) });
    await correr(deps);
    expect(vistos).toHaveLength(1);
    expect(vistos[0]).toHaveLength(1);
  });

  it("también pasa a clf los contactos que ganaron datos nuevos", async () => {
    sembrarRegiones();
    agregarTarea({ fuente: "WEB_SEARCH" });
    agregarTarea({ fuente: "WEB_SEARCH", provincia: "Córdoba" });
    const vistos: string[][] = [];
    const { deps } = armarDeps({ clf: async (ids) => void vistos.push(ids) });
    // Las dos tareas descubren el mismo estudio; la segunda le suma un teléfono.
    let vez = 0;
    deps.web = {
      ...deps.web!,
      descubrir: async () => {
        vez++;
        const c = candidato("Mismo Estudio");
        if (vez === 2) c.datos.telefono = { valor: "0341 15 555-1234", fuente: "SITIO_PROPIO", fuenteUrl: null };
        return { candidatos: [c], uso: USO, descartados: 0 };
      },
    };
    await correr(deps);
    expect(vistos).toHaveLength(2);
    expect(vistos[1]).toEqual(vistos[0]);
  });

  describe("servicios caídos: no queman la cola", () => {
    const SIN_USO = { entrada: 0, salida: 0, busquedas: 0 };

    it("Google con la cuota agotada tres corridas seguidas: nada en FALLO y la región sigue abierta", async () => {
      sembrarRegiones();
      const p1 = agregarTarea({ fuente: "GOOGLE_PLACES" });
      const p2 = agregarTarea({ fuente: "GOOGLE_PLACES" });
      const w = agregarTarea({ fuente: "WEB_SEARCH", provincia: "Otra" });
      const { deps, llamadas, mensajes } = armarDeps({
        places: async () => {
          llamadas.places++;
          return { error: "CUOTA", detalle: "429 RESOURCE_EXHAUSTED" };
        },
      });
      for (let i = 0; i < 3; i++) {
        const r = await correr(deps);
        expect(r.frenadoPor).toBe("GOOGLE_NO_DISPONIBLE");
        expect(r.regionCerrada).toBeNull();
      }
      // Una sola llamada a Google por corrida: después la corrida sigue sólo con la web.
      expect(llamadas.places).toBe(3);
      expect(tareaPorId(p1)).toMatchObject({ estado: "PENDIENTE", intentos: 0 });
      expect(tareaPorId(p2)).toMatchObject({ estado: "PENDIENTE", intentos: 0 });
      expect(tareaPorId(w).estado).toBe("HECHA");
      expect(tareas().some((t) => t.estado === "FALLO")).toBe(false);
      expect(region("CENTRO").estado).toBe("EN_CURSO");
      expect(mensajes).toHaveLength(0);
    });

    it("Google sin acceso (API sin habilitar o clave mala) tampoco gasta intentos", async () => {
      sembrarRegiones();
      const p = agregarTarea({ fuente: "GOOGLE_PLACES" });
      const { deps } = armarDeps({ places: async () => ({ error: "ACCESO", detalle: "403 PERMISSION_DENIED" }) });
      await correr(deps);
      expect(tareaPorId(p)).toMatchObject({ estado: "PENDIENTE", intentos: 0 });
      expect(region("CENTRO").estado).toBe("EN_CURSO");
    });

    it("sin clave de Google las tareas de Places ni se tocan y las de web avanzan", async () => {
      sembrarRegiones();
      const p = agregarTarea({ fuente: "GOOGLE_PLACES" });
      const w = agregarTarea({ fuente: "WEB_SEARCH", provincia: "Otra" });
      const { deps, llamadas } = armarDeps({ claves: () => ({ google: false, claude: true }) });
      const r = await correr(deps);
      expect(llamadas.places).toBe(0);
      expect(tareaPorId(p)).toMatchObject({ estado: "PENDIENTE", intentos: 0, tomadaEn: null });
      expect(tareaPorId(w).estado).toBe("HECHA");
      expect(r).toMatchObject({ procesadas: 1, frenadoPor: "GOOGLE_NO_DISPONIBLE", regionCerrada: null });
      expect(region("CENTRO").estado).toBe("EN_CURSO");
    });

    it("sin clave de Claude sólo corren las de Places, con la web propia y sin llamar a Claude", async () => {
      sembrarRegiones();
      const p = agregarTarea({ fuente: "GOOGLE_PLACES" });
      const w = agregarTarea({ fuente: "WEB_SEARCH", provincia: "Otra" });
      const { deps, llamadas } = armarDeps({
        claves: () => ({ google: true, claude: false }),
        places: async () => ({ lugares: [lugar(1, "https://propio.com.ar"), lugar(2)], llamadas: { TEXT_SEARCH_ENTERPRISE: 1 } }),
        sitio: async (_web, ctx) => {
          llamadas.sitio++;
          return candidato("Propio", { googlePlaceId: ctx.googlePlaceId });
        },
      });
      const r = await correr(deps);
      expect(llamadas).toMatchObject({ leer: 0, descubrir: 0, sitio: 1 });
      expect(tareaPorId(p).estado).toBe("HECHA");
      expect(tareaPorId(p).resultado).toMatchObject({ nuevos: 1, descartados: 1 });
      expect(tareaPorId(p).costoClaudeUsdMicros).toBe(0);
      expect(tareaPorId(w)).toMatchObject({ estado: "PENDIENTE", intentos: 0 });
      expect(r.frenadoPor).toBe("CLAUDE_NO_DISPONIBLE");
      expect(region("CENTRO").estado).toBe("EN_CURSO");
    });

    it("Claude saturado (429) tres corridas seguidas: nada en FALLO", async () => {
      sembrarRegiones();
      const w1 = agregarTarea({ fuente: "WEB_SEARCH", provincia: "A" });
      const w2 = agregarTarea({ fuente: "WEB_SEARCH", provincia: "B" });
      const { deps, llamadas, mensajes } = armarDeps({
        web: {
          descubrir: async () => {
            llamadas.descubrir++;
            return { candidatos: [], uso: SIN_USO, descartados: 0, falla: "SERVICIO" as const };
          },
          leer: async () => ({ candidato: null, uso: SIN_USO, falla: "SERVICIO" as const }),
        },
      });
      for (let i = 0; i < 3; i++) {
        const r = await correr(deps);
        expect(r).toMatchObject({ frenadoPor: "CLAUDE_NO_DISPONIBLE", regionCerrada: null });
      }
      // La corrida se corta en la primera: no prueba con todas.
      expect(llamadas.descubrir).toBe(3);
      expect(tareaPorId(w1)).toMatchObject({ estado: "PENDIENTE", intentos: 0 });
      expect(tareaPorId(w2)).toMatchObject({ estado: "PENDIENTE", intentos: 0 });
      expect(tareas().some((t) => t.estado === "FALLO")).toBe(false);
      expect(region("CENTRO").estado).toBe("EN_CURSO");
      expect(mensajes).toHaveLength(0);
    });

    it("Claude caído leyendo un lugar de Places: la tarea vuelve a PENDIENTE sin gastar el intento", async () => {
      sembrarRegiones();
      const p = agregarTarea({ fuente: "GOOGLE_PLACES" });
      const { deps } = armarDeps({
        places: async () => ({ lugares: [lugar(1)], llamadas: { TEXT_SEARCH_ENTERPRISE: 1 } }),
        web: {
          descubrir: async () => ({ candidatos: [], uso: SIN_USO, descartados: 0 }),
          leer: async () => ({ candidato: null, uso: SIN_USO, falla: "SERVICIO" as const }),
        },
      });
      for (let i = 0; i < 3; i++) await correr(deps);
      expect(tareaPorId(p)).toMatchObject({ estado: "PENDIENTE", intentos: 0 });
      expect(tareaPorId(p).resultado).toMatchObject({ llamadas: { TEXT_SEARCH_ENTERPRISE: 3 } });
      // Una caída de servicio no cuenta como corte por tiempo (no la acerca a «hecha parcial»).
      expect(tareaPorId(p).resultado?.cortes ?? 0).toBe(0);
    });
  });

  describe("cortes por tiempo con Claude", () => {
    it("no empieza una búsqueda web con menos de 120 s", async () => {
      sembrarRegiones();
      const w = agregarTarea({ fuente: "WEB_SEARCH" });
      const { deps, llamadas } = armarDeps();
      const r = await correr(deps, 119_000);
      expect(llamadas.descubrir).toBe(0);
      expect(r.procesadas).toBe(0);
      expect(tareaPorId(w)).toMatchObject({ estado: "PENDIENTE", intentos: 0 });
      expect(region("CENTRO").estado).toBe("EN_CURSO");
    });

    it("una búsqueda web cortada a mitad de camino anota un costo estimado", async () => {
      sembrarRegiones();
      const w = agregarTarea({ fuente: "WEB_SEARCH" });
      const { deps } = armarDeps({
        web: {
          descubrir: async () => ({ candidatos: [], uso: { entrada: 0, salida: 0, busquedas: 0 }, descartados: 0, falla: "CORTADA" as const }),
          leer: async () => ({ candidato: null, uso: USO }),
        },
      });
      await correr(deps);
      // 5 búsquedas × USD 0,01 + 2.000 tokens de entrada (USD 0,004) + 1.000 de salida (USD 0,01).
      expect(tareaPorId(w)).toMatchObject({ estado: "PENDIENTE", intentos: 0, costoClaudeUsdMicros: 64_000 });
      expect(tareaPorId(w).resultado).toMatchObject({ cortes: 1 });
    });

    it("la lectura de un lugar cortada a mitad de camino anota un costo estimado", async () => {
      sembrarRegiones();
      const p = agregarTarea({ fuente: "GOOGLE_PLACES" });
      const { deps } = armarDeps({
        places: async () => ({ lugares: [lugar(1)], llamadas: { TEXT_SEARCH_ENTERPRISE: 1 } }),
        web: {
          descubrir: async () => ({ candidatos: [], uso: USO, descartados: 0 }),
          leer: async () => ({ candidato: null, uso: { entrada: 0, salida: 0, busquedas: 0 }, falla: "CORTADA" as const }),
        },
      });
      await correr(deps);
      // 3 búsquedas × USD 0,01 + el piso de tokens (USD 0,014).
      expect(tareaPorId(p)).toMatchObject({ estado: "PENDIENTE", intentos: 0, costoClaudeUsdMicros: 44_000 });
    });
  });
});

describe("resumenDeRegion", () => {
  it("cuenta por tipo, por nicho, las ciudades y el gasto", async () => {
    sembrarRegiones();
    const c = (tipo: string, nichos: string[], ciudad: string) =>
      B.agregar("dnxContacto", { tipo, nichos, nombre: `${tipo} ${ciudad}`, ciudad, region: "CENTRO", creadoPor: "BUSCADOR" });
    c("FOTOGRAFO", ["ESCOLAR"], "Rosario");
    c("FOTOGRAFO", ["ESCOLAR", "DEPORTIVA"], "Rosario");
    c("CLUB", [], "Córdoba");
    B.agregar("dnxContacto", { tipo: "CLUB", nombre: "importado", region: "CENTRO", creadoPor: "CARGA_INICIAL" });
    agregarTarea({ estado: "HECHA", costoGoogleUsdMicros: 6_100_000, costoClaudeUsdMicros: 12_345_678 });
    const texto = await M.resumenDeRegion("CENTRO");
    expect(texto).toContain("Región Centro lista");
    expect(texto).toContain("Contactos nuevos: 3");
    expect(texto).toContain("Fotógrafo: 2");
    expect(texto).toContain("Club: 1");
    expect(texto).toContain("Escolar: 2");
    expect(texto).toContain("Deportiva: 1");
    expect(texto).toContain("Rosario: 2");
    expect(texto).toContain("Google USD 6,10");
    expect(texto).toContain("Claude USD 12,35");
    expect(texto).toContain("https://fotoffice.test/admin/contactos-dnx?region=CENTRO");
  });

  it("REGIONES_NOMBRE", () => {
    expect(M.REGIONES_NOMBRE).toEqual({
      CENTRO: "Centro", BUENOS_AIRES_AMBA: "Buenos Aires y AMBA", CUYO: "Cuyo", NOA: "NOA", NEA: "NEA", PATAGONIA: "Patagonia",
    });
  });
});
