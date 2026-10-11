import { beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.fn();
const getSignedUrl = vi.fn();
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: class { send = send; },
  GetObjectCommand: class { constructor(public input: unknown) {} },
  PutObjectCommand: class { constructor(public input: unknown) {} },
  HeadObjectCommand: class { constructor(public input: unknown) {} },
  DeleteObjectCommand: class { constructor(public input: unknown) {} },
}));
vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl }));

const { borrarPrivado, claveDelBucketPrivado, existePrivado, leerPrivado, subirPrivado, urlDeSubida } = await import("./r2-privado");

beforeEach(() => {
  send.mockReset();
  getSignedUrl.mockReset();
  vi.stubEnv("R2_ACCESS_KEY_ID", "a");
  vi.stubEnv("R2_SECRET_ACCESS_KEY", "b");
  vi.stubEnv("R2_ENDPOINT", "https://e.test");
  vi.stubEnv("MUESTRAS_R2_PRIVATE_BUCKET", "privado");
});

describe("claves del bucket privado", () => {
  it.each(["originales/7/ck1", "firmas/7.png", "ventas/ord1/certificado.pdf"])("acepta %s", (k) => expect(claveDelBucketPrivado(k)).toBe(true));
  it.each(["muestras/obras/a.webp", "originales/../firmas/7.png", "/originales/7", "originales/", "ventas/a b", "firmas//7.png", ""])(
    "rechaza %s",
    (k) => expect(claveDelBucketPrivado(k)).toBe(false),
  );
  it("una clave fuera de los prefijos tira y no toca el bucket", async () => {
    await expect(subirPrivado("muestras/x.webp", Buffer.from("x"), "image/png")).rejects.toThrow();
    await expect(leerPrivado("../x")).rejects.toThrow();
    await expect(urlDeSubida("otra/x", "image/jpeg", 10)).rejects.toThrow();
    await expect(borrarPrivado("muestras/x")).rejects.toThrow();
    expect(send).not.toHaveBeenCalled();
    expect(getSignedUrl).not.toHaveBeenCalled();
  });
});

describe("operaciones", () => {
  it("la URL de subida firma el tamaño y el tipo, y vence en 10 minutos", async () => {
    getSignedUrl.mockResolvedValue("https://firmada.test/x");
    expect(await urlDeSubida("originales/7/ck1", "image/jpeg", 1234)).toBe("https://firmada.test/x");
    const [, comando, opciones] = getSignedUrl.mock.calls[0]!;
    expect(comando.input).toEqual({ Bucket: "privado", Key: "originales/7/ck1", ContentType: "image/jpeg", ContentLength: 1234 });
    expect(opciones).toEqual({ expiresIn: 600 });
  });
  it("sube sin caché pública", async () => {
    send.mockResolvedValue({});
    await subirPrivado("firmas/7.png", Buffer.from("x"), "image/png");
    expect(send.mock.calls[0]![0].input).toMatchObject({ Bucket: "privado", Key: "firmas/7.png", ContentType: "image/png", CacheControl: "private, no-store" });
  });
  it("leer devuelve los bytes, o null si no existe", async () => {
    send.mockResolvedValueOnce({ Body: { transformToByteArray: async () => new Uint8Array([1, 2, 3]) } });
    expect(await leerPrivado("originales/7/ck1")).toEqual(Buffer.from([1, 2, 3]));
    send.mockRejectedValueOnce(Object.assign(new Error("no"), { name: "NoSuchKey" }));
    expect(await leerPrivado("originales/7/ck2")).toBeNull();
  });
  it("existe devuelve tamaño y tipo, o null", async () => {
    send.mockResolvedValueOnce({ ContentLength: 10, ContentType: "image/png" });
    expect(await existePrivado("firmas/7.png")).toEqual({ bytes: 10, contentType: "image/png" });
    send.mockRejectedValueOnce(Object.assign(new Error("no"), { name: "NotFound", $metadata: { httpStatusCode: 404 } }));
    expect(await existePrivado("firmas/8.png")).toBeNull();
  });
  it("sin bucket privado configurado, tira", async () => {
    vi.stubEnv("MUESTRAS_R2_PRIVATE_BUCKET", "");
    await expect(subirPrivado("firmas/7.png", Buffer.from("x"), "image/png")).rejects.toThrow(/bucket privado/);
  });
});
