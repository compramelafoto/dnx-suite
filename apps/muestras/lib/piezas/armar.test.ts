import { beforeEach, describe, expect, it, vi } from "vitest";

const imagen = vi.hoisted(() => ({ imagenParaPdf: vi.fn() }));
const pdfs = vi.hoisted(() => ({ pdfDeMarcos: vi.fn(), pdfDeCartel: vi.fn(), pdfDeCatalogo: vi.fn(), pdfDeAficheLibro: vi.fn(), pdfDeMontaje: vi.fn() }));
vi.mock("./imagen", () => imagen);
vi.mock("./marco", () => ({ pdfDeMarcos: pdfs.pdfDeMarcos }));
vi.mock("./cartel", () => ({ pdfDeCartel: pdfs.pdfDeCartel }));
vi.mock("./catalogo", () => ({ pdfDeCatalogo: pdfs.pdfDeCatalogo }));
vi.mock("./afiche-libro", () => ({ pdfDeAficheLibro: pdfs.pdfDeAficheLibro }));
vi.mock("./montaje", () => ({ pdfDeMontaje: pdfs.pdfDeMontaje }));
const { armarPieza } = await import("./armar");

const a = {
  id: "a1", slug: "miradas-abc", title: "Miradas", organizersText: "FC", curatorialText: null, curatorCredits: null,
  startsAt: new Date("2026-11-05T03:00:00Z"), endsAt: new Date("2026-11-21T02:59:59.999Z"), scheduleText: null,
  venueName: null, address: null, city: null, province: null, coverImageUrl: null, hangingPlan: null,
  updatedAt: new Date("2026-11-01T12:00:00Z"),
  works: [
    { id: "w1", title: "Uno", authorName: "Ana", year: 2025, technique: null, imageUrl: "u1", sortOrder: 0 },
    { id: "w2", title: "Dos", authorName: "", year: null, technique: null, imageUrl: "u2", sortOrder: 1 },
  ],
};
const base = "https://muestrasfotograficas.com";

beforeEach(() => {
  vi.clearAllMocks();
  imagen.imagenParaPdf.mockResolvedValue(null);
  for (const fn of Object.values(pdfs)) fn.mockResolvedValue(new Uint8Array([1]));
});

describe("armarPieza", () => {
  it("marcos de todas las obras, foto en alta, una por vez, con la fecha de la muestra", async () => {
    const r = await armarPieza(a, { pieza: "marcos", tamano: "A3", orientacion: "AUTO", conFoto: true, obra: null }, base);
    expect(r?.nombre).toBe("marcos-miradas-abc-A3");
    expect(imagen.imagenParaPdf.mock.calls).toEqual([["u1", 2000, 88], ["u2", 2000, 88]]);
    const [, obras, , fecha] = pdfs.pdfDeMarcos.mock.calls[0]!;
    expect(obras.map((o: { autor: string }) => o.autor)).toEqual(["Ana", "Autor sin indicar"]);
    expect(fecha).toEqual(a.updatedAt);
  });
  it("una sola obra y sólo el remarco: foto chica (sólo para la proporción)", async () => {
    const r = await armarPieza(a, { pieza: "marcos", tamano: "A4", orientacion: "AUTO", conFoto: false, obra: "w2" }, base);
    expect(r?.nombre).toBe("marcos-miradas-abc-A4-2-remarco");
    expect(imagen.imagenParaPdf.mock.calls).toEqual([["u2", 200, 88]]);
  });
  it("una obra que no es de la muestra no arma nada", async () => {
    expect(await armarPieza(a, { pieza: "marcos", tamano: "A4", orientacion: "AUTO", conFoto: true, obra: "ajena" }, base)).toBeNull();
  });
  it("el afiche del libro lleva el QR con conteo y la dirección para escribir", async () => {
    await armarPieza(a, { pieza: "libro", tamano: "A3" }, base);
    expect(pdfs.pdfDeAficheLibro.mock.calls[0]![0]).toEqual({
      muestra: "Miradas", url: "https://muestrasfotograficas.com/q/l/a1", urlVisible: "muestrasfotograficas.com/m/miradas-abc/libro",
    });
  });
  it("el plano lee el JSON guardado (aunque esté vacío)", async () => {
    const r = await armarPieza(a, { pieza: "montaje" }, base);
    expect(r?.nombre).toBe("montaje-miradas-abc");
    expect(pdfs.pdfDeMontaje.mock.calls[0]![0].paredes).toEqual([]);
  });
});
