import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { isFotofficeOwnedR2Key } from "@/lib/images/r2-key-policy";
import { existsSync, readFileSync } from "node:fs";
import { crearCopiadorDeFotos, depsConWrangler, keyDeFoto, prefijoImagenesBlog, prefijoImagenesPagina, WRANGLER_TIMEOUT_MS, type DepsCopia, type Ejecutar } from "./fotos-r2";

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
    expect(a).toEqual({ url: `https://media.test/${keyDeFoto(ORIGEN, PREFIJO)}`, key: keyDeFoto(ORIGEN, PREFIJO), ancho: 1200, alto: 800, tipo: "image/jpeg", peso: bytes.byteLength });
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
    expect(r).toEqual({ url: `https://media.test/${keyDeFoto(ORIGEN, PREFIJO)}`, key: keyDeFoto(ORIGEN, PREFIJO), ancho: 1000, alto: 1500, tipo: null, peso: null });
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

describe("subida con wrangler", () => {
  const BASE = "https://pub-x.r2.dev";

  function wrangler(resultados: Array<{ code: number; stderr?: string }> = [{ code: 0 }]) {
    const archivos: Array<{ existia: boolean; bytes: Buffer | null; ruta: string }> = [];
    const ejecutar = vi.fn<Ejecutar>(async (_cmd, args) => {
      const ruta = args[args.indexOf("--file") + 1];
      archivos.push({ ruta, existia: existsSync(ruta), bytes: existsSync(ruta) ? readFileSync(ruta) : null });
      const r = resultados.shift() ?? { code: 0 };
      return { code: r.code, stdout: "", stderr: r.stderr ?? "" };
    });
    return { ejecutar, archivos };
  }

  it("sube con `npx wrangler r2 object put` al bucket, con el tipo y --remote, y borra el temporal", async () => {
    const w = wrangler();
    const head = vi.fn(async () => respuesta("", 404));
    const r2 = depsConWrangler({ bucket: "fotoffice-media", basePublica: `${BASE}/`, ejecutar: w.ejecutar, fetch: head, esperar: async () => {} });
    const bytes = await jpeg(1200, 800);
    const { copiarFoto } = crearCopiadorDeFotos({ fetch: vi.fn(async () => respuesta(bytes)), ...r2, esperar: async () => {} });
    const r = await copiarFoto(ORIGEN, PREFIJO);
    const key = keyDeFoto(ORIGEN, PREFIJO);
    expect(r).toMatchObject({ url: `${BASE}/${key}`, key, ancho: 1200, alto: 800 });
    // Antes de subir pregunta si ya está, por la dirección pública.
    expect(head).toHaveBeenCalledWith(`${BASE}/${key}`, expect.objectContaining({ method: "HEAD" }));
    const [cmd, args, opciones] = w.ejecutar.mock.calls[0];
    expect(cmd).toBe("npx");
    expect(args).toEqual(["wrangler", "r2", "object", "put", `fotoffice-media/${key}`, "--file", w.archivos[0].ruta, "--content-type", "image/jpeg", "--remote"]);
    expect(opciones).toEqual({ timeoutMs: WRANGLER_TIMEOUT_MS });
    expect(w.archivos[0].existia).toBe(true);
    expect(w.archivos[0].bytes?.equals(bytes)).toBe(true);
    expect(existsSync(w.archivos[0].ruta)).toBe(false);
  });

  it("si ya está en R2 (HEAD 200) no la baja ni la sube", async () => {
    const w = wrangler();
    const r2 = depsConWrangler({
      bucket: "fotoffice-media",
      basePublica: BASE,
      ejecutar: w.ejecutar,
      fetch: vi.fn(async () => respuesta("", 200, { "content-type": "image/jpeg", "content-length": "1234" })),
    });
    const bajar = vi.fn(async () => respuesta("x"));
    const r = await crearCopiadorDeFotos({ fetch: bajar, ...r2 }).copiarFoto(ORIGEN, PREFIJO);
    expect(r).toMatchObject({ ancho: null, alto: null, tipo: "image/jpeg", peso: 1234 });
    expect(bajar).not.toHaveBeenCalled();
    expect(w.ejecutar).not.toHaveBeenCalled();
  });

  it("reintenta 2 veces y después informa el error", async () => {
    const w = wrangler([{ code: 1, stderr: "uno" }, { code: 1, stderr: "dos" }, { code: 1, stderr: "Authentication error" }]);
    const r2 = depsConWrangler({ bucket: "fotoffice-media", basePublica: BASE, ejecutar: w.ejecutar, fetch: vi.fn(async () => respuesta("", 404)), esperar: async () => {} });
    const bytes = await jpeg(10, 10);
    const r = await crearCopiadorDeFotos({ fetch: vi.fn(async () => respuesta(bytes)), ...r2, esperar: async () => {} }).copiarFoto(ORIGEN, PREFIJO);
    expect(r).toEqual({ error: expect.stringContaining("Authentication error") });
    expect(w.ejecutar).toHaveBeenCalledTimes(3);
  });

  it("una key fuera del espacio de FOTOFFICE nunca llega a wrangler", async () => {
    const w = wrangler();
    const r2 = depsConWrangler({ bucket: "fotoffice-media", basePublica: BASE, ejecutar: w.ejecutar });
    await expect(r2.subir(Buffer.from("x"), "otra-app/x.jpg", "image/jpeg")).rejects.toThrow("fuera del espacio de FOTOFFICE");
    await expect(r2.subir(Buffer.from("x"), "fotoffice/site-paginas/../../x.jpg", "image/jpeg")).rejects.toThrow();
    expect(w.ejecutar).not.toHaveBeenCalled();
  });

  it("pide una dirección pública https y un bucket válido", () => {
    expect(() => depsConWrangler({ bucket: "fotoffice-media", basePublica: "" })).toThrow();
    expect(() => depsConWrangler({ bucket: "a b", basePublica: BASE })).toThrow();
  });
});
