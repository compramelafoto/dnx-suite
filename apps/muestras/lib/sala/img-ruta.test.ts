import { beforeEach, describe, expect, it, vi } from "vitest";

// La ruta `GET /m/[slug]/sala/img/[id]`, con el pase, la base y el bucket simulados.
const m = vi.hoisted(() => ({ permitida: vi.fn(), pase: vi.fn(), leerDeR2: vi.fn() }));
vi.mock("@/lib/sala/consultas", () => ({ imagenDeSalaPermitida: m.permitida, paseDeSala: m.pase }));
vi.mock("@/lib/imagenes/r2", () => ({ leerDeR2: m.leerDeR2 }));

const { GET } = await import("@/app/m/[slug]/sala/img/[id]/route");
const { LIMITES_PUBLICOS, resetRateLimit } = await import("@/lib/limite");

const URL_BUCKET = "https://pub-test.r2.dev/muestras/50/obra-oculta.webp";
const pedir = (id = "w1", ip = "1.1.1.1") =>
  GET(new Request(`http://x/m/silos/sala/img/${id}`, { headers: { "x-forwarded-for": ip } }), { params: Promise.resolve({ slug: "silos", id }) });
const conPase = (huella: string) => ({ actividad: { id: "a1" }, pase: { v: 1, a: "a1", exp: Date.now() + 1000, w: ["w1"] }, equipo: false, huella });
const cuerpo = (texto: string) => new Response(texto).body!;

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  m.permitida.mockImplementation(async (_slug: string, id: string) => (id === "w1" ? URL_BUCKET : null));
  m.pase.mockResolvedValue(conPase("uno"));
  m.leerDeR2.mockResolvedValue({ cuerpo: cuerpo("BYTES"), contentType: "image/webp" });
});

async function esNoEncontrada(r: Response) {
  expect(r.status).toBe(404);
  expect(r.headers.get("cache-control")).toBe("private, no-store");
  expect(r.headers.get("location")).toBeNull();
  expect(await r.text()).not.toContain("muestras/");
}

describe("GET /m/[slug]/sala/img/[id]", () => {
  it("sin pase (o sin permiso para esa obra): 404 no-store, sin leer el bucket", async () => {
    m.permitida.mockResolvedValue(null);
    await esNoEncontrada(await pedir());
    expect(m.leerDeR2).not.toHaveBeenCalled();
  });
  it("con pase y obra permitida: los bytes, privados y sin la dirección del bucket", async () => {
    const r = await pedir();
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("BYTES");
    expect(r.headers.get("content-type")).toBe("image/webp");
    expect(r.headers.get("cache-control")).toBe("private, max-age=600");
    expect(r.headers.get("referrer-policy")).toBe("no-referrer");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("content-disposition")).toBe("inline");
    expect(r.headers.get("location")).toBeNull();
    expect(m.permitida).toHaveBeenCalledWith("silos", "w1", expect.objectContaining({ huella: "uno" }));
  });
  it("un SVG (o cualquier otro tipo) no se sirve", async () => {
    m.leerDeR2.mockResolvedValue({ cuerpo: cuerpo("<svg/>"), contentType: "image/svg+xml" });
    await esNoEncontrada(await pedir());
  });
  it("una obra no permitida: 404", async () => {
    await esNoEncontrada(await pedir("w-oculta"));
  });
  it("si el bucket no la tiene: 404", async () => {
    m.leerDeR2.mockResolvedValue(null);
    await esNoEncontrada(await pedir());
  });
  it("sin pase ni equipo: 404 sin contar en el freno de pases", async () => {
    m.pase.mockResolvedValue({ actividad: { id: "a1" }, pase: null, equipo: false, huella: null });
    await esNoEncontrada(await pedir());
    expect(m.permitida).not.toHaveBeenCalled();
  });
  it("el tope fino es por pase: en el mismo Wi-Fi, otro teléfono sigue viendo", async () => {
    for (let i = 0; i < LIMITES_PUBLICOS.imagenSala.limit; i++) await pedir();
    const frenada = await pedir();
    expect(frenada.status).toBe(429);
    expect(await frenada.text()).toBe("Hiciste muchas consultas seguidas. Probá en un minuto.");
    m.pase.mockResolvedValue(conPase("dos"));
    expect((await pedir()).status).toBe(200);
  });
  it("pasado el tope de la red, 429 con el aviso (no una redirección muda)", async () => {
    for (let i = 0; i < LIMITES_PUBLICOS.imagenSalaRed.limit; i++) {
      m.pase.mockResolvedValueOnce(conPase(`p${i}`));
      await pedir("w1", "9.9.9.9");
    }
    const r = await pedir("w1", "9.9.9.9");
    expect(r.status).toBe(429);
    expect(await r.text()).toBe("Hay mucha gente consultando desde esta red. Probá en un minuto.");
    expect(r.headers.get("location")).toBeNull();
  });
});
