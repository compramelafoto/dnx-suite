import { beforeEach, describe, expect, it, vi } from "vitest";

const r2 = vi.hoisted(() => ({ subirPdfAR2: vi.fn() }));
vi.mock("@/lib/imagenes/r2", () => r2);
const { LIMITE_RESPUESTA_DIRECTA, entregarPdf } = await import("./entregar");

beforeEach(() => vi.clearAllMocks());

describe("entregarPdf", () => {
  it("un PDF liviano se descarga directo", async () => {
    const r = await entregarPdf(new Uint8Array([1, 2, 3]), { nombre: "cartel-m-A3", activityId: "a1" });
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="cartel-m-A3.pdf"');
    expect(r2.subirPdfAR2).not.toHaveBeenCalled();
  });
  it("uno pesado se sube a R2 con la huella del contenido y se redirige", async () => {
    r2.subirPdfAR2.mockResolvedValue("https://pub-test.r2.dev/muestras/piezas/a1/x.pdf");
    const r = await entregarPdf(new Uint8Array(LIMITE_RESPUESTA_DIRECTA + 1), { nombre: "marcos-m-A3", activityId: "a1" });
    expect(r.status).toBe(303);
    expect(r.headers.get("location")).toBe("https://pub-test.r2.dev/muestras/piezas/a1/x.pdf");
    expect(r2.subirPdfAR2.mock.calls[0]![1]).toMatch(/^muestras\/piezas\/a1\/[a-f0-9]{32}\.pdf$/);
    expect(r2.subirPdfAR2.mock.calls[0]![2]).toBe("marcos-m-A3.pdf");
  });
  it("un id de muestra que no sirve para la clave da 400, no \"muy pesado\"", async () => {
    for (const activityId of ["", "a/b", "../x", "x".repeat(65)]) {
      const r = await entregarPdf(new Uint8Array(LIMITE_RESPUESTA_DIRECTA + 1), { nombre: "x", activityId });
      expect(r.status).toBe(400);
      expect(await r.text()).toBe("No encontramos esa muestra.");
    }
    expect(r2.subirPdfAR2).not.toHaveBeenCalled();
  });
  it("si R2 falla, un error claro", async () => {
    r2.subirPdfAR2.mockRejectedValue(new Error("sin red"));
    const r = await entregarPdf(new Uint8Array(LIMITE_RESPUESTA_DIRECTA + 1), { nombre: "x", activityId: "a1" });
    expect(r.status).toBe(500);
    expect(r.headers.get("content-type")).toMatch(/^text\/plain/);
    expect(await r.text()).toMatch(/muy pesado/);
  });
});
