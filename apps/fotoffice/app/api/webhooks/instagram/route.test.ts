import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const B = await vi.hoisted(async () => {
  const { crearBaseEnMemoria } = await import("../../../../lib/circuitos/base-en-memoria");
  return crearBaseEnMemoria();
});
vi.mock("@repo/db", () => ({ prisma: B.prisma }));
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- la base en memoria tipa el cliente como mapa suelto
const P = B.prisma as Record<string, any>;

const programados: string[][] = [];
vi.mock("@/lib/bandeja/bot/programar", () => ({ programarTrasRegistro: (r: { paraElBot: string[] }) => void programados.push([...r.paraElBot]) }));
vi.mock("@/lib/bandeja/instagram/perfil", () => ({ perfilInstagram: async () => ({ nombre: "Lucía Gómez", usuario: "luciag" }) }));

const { GET, POST } = await import("./route");

const SECRETO = "app-secret-de-prueba";
const TOKEN = "token-de-verificacion";
const CUENTA = "17841400000000001";
const fixture = (n: string) => readFileSync(join(__dirname, "../../../../lib/bandeja/instagram/__fixtures__", n), "utf8");
const firmar = (c: string, s = SECRETO) => `sha256=${createHmac("sha256", s).update(c).digest("hex")}`;
const post = (cuerpo: string, firma?: string | null) =>
  POST(new Request("http://x/api/webhooks/instagram", {
    method: "POST", body: cuerpo, headers: firma === null ? {} : { "x-hub-signature-256": firma ?? firmar(cuerpo) },
  }));
const get = (q: Record<string, string>) => GET(new Request(`http://x/api/webhooks/instagram?${new URLSearchParams(q)}`));

beforeEach(async () => {
  process.env.WHATSAPP_APP_SECRET = SECRETO;
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = TOKEN;
  programados.length = 0;
  for (const t of ["fotofficeWaConexion", "fotofficeWaChat", "fotofficeWaMensaje"] as const) B.datos[t].length = 0;
  await P.fotofficeWaConexion.create({ data: { workspaceId: "w1", phoneNumberId: "106540352242922", modo: "REAL", igAccountId: CUENTA, igPageId: "pg1", igActivo: true } });
});
afterEach(() => {
  delete process.env.WHATSAPP_APP_SECRET;
  delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  vi.restoreAllMocks();
});

describe("GET /api/webhooks/instagram (verificación de Meta)", () => {
  it("token correcto: devuelve el challenge como texto plano con nosniff", async () => {
    const r = await get({ "hub.mode": "subscribe", "hub.verify_token": TOKEN, "hub.challenge": "12345" });
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("12345");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("content-type")).toContain("text/plain");
  });
  it("token incorrecto: 403; sin la variable: 404", async () => {
    expect((await get({ "hub.mode": "subscribe", "hub.verify_token": "otro", "hub.challenge": "1" })).status).toBe(403);
    delete process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    expect((await get({ "hub.mode": "subscribe", "hub.verify_token": "", "hub.challenge": "1" })).status).toBe(404);
  });
});

describe("POST /api/webhooks/instagram", () => {
  it("sin secreto: 404 y no toca nada", async () => {
    delete process.env.WHATSAPP_APP_SECRET;
    expect((await post(fixture("texto.json"))).status).toBe(404);
    expect(B.datos.fotofficeWaChat).toHaveLength(0);
  });

  it("firma mala o ausente: 401 y no registra", async () => {
    const c = fixture("texto.json");
    expect((await post(c, firmar(c, "otro"))).status).toBe(401);
    expect((await post(c, null)).status).toBe(401);
    expect(B.datos.fotofficeWaChat).toHaveLength(0);
  });

  it("JSON roto con firma válida: 400", async () => {
    expect((await post("{no es json")).status).toBe(400);
  });

  it("mensaje válido: 200, chat de Instagram creado y el bot programado", async () => {
    const r = await post(fixture("texto.json"));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, aplicados: 1 });
    expect(B.datos.fotofficeWaChat).toHaveLength(1);
    expect(B.datos.fotofficeWaChat[0]).toMatchObject({ canal: "INSTAGRAM", waId: "5550001", nombre: "Lucía Gómez", usuarioInstagram: "luciag", clientId: null });
    expect(B.datos.fotofficeWaMensaje).toHaveLength(1);
    expect(programados).toEqual([[B.datos.fotofficeWaChat[0].id]]);
  });

  it("idempotente: el mismo aviso dos veces deja un solo mensaje", async () => {
    await post(fixture("texto.json"));
    const r = await post(fixture("texto.json"));
    expect(await r.json()).toMatchObject({ duplicados: 1 });
    expect(B.datos.fotofficeWaMensaje).toHaveLength(1);
  });

  it("cuenta desconocida o SIMULADA: 200 e ignorado", async () => {
    B.datos.fotofficeWaConexion[0].modo = "SIMULADO";
    const r = await post(fixture("texto.json"));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ignorados: 1 });
    B.datos.fotofficeWaConexion.length = 0;
    expect((await post(fixture("texto.json"))).status).toBe(200);
    expect((await post(fixture("reaccion.json"))).status).toBe(200);
    expect(B.datos.fotofficeWaChat).toHaveLength(0);
  });

  it("falla inesperada de base: 500 con log [fotoffice][instagram] sin texto ni IGSID", async () => {
    const original = B.tablas.fotofficeWaConexion.findUnique;
    B.tablas.fotofficeWaConexion.findUnique = async () => { throw Object.assign(new Error("Hola, quiero una cotización 5550001"), { code: "P2024" }); };
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect((await post(fixture("texto.json"))).status).toBe(500);
    } finally {
      B.tablas.fotofficeWaConexion.findUnique = original;
    }
    const registrado = JSON.stringify(log.mock.calls);
    expect(registrado).toContain("P2024");
    expect(registrado).not.toContain("cotización");
    expect(registrado).not.toContain("5550001");
  });
});
