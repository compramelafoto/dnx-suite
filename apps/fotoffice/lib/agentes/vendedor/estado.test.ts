import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const canal = vi.hoisted(() => ({ tieneToken: true, vinculado: true }));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null, DbNull: null } }));
vi.mock("../canal", () => ({
  estadoCanalAgentes: async () => ({
    tieneToken: canal.tieneToken, conectado: true, botUsername: "bot", vinculado: canal.vinculado, chatNombre: "Daniel", enlaceVinculo: null,
  }),
}));

const E = await import("./estado");
const { AJUSTES_VENDEDOR_POR_OMISION, CLAVE_AJUSTES_VENDEDOR, guardarAjustesVendedor, leerAjustesVendedor } = await import("./ajustes");
const { CLAVE_CAMPANA_ESCOLAR, CLAVE_CONOCIMIENTO } = await import("./clf");
const { GRUPOS } = await import("./tipos");

type Fila = Record<string, unknown>;

/** Martes 10/11/2026 a las 12:00 argentinas. */
const AHORA = new Date("2026-11-10T15:00:00.000Z");

function ajustes(o: Partial<typeof AJUSTES_VENDEDOR_POR_OMISION>) {
  B.agregar("systemSettings", { key: CLAVE_AJUSTES_VENDEDOR, value: JSON.stringify({ ...AJUSTES_VENDEDOR_POR_OMISION, ...o }) });
}
function conocimiento() {
  B.agregar("systemSettings", { key: CLAVE_CONOCIMIENTO, value: JSON.stringify({ texto: "Guía de CLF", version: "v7" }) });
}
let n = 0;
function contacto(o: Fila = {}): string {
  n++;
  const email = `c${n}@x.com`;
  return (B.agregar("dnxContacto", {
    tipo: "FOTOGRAFO", nichos: ["ESCOLAR"], nombre: `Contacto ${n}`, creadoPor: "BUSCADOR", email, claveEmail: email,
    estado: "NUEVO", creadoEn: new Date(2026, 0, n), ...o,
  }) as { id: string }).id;
}
function modelo(grupo: string, o: Fila = {}): string {
  return (B.agregar("dnxVendedorModelo", { grupo, estado: "APROBADO", asunto: `Asunto ${grupo}`, cuerpo: "c", indicaciones: "i", landing: "/land", ...o }) as { id: string }).id;
}
function correo(o: Fila) {
  B.agregar("dnxVendedorCorreo", { de: "d", para: "p", asunto: "a", texto: "t", ...o });
}

beforeEach(() => {
  B.vaciar();
  n = 0;
  canal.tieneToken = true;
  canal.vinculado = true;
  B.agregar("systemSettings", { key: CLAVE_CAMPANA_ESCOLAR, value: JSON.stringify({ emails: [] }) });
});

describe("estadoVendedor", () => {
  it("cada grupo muestra su vigente y su propuesto", async () => {
    const aprobadoEn = new Date("2026-11-01T12:00:00.000Z");
    const vigente = modelo("FOTOGRAFO:ESCOLAR", { aprobadoEn });
    modelo("FOTOGRAFO:ESCOLAR", { asunto: "Viejo", reemplazadoEn: new Date("2026-11-01T12:00:00.000Z") });
    const propuesto = modelo("FOTOGRAFO:ESCOLAR", { estado: "PROPUESTO", asunto: "Nuevo" });
    modelo("FOTOGRAFO:ESCOLAR", { estado: "DESCARTADO", asunto: "Descartado" });
    const soloPropuesto = modelo("CLUB", { estado: "PROPUESTO" });

    const e = await E.estadoVendedor(AHORA);
    expect(e.modelos).toHaveLength(GRUPOS.length);
    const escolar = e.modelos.find((m) => m.grupo === "FOTOGRAFO:ESCOLAR")!;
    expect(escolar.rotulo).toBe("Fotógrafos escolares");
    expect(escolar.vigente).toEqual({ id: vigente, asunto: "Asunto FOTOGRAFO:ESCOLAR", aprobadoEn });
    expect(escolar.propuesto).toMatchObject({ id: propuesto, asunto: "Nuevo" });
    const club = e.modelos.find((m) => m.grupo === "CLUB")!;
    expect(club.vigente).toBeNull();
    expect(club.propuesto?.id).toBe(soloPropuesto);
    expect(e.modelos.find((m) => m.grupo === "ESCUELA")).toMatchObject({ vigente: null, propuesto: null });
  });

  it("la cola de hoy respeta el cupo", async () => {
    // Arrancó hace 2 días: cupo de la primera semana (3), y ya salieron 2 hoy (un primero y un recordatorio).
    ajustes({ pausado: false, arrancoEn: "2026-11-08", correosPrimeraSemana: 3 });
    modelo("FOTOGRAFO:ESCOLAR");
    const ids = [contacto(), contacto(), contacto(), contacto()];
    correo({ direccion: "SALIDA", paso: "PRIMERO", creadoEn: new Date("2026-11-10T13:00:00.000Z") });
    correo({ direccion: "SALIDA", paso: "RECORDATORIO", creadoEn: new Date("2026-11-10T14:00:00.000Z") });
    // No cuentan: una respuesta a una duda, un entrante y un envío de ayer.
    correo({ direccion: "SALIDA", paso: "RESPUESTA", creadoEn: new Date("2026-11-10T14:00:00.000Z") });
    correo({ direccion: "ENTRADA", creadoEn: new Date("2026-11-10T14:00:00.000Z") });
    correo({ direccion: "SALIDA", paso: "PRIMERO", creadoEn: new Date("2026-11-09T14:00:00.000Z") });

    const e = await E.estadoVendedor(AHORA);
    expect(e.cupoHoy).toBe(3);
    expect(e.enviadosHoy).toBe(2);
    expect(e.enviadosMes).toBe(3);
    expect(e.cola).toHaveLength(1);
    expect(e.cola[0]).toEqual({ contactoId: ids[0], grupo: "FOTOGRAFO:ESCOLAR", nombre: "Contacto 1" });
  });

  it("sin arranque el cupo es 0 y la cola está vacía; trae gasto, informes y versión del conocimiento", async () => {
    modelo("FOTOGRAFO:ESCOLAR");
    contacto();
    conocimiento();
    B.agregar("dnxVendedorGasto", { usdMicros: 1_500_000, motivo: "MODELO", creadoEn: new Date("2026-11-05T12:00:00.000Z") });
    B.agregar("systemSettings", {
      key: "fotoffice_vendedor_informe_2026-10",
      value: JSON.stringify({ mes: "2026-10", porGrupo: [], total: { enviados: 0, respondieron: 0, registros: 0, vendieron: 0, ventas: 0, totalPesos: 0 }, gastoUsd: 0, ventasDisponibles: true }),
    });
    const e = await E.estadoVendedor(AHORA);
    expect(e.ajustes.pausado).toBe(true);
    expect(e.cupoHoy).toBe(0);
    expect(e.cola).toEqual([]);
    expect(e.gastoMesUsd).toBeCloseTo(1.5);
    expect(e.informes.map((i) => i.mes)).toEqual(["2026-10"]);
    expect(e.conocimientoVersion).toBe("v7");
  });
});

describe("puedeReanudar", () => {
  it("no deja reanudar sin un correo recibido", async () => {
    conocimiento();
    correo({ direccion: "SALIDA", paso: "PRIMERO" });
    expect(await E.puedeReanudar()).toEqual({
      ok: false,
      motivo: "Todavía no llegó ningún correo a daniel@compramelafoto.com: falta el MX o el webhook.",
    });
    correo({ direccion: "ENTRADA" });
    expect(await E.puedeReanudar()).toEqual({ ok: true });
  });

  it("tampoco sin el conocimiento de CLF ni sin el chat de Telegram", async () => {
    correo({ direccion: "ENTRADA" });
    const sinConocimiento = await E.puedeReanudar();
    expect(sinConocimiento.ok).toBe(false);
    expect(!sinConocimiento.ok && sinConocimiento.motivo).toMatch(/conocimiento de CompraMeLaFoto/);
    conocimiento();
    canal.vinculado = false;
    const sinChat = await E.puedeReanudar();
    expect(!sinChat.ok && sinChat.motivo).toMatch(/chat de Telegram/);
    canal.vinculado = true;
    canal.tieneToken = false;
    expect((await E.puedeReanudar()).ok).toBe(false);
  });
});

describe("reanudar y pausar", () => {
  it("al reanudar mueve saludDesde a ahora, limpia pausadoPor y pone arrancoEn sólo la primera vez", () => {
    const viejo = "2026-10-01T12:00:00.000Z";
    const primera = E.ajustesAlReanudar({ ...AJUSTES_VENDEDOR_POR_OMISION, pausadoPor: "SALUD", saludDesde: viejo }, AHORA);
    expect(primera).toEqual({ pausado: false, pausadoPor: null, saludDesde: AHORA.toISOString(), arrancoEn: "2026-11-10" });
    const otra = E.ajustesAlReanudar({ ...AJUSTES_VENDEDOR_POR_OMISION, pausadoPor: "MANUAL", arrancoEn: "2026-11-02" }, AHORA);
    expect(otra.arrancoEn).toBe("2026-11-02");
    expect(otra.saludDesde).toBe(AHORA.toISOString());
  });

  it("con contacto de prueba no fija el arranque: la prueba no gasta la primera semana", () => {
    const r = E.ajustesAlReanudar({ ...AJUSTES_VENDEDOR_POR_OMISION, soloContactoPrueba: "c1" }, AHORA);
    expect(r.arrancoEn).toBeNull();
    expect(E.ajustesAlReanudar({ ...AJUSTES_VENDEDOR_POR_OMISION, soloContactoPrueba: "c1", arrancoEn: "2026-11-02" }, AHORA).arrancoEn).toBe("2026-11-02");
  });

  it("arrancoEn es el día argentino (a las 23:30 argentinas todavía es el mismo día)", () => {
    const tarde = new Date("2026-11-11T02:30:00.000Z");
    expect(E.ajustesAlReanudar(AJUSTES_VENDEDOR_POR_OMISION, tarde).arrancoEn).toBe("2026-11-10");
  });

  it("cambiarPausaVendedor: reanudar sin correo recibido no toca los ajustes", async () => {
    conocimiento();
    ajustes({ pausado: true, pausadoPor: "SALUD", saludDesde: "2026-10-01T12:00:00.000Z" });
    const r = await E.cambiarPausaVendedor(false, AHORA);
    expect(r.ok).toBe(false);
    const a = await leerAjustesVendedor();
    expect(a).toMatchObject({ pausado: true, pausadoPor: "SALUD", saludDesde: "2026-10-01T12:00:00.000Z", arrancoEn: null });
  });

  it("cambiarPausaVendedor: reanuda y después pausa a mano", async () => {
    conocimiento();
    correo({ direccion: "ENTRADA" });
    ajustes({ pausado: true, pausadoPor: "SALUD", saludDesde: "2026-10-01T12:00:00.000Z" });
    expect((await E.cambiarPausaVendedor(false, AHORA)).ok).toBe(true);
    expect(await leerAjustesVendedor()).toMatchObject({ pausado: false, pausadoPor: null, saludDesde: AHORA.toISOString(), arrancoEn: "2026-11-10" });
    expect((await E.cambiarPausaVendedor(true, AHORA)).ok).toBe(true);
    expect(await leerAjustesVendedor()).toMatchObject({ pausado: true, pausadoPor: "MANUAL", arrancoEn: "2026-11-10" });
  });
});

describe("leerAjustesFormulario", () => {
  it("acepta el tope con coma y los correos enteros", () => {
    expect(E.leerAjustesFormulario("30,5", "20", "10")).toEqual({ ok: true, valor: { topeClaudeUsd: 30.5, correosPorDia: 20, correosPrimeraSemana: 10 } });
    expect(E.leerAjustesFormulario("0", "0", "0").ok).toBe(true);
    expect(E.leerAjustesFormulario("500", "50", "50").ok).toBe(true);
  });
  it("rechaza fuera de rango o no numérico", () => {
    expect(E.leerAjustesFormulario("501", "20", "10").ok).toBe(false);
    expect(E.leerAjustesFormulario("30", "51", "10").ok).toBe(false);
    expect(E.leerAjustesFormulario("30", "20", "-1").ok).toBe(false);
    expect(E.leerAjustesFormulario("30", "2,5", "10").ok).toBe(false);
    expect(E.leerAjustesFormulario("abc", "20", "10").ok).toBe(false);
    expect(E.leerAjustesFormulario("", "20", "10").ok).toBe(false);
  });
});

describe("hiloDeContacto", () => {
  it("hiloDeContacto trae los correos en orden con su estado de entrega", async () => {
    const c = contacto();
    const hilo = (B.agregar("dnxVendedorHilo", {
      contactoId: c, grupo: "FOTOGRAFO:ESCOLAR", token: "tk", estado: "RESPONDIO", registradoEn: new Date("2026-11-06T12:00:00.000Z"), viaRegistro: "COOKIE",
    }) as { id: string }).id;
    const entregado = new Date("2026-11-03T12:01:00.000Z");
    const abierto = new Date("2026-11-03T15:00:00.000Z");
    correo({ hiloId: hilo, contactoId: c, direccion: "ENTRADA", asunto: "Re: hola", clase: "INTERESADO", creadoEn: new Date("2026-11-04T12:00:00.000Z") });
    correo({ hiloId: hilo, contactoId: c, direccion: "SALIDA", paso: "PRIMERO", asunto: "Hola", creadoEn: new Date("2026-11-03T12:00:00.000Z"), entregadoEn: entregado, abiertoEn: abierto });
    correo({ hiloId: hilo, contactoId: c, direccion: "SALIDA", paso: "RESPUESTA", asunto: "Re: hola", creadoEn: new Date("2026-11-05T12:00:00.000Z"), reboteEn: new Date("2026-11-05T12:01:00.000Z") });
    correo({ hiloId: "otro", direccion: "SALIDA", paso: "PRIMERO", creadoEn: new Date("2026-11-01T12:00:00.000Z") });

    const r = await E.hiloDeContacto(c);
    expect(r?.hilo).toMatchObject({ id: hilo, estado: "RESPONDIO", viaRegistro: "COOKIE" });
    expect(r?.correos.map((x) => [x.direccion, x.paso ?? x.clase])).toEqual([["SALIDA", "PRIMERO"], ["ENTRADA", "INTERESADO"], ["SALIDA", "RESPUESTA"]]);
    expect(r?.correos[0]).toMatchObject({ entregadoEn: entregado, abiertoEn: abierto });
    expect(r?.correos.map((x) => E.estadoEntrega(x))).toEqual(["Abierto", null, "Rebotó"]);
  });

  it("sin hilo devuelve null", async () => {
    expect(await E.hiloDeContacto(contacto())).toBeNull();
  });
});

describe("estadoEntrega", () => {
  const base = { direccion: "SALIDA", entregadoEn: null, abiertoEn: null, clicEn: null, reboteEn: null, quejaEn: null };
  it("de lo peor a lo mejor", () => {
    const t = new Date();
    expect(E.estadoEntrega(base)).toBe("Enviado");
    expect(E.estadoEntrega({ ...base, entregadoEn: t })).toBe("Entregado");
    expect(E.estadoEntrega({ ...base, entregadoEn: t, abiertoEn: t })).toBe("Abierto");
    expect(E.estadoEntrega({ ...base, entregadoEn: t, abiertoEn: t, clicEn: t })).toBe("Abrió un enlace");
    expect(E.estadoEntrega({ ...base, entregadoEn: t, quejaEn: t })).toBe("Lo marcó como correo no deseado");
    expect(E.estadoEntrega({ ...base, direccion: "ENTRADA" })).toBeNull();
  });
});

describe("primerAptoDelGrupo", () => {
  it("sirve tanto para un grupo sin modelo como para uno con modelo vigente", async () => {
    const escolar = contacto();
    const club = contacto({ tipo: "CLUB", nichos: [] });
    expect(await E.primerAptoDelGrupo("CLUB")).toBe(club);
    modelo("FOTOGRAFO:ESCOLAR");
    expect(await E.primerAptoDelGrupo("FOTOGRAFO:ESCOLAR")).toBe(escolar);
    expect(await E.primerAptoDelGrupo("ESCUELA")).toBeNull();
  });

  it("en modo prueba sólo sirve el contacto de prueba", async () => {
    contacto();
    const prueba = contacto();
    contacto({ tipo: "CLUB", nichos: [] });
    ajustes({ soloContactoPrueba: prueba });
    expect(await E.primerAptoDelGrupo("FOTOGRAFO:ESCOLAR")).toBe(prueba);
    expect(await E.primerAptoDelGrupo("CLUB")).toBeNull();
  });
});

describe("fijarContactoPrueba", () => {
  it("guarda el contacto, avisa si hoy no sería apto y vacío lo saca", async () => {
    const c = contacto({ estado: "NO_CONTACTAR" });
    const r = await E.fijarContactoPrueba(` ${c} `);
    expect(r.ok).toBe(true);
    expect(r.mensaje).toMatch(/Contacto 1.*Ojo: hoy no le escribiría/);
    expect((await leerAjustesVendedor()).soloContactoPrueba).toBe(c);
    expect((await E.fijarContactoPrueba("no-existe")).ok).toBe(false);
    expect((await leerAjustesVendedor()).soloContactoPrueba).toBe(c);
    expect((await E.fijarContactoPrueba("")).ok).toBe(true);
    expect((await leerAjustesVendedor()).soloContactoPrueba).toBeNull();
  });

  it("sacar la prueba en pausa no fija el arranque; con el Vendedor andando, hoy es el primer día", async () => {
    const c = contacto();
    ajustes({ pausado: true, soloContactoPrueba: c });
    expect((await E.fijarContactoPrueba("", AHORA)).mensaje).toMatch(/sigue en pausa/);
    expect((await leerAjustesVendedor()).arrancoEn).toBeNull();
    await guardarAjustesVendedor({ pausado: false, soloContactoPrueba: c, arrancoEn: null });
    expect((await E.fijarContactoPrueba("", AHORA)).mensaje).toMatch(/primer día/);
    expect((await leerAjustesVendedor()).arrancoEn).toBe("2026-11-10");
  });
});
