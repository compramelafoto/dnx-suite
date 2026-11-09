import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OutboundEmail, SendDeps, SendOutcome } from "@/lib/communications/send-email";
import type { ClienteClaude } from "../claude";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
const telegram = vi.hoisted(() => ({
  mensajes: [] as Array<{ html: string; teclado: unknown }>,
  destino: { token: "tok", chatId: "chat" } as { token: string; chatId: string } | null,
}));

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null, DbNull: null } }));
vi.mock("../canal", () => ({
  destinoAgentes: async () => telegram.destino,
  mandarMensaje: async (_t: string, _c: string, html: string, teclado: unknown) => {
    telegram.mensajes.push({ html, teclado });
    return { ok: true, resultado: { messageId: String(500 + telegram.mensajes.length) } };
  },
  cambiarBotones: async () => ({ ok: true, resultado: true }),
}));

const M = await import("./motor");
const E = await import("./entrante");
const { guardarAjustesVendedor, leerAjustesVendedor } = await import("./ajustes");
const { CLAVE_CONOCIMIENTO } = await import("./clf");

type Fila = Record<string, unknown>;

/** Martes 10/11/2026 a las 12:00 argentinas. */
const AHORA = new Date("2026-11-10T15:00:00.000Z");
/** Hace 6 días hábiles: el recordatorio ya venció. */
const HACE_UNA_SEMANA = new Date("2026-11-02T15:00:00.000Z");

// --- Dobles -----------------------------------------------------------------------------------

let enviados: OutboundEmail[] = [];
let fallasEnvio: SendOutcome[] = [];
let n = 0;
const enviar = async (m: OutboundEmail, _d: SendDeps = {}): Promise<SendOutcome> => {
  enviados.push(m);
  const falla = fallasEnvio.shift();
  if (falla) return falla;
  return { status: "SENT", providerId: `re_out_${++n}` };
};

let respuestasClaude: unknown[] = [];
let pedidosClaude = 0;
const cliente: ClienteClaude = {
  beta: {
    messages: {
      create: async () => {
        pedidosClaude++;
        const r = respuestasClaude.shift();
        if (!r) throw new Error("Claude no tenía que ser llamado");
        return {
          stop_reason: "end_turn",
          content: [{ type: "text", text: "```json\n" + JSON.stringify(r) + "\n```", citations: null }],
          usage: { input_tokens: 1000, output_tokens: 500 },
        } as never;
      },
    },
  },
};
const adaptado = (nombre = "Estudio Luz") =>
  respuestasClaude.push({ asunto: "Una idea para tus fotos escolares", cuerpo: `Hola ${nombre}, te cuento cómo vender tus fotos: {{ENLACE}}` });
const recordatorio = () => respuestasClaude.push({ cuerpo: "Te escribo de nuevo por si se te pasó mi correo. Acá está: {{ENLACE}}" });
const modeloNuevo = () =>
  respuestasClaude.push({
    asunto: "Fotos deportivas que se venden solas",
    cuerpo: "Hola, vi tu trabajo. Te cuento cómo vender tus fotos deportivas: {{ENLACE}}",
    indicaciones: "Nombrar la ciudad.",
    landing: "/land",
  });
const clasificacion = (clase: string, respuesta: string | null = "Gracias por escribir. Te dejo esto: {{ENLACE}}") =>
  respuestasClaude.push({ clase, resumen: `Resumen ${clase}`, quiereCapacitarse: false, respuesta });

/** CLF falso: conocimiento, campaña escolar, atribuciones, usuarios existentes y la página de clubes. */
const clf = {
  caido: false,
  atribuciones: [] as Array<{ token: string; userId: number; rol: string; creadoEn: string }>,
  coincidencias: [] as Array<{ clave: string; userId: number; rol: string; creadoEn: string; baja: boolean }>,
};
const fetchClf = (async (url: string, init?: RequestInit) => {
  const u = String(url);
  if (u.endsWith("/clubes")) return new Response("", { status: 404 });
  if (clf.caido) return new Response("{}", { status: 503 });
  const cuerpo = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
  if (u.endsWith("/api/internal/usuarios/existentes")) return Response.json({ coincidencias: clf.coincidencias });
  if (u.endsWith("/api/internal/vendedor")) {
    if (cuerpo.consulta === "conocimiento") return Response.json({ texto: "CompraMeLaFoto vende fotos.", version: "v1" });
    if (cuerpo.consulta === "campana-escolar") return Response.json({ emails: [] });
    if (cuerpo.consulta === "atribuciones") return Response.json({ atribuciones: clf.atribuciones });
  }
  return new Response("{}", { status: 404 });
}) as unknown as typeof fetch;

let antesDeEnviar: ((contactoId: string) => Promise<void>) | undefined;
const deps = () => ({
  claude: { cliente },
  clf: { fetch: fetchClf, url: "https://clf.test", secreto: "secreto-clf" },
  enviar,
  telegram: {},
  antesDeEnviar: (id: string) => (antesDeEnviar ? antesDeEnviar(id) : Promise.resolve()),
});
const correr = () => M.correrVendedor({ presupuestoMs: 240_000, motivo: "CRON" }, deps());

/** Mueve el reloj (también el `new Date()` de la base en memoria). */
const a = (iso: string | Date) => vi.setSystemTime(new Date(iso));

// --- Datos ------------------------------------------------------------------------------------

let nContacto = 0;
function contacto(o: { nicho?: string; estado?: string; email?: string } = {}): string {
  const email = o.email ?? `estudio${++nContacto}@luz.com.ar`;
  const c = B.agregar("dnxContacto", {
    tipo: "FOTOGRAFO", nichos: [o.nicho ?? "ESCOLAR"], nombre: `Estudio Luz ${nContacto}`, ciudad: "Rosario", provincia: "Santa Fe",
    creadoPor: "BUSCADOR", email, claveEmail: email, estado: o.estado ?? "NUEVO", creadoEn: new Date(`2026-10-0${(nContacto % 9) + 1}T12:00:00Z`),
  }) as { id: string };
  return c.id;
}

function modeloAprobado(grupo = "FOTOGRAFO:ESCOLAR"): string {
  const m = B.agregar("dnxVendedorModelo", {
    grupo, estado: "APROBADO", asunto: "Una idea para tus fotos escolares",
    cuerpo: "Hola, te cuento cómo vender tus fotos escolares: {{ENLACE}}", indicaciones: "Nombrar la ciudad.",
    landing: "/land/fotografo-escolar",
  }) as { id: string };
  return m.id;
}

/** Un hilo ya enviado (contacto CONTACTADO), con su primer correo y su Message-ID. */
function hiloEnviado(o: { enviadoEn?: Date; messageId?: string | null } = {}) {
  const contactoId = contacto({ estado: "CONTACTADO" });
  const email = (B.datos.dnxContacto.find((c) => c.id === contactoId) as Fila).email as string;
  const hilo = B.agregar("dnxVendedorHilo", {
    contactoId, grupo: "FOTOGRAFO:ESCOLAR", token: `tok${contactoId}`, estado: "ENVIADO", enviadoEn: o.enviadoEn ?? HACE_UNA_SEMANA,
  }) as { id: string; token: string };
  B.agregar("dnxVendedorCorreo", {
    hiloId: hilo.id, contactoId, direccion: "SALIDA", paso: "PRIMERO", resendId: `re_primero_${hilo.id}`,
    messageId: o.messageId === undefined ? `<primero-${hilo.id}@resend.dev>` : o.messageId, de: "Daniel Cuart <daniel@compramelafoto.com>",
    para: email, asunto: "Una idea para tus fotos escolares", texto: "Hola, te escribo por tus fotos.", creadoEn: o.enviadoEn ?? HACE_UNA_SEMANA,
  });
  return { contactoId, hiloId: hilo.id, token: hilo.token, email };
}

/** `n` primeros correos ya enviados hoy (cuentan para el cupo). */
function enviadosHoy(cantidad: number, paso = "PRIMERO") {
  for (let i = 0; i < cantidad; i++) {
    B.agregar("dnxVendedorCorreo", {
      direccion: "SALIDA", paso, resendId: `re_hoy_${paso}_${i}`, de: "Daniel", para: `x${i}@y.com`, asunto: "a", texto: "t", creadoEn: new Date(),
    });
  }
}

const hilos = () => B.datos.dnxVendedorHilo as Fila[];
const hiloDe = (contactoId: string) => hilos().find((h) => h.contactoId === contactoId);
const fila = (tabla: "dnxContacto" | "dnxVendedorHilo", id: string) => B.datos[tabla].find((f) => f.id === id)! as Fila;
const salidas = (paso: string) => B.datos.dnxVendedorCorreo.filter((c) => c.direccion === "SALIDA" && c.paso === paso && String(c.resendId).startsWith("re_out_")) as Fila[];

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  a(AHORA);
  B.vaciar();
  enviados = [];
  fallasEnvio = [];
  respuestasClaude = [];
  pedidosClaude = 0;
  antesDeEnviar = undefined;
  telegram.mensajes = [];
  telegram.destino = { token: "tok", chatId: "chat" };
  clf.caido = false;
  clf.atribuciones = [];
  clf.coincidencias = [];
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://fotoffice.com");
  vi.stubEnv("FOTOFFICE_MAILING_SECRET", "secreto-de-prueba");
  vi.stubEnv("RESEND_API_KEY", "");
  vi.stubEnv("VENDEDOR_RESEND_API_KEY", "");
  await guardarAjustesVendedor({ pausado: false, arrancoEn: "2026-11-02" });
  B.agregar("systemSettings", { key: CLAVE_CONOCIMIENTO, value: JSON.stringify({ texto: "CompraMeLaFoto vende fotos.", version: "v1" }) });
  B.agregar("systemSettings", { key: "fotoffice_vendedor_campana_escolar", value: JSON.stringify({ emails: [] }) });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

// --- debeRecordar -----------------------------------------------------------------------------

describe("debeRecordar", () => {
  const base = {
    estado: "ENVIADO", recordadoEn: null, ultimaRespuestaEn: null, recordatorioCancelado: false, registradoEn: null,
    modoManual: false, enviadoEn: HACE_UNA_SEMANA,
  };
  it("sólo un hilo ENVIADO, sin respuesta ni registro, de un contacto CONTACTADO y vencido", () => {
    expect(M.debeRecordar(base, "CONTACTADO", AHORA)).toBe(true);
    expect(M.debeRecordar({ ...base, estado: "RECORDADO" }, "CONTACTADO", AHORA)).toBe(false);
    expect(M.debeRecordar({ ...base, recordadoEn: AHORA }, "CONTACTADO", AHORA)).toBe(false);
    expect(M.debeRecordar({ ...base, ultimaRespuestaEn: AHORA }, "CONTACTADO", AHORA)).toBe(false);
    expect(M.debeRecordar({ ...base, recordatorioCancelado: true }, "CONTACTADO", AHORA)).toBe(false);
    expect(M.debeRecordar({ ...base, registradoEn: AHORA }, "CONTACTADO", AHORA)).toBe(false);
    expect(M.debeRecordar({ ...base, modoManual: true }, "CONTACTADO", AHORA)).toBe(false);
    expect(M.debeRecordar(base, "NO_CONTACTAR", AHORA)).toBe(false);
    expect(M.debeRecordar(base, "SE_SUMO", AHORA)).toBe(false);
    expect(M.debeRecordar({ ...base, enviadoEn: new Date("2026-11-09T15:00:00.000Z") }, "CONTACTADO", AHORA)).toBe(false);
    expect(M.debeRecordar({ ...base, enviadoEn: null }, "CONTACTADO", AHORA)).toBe(false);
  });
});

// --- Corrida ----------------------------------------------------------------------------------

describe("correrVendedor", () => {
  it("en pausa no envía pero procesa las respuestas", async () => {
    await guardarAjustesVendedor({ pausado: true });
    modeloAprobado();
    contacto();
    const h = hiloEnviado({ enviadoEn: new Date("2026-11-09T15:00:00.000Z") });
    await E.registrarEntrante(
      { id: "in_1", de: h.email, deNombre: "Ana", para: ["daniel@compramelafoto.com"], asunto: "Re: Una idea", texto: "Me interesa", messageId: "<r1@gmail.com>", inReplyTo: null, referencias: [], cabeceras: {} },
      AHORA,
    );
    clasificacion("INTERESADO");

    const r = await correr();

    expect(r.frenadoPor).toBe("PAUSADO");
    expect(r.respuestas).toBe(1);
    expect(r.enviados).toBe(0);
    expect(enviados).toHaveLength(0);
    expect(B.datos.dnxVendedorCorreo.find((c) => c.resendId === "in_1")!.procesadoEn).not.toBeNull();
    // En pausa la respuesta pasa a Daniel.
    expect(telegram.mensajes.some((m) => m.html.includes("en pausa"))).toBe(true);
  });

  it("rampa: el 10/11 a las 17:55 con 9 enviados manda 1 y no más", async () => {
    await guardarAjustesVendedor({ arrancoEn: "2026-11-10" });
    a("2026-11-10T20:55:00.000Z");
    modeloAprobado();
    contacto();
    contacto();
    contacto();
    enviadosHoy(9);
    adaptado();
    adaptado();

    const r = await correr();

    expect(r.enviados).toBe(1);
    expect(enviados).toHaveLength(1);
  });

  it("el 17/11 el cupo es 20", async () => {
    await guardarAjustesVendedor({ arrancoEn: "2026-11-10" });
    a("2026-11-17T20:55:00.000Z");
    modeloAprobado();
    contacto();
    contacto();
    enviadosHoy(18);
    adaptado();
    adaptado();

    const r = await correr();

    // Con el cupo de la primera semana (10) no saldría ninguno.
    expect(r.enviados).toBe(2);
  });

  it("fuera de 9 a 18 o en feriado no envía", async () => {
    modeloAprobado();
    contacto();
    a("2026-11-10T21:00:00.000Z");
    expect(await correr()).toMatchObject({ enviados: 0, frenadoPor: "FUERA_DE_HORARIO" });
    a("2026-12-08T15:00:00.000Z");
    expect(await correr()).toMatchObject({ enviados: 0, frenadoPor: "FUERA_DE_HORARIO" });
    expect(enviados).toHaveLength(0);
  });

  it("no manda más de 2 por corrida y reparte en el día", async () => {
    modeloAprobado();
    for (let i = 0; i < 5; i++) contacto();
    for (let i = 0; i < 5; i++) adaptado();

    a("2026-11-10T12:15:00.000Z");
    expect((await correr()).enviados).toBe(1);

    a(AHORA);
    expect((await correr()).enviados).toBe(2);
    expect(enviados).toHaveLength(3);
  });

  it("prioridad: primero el pendiente aprobado, después el recordatorio, después el primero", async () => {
    const modeloId = modeloAprobado();
    contacto();
    const recordar = hiloEnviado();
    const ejemplo = contacto();
    B.agregar("dnxVendedorHilo", {
      contactoId: ejemplo, grupo: "FOTOGRAFO:ESCOLAR", modeloId, token: "tok-ejemplo", estado: "PENDIENTE_ENVIO",
      borrador: { asunto: "El ejemplo aprobado", cuerpo: "Hola, este es el ejemplo: {{ENLACE}}" },
    });
    recordatorio();
    adaptado();

    const r = await correr();

    expect(r).toMatchObject({ enviados: 1, recordatorios: 1 });
    expect(enviados.map((e) => e.subject)).toEqual(["El ejemplo aprobado", "Re: Una idea para tus fotos escolares"]);
    expect(enviados[0]!.text).toContain("https://www.compramelafoto.com/land/fotografo-escolar?dnxv=tok-ejemplo");
    expect(enviados[1]!.headers?.["In-Reply-To"]).toBe(`<primero-${recordar.hiloId}@resend.dev>`);
    expect(hiloDe(ejemplo)).toMatchObject({ estado: "ENVIADO", borrador: null });
    expect(fila("dnxContacto", ejemplo).estado).toBe("CONTACTADO");
  });

  it("las respuestas a dudas no consumen cupo", async () => {
    a("2026-11-10T12:30:00.000Z"); // 9:30: cupo de 20 → 2 hasta ahora
    modeloAprobado();
    contacto();
    enviadosHoy(5, "RESPUESTA");
    enviadosHoy(1);
    const h = hiloEnviado({ enviadoEn: new Date("2026-11-09T15:00:00.000Z") });
    await E.registrarEntrante(
      { id: "in_1", de: h.email, deNombre: "Ana", para: ["daniel@compramelafoto.com"], asunto: "Re: Una idea", texto: "¿Cómo sigo?", messageId: "<r1@gmail.com>", inReplyTo: null, referencias: [], cabeceras: {} },
      AHORA,
    );
    clasificacion("INTERESADO");
    adaptado();

    const r = await correr();

    expect(r).toMatchObject({ respuestas: 1, enviados: 1 });
    expect(salidas("RESPUESTA")).toHaveLength(1);
    expect(salidas("PRIMERO")).toHaveLength(1);
  });

  describe("recordatorio", () => {
    it("sale uno solo", async () => {
      const h = hiloEnviado();
      recordatorio();

      expect((await correr()).recordatorios).toBe(1);
      a("2026-11-10T16:00:00.000Z");
      expect((await correr()).recordatorios).toBe(0);

      expect(salidas("RECORDATORIO")).toHaveLength(1);
      expect(enviados[0]!.idempotencyKey).toBe(`dnx-vendedor:${h.hiloId}:RECORDATORIO`);
      expect(fila("dnxVendedorHilo", h.hiloId)).toMatchObject({ estado: "RECORDADO", borrador: null });
      // El contacto ya está CONTACTADO: el recordatorio no pasa por el chequeo de «apto».
      expect(fila("dnxContacto", h.contactoId).estado).toBe("CONTACTADO");
    });

    it("no sale si contestó", async () => {
      const h = hiloEnviado();
      await E.registrarEntrante(
        { id: "in_1", de: h.email, deNombre: "Ana", para: ["daniel@compramelafoto.com"], asunto: "Re: Una idea", texto: "Me interesa", messageId: "<r1@gmail.com>", inReplyTo: null, referencias: [], cabeceras: {} },
        AHORA,
      );
      clasificacion("INTERESADO");

      const r = await correr();

      expect(r.recordatorios).toBe(0);
      expect(salidas("RECORDATORIO")).toHaveLength(0);
    });

    it("no sale si la respuesta fue automática", async () => {
      const h = hiloEnviado();
      await E.registrarEntrante(
        { id: "in_1", de: h.email, deNombre: "Ana", para: ["daniel@compramelafoto.com"], asunto: "Fuera de la oficina", texto: "Vuelvo el lunes", messageId: "<r1@gmail.com>", inReplyTo: null, referencias: [], cabeceras: { "auto-submitted": "auto-replied" } },
        AHORA,
      );

      const r = await correr();

      expect(r.recordatorios).toBe(0);
      expect(salidas("RECORDATORIO")).toHaveLength(0);
    });

    it("no sale si se registró", async () => {
      const h = hiloEnviado();
      clf.atribuciones = [{ token: h.token, userId: 7, rol: "PHOTOGRAPHER", creadoEn: "2026-11-05T12:00:00.000Z" }];

      const r = await correr();

      expect(r.recordatorios).toBe(0);
      expect(salidas("RECORDATORIO")).toHaveLength(0);
      expect(fila("dnxVendedorHilo", h.hiloId).registradoEn).not.toBeNull();
      expect(telegram.mensajes.some((m) => m.html.includes("✅ Se sumó a CLF"))).toBe(true);
    });

    it("espera el Message-ID del primero", async () => {
      const h = hiloEnviado({ messageId: null });

      expect((await correr()).recordatorios).toBe(0);
      expect(salidas("RECORDATORIO")).toHaveLength(0);
      expect(fila("dnxVendedorHilo", h.hiloId)).toMatchObject({ estado: "ENVIADO", tomadoEn: null });
    });

    it("un reintento reusa el texto guardado", async () => {
      const h = hiloEnviado();
      recordatorio();
      fallasEnvio.push({ status: "INTERNAL_ERROR", detail: "caído" });

      expect((await correr()).recordatorios).toBe(0);
      a("2026-11-10T15:15:00.000Z");
      expect((await correr()).recordatorios).toBe(1);

      expect(pedidosClaude).toBe(1);
      expect(enviados).toHaveLength(2);
      expect(enviados[1]!.text).toBe(enviados[0]!.text);
      expect(fila("dnxVendedorHilo", h.hiloId).estado).toBe("RECORDADO");
    });
  });

  it("un NO_CONTACTAR que aparece entre la cola y el envío no recibe", async () => {
    modeloAprobado();
    const id = contacto();
    adaptado();
    antesDeEnviar = async (contactoId) => {
      fila("dnxContacto", contactoId).estado = "NO_CONTACTAR";
    };

    const r = await correr();

    expect(r.enviados).toBe(0);
    expect(enviados).toHaveLength(0);
    expect(hiloDe(id)).toMatchObject({ estado: "BAJA", cierre: "BAJA" });
  });

  it("si CLF no responde no sale ningún primer correo", async () => {
    modeloAprobado();
    contacto();
    contacto();
    clf.caido = true;

    const r = await correr();

    expect(r).toMatchObject({ enviados: 0, frenadoPor: "SIN_CLF" });
    expect(enviados).toHaveLength(0);
    expect(hilos()).toHaveLength(0);
    expect(pedidosClaude).toBe(0);
  });

  it("un usuario de CLF no recibe y no vuelve a la cola", async () => {
    modeloAprobado();
    const id = contacto({ email: "marta@fotosur.com.ar" });
    clf.coincidencias = [{ clave: "marta@fotosur.com.ar", userId: 3, rol: "PHOTOGRAPHER", creadoEn: "2026-01-01T00:00:00.000Z", baja: false }];

    const r = await correr();

    expect(r.enviados).toBe(0);
    expect(hiloDe(id)).toMatchObject({ estado: "CERRADO", cierre: "YA_ERA_USUARIO" });
  });

  it("un grupo sin modelo propone uno y no gasta cupo", async () => {
    modeloAprobado();
    contacto();
    contacto();
    contacto({ nicho: "DEPORTIVA" });
    adaptado();
    adaptado();
    modeloNuevo();

    const r = await correr();

    expect(r).toMatchObject({ enviados: 2, propuestos: 1 });
    expect(B.datos.dnxVendedorModelo.filter((m) => m.grupo === "FOTOGRAFO:DEPORTIVA" && m.estado === "PROPUESTO")).toHaveLength(1);
    expect(telegram.mensajes.some((m) => m.html.includes("Modelo de primer correo"))).toBe(true);
  });

  it("si proponer un modelo falla, la corrida sigue con el próximo grupo", async () => {
    contacto({ nicho: "DEPORTIVA" });
    contacto({ nicho: "SOCIAL" });
    modeloNuevo();
    modeloNuevo();
    const crear = B.tablas.dnxVendedorModelo.create;
    let primera = true;
    B.tablas.dnxVendedorModelo.create = async (x) => {
      if (primera) {
        primera = false;
        throw new Error("falla de la base");
      }
      return crear(x);
    };

    const r = await correr();
    B.tablas.dnxVendedorModelo.create = crear;

    expect(r.propuestos).toBe(1);
  });

  it("con el tope frena y avisa una sola vez por mes", async () => {
    modeloAprobado();
    contacto();
    B.agregar("dnxVendedorGasto", { usdMicros: 28_000_000, motivo: "CORREO", creadoEn: new Date("2026-11-03T15:00:00.000Z") });

    expect(await correr()).toMatchObject({ enviados: 0, frenadoPor: "TOPE" });
    a("2026-11-10T15:15:00.000Z");
    expect(await correr()).toMatchObject({ enviados: 0, frenadoPor: "TOPE" });

    expect(telegram.mensajes.filter((m) => m.html.includes("tope de gasto"))).toHaveLength(1);
    expect((await leerAjustesVendedor()).avisoTope).toBe("2026-11");
    expect(enviados).toHaveLength(0);
  });

  it("dos corridas a la vez no le escriben dos veces al mismo contacto", async () => {
    modeloAprobado();
    const id = contacto();
    adaptado();
    adaptado();

    const [r1, r2] = await Promise.all([correr(), correr()]);

    expect(r1.enviados + r2.enviados).toBe(1);
    expect(enviados).toHaveLength(1);
    expect(hilos().filter((h) => h.contactoId === id)).toHaveLength(1);
  });

  it("una corrida que empieza durante el envío de otra no toma el mismo hilo", async () => {
    modeloAprobado();
    contacto();
    adaptado();
    let otra: Promise<unknown> | null = null;
    antesDeEnviar = async () => {
      otra ??= correr();
      await otra;
    };

    await correr();

    expect(enviados).toHaveLength(1);
  });

  it("con soloContactoPrueba sólo le escribe a ese contacto", async () => {
    modeloAprobado();
    contacto();
    const prueba = contacto();
    await guardarAjustesVendedor({ soloContactoPrueba: prueba });
    adaptado();
    adaptado();

    const r = await correr();

    expect(r.enviados).toBe(1);
    expect(hilos().map((h) => h.contactoId)).toEqual([prueba]);
  });

  it("tres fallas cierran el hilo como FALLO", async () => {
    modeloAprobado();
    const id = contacto();
    adaptado();
    fallasEnvio.push(
      { status: "PROVIDER_REJECTED", detail: "no" },
      { status: "PROVIDER_REJECTED", detail: "no" },
      { status: "PROVIDER_REJECTED", detail: "no" },
    );

    for (const hora of ["15:00", "15:15", "15:30", "15:45"]) {
      a(`2026-11-10T${hora}:00.000Z`);
      await correr();
    }

    expect(enviados).toHaveLength(3);
    expect(hiloDe(id)).toMatchObject({ estado: "CERRADO", cierre: "FALLO", intentos: 3 });
  });

  it("un reintento del primero reusa el texto guardado y la misma clave", async () => {
    modeloAprobado();
    const id = contacto();
    adaptado();
    fallasEnvio.push({ status: "INTERNAL_ERROR", detail: "caído" });

    expect((await correr()).enviados).toBe(0);
    expect(hiloDe(id)).toMatchObject({ estado: "PENDIENTE_ENVIO", intentos: 1, tomadoEn: null });
    a("2026-11-10T15:15:00.000Z");
    expect((await correr()).enviados).toBe(1);

    const hiloId = hiloDe(id)!.id as string;
    expect(pedidosClaude).toBe(1);
    expect(enviados.map((e) => e.idempotencyKey)).toEqual([`dnx-vendedor:${hiloId}:PRIMERO`, `dnx-vendedor:${hiloId}:PRIMERO`]);
    expect(enviados[1]!.text).toBe(enviados[0]!.text);
    expect(hiloDe(id)).toMatchObject({ estado: "ENVIADO", borrador: null });
  });

  it("si falla después de enviar, el reintento no manda un segundo primer correo", async () => {
    modeloAprobado();
    const id = contacto();
    adaptado();
    const actualizar = B.tablas.dnxVendedorHilo.update;
    let fallar = true;
    B.tablas.dnxVendedorHilo.update = async (x) => {
      if (fallar && (x.data as Fila).estado === "ENVIADO") {
        fallar = false;
        throw new Error("se cortó la base");
      }
      return actualizar(x);
    };

    await correr();
    expect(hiloDe(id)!.estado).toBe("PENDIENTE_ENVIO");
    a("2026-11-10T15:15:00.000Z");
    await correr();
    B.tablas.dnxVendedorHilo.update = actualizar;

    expect(enviados).toHaveLength(1);
    expect(salidas("PRIMERO")).toHaveLength(1);
    expect(hiloDe(id)).toMatchObject({ estado: "ENVIADO" });
    expect(fila("dnxContacto", id).estado).toBe("CONTACTADO");
  });
});

describe("pasos programados: resumen diario e informe mensual", () => {
  /** Martes 10/11/2026 a las 19:00 argentinas: fuera de la ventana de envío, el resumen toca igual. */
  const A19 = "2026-11-10T22:00:00.000Z";
  /** Domingo 1/11/2026 a las 9:00 argentinas. */
  const D1 = "2026-11-01T12:00:00.000Z";
  const resumenes = () => telegram.mensajes.filter((m) => m.html.includes("resumen de hoy"));
  const informes = () => telegram.mensajes.filter((m) => m.html.includes("informe de octubre"));

  it("a las 19 manda el resumen con actividad, una sola vez por día", async () => {
    a(A19);
    enviadosHoy(2);
    await correr();
    expect(resumenes()).toHaveLength(1);
    expect(resumenes()[0]!.html).toContain("Salieron 2 correos");
    expect((await leerAjustesVendedor()).resumenDia).toBe("2026-11-10");

    a("2026-11-10T22:15:00.000Z");
    await correr();
    expect(resumenes()).toHaveLength(1);
  });

  it("a las 19 sin actividad no manda nada pero marca el día", async () => {
    a(A19);
    await correr();
    expect(resumenes()).toHaveLength(0);
    expect((await leerAjustesVendedor()).resumenDia).toBe("2026-11-10");
  });

  it("antes de las 19 no manda el resumen", async () => {
    enviadosHoy(2);
    await correr();
    expect(resumenes()).toHaveLength(0);
    expect((await leerAjustesVendedor()).resumenDia).toBeNull();
  });

  it("el día 1 a las 9 manda el informe del mes anterior, lo guarda y lo manda una sola vez", async () => {
    a(D1);
    const h = B.agregar("dnxVendedorHilo", { contactoId: "cx", grupo: "CLUB", token: "tx", estado: "ENVIADO" }) as { id: string };
    B.agregar("dnxVendedorCorreo", {
      hiloId: h.id, direccion: "SALIDA", paso: "PRIMERO", de: "d", para: "p", asunto: "a", texto: "t", creadoEn: new Date("2026-10-20T15:00:00Z"),
    });
    await correr();
    expect(informes()).toHaveLength(1);
    expect(informes()[0]!.html).toContain("mínimo comprobado");
    expect((await leerAjustesVendedor()).informeMes).toBe("2026-10");
    expect(B.datos.systemSettings.some((s) => s.key === "fotoffice_vendedor_informe_2026-10")).toBe(true);

    a("2026-11-01T12:15:00.000Z");
    await correr();
    expect(informes()).toHaveLength(1);
  });

  it("si CLF falla el informe sale igual, no se marca y se reintenta sin repetir el aviso", async () => {
    a(D1);
    B.agregar("dnxVendedorHilo", {
      contactoId: "cx", grupo: "CLUB", token: "tx", estado: "ENVIADO", registradoEn: new Date("2026-10-05T15:00:00Z"), usuarioClfId: 9,
    });
    // Para el informe CLF falla; la consulta diaria y el conocimiento ya están guardados.
    const pedirVentas = deps();
    const fetchOriginal = pedirVentas.clf.fetch;
    let caidoVentas = true;
    pedirVentas.clf.fetch = (async (url: string, init?: RequestInit) => {
      const cuerpo = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      if (cuerpo.consulta === "ventas") {
        return caidoVentas ? new Response("{}", { status: 503 }) : Response.json({ ventas: [{ userId: 9, ventas: 2, totalPesos: 50_000 }] });
      }
      return fetchOriginal(url, init);
    }) as typeof fetch;
    const correrConClf = () => M.correrVendedor({ presupuestoMs: 240_000, motivo: "CRON" }, pedirVentas);

    await correrConClf();
    expect(informes()).toHaveLength(1);
    expect(informes()[0]!.html).toContain("No pude traer las ventas de CLF");
    expect(informes()[0]!.html).not.toContain("vendieron");
    expect((await leerAjustesVendedor()).informeMes).toBeNull();

    // Sigue fallando: se reintenta pero no se repite el aviso.
    a("2026-11-01T12:15:00.000Z");
    await correrConClf();
    expect(informes()).toHaveLength(1);
    expect((await leerAjustesVendedor()).informeMes).toBeNull();

    // CLF vuelve: sale el informe completo y se marca.
    caidoVentas = false;
    a("2026-11-01T12:30:00.000Z");
    await correrConClf();
    expect(informes()).toHaveLength(2);
    expect(informes()[1]!.html).toContain("1 vendieron (2 ventas, $ 50.000)");
    expect((await leerAjustesVendedor()).informeMes).toBe("2026-10");
  });

  it("una excepción en un paso anterior no saltea el resumen", async () => {
    a(A19);
    enviadosHoy(1);
    const buscar = B.tablas.dnxVendedorGasto.findMany;
    let primera = true;
    B.tablas.dnxVendedorGasto.findMany = async (x) => {
      if (primera) {
        primera = false;
        throw new Error("se cortó la base");
      }
      return buscar(x);
    };
    await expect(correr()).rejects.toThrow("se cortó la base");
    B.tablas.dnxVendedorGasto.findMany = buscar;
    expect(resumenes()).toHaveLength(1);
  });

  it("si el resumen falla, la corrida no se rompe", async () => {
    a(A19);
    enviadosHoy(1);
    const buscar = B.tablas.dnxVendedorModelo.findMany;
    B.tablas.dnxVendedorModelo.findMany = async () => {
      throw new Error("se cortó la base");
    };
    await expect(correr()).resolves.toMatchObject({ frenadoPor: "FUERA_DE_HORARIO" });
    B.tablas.dnxVendedorModelo.findMany = buscar;
  });

  it("un error inesperado al crear un hilo no corta la cola ni las propuestas", async () => {
    modeloAprobado();
    const malo = contacto();
    const bueno = contacto();
    contacto({ nicho: "DEPORTIVA" });
    adaptado();
    modeloNuevo();
    const crear = B.tablas.dnxVendedorHilo.create;
    B.tablas.dnxVendedorHilo.create = async (x) => {
      if ((x.data as Fila).contactoId === malo) throw new Error("falla de la base");
      return crear(x);
    };
    const r = await correr();
    B.tablas.dnxVendedorHilo.create = crear;

    expect(r.enviados).toBe(1);
    expect(r.propuestos).toBe(1);
    expect(hiloDe(malo)).toBeUndefined();
    expect(hiloDe(bueno)).toMatchObject({ estado: "ENVIADO" });
  });
});
