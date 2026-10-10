import { beforeEach, describe, expect, it, vi } from "vitest";

// La ruta `GET /m/[slug]/sala/img/[id]`, con el pase, la base y el bucket simulados.
const m = vi.hoisted(() => ({ permitida: vi.fn(), leerDeR2: vi.fn() }));
vi.mock("@/lib/sala/consultas", () => ({ imagenDeSalaPermitida: m.permitida }));
vi.mock("@/lib/imagenes/r2", () => ({ leerDeR2: m.leerDeR2 }));

const { GET } = await import("@/app/m/[slug]/sala/img/[id]/route");
const { resetRateLimit } = await import("@/lib/limite");

const URL_BUCKET = "https://pub-test.r2.dev/muestras/50/obra-oculta.webp";
const pedir = (id = "w1") =>
  GET(new Request(`http://x/m/silos/sala/img/${id}`, { headers: { "x-forwarded-for": "1.1.1.1" } }), { params: Promise.resolve({ slug: "silos", id }) });
const cuerpo = (texto: string) => new Response(texto).body!;

beforeEach(() => {
  vi.clearAllMocks();
  resetRateLimit();
  m.permitida.mockImplementation(async (_slug: string, id: string) => (id === "w1" ? URL_BUCKET : null));
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
    expect(m.permitida).toHaveBeenCalledWith("silos", "w1");
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
});
