import { beforeEach, describe, expect, it, vi } from "vitest";

// La ruta `GET /api/curaduria/obras/[id]/imagen`, con la sesión, la base y el bucket simulados.
const m = vi.hoisted(() => ({
  getUsuario: vi.fn(),
  frenar: vi.fn(),
  leerDeR2: vi.fn(),
  db: {
    culturalCallWork: { findUnique: vi.fn() },
    culturalCallCurator: { findFirst: vi.fn() },
  },
}));
vi.mock("@repo/db", () => ({ prisma: m.db }));
vi.mock("@/lib/usuario", () => ({ getUsuario: m.getUsuario }));
vi.mock("@/lib/limite", () => ({ frenarPorUsuario: m.frenar }));
vi.mock("@/lib/imagenes/r2", () => ({ leerDeR2: m.leerDeR2 }));

const { GET } = await import("@/app/api/curaduria/obras/[id]/imagen/route");

const ID = "3f1c2b9e-8d4a-4c6b-9e2f-0a1b2c3d4e5f";
const URL_BUCKET = "https://pub.r2.dev/muestras/7/obra-secreta.webp";
const pedir = (id = ID) => GET(new Request(`http://x/api/curaduria/obras/${id}/imagen`), { params: Promise.resolve({ id }) });
const curador = { id: 20, email: "c@x", name: null, esSuperAdmin: false };
const obra = (status = "CURATING", callId = "c1") => ({
  imageUrl: URL_BUCKET, callId, anonymousCode: "O-001", submission: { status: "ACTIVE" }, call: { status, activity: { proposedByUserId: 9 } },
});
const cuerpo = (texto: string) => new Response(texto).body!;

beforeEach(() => {
  vi.clearAllMocks();
  m.getUsuario.mockResolvedValue(curador);
  m.frenar.mockReturnValue({ allowed: true, remaining: 1, resetAt: 0 });
  m.db.culturalCallWork.findUnique.mockResolvedValue(obra());
  // Curador activo sólo de la convocatoria c1.
  m.db.culturalCallCurator.findFirst.mockImplementation(async ({ where }: { where: { callId: string; userId: number } }) =>
    where.callId === "c1" && where.userId === 20 ? { status: "ACTIVE" } : null,
  );
  m.leerDeR2.mockResolvedValue({ cuerpo: cuerpo("BYTES"), contentType: "image/webp" });
});

async function esNoEncontrada(r: Response) {
  expect(r.status).toBe(404);
  expect(r.headers.get("location")).toBeNull();
  expect(await r.text()).not.toContain("muestras/");
}

describe("GET /api/curaduria/obras/[id]/imagen", () => {
  it("sin sesión: 404, sin tocar la base", async () => {
    m.getUsuario.mockResolvedValue(null);
    await esNoEncontrada(await pedir());
    expect(m.db.culturalCallWork.findUnique).not.toHaveBeenCalled();
    expect(m.leerDeR2).not.toHaveBeenCalled();
  });

  it("un id que no es uuid: 404 sin consultar", async () => {
    await esNoEncontrada(await pedir("x"));
    expect(m.db.culturalCallWork.findUnique).not.toHaveBeenCalled();
  });

  it("curador de otra convocatoria: 404", async () => {
    m.db.culturalCallWork.findUnique.mockResolvedValue(obra("CURATING", "c2"));
    await esNoEncontrada(await pedir());
    expect(m.leerDeR2).not.toHaveBeenCalled();
  });

  it("el autor de la obra (ni curador ni organizador): 404", async () => {
    m.getUsuario.mockResolvedValue({ ...curador, id: 7 });
    await esNoEncontrada(await pedir());
  });

  it("curador con la convocatoria todavía cerrada (sin curaduría): 404", async () => {
    m.db.culturalCallWork.findUnique.mockResolvedValue(obra("CLOSED"));
    await esNoEncontrada(await pedir());
  });

  it("obra inexistente o archivo que falta en el bucket: 404", async () => {
    m.db.culturalCallWork.findUnique.mockResolvedValue(null);
    await esNoEncontrada(await pedir());
    m.db.culturalCallWork.findUnique.mockResolvedValue(obra());
    m.leerDeR2.mockResolvedValue(null);
    await esNoEncontrada(await pedir());
  });

  it.each(["text/html", "image/svg+xml", "image/gif", "application/octet-stream"])("un objeto %s no se sirve", async (tipo) => {
    m.leerDeR2.mockResolvedValue({ cuerpo: cuerpo("<html>"), contentType: tipo });
    await esNoEncontrada(await pedir());
  });

  it.each(["image/jpeg", "image/png", "IMAGE/WEBP; charset=binary"])("sirve %s", async (tipo) => {
    m.leerDeR2.mockResolvedValue({ cuerpo: cuerpo("BYTES"), contentType: tipo });
    const r = await pedir();
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe(tipo.split(";")[0]!.toLowerCase());
  });

  it("demasiados pedidos: 429", async () => {
    m.frenar.mockReturnValue({ allowed: false, remaining: 0, resetAt: 0 });
    const r = await pedir();
    expect(r.status).toBe(429);
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(m.leerDeR2).not.toHaveBeenCalled();
  });

  it("curador activo durante la curaduría: sirve los bytes, privada y sin revelar la URL", async () => {
    const r = await pedir();
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("BYTES");
    expect(m.leerDeR2).toHaveBeenCalledWith(URL_BUCKET);
    expect(r.headers.get("content-type")).toBe("image/webp");
    expect(r.headers.get("cache-control")).toBe("private, max-age=600");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("referrer-policy")).toBe("no-referrer");
    expect(r.headers.get("content-disposition")).toBe("inline");
    expect(r.headers.get("location")).toBeNull();
    const todos = [...r.headers.entries()].map(([k, v]) => `${k}: ${v}`).join("\n");
    expect(todos).not.toContain("r2.dev");
    expect(todos).not.toContain("muestras/");
  });

  it("el organizador la ve desde el cierre", async () => {
    m.getUsuario.mockResolvedValue({ ...curador, id: 9 });
    m.db.culturalCallWork.findUnique.mockResolvedValue(obra("CLOSED"));
    expect((await pedir()).status).toBe(200);
  });
});
