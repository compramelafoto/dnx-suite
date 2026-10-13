import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});

vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma, Prisma: { JsonNull: null } }));
vi.mock("@/lib/presupuestos/sitio", () => ({
  sitioDelWorkspace: async (ws: string) => ({ workspaceId: ws, slug: "dnxestudio", customDomain: null, nombre: "DNX", logoUrl: null, whatsapp: null, email: null }),
  workspaceDelSlug: async () => "ws-1",
}));
vi.mock("@/lib/communications/load-workspace-signature", () => ({
  loadWorkspaceEmailContext: async () => ({ organizationName: "DNX Estudio", signature: { html: "<p>DNX</p>", text: "DNX" }, contact: { email: "hola@dnx.test", phone: null, whatsapp: null, website: null, instagram: null, city: null } }),
}));

const C = await import("./correos");
const { tokenDeGaleriaCliente, hashDeToken } = await import("./enlace");
const { clavesPermitidas } = await import("@/lib/plantillas/variables");
const { analizar } = await import("@/lib/plantillas/motor");
const { CLAVES_AUTOMATICO_GALERIA } = await import("./constantes-correo");
const { AUTOMATICOS } = await import("@/lib/plantillas/definiciones");
const { TOPE_AUTOMATICOS_DIA } = await import("@/lib/plantillas/constantes");

const AHORA = new Date("2026-10-10T15:00:00.000Z");
const CLAVE = "clave-de-prueba";
const DEPS = { ahora: () => AHORA, clave: CLAVE, appOrigin: "https://app.test" };

type Salida = { to: string; subject: string; html: string; text: string };
let enviados: Salida[];
let resultado: { status: "SENT"; providerId: string } | { status: "PROVIDER_REJECTED"; detail: string };
const enviar = async (m: Salida) => {
  enviados.push(m);
  return resultado as never;
};
const mensajes = () => B.datos.fotofficeMessage;
const eventos = () => B.datos.fotofficeGaleriaEvento;

const base = { workspaceId: "ws-1", galeriaId: "g1", para: "ana@x.com", nombre: "Ana Gómez", numero: "G-1", nombreGaleria: "Boda Ana y Luis" };
const TOKEN = tokenDeGaleriaCliente("gc1", AHORA, CLAVE);
const URL_ENLACE = `https://app.test/w/dnxestudio/galeria/${TOKEN}`;

beforeEach(() => {
  B.vaciar();
  enviados = [];
  resultado = { status: "SENT", providerId: "prov-1" };
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  B.agregar("fotofficeGaleria", { id: "g1", workspaceId: "ws-1", proyectoId: "pr1", number: "G-1", name: "Boda Ana y Luis", status: "PUBLICADA" });
  B.agregar("fotofficeGaleriaCliente", { id: "gc1", workspaceId: "ws-1", galeriaId: "g1", name: "Ana Gómez", email: "ana@x.com", tokenHash: hashDeToken(TOKEN), tokenIssuedAt: AHORA });
});

describe("plantillas iniciales", () => {
  it("usan sólo variables del tipo GALERIA, el envío lleva el enlace y la copia lleva la cantidad", () => {
    const permitidas = clavesPermitidas("GALERIA", []);
    for (const clave of CLAVES_AUTOMATICO_GALERIA) {
      const t = C.TEXTOS_GALERIA_INICIALES[clave];
      expect(analizar(t.asunto, permitidas).ok).toBe(true);
      expect(analizar(t.cuerpo, permitidas).ok).toBe(true);
      expect(AUTOMATICOS[clave].tipo).toBe("GALERIA");
      expect(`${t.asunto} ${t.cuerpo}`).not.toMatch(/\bplata\b/i);
    }
    expect(C.TEXTOS_GALERIA_INICIALES.GALERIA_ENVIO.cuerpo).toContain("[galeria_enlace]");
    expect(C.TEXTOS_GALERIA_INICIALES.GALERIA_ENVIO.cuerpo).not.toContain("[galeria_cantidad]");
    expect(C.TEXTOS_GALERIA_INICIALES.GALERIA_SELECCION_ENVIADA.cuerpo).toContain("[galeria_cantidad]");
  });
  it("se crean una sola vez, encendidas", async () => {
    await C.asegurarPlantillasGaleria("ws-1");
    await C.asegurarPlantillasGaleria("ws-1");
    const filas = B.datos.fotofficeMessageTemplate;
    expect(filas.map((f) => f.systemKey).sort()).toEqual([...CLAVES_AUTOMATICO_GALERIA].sort());
    expect(filas.every((f) => f.enabled === true && f.entityType === "GALERIA" && f.channel === "EMAIL")).toBe(true);
  });
});

describe("textos de la entrega y de la descarga lista", () => {
  it("el enlace de una entrega habla de ver y descargar, no de elegir", () => {
    const t = C.TEXTOS_GALERIA_INICIALES.GALERIA_ENTREGA_ENVIO;
    expect(t.cuerpo).toContain("ya están listas para ver y descargar");
    expect(`${t.asunto} ${t.cuerpo}`).not.toMatch(/elegir|elegí|selección/i);
    expect(t.cuerpo).toContain("[galeria_enlace]");
    expect(AUTOMATICOS.GALERIA_ENTREGA_ENVIO.tipo).toBe("GALERIA");
  });
  it("el aviso de descarga lista trae el enlace y el vencimiento", () => {
    const t = C.TEXTOS_GALERIA_INICIALES.GALERIA_DESCARGA_LISTA;
    expect(t.cuerpo).toContain("[galeria_enlace]");
    expect(t.cuerpo).toContain("[galeria_vence]");
    expect(AUTOMATICOS.GALERIA_DESCARGA_LISTA).toMatchObject({ canal: "EMAIL", tipo: "GALERIA" });
  });
  it("el aviso sale con la fecha de vencimiento y el registro no guarda el enlace", async () => {
    const r = await C.enviarCorreoGaleria({ ...base, clave: "GALERIA_DESCARGA_LISTA", enlace: `${URL_ENLACE}/descargas`, vence: "18 de octubre de 2026" }, { ...DEPS, enviar });
    expect(r).toBe("ENVIADO");
    expect(enviados[0]!.text).toContain("18 de octubre de 2026");
    expect(enviados[0]!.text).toContain(`${URL_ENLACE}/descargas`);
    expect(mensajes()[0]!.body).toContain("18 de octubre de 2026");
    expect(String(mensajes()[0]!.body)).not.toContain(TOKEN);
  });
  it("enviarCorreoEnlace usa el texto de entrega cuando la galería es de entrega, y el de selección si no", async () => {
    B.datos.fotofficeGaleria.find((g) => g.id === "g1")!.kind = "ENTREGA";
    expect(await C.enviarCorreoEnlace("ws-1", "gc1", 7, { ...DEPS, enviar })).toBe("ENVIADO");
    expect(enviados[0]!.subject).toBe("Tus fotos ya están listas: Boda Ana y Luis");
    expect(enviados[0]!.text).toContain("para ver y descargar");
    B.datos.fotofficeGaleria.find((g) => g.id === "g1")!.kind = "SELECCION";
    await C.enviarCorreoEnlace("ws-1", "gc1", 7, { ...DEPS, enviar });
    expect(enviados[1]!.subject).toBe("Elegí tus fotos: Boda Ana y Luis");
  });
});

describe("enviarCorreoGaleria", () => {
  it("sale al cliente con su nombre y su enlace, y el registro NO guarda el enlace personal", async () => {
    const r = await C.enviarCorreoGaleria({ ...base, clave: "GALERIA_ENVIO", enlace: URL_ENLACE }, { ...DEPS, enviar });
    expect(r).toBe("ENVIADO");
    expect(enviados).toHaveLength(1);
    expect(enviados[0]!.to).toBe("ana@x.com");
    expect(enviados[0]!.subject).toBe("Elegí tus fotos: Boda Ana y Luis");
    expect(enviados[0]!.text).toContain(URL_ENLACE);
    expect(enviados[0]!.text).toContain("Ana");
    expect(mensajes()).toHaveLength(1);
    expect(mensajes()[0]).toMatchObject({ workspaceId: "ws-1", entityType: "GALERIA", entityId: "g1", toAddress: "ana@x.com", status: "SENT", automatic: true, providerId: "prov-1" });
    expect(JSON.stringify(mensajes()[0])).not.toContain(TOKEN);
    expect(String(mensajes()[0]!.body)).toContain("(enlace personal)");
  });
  it("respeta el tope diario de automáticos: no envía ni registra al llegar", async () => {
    for (let i = 0; i < TOPE_AUTOMATICOS_DIA; i++) {
      B.agregar("fotofficeMessage", { workspaceId: "ws-1", channel: "EMAIL", entityType: "CLIENTE", entityId: "x", toAddress: `a${i}@x.com`, body: "", status: "SENT", automatic: true, createdAt: AHORA });
    }
    const antes = mensajes().length;
    expect(await C.enviarCorreoGaleria({ ...base, clave: "GALERIA_ENVIO", enlace: URL_ENLACE }, { ...DEPS, enviar })).toBe("TOPE");
    expect(enviados).toHaveLength(0);
    expect(mensajes()).toHaveLength(antes);
  });
  it("plantilla apagada, dirección inválida, plantilla rota y falla del proveedor: no lanza y deja el motivo", async () => {
    await C.asegurarPlantillasGaleria("ws-1");
    const t = B.datos.fotofficeMessageTemplate.find((x) => x.systemKey === "GALERIA_ENVIO")!;
    t.enabled = false;
    expect(await C.enviarCorreoGaleria({ ...base, clave: "GALERIA_ENVIO", enlace: URL_ENLACE }, { ...DEPS, enviar })).toBe("APAGADA");
    expect(await C.enviarCorreoGaleria({ ...base, para: "no-es-correo", clave: "GALERIA_ENVIO", enlace: URL_ENLACE }, { ...DEPS, enviar })).toBe("SIN_CORREO");
    t.enabled = true;
    t.body = "Hola [variable_que_no_existe]";
    expect(await C.enviarCorreoGaleria({ ...base, clave: "GALERIA_ENVIO", enlace: URL_ENLACE }, { ...DEPS, enviar })).toBe("PLANTILLA_CON_ERRORES");
    t.body = C.TEXTOS_GALERIA_INICIALES.GALERIA_ENVIO.cuerpo;
    resultado = { status: "PROVIDER_REJECTED", detail: "HTTP 422 · validation_error" };
    expect(await C.enviarCorreoGaleria({ ...base, clave: "GALERIA_ENVIO", enlace: URL_ENLACE }, { ...DEPS, enviar })).toBe("NO_ENVIADO");
    expect(mensajes().at(-1)).toMatchObject({ status: "FAILED", errorCode: "PROVIDER_REJECTED:422:validation_error" });
    const lanza = async () => { throw new Error("se cayó"); };
    expect(await C.enviarCorreoGaleria({ ...base, clave: "GALERIA_ENVIO", enlace: URL_ENLACE }, { ...DEPS, enviar: lanza as never })).toBe("ERROR");
    expect(enviados).toHaveLength(1);
  });
  it("la copia de la selección lleva la cantidad", async () => {
    const r = await C.enviarCorreoGaleria({ ...base, clave: "GALERIA_SELECCION_ENVIADA", cantidad: 42 }, { ...DEPS, enviar });
    expect(r).toBe("ENVIADO");
    expect(enviados[0]!.text).toContain("42");
    expect(enviados[0]!.subject).toContain("Boda Ana y Luis");
  });
});

describe("enviarCorreoEnlace (lo que corre en after())", () => {
  it("manda el enlace vigente del cliente y deja el resultado en el historial de la galería", async () => {
    expect(await C.enviarCorreoEnlace("ws-1", "gc1", 7, { ...DEPS, enviar })).toBe("ENVIADO");
    expect(enviados[0]!.text).toContain(URL_ENLACE);
    expect(eventos().map((e) => [e.type, e.galeriaId, e.galeriaClienteId, e.actorUserId])).toEqual([["CORREO_ENVIADO", "g1", "gc1", 7]]);
  });
  it("si no salió, el historial dice por qué (sin datos personales)", async () => {
    resultado = { status: "PROVIDER_REJECTED", detail: "HTTP 500" };
    expect(await C.enviarCorreoEnlace("ws-1", "gc1", 7, { ...DEPS, enviar })).toBe("NO_ENVIADO");
    expect(eventos()[0]).toMatchObject({ type: "CORREO_NO_ENVIADO", data: { motivo: "NO_ENVIADO" } });
    expect(JSON.stringify(eventos())).not.toContain("ana@x.com");
  });
  it("no manda nada si la galería ya no está publicada, si el enlace se anuló o si cambió (el hash no coincide)", async () => {
    B.datos.fotofficeGaleria[0]!.status = "ARCHIVADA";
    expect(await C.enviarCorreoEnlace("ws-1", "gc1", 7, { ...DEPS, enviar })).toBe("ERROR");
    B.datos.fotofficeGaleria[0]!.status = "PUBLICADA";
    B.datos.fotofficeGaleriaCliente[0]!.revokedAt = AHORA;
    expect(await C.enviarCorreoEnlace("ws-1", "gc1", 7, { ...DEPS, enviar })).toBe("ERROR");
    B.datos.fotofficeGaleriaCliente[0]!.revokedAt = null;
    B.datos.fotofficeGaleriaCliente[0]!.tokenHash = "otro";
    expect(await C.enviarCorreoEnlace("ws-1", "gc1", 7, { ...DEPS, enviar })).toBe("ERROR");
    expect(enviados).toHaveLength(0);
  });
  it("cliente de otro workspace: nada", async () => {
    expect(await C.enviarCorreoEnlace("ws-2", "gc1", 7, { ...DEPS, enviar })).toBe("ERROR");
    expect(enviados).toHaveLength(0);
    expect(eventos()).toHaveLength(0);
  });
  it("sin correo cargado: queda anotado y no sale", async () => {
    B.datos.fotofficeGaleriaCliente[0]!.email = null;
    expect(await C.enviarCorreoEnlace("ws-1", "gc1", 7, { ...DEPS, enviar })).toBe("SIN_CORREO");
    expect(eventos()[0]).toMatchObject({ type: "CORREO_NO_ENVIADO", data: { motivo: "SIN_CORREO" } });
  });
});

describe("aviso de ronda nueva del álbum (GALERIA_ALBUM_RONDA)", () => {
  function clienteExtra(id: string, nombre: string, email: string | null, extra: Record<string, unknown> = {}) {
    const token = tokenDeGaleriaCliente(id, AHORA, CLAVE);
    B.agregar("fotofficeGaleriaCliente", { id, workspaceId: "ws-1", galeriaId: "g1", name: nombre, email, tokenHash: hashDeToken(token), tokenIssuedAt: AHORA, ...extra });
    return token;
  }
  beforeEach(() => {
    B.datos.fotofficeGaleria.find((g) => g.id === "g1")!.kind = "ALBUM";
  });

  it("el texto trae el enlace, el número de ronda y la nota del estudio (sólo si hay nota)", () => {
    const t = C.TEXTOS_GALERIA_INICIALES.GALERIA_ALBUM_RONDA;
    for (const v of ["[galeria_enlace]", "[galeria_ronda]", "[galeria_nota]", "[si:galeria_nota]"]) expect(t.cuerpo, v).toContain(v);
    expect(AUTOMATICOS.GALERIA_ALBUM_RONDA).toMatchObject({ canal: "EMAIL", tipo: "GALERIA" });
    expect(CLAVES_AUTOMATICO_GALERIA).toContain("GALERIA_ALBUM_RONDA");
  });
  it("sale con la nota y el enlace personal, y el registro no guarda el enlace", async () => {
    const r = await C.enviarCorreoEnlace("ws-1", "gc1", 7, { ...DEPS, enviar, correo: { clave: "GALERIA_ALBUM_RONDA", ronda: 2, nota: "Cambiamos la tapa." } });
    expect(r).toBe("ENVIADO");
    expect(enviados[0]!.subject).toBe("Hay una ronda nueva de tu álbum para revisar: Boda Ana y Luis");
    expect(enviados[0]!.text).toContain("ronda 2");
    expect(enviados[0]!.text).toContain("Cambiamos la tapa.");
    expect(enviados[0]!.text).toContain(URL_ENLACE);
    expect(String(mensajes()[0]!.body)).not.toContain(TOKEN);
    expect(mensajes()[0]).toMatchObject({ entityType: "GALERIA", entityId: "g1", automatic: true, status: "SENT" });
  });
  it("sin nota, la línea de la nota no aparece", async () => {
    await C.enviarCorreoEnlace("ws-1", "gc1", 7, { ...DEPS, enviar, correo: { clave: "GALERIA_ALBUM_RONDA", ronda: 3, nota: null } });
    expect(enviados[0]!.text).not.toContain("Esto nos dejó el estudio");
    expect(enviados[0]!.text).toContain("ronda 3");
  });
  it("avisarRondaNueva manda a cada cliente con enlace vigente y correo, y se salta al anulado y al que no tiene correo", async () => {
    clienteExtra("gc2", "Luis", "luis@x.com");
    clienteExtra("gc3", "Sin correo", null);
    clienteExtra("gc4", "Anulado", "anulado@x.com", { revokedAt: AHORA });
    const r = await C.avisarRondaNueva("ws-1", "g1", 2, "Hola", 7, { ...DEPS, enviar });
    expect(r).toEqual({ enviados: 2, fallidos: 0 });
    expect(enviados.map((e) => e.to).sort()).toEqual(["ana@x.com", "luis@x.com"]);
    expect(eventos().map((e) => e.type)).toEqual(["CORREO_ENVIADO", "CORREO_ENVIADO"]);
    // Cada uno recibe SU enlace.
    expect(enviados.find((e) => e.to === "luis@x.com")!.text).toContain(tokenDeGaleriaCliente("gc2", AHORA, CLAVE));
    expect(enviados.find((e) => e.to === "luis@x.com")!.text).not.toContain(TOKEN);
  });
  it("un envío rechazado cuenta como fallido y queda en el historial sin datos personales", async () => {
    resultado = { status: "PROVIDER_REJECTED", detail: "HTTP 500" };
    const r = await C.avisarRondaNueva("ws-1", "g1", 2, null, 7, { ...DEPS, enviar });
    expect(r).toEqual({ enviados: 0, fallidos: 1 });
    expect(eventos()[0]).toMatchObject({ type: "CORREO_NO_ENVIADO", data: { motivo: "NO_ENVIADO" } });
    expect(JSON.stringify(eventos())).not.toContain("ana@x.com");
  });
  it("al llegar al tope diario deja de mandar", async () => {
    clienteExtra("gc2", "Luis", "luis@x.com");
    clienteExtra("gc3", "Eva", "eva@x.com");
    for (let i = 0; i < TOPE_AUTOMATICOS_DIA; i++) {
      B.agregar("fotofficeMessage", { workspaceId: "ws-1", channel: "EMAIL", entityType: "GENERAL", entityId: `e${i}`, toAddress: `x${i}@x.com`, body: "x", status: "SENT", automatic: true, createdAt: AHORA });
    }
    const r = await C.avisarRondaNueva("ws-1", "g1", 2, null, 7, { ...DEPS, enviar });
    expect(r).toEqual({ enviados: 0, fallidos: 1 });
    expect(enviados).toHaveLength(0);
  });
  it("nunca avisa a clientes de otra galería ni de otro workspace", async () => {
    B.agregar("fotofficeGaleria", { id: "g2", workspaceId: "ws-1", proyectoId: "pr1", number: "G-2", name: "Otra", status: "PUBLICADA", kind: "ALBUM" });
    B.agregar("fotofficeGaleriaCliente", { id: "gcx", workspaceId: "ws-1", galeriaId: "g2", name: "Otro", email: "otro@x.com", tokenHash: "x", tokenIssuedAt: AHORA });
    expect(await C.avisarRondaNueva("ws-2", "g1", 2, null, 7, { ...DEPS, enviar })).toEqual({ enviados: 0, fallidos: 0 });
    const r = await C.avisarRondaNueva("ws-1", "g1", 2, null, 7, { ...DEPS, enviar });
    expect(r.enviados).toBe(1);
    expect(enviados.map((e) => e.to)).toEqual(["ana@x.com"]);
  });
  it("si la galería no está publicada no manda nada (borrador o archivada)", async () => {
    B.datos.fotofficeGaleria.find((g) => g.id === "g1")!.status = "BORRADOR";
    expect(await C.avisarRondaNueva("ws-1", "g1", 2, null, 7, { ...DEPS, enviar })).toEqual({ enviados: 0, fallidos: 1 });
    expect(enviados).toHaveLength(0);
  });
});
