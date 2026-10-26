import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { isFotofficeOwnedR2Key } from "@/lib/images/r2-key-policy";
import { crearCopiadorDeFotos, keyDeFoto, prefijoImagenesBlog, prefijoImagenesPagina, type DepsCopia } from "./fotos-r2";

const WS = "cmv5z6qxwwmmhf0q5gp8qja1j";
const PREFIJO = prefijoImagenesPagina(WS);
const ORIGEN = "https://storage.alboom.ninja/sites/8403/albuns/1465286/copia_de_dn105000.jpg";

async function jpeg(ancho: number, alto: number): Promise<Buffer> {
  return sharp({ create: { width: ancho, height: alto, channels: 3, background: "#c0a060" } }).jpeg().toBuffer();
}

function respuesta(cuerpo: Uint8Array | string, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(typeof cuerpo === "string" ? cuerpo : new Uint8Array(cuerpo), { status, headers });
}

/** Un R2 en memoria: guarda lo subido con sus metadatos. */
function r2Simulado() {
  const objetos = new Map<string, { bytes: Buffer; tipo: string; metadata?: Record<string, string> }>();
  const subir = vi.fn(async (bytes: Buffer, key: string, tipo: string, metadata?: Record<string, string>) => {
    objetos.set(key, { bytes, tipo, metadata });
    return { key, url: `https://media.test/${key}` };
  });
  const cabecera = vi.fn(async (key: string) => (objetos.has(key) ? { metadata: objetos.get(key)?.metadata ?? {} } : null));
  return { objetos, subir, cabecera };
}

function deps(fetchFn: DepsCopia["fetch"], r2 = r2Simulado()): { deps: Partial<DepsCopia>; r2: ReturnType<typeof r2Simulado> } {
  return {
    r2,
    deps: {
      fetch: fetchFn,
      subir: r2.subir,
      cabecera: r2.cabecera,
      urlPublica: (key) => `https://media.test/${key}`,
      esperar: async () => {},
    },
  };
}

describe("prefijos", () => {
  it("todos dentro del espacio de FOTOFFICE (si no, no se podrían borrar después)", () => {
    expect(PREFIJO).toBe(`fotoffice/site-paginas/${WS}/`);
    expect(prefijoImagenesBlog(WS, "hero")).toBe(`fotoffice/blog-hero/${WS}/`);
    expect(prefijoImagenesBlog(WS, "media")).toBe(`fotoffice/blog-media/${WS}/`);
    expect(isFotofficeOwnedR2Key(`${PREFIJO}x.jpg`)).toBe(true);
  });

  it("la key sale del hash del origen: misma foto, misma key", () => {
    expect(keyDeFoto(ORIGEN, PREFIJO)).toBe(keyDeFoto(ORIGEN, PREFIJO));
    expect(keyDeFoto(ORIGEN, PREFIJO)).toMatch(new RegExp(`^${PREFIJO}[0-9a-f]{32}\\.jpg$`));
    expect(keyDeFoto(`${ORIGEN}x`, PREFIJO)).not.toBe(keyDeFoto(ORIGEN, PREFIJO));
    expect(keyDeFoto("https://cdn.alboompro.com/a/original_size/logo.PNG", PREFIJO)).toMatch(/\.png$/);
  });
});

describe("copiarFoto", () => {
  it("404 → { error: «respondió 404» }, sin subir nada y sin reintentar", async () => {
    const fetchFn = vi.fn(async () => respuesta("no", 404));
    const { deps: d, r2 } = deps(fetchFn);
    const { copiarFoto } = crearCopiadorDeFotos(d);
    expect(await copiarFoto(ORIGEN, PREFIJO)).toEqual({ error: "respondió 404" });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(r2.subir).not.toHaveBeenCalled();
  });

  it("la misma URL dos veces → una sola descarga y una sola subida", async () => {
    const bytes = await jpeg(1200, 800);
    const fetchFn = vi.fn(async () => respuesta(bytes, 200, { "content-type": "image/jpeg" }));
    const { deps: d, r2 } = deps(fetchFn);
    const { copiarFoto } = crearCopiadorDeFotos(d);
    const [a, b] = await Promise.all([copiarFoto(ORIGEN, PREFIJO), copiarFoto(ORIGEN, PREFIJO)]);
    const c = await copiarFoto(ORIGEN, PREFIJO);
    expect(a).toEqual({ url: `https://media.test/${keyDeFoto(ORIGEN, PREFIJO)}`, key: keyDeFoto(ORIGEN, PREFIJO), ancho: 1200, alto: 800 });
    expect(b).toEqual(a);
    expect(c).toEqual(a);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(r2.subir).toHaveBeenCalledTimes(1);
    // Una foto chica se sube tal cual, sin recomprimir.
    expect(r2.objetos.get(keyDeFoto(ORIGEN, PREFIJO))?.bytes.equals(bytes)).toBe(true);
  });

  it("en otra corrida (memoria vacía) la encuentra en R2 por su key y no la vuelve a bajar", async () => {
    const r2 = r2Simulado();
    const bytes = await jpeg(1000, 1500);
    const primera = deps(vi.fn(async () => respuesta(bytes)), r2);
    await crearCopiadorDeFotos(primera.deps).copiarFoto(ORIGEN, PREFIJO);

    const fetchFn = vi.fn(async () => respuesta(bytes));
    const segunda = deps(fetchFn, r2);
    const r = await crearCopiadorDeFotos(segunda.deps).copiarFoto(ORIGEN, PREFIJO);
    expect(r).toEqual({ url: `https://media.test/${keyDeFoto(ORIGEN, PREFIJO)}`, key: keyDeFoto(ORIGEN, PREFIJO), ancho: 1000, alto: 1500 });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(r2.subir).toHaveBeenCalledTimes(1);
  });

  it("más grande que el tope → se achica a 2560 del lado largo (o al tope pedido)", async () => {
    const grande = await jpeg(4000, 3000);
    const { deps: d, r2 } = deps(vi.fn(async () => respuesta(grande)));
    const { copiarFoto } = crearCopiadorDeFotos(d);
    const r = await copiarFoto(ORIGEN, PREFIJO);
    expect(r).toMatchObject({ ancho: 2560, alto: 1920 });
    const subida = r2.objetos.get(keyDeFoto(ORIGEN, PREFIJO));
    expect(subida?.tipo).toBe("image/jpeg");
    expect((await sharp(subida?.bytes).metadata()).width).toBe(2560);

    const avatar = await copiarFoto("https://storage.alboom.ninja/sites/8403/testimonials/gyf.jpg", PREFIJO, { ladoMaximo: 800 });
    expect(avatar).toMatchObject({ ancho: 800, alto: 600 });
  });

  it("reintenta dos veces un error de red o un 5xx, y después se rinde", async () => {
    const bytes = await jpeg(10, 10);
    const fetchFn = vi
      .fn<DepsCopia["fetch"]>()
      .mockRejectedValueOnce(new Error("socket hang up"))
      .mockResolvedValueOnce(respuesta("x", 503))
      .mockResolvedValueOnce(respuesta(bytes));
    const { copiarFoto } = crearCopiadorDeFotos(deps(fetchFn).deps);
    expect(await copiarFoto(ORIGEN, PREFIJO)).toMatchObject({ ancho: 10, alto: 10 });
    expect(fetchFn).toHaveBeenCalledTimes(3);

    const siempreMal = vi.fn(async () => respuesta("x", 500));
    const otro = crearCopiadorDeFotos(deps(siempreMal).deps);
    expect(await otro.copiarFoto(ORIGEN, PREFIJO)).toEqual({ error: "respondió 500" });
    expect(siempreMal).toHaveBeenCalledTimes(3);
  });

  it("lo que no es una imagen (por su firma, no por lo que dice el servidor) no se sube", async () => {
    const { deps: d, r2 } = deps(vi.fn(async () => respuesta("<html>hola</html>", 200, { "content-type": "image/jpeg" })));
    expect(await crearCopiadorDeFotos(d).copiarFoto(ORIGEN, PREFIJO)).toEqual({ error: "no es una imagen JPG, PNG o WebP" });
    expect(r2.subir).not.toHaveBeenCalled();
  });

  it("más de 25 MB no se baja entero ni se sube", async () => {
    const { deps: d, r2 } = deps(vi.fn(async () => respuesta("x", 200, { "content-length": String(30 * 1024 * 1024) })));
    expect(await crearCopiadorDeFotos(d).copiarFoto(ORIGEN, PREFIJO)).toEqual({ error: "pesa más de 25 MB" });
    expect(r2.subir).not.toHaveBeenCalled();
  });

  it("un prefijo fuera del espacio de FOTOFFICE se rechaza antes de bajar nada", async () => {
    const fetchFn = vi.fn(async () => respuesta("x"));
    const r = await crearCopiadorDeFotos(deps(fetchFn).deps).copiarFoto(ORIGEN, "otra-app/fotos/");
    expect(r).toEqual({ error: "destino fuera del espacio de FOTOFFICE" });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
