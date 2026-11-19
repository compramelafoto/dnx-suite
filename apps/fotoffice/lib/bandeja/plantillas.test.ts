import { beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("server-only", () => ({}));
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
vi.mock("@/lib/integrations/whatsapp/credentials", () => ({ leerTokenWhatsapp: vi.fn(async () => "tok"), hayTokenWhatsapp: vi.fn(), guardarTokenWhatsapp: vi.fn() }));

const T = await import("./plantillas");

const AHORA = new Date("2026-11-18T15:00:00.000Z").getTime();
const ctxDe = (userId: number, label: string, levels: Record<string, "VIEW" | "MANAGE" | "NONE">, workspaceId = "w1") => ({
  workspaceId, userId, userLabel: label, role: "STAFF", acceso: { role: "STAFF", levels } as never,
});
const GIULI = ctxDe(2, "Giuli", { "whatsapp-inbox": "MANAGE", clients: "MANAGE" });
const LEO = ctxDe(3, "Leo", { "whatsapp-inbox": "VIEW" });

const RESPUESTA_META = {
  data: [
    { name: "retomar_consulta", language: "es_AR", status: "APPROVED", category: "MARKETING", components: [{ type: "BODY", text: "¡Hola {{1}}! Por tu consulta sobre {{2}}." }] },
    {
      name: "recordatorio_pago", language: "es_AR", status: "APPROVED", category: "UTILITY",
      components: [{ type: "BODY", text: "Hola {{1}}" }, { type: "BUTTONS", buttons: [{ type: "URL", text: "Pagar", url: "https://x.com/p/{{1}}" }] }],
    },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- la base en memoria tipa el cliente como mapa suelto
const P = B.prisma as Record<string, any>;
const mensajes = () => B.datos.fotofficeWaMensaje;

const fetchMeta = () => vi.fn(async () => new Response(JSON.stringify(RESPUESTA_META), { status: 200 }));

async function chatFueraDeVentana(p: Record<string, unknown> = {}) {
  return (await P.fotofficeWaChat.create({
    data: { workspaceId: "w1", waId: "5493415551234", nombre: "Martina López", ultimoMensajeEn: new Date(AHORA - 48 * 3_600_000), ultimoEntranteEn: new Date(AHORA - 48 * 3_600_000), ...p },
  })) as { id: string };
}

beforeEach(() => {
  B.vaciar();
  T.olvidarPlantillas();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  B.agregar("fotofficeWaConexion", { workspaceId: "w1", modo: "REAL", phoneNumberId: "123", wabaId: "288" });
});

describe("lista de plantillas", () => {
  it("las trae de Meta una vez y las recuerda un rato", async () => {
    const f = fetchMeta();
    const conexion = { workspaceId: "w1", modo: "REAL" as const, wabaId: "288" };
    expect((await T.plantillasAprobadas(conexion, { fetch: f, ahora: AHORA })).map((p) => p.nombre)).toEqual(["recordatorio_pago", "retomar_consulta"]);
    await T.plantillasAprobadas(conexion, { fetch: f, ahora: AHORA + 60_000 });
    expect(f).toHaveBeenCalledTimes(1);
    expect(String((f.mock.calls[0] as unknown[])[0])).toContain("/288/message_templates?status=APPROVED");
    await T.plantillasAprobadas(conexion, { fetch: f, ahora: AHORA + 10 * 60_000 });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("en modo simulado, sin cuenta o si Meta falla: vacía", async () => {
    expect(await T.plantillasAprobadas({ workspaceId: "w1", modo: "SIMULADO", wabaId: "288" }, { fetch: fetchMeta() })).toEqual([]);
    expect(await T.plantillasAprobadas({ workspaceId: "w1", modo: "REAL", wabaId: null }, { fetch: fetchMeta() })).toEqual([]);
    const falla = vi.fn(async () => new Response("{}", { status: 500 }));
    expect(await T.plantillasAprobadas({ workspaceId: "w9", modo: "REAL", wabaId: "1" }, { fetch: falla })).toEqual([]);
  });

  it("propone el nombre del cliente y su evento", async () => {
    B.agregar("client", { id: "c1", workspaceId: "w1", firstName: "Martina", lastName: "López" });
    B.agregar("fotofficeConsultaCategoria", { id: "cat", workspaceId: "w1", name: "Fotografía o Video de Cumpleaños de 15", group: "EVENTO" });
    B.agregar("fotofficeConsulta", { id: "fc", workspaceId: "w1", leadId: "l1", clientId: "c1", categoryId: "cat", eventStartsAt: new Date("2026-12-12T00:00:00.000Z"), createdAt: new Date(AHORA) });
    const { id } = await chatFueraDeVentana({ clientId: "c1" });
    const p = await T.plantillasDelChat(GIULI, id, { fetch: fetchMeta(), ahora: AHORA });
    expect(p.find((x) => x.nombre === "retomar_consulta")?.sugeridos).toEqual(["Martina", "los 15 del 12/12/2026"]);
    expect(await T.plantillasDelChat(LEO, id, { fetch: fetchMeta() })).toEqual([]);
  });
});

describe("enviar una plantilla desde el panel", () => {
  const ok = vi.fn(async () => ({ ok: true as const, simulado: false as const, waMessageId: "wamid.1" }));

  it("fuera de las 24 h la manda, toma el chat y deja el texto armado", async () => {
    const { id } = await chatFueraDeVentana();
    const enviar = vi.fn(ok);
    const r = await T.enviarPlantillaDesdePanel(GIULI, id, { nombre: "retomar_consulta", idioma: "es_AR", valores: ["Martina", "los 15"] }, "tok-1", { fetch: fetchMeta(), enviar, ahora: AHORA });
    expect(r).toMatchObject({ ok: true, estadoEnvio: "ENVIADO" });
    expect(enviar).toHaveBeenCalledWith(expect.anything(), "5493415551234", { nombre: "retomar_consulta", idioma: "es_AR", cuerpo: ["Martina", "los 15"], boton: undefined });
    const [sistema, saliente] = mensajes();
    expect(sistema).toMatchObject({ direccion: "SISTEMA", texto: "Giuli tomó el chat" });
    expect(saliente).toMatchObject({ tipo: "PLANTILLA", autor: "USUARIO", autorLabel: "Giuli", texto: "¡Hola Martina! Por tu consulta sobre los 15.", estadoEnvio: "ENVIADO", waMessageId: "wamid.1" });
  });

  it("un reintento con el mismo identificador no manda dos veces", async () => {
    const { id } = await chatFueraDeVentana();
    const enviar = vi.fn(ok);
    const entrada = { nombre: "retomar_consulta", idioma: "es_AR", valores: ["Martina", "los 15"] };
    await T.enviarPlantillaDesdePanel(GIULI, id, entrada, "tok-1", { fetch: fetchMeta(), enviar, ahora: AHORA });
    const b = await T.enviarPlantillaDesdePanel(GIULI, id, entrada, "tok-1", { fetch: fetchMeta(), enviar, ahora: AHORA });
    expect(b).toMatchObject({ ok: true });
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it("rechaza sin permiso, plantillas no aprobadas, datos incompletos y el botón dinámico vacío", async () => {
    const { id } = await chatFueraDeVentana();
    const enviar = vi.fn(ok);
    const d = { fetch: fetchMeta(), enviar, ahora: AHORA };
    expect(await T.enviarPlantillaDesdePanel(LEO, id, { nombre: "retomar_consulta", idioma: "es_AR", valores: ["a", "b"] }, "t1", d)).toMatchObject({ ok: false });
    expect(await T.enviarPlantillaDesdePanel(GIULI, id, { nombre: "inventada", idioma: "es_AR", valores: [] }, "t2", d)).toEqual({ ok: false, error: T.MENSAJES_PLANTILLAS.noDisponible });
    expect(await T.enviarPlantillaDesdePanel(GIULI, id, { nombre: "retomar_consulta", idioma: "es_AR", valores: ["Martina"] }, "t3", d)).toMatchObject({ ok: false });
    expect(await T.enviarPlantillaDesdePanel(GIULI, id, { nombre: "recordatorio_pago", idioma: "es_AR", valores: ["Martina"] }, "t4", d)).toEqual({ ok: false, error: T.MENSAJES_PLANTILLAS.sinBoton });
    expect(enviar).not.toHaveBeenCalled();
    expect(mensajes()).toHaveLength(0);
  });

  it("en Instagram no hay plantillas; otro workspace no ve el chat", async () => {
    const ig = await chatFueraDeVentana({ canal: "INSTAGRAM", waId: "ig-1" });
    const enviar = vi.fn(ok);
    const entrada = { nombre: "retomar_consulta", idioma: "es_AR", valores: ["a", "b"] };
    expect(await T.enviarPlantillaDesdePanel(GIULI, ig.id, entrada, "t1", { fetch: fetchMeta(), enviar })).toEqual({ ok: false, error: T.MENSAJES_PLANTILLAS.soloWhatsapp });
    const { id } = await chatFueraDeVentana();
    B.agregar("fotofficeWaConexion", { workspaceId: "w2", modo: "REAL", phoneNumberId: "999", wabaId: "288" });
    expect(await T.enviarPlantillaDesdePanel({ ...GIULI, workspaceId: "w2" }, id, entrada, "t2", { fetch: fetchMeta(), enviar })).toMatchObject({ ok: false });
    expect(enviar).not.toHaveBeenCalled();
  });

  it("si Meta la rechaza queda registrada como fallida y se avisa", async () => {
    const { id } = await chatFueraDeVentana();
    const enviar = vi.fn(async () => ({ ok: false as const, codigo: "132001" }));
    const r = await T.enviarPlantillaDesdePanel(GIULI, id, { nombre: "retomar_consulta", idioma: "es_AR", valores: ["a", "b"] }, "t1", { fetch: fetchMeta(), enviar, ahora: AHORA });
    expect(r).toMatchObject({ ok: false });
    expect(mensajes().at(-1)).toMatchObject({ estadoEnvio: "FALLO", errorCodigo: "132001" });
  });
});
