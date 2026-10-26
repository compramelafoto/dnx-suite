import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * Con el cliente de R2 simulado: `r2-presign` corre de verdad (HeadObject + primeros bytes +
 * firma binaria), así que lo que se prueba es la verificación real de lo subido.
 */
const { trabajo, foto, enviarR2, borrarR2, firmar, objetos } = vi.hoisted(() => ({
  trabajo: { findFirst: vi.fn(), update: vi.fn() },
  foto: { count: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), createMany: vi.fn() },
  enviarR2: vi.fn(),
  borrarR2: vi.fn(),
  firmar: vi.fn(),
  objetos: new Map<string, Uint8Array>(),
}));

vi.mock("@repo/db", () => ({ prisma: { fotofficeTrabajo: trabajo, fotofficeTrabajoFoto: foto } }));
vi.mock("@repo/content", () => ({ sanitizeContentHtml: (h: string) => h }));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: firmar }));
vi.mock("@/lib/images/r2-client", () => ({
  isFotofficeR2Configured: () => true,
  getFotofficeR2Client: () => ({ send: enviarR2 }),
  getFotofficeR2Bucket: () => "bucket",
  generateFotofficeR2Key: (nombre: string, prefijo: string) => `${prefijo.replace(/\/+$/, "")}/${nombre}`,
  getFotofficeR2PublicUrl: (k: string) => `https://cdn.example/${k}`,
  deleteFotofficeR2Object: borrarR2,
}));

const { prepararSubida, confirmarSubida } = await import("./subida");

const P = "fotoffice/site-trabajos/ws-1/trabajo1/";
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
const TEXTO = new TextEncoder().encode("<html>no soy foto</html>");

beforeEach(() => {
  for (const m of [trabajo, foto]) for (const f of Object.values(m)) f.mockReset();
  for (const f of [enviarR2, borrarR2, firmar]) f.mockReset();
  objetos.clear();
  firmar.mockImplementation(async (_c: unknown, cmd: { input: { Key: string } }) => `https://r2.example/put/${cmd.input.Key}`);
  borrarR2.mockResolvedValue({ ok: true });
  // Por defecto ninguna key tiene fila todavía.
  foto.findMany.mockResolvedValue([]);
  enviarR2.mockImplementation(async (cmd: { constructor: { name: string }; input: { Key: string } }) => {
    const bytes = objetos.get(cmd.input.Key);
    if (!bytes) throw Object.assign(new Error("NotFound"), { name: "NotFound" });
    if (cmd.constructor.name === "HeadObjectCommand") return { ContentLength: bytes.length };
    return { Body: { transformToByteArray: async () => bytes.slice(0, 16) } };
  });
});

describe("prepararSubida", () => {
  it("firma una URL por archivo bajo el prefijo del trabajo", async () => {
    trabajo.findFirst.mockResolvedValueOnce({ id: "trabajo1" });
    foto.count.mockResolvedValueOnce(0);
    const r = await prepararSubida("ws-1", "trabajo1", [
      { nombre: "a.jpg", tipo: "image/jpeg", bytes: 1000 },
      { nombre: "b.png", tipo: "image/png", bytes: 2000 },
    ]);
    expect(r).toEqual({
      ok: true,
      valor: [
        { nombre: "a.jpg", key: `${P}foto.jpg`, uploadUrl: `https://r2.example/put/${P}foto.jpg` },
        { nombre: "b.png", key: `${P}foto.png`, uploadUrl: `https://r2.example/put/${P}foto.png` },
      ],
    });
    expect(trabajo.findFirst.mock.calls[0][0].where).toEqual({ id: "trabajo1", workspaceId: "ws-1" });
  });

  it("la extensión de la key sale del tipo, no del nombre que manda el navegador", async () => {
    trabajo.findFirst.mockResolvedValueOnce({ id: "trabajo1" });
    foto.count.mockResolvedValueOnce(0);
    const r = await prepararSubida("ws-1", "trabajo1", [{ nombre: "x.html", tipo: "image/webp", bytes: 10 }]);
    expect(r.ok && r.valor[0].key).toBe(`${P}foto.webp`);
  });

  it("pasar el tope de 300 fotos da error y no firma nada", async () => {
    trabajo.findFirst.mockResolvedValueOnce({ id: "trabajo1" });
    foto.count.mockResolvedValueOnce(299);
    const r = await prepararSubida("ws-1", "trabajo1", [
      { nombre: "a.jpg", tipo: "image/jpeg", bytes: 1 },
      { nombre: "b.jpg", tipo: "image/jpeg", bytes: 1 },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Cada trabajo admite hasta 300 fotos");
    expect(firmar).not.toHaveBeenCalled();
  });

  it("rechaza formatos que no son foto y fotos de más de 25 MB", async () => {
    trabajo.findFirst.mockResolvedValue({ id: "trabajo1" });
    foto.count.mockResolvedValue(0);
    const gif = await prepararSubida("ws-1", "trabajo1", [{ nombre: "x.gif", tipo: "image/gif", bytes: 10 }]);
    expect(gif.ok).toBe(false);
    const pesada = await prepararSubida("ws-1", "trabajo1", [{ nombre: "x.jpg", tipo: "image/jpeg", bytes: 25 * 1024 * 1024 + 1 }]);
    expect(pesada).toEqual({ ok: false, codigo: "ARCHIVO_INVALIDO", error: "«x.jpg» pesa más de 25 MB" });
    expect(firmar).not.toHaveBeenCalled();
  });

  it("un trabajo de otra institución no existe", async () => {
    trabajo.findFirst.mockResolvedValueOnce(null);
    const r = await prepararSubida("ws-1", "trabajoajeno1", [{ nombre: "a.jpg", tipo: "image/jpeg", bytes: 1 }]);
    expect(r).toEqual({ ok: false, codigo: "NO_EXISTE", error: "El trabajo no existe" });
  });
});

describe("confirmarSubida", () => {
  it("registra las fotos verificadas con su URL pública y medidas", async () => {
    objetos.set(`${P}a.jpg`, JPG);
    trabajo.findFirst.mockResolvedValueOnce({ id: "trabajo1" }).mockResolvedValueOnce({ portadaUrl: "https://x" });
    foto.count.mockResolvedValueOnce(0);
    foto.findFirst.mockResolvedValueOnce(null);
    const r = await confirmarSubida("ws-1", "trabajo1", [`${P}a.jpg`], { [`${P}a.jpg`]: { ancho: 3000, alto: 2000 } });
    expect(r).toEqual({ ok: true, valor: { agregadas: 1, yaEstaban: 0, rechazadas: [] } });
    expect(foto.createMany.mock.calls[0][0].data[0]).toMatchObject({
      r2Key: `${P}a.jpg`,
      url: `https://cdn.example/${P}a.jpg`,
      ancho: 3000,
      alto: 2000,
      workspaceId: "ws-1",
    });
    expect(borrarR2).not.toHaveBeenCalled();
  });

  it("si otro pedido la registró en el medio, ya estaba: no es error y no se borra", async () => {
    objetos.set(`${P}a.jpg`, JPG);
    trabajo.findFirst.mockResolvedValueOnce({ id: "trabajo1" }).mockResolvedValueOnce({ portadaUrl: "https://x" });
    foto.count.mockResolvedValueOnce(0);
    foto.findFirst.mockResolvedValueOnce(null);
    foto.createMany.mockResolvedValueOnce({ count: 0 });
    const r = await confirmarSubida("ws-1", "trabajo1", [`${P}a.jpg`]);
    expect(r).toEqual({ ok: true, valor: { agregadas: 0, yaEstaban: 1, rechazadas: [] } });
    expect(foto.createMany.mock.calls[0][0].skipDuplicates).toBe(true);
    expect(borrarR2).not.toHaveBeenCalled();
  });

  it("un archivo que dice ser JPG y no lo es se borra de R2 y no queda fila", async () => {
    objetos.set(`${P}falsa.jpg`, TEXTO);
    trabajo.findFirst.mockResolvedValueOnce({ id: "trabajo1" });
    const r = await confirmarSubida("ws-1", "trabajo1", [`${P}falsa.jpg`]);
    expect(r).toEqual({
      ok: true,
      valor: { agregadas: 0, yaEstaban: 0, rechazadas: [{ key: `${P}falsa.jpg`, error: "El archivo no es una imagen JPG, PNG o WebP válida." }] },
    });
    expect(borrarR2).toHaveBeenCalledWith(`${P}falsa.jpg`);
    expect(foto.createMany).not.toHaveBeenCalled();
  });

  it("mezcla: la válida se registra y la inválida se borra", async () => {
    objetos.set(`${P}buena.jpg`, JPG);
    objetos.set(`${P}mala.jpg`, TEXTO);
    trabajo.findFirst.mockResolvedValueOnce({ id: "trabajo1" }).mockResolvedValueOnce({ portadaUrl: null });
    foto.count.mockResolvedValueOnce(0);
    foto.findFirst.mockResolvedValueOnce(null);
    const r = await confirmarSubida("ws-1", "trabajo1", [`${P}buena.jpg`, `${P}mala.jpg`]);
    expect(r.ok && r.valor.agregadas).toBe(1);
    expect(borrarR2).toHaveBeenCalledTimes(1);
    expect(borrarR2).toHaveBeenCalledWith(`${P}mala.jpg`);
    expect(foto.createMany.mock.calls[0][0].data).toHaveLength(1);
  });

  it("una key de otro trabajo no se registra ni se borra", async () => {
    trabajo.findFirst.mockResolvedValueOnce({ id: "trabajo1" });
    const ajena = "fotoffice/site-trabajos/ws-2/trabajo9/x.jpg";
    const r = await confirmarSubida("ws-1", "trabajo1", [ajena]);
    expect(r).toEqual({ ok: true, valor: { agregadas: 0, yaEstaban: 0, rechazadas: [{ key: ajena, error: "La foto no es de este trabajo" }] } });
    expect(enviarR2).not.toHaveBeenCalled();
    expect(borrarR2).not.toHaveBeenCalled();
  });

  it("si al registrar ya no hay lugar, borra lo subido", async () => {
    objetos.set(`${P}a.jpg`, JPG);
    trabajo.findFirst.mockResolvedValueOnce({ id: "trabajo1" }).mockResolvedValueOnce({ portadaUrl: null });
    foto.count.mockResolvedValueOnce(300);
    const r = await confirmarSubida("ws-1", "trabajo1", [`${P}a.jpg`]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Cada trabajo admite hasta 300 fotos");
    expect(borrarR2).toHaveBeenCalledWith(`${P}a.jpg`);
    expect(foto.createMany).not.toHaveBeenCalled();
  });

  it("un objeto que no llegó a R2 se rechaza", async () => {
    trabajo.findFirst.mockResolvedValueOnce({ id: "trabajo1" });
    const r = await confirmarSubida("ws-1", "trabajo1", [`${P}nunca.jpg`]);
    expect(r.ok && r.valor.rechazadas[0].error).toBe("No encontramos la foto subida. Probá de nuevo.");
    expect(foto.createMany).not.toHaveBeenCalled();
  });

  it("reintento del mismo lote: no duplica filas ni borra nada", async () => {
    objetos.set(`${P}a.jpg`, JPG);
    trabajo.findFirst.mockResolvedValueOnce({ id: "trabajo1" });
    foto.findMany.mockResolvedValueOnce([{ r2Key: `${P}a.jpg` }]);
    const r = await confirmarSubida("ws-1", "trabajo1", [`${P}a.jpg`, `${P}a.jpg`]);
    expect(r).toEqual({ ok: true, valor: { agregadas: 0, yaEstaban: 1, rechazadas: [] } });
    expect(foto.findMany.mock.calls[0][0].where).toEqual({ trabajoId: "trabajo1", workspaceId: "ws-1", r2Key: { in: [`${P}a.jpg`] } });
    expect(foto.createMany).not.toHaveBeenCalled();
    expect(borrarR2).not.toHaveBeenCalled();
    expect(enviarR2).not.toHaveBeenCalled();
  });

  it("keys repetidas en la lista se registran una sola vez", async () => {
    objetos.set(`${P}a.jpg`, JPG);
    trabajo.findFirst.mockResolvedValueOnce({ id: "trabajo1" }).mockResolvedValueOnce({ portadaUrl: "https://x" });
    foto.count.mockResolvedValueOnce(0);
    foto.findFirst.mockResolvedValueOnce(null);
    const r = await confirmarSubida("ws-1", "trabajo1", [`${P}a.jpg`, `${P}a.jpg`]);
    expect(r.ok && r.valor.agregadas).toBe(1);
    expect(foto.createMany.mock.calls[0][0].data).toHaveLength(1);
  });

  it("reintento en el tope: las fotos que ya tienen fila no se tocan en R2", async () => {
    objetos.set(`${P}vieja.jpg`, JPG);
    objetos.set(`${P}nueva.jpg`, JPG);
    trabajo.findFirst.mockResolvedValueOnce({ id: "trabajo1" }).mockResolvedValueOnce({ portadaUrl: "https://x" });
    // Primero: ¿cuáles ya tienen fila? (la vieja). Al limpiar: se vuelve a mirar (sigue la vieja sola).
    foto.findMany.mockResolvedValueOnce([{ r2Key: `${P}vieja.jpg` }]).mockResolvedValueOnce([]);
    foto.count.mockResolvedValueOnce(300);
    const r = await confirmarSubida("ws-1", "trabajo1", [`${P}vieja.jpg`, `${P}nueva.jpg`]);
    expect(r).toMatchObject({ ok: false, codigo: "NO_REGISTRADA" });
    expect(borrarR2.mock.calls.map((c) => c[0])).toEqual([`${P}nueva.jpg`]);
  });

  it("nunca borra un objeto que otro pedido registró mientras tanto", async () => {
    objetos.set(`${P}a.jpg`, JPG);
    trabajo.findFirst.mockResolvedValueOnce({ id: "trabajo1" }).mockResolvedValueOnce({ portadaUrl: null });
    foto.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([{ r2Key: `${P}a.jpg` }]);
    foto.count.mockResolvedValueOnce(300);
    const r = await confirmarSubida("ws-1", "trabajo1", [`${P}a.jpg`]);
    expect(r.ok).toBe(false);
    expect(borrarR2).not.toHaveBeenCalled();
  });

  it("un id de trabajo con forma rara no llega a R2 ni a la base", async () => {
    const r = await confirmarSubida("ws-1", "../ws-2", ["fotoffice/site-trabajos/ws-1/../ws-2/x.jpg"]);
    expect(r).toMatchObject({ ok: false, codigo: "ID_INVALIDO" });
    expect(trabajo.findFirst).not.toHaveBeenCalled();
    expect(borrarR2).not.toHaveBeenCalled();
    const p = await prepararSubida("ws-1", "a/b", [{ nombre: "a.jpg", tipo: "image/jpeg", bytes: 1 }]);
    expect(p).toMatchObject({ ok: false, codigo: "ID_INVALIDO" });
  });
});
