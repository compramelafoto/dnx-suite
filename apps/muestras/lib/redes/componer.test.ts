import sharp from "sharp";
import { socialLayout, type SocialFormat, type SocialVariant } from "@repo/muestras";
import { beforeEach, describe, expect, it, vi } from "vitest";

const r2 = vi.hoisted(() => ({ leerBytesDeR2: vi.fn() }));
vi.mock("@/lib/imagenes/r2", () => r2);
const { armarPiezaRedes } = await import("./componer");

const muestra = {
  slug: "rosario-abc123", title: "Silos del puerto", type: "MUESTRA", reviewStatus: "APPROVED", isCancelled: false, isVirtualOnly: false,
  startsAt: new Date("2026-11-05T03:00:00Z"), endsAt: new Date("2026-11-30T03:00:00Z"),
  openingAt: new Date("2026-11-05T22:00:00Z"), openingEndsAt: null, worksCount: 3,
  venueName: "Centro Cultural Parque España", city: "Rosario", province: "Santa Fe",
  coverImageUrl: "https://pub-test.r2.dev/muestras/1/portada.webp",
};
const obra = { title: "El río a la siesta", authorName: "Ana Pérez", year: 2025, imageUrl: "https://pub-test.r2.dev/muestras/1/obra.webp" };
const foto = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: "#808080" } }).webp().toBuffer();

const armar = (formato: SocialFormat, variante: SocialVariant) =>
  armarPiezaRedes({ muestra, obra, formato, variante, urlInvitacion: "https://muestrasfotograficas.com/m/rosario-abc123/inauguracion" });

const leer = async (jpg: Buffer) => {
  const { data, info } = await sharp(jpg).raw().toBuffer({ resolveWithObject: true });
  return { info, px: (x: number, y: number) => Array.from(data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)) };
};
const cerca = (rgb: number[], hex: string, tol = 8) => {
  const ref = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return rgb.every((c, i) => Math.abs(c - ref[i]!) <= tol);
};

beforeEach(() => {
  vi.clearAllMocks();
  r2.leerBytesDeR2.mockImplementation(async () => foto(1600, 1200));
});

describe("armarPiezaRedes", () => {
  it.each([["POST", 1080, 1350], ["STORY", 1080, 1920], ["SQUARE", 1080, 1080], ["A6", 1240, 1748]] as const)(
    "%s: JPEG de las medidas exactas, con la banda de tinta",
    async (formato, w, h) => {
      const variante = formato === "A6" ? "INVITATION" : "OPENING";
      const jpg = await armar(formato, variante);
      expect([jpg[0], jpg[1]]).toEqual([0xff, 0xd8]);
      const { info, px } = await leer(jpg);
      expect([info.width, info.height]).toEqual([w, h]);
      const l = socialLayout(formato, variante);
      expect(cerca(px(l.width - 8, l.band.y + 8), "#1c2b35")).toBe(true);
    },
  );

  it("la obra apaisada no se recorta: arriba y abajo queda el fondo oscuro", async () => {
    r2.leerBytesDeR2.mockImplementation(async () => foto(2000, 800));
    const { px } = await leer(await armar("POST", "WORK"));
    const l = socialLayout("POST", "WORK");
    const cx = Math.round(l.width / 2);
    expect(cerca(px(cx, 10), "#11181d")).toBe(true);
    expect(cerca(px(cx, l.photo.height - 10), "#11181d")).toBe(true);
    expect(cerca(px(cx, Math.round(l.photo.height / 2)), "#808080")).toBe(true);
    expect(r2.leerBytesDeR2).toHaveBeenCalledWith(obra.imageUrl);
  });

  it("la portada llena su caja", async () => {
    const { px } = await leer(await armar("POST", "OPENING"));
    const l = socialLayout("POST", "OPENING");
    expect(cerca(px(5, 5), "#808080")).toBe(true);
    expect(cerca(px(l.width - 5, l.photo.height - 5), "#808080")).toBe(true);
    expect(r2.leerBytesDeR2).toHaveBeenCalledWith(muestra.coverImageUrl);
  });

  it("sin foto sale igual, con la caja en color superficie", async () => {
    r2.leerBytesDeR2.mockResolvedValue(null);
    const { info, px } = await leer(await armar("SQUARE", "LAST_DAYS"));
    expect(info.width).toBe(1080);
    expect(cerca(px(540, 200), "#f2f3f4")).toBe(true);
  });

  it("con una foto ilegible sale igual, sin foto", async () => {
    r2.leerBytesDeR2.mockResolvedValue(Buffer.from("no es una imagen"));
    const { px } = await leer(await armar("SQUARE", "LAST_DAYS"));
    expect(cerca(px(540, 200), "#f2f3f4")).toBe(true);
  });

  it("la invitación lleva el QR con su margen blanco", async () => {
    const { px } = await leer(await armar("POST", "INVITATION"));
    const qr = socialLayout("POST", "INVITATION").qr!;
    expect(cerca(px(qr.x + 3, qr.y + 3), "#ffffff", 12)).toBe(true);
    expect(cerca(px(qr.x + qr.width - 4, qr.y + qr.height - 4), "#ffffff", 12)).toBe(true);
  });

  it("la historia no pone texto en los 250 px de arriba ni de abajo", async () => {
    const { info, px } = await leer(await armar("STORY", "LAST_DAYS"));
    for (let x = 0; x < info.width; x += 4) {
      for (const y of [info.height - 249, info.height - 120, info.height - 2]) expect(cerca(px(x, y), "#1c2b35", 10)).toBe(true);
    }
  });

  it("la banda tiene texto (píxeles claros)", async () => {
    const jpg = await armar("POST", "LAST_DAYS");
    const l = socialLayout("POST", "LAST_DAYS");
    const { data } = await sharp(jpg).extract({ left: 0, top: l.band.y, width: l.width, height: l.band.height }).raw().toBuffer({ resolveWithObject: true });
    let claros = 0;
    for (let i = 0; i < data.length; i += 3) if (data[i]! > 200 && data[i + 1]! > 200 && data[i + 2]! > 200) claros++;
    expect(claros).toBeGreaterThan(5000);
  });

  it("título larguísimo: entra igual", async () => {
    const larga = { ...muestra, title: "Una muestra con un título larguísimo ".repeat(6) };
    const jpg = await armarPiezaRedes({ muestra: larga, obra: null, formato: "SQUARE", variante: "LAST_DAYS", urlInvitacion: "https://x.test/m/a/inauguracion" });
    expect((await sharp(jpg).metadata()).height).toBe(1080);
  });
});
