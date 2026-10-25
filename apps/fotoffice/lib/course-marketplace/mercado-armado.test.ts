import { describe, expect, it } from "vitest";
import { armarCursosEnMercado, type FilaDeCurso } from "./mercado-armado";

const fila = (extra: Partial<FilaDeCurso> = {}): FilaDeCurso => ({
  id: "c1",
  title: "Retrato",
  slug: "retrato",
  instructorName: null,
  priceArs: "105000.00",
  suggestedResellerBps: 2000,
  workspaceId: "ws-dueno",
  lessons: [{ id: "l1", isPreview: true }],
  beneficiaries: [],
  resaleAgreements: [],
  ...extra,
});

describe("armarCursosEnMercado", () => {
  const nombres = new Map([["ws-dueno", "Dueño SA"], ["ws-b", "Docente SRL"]]);
  const slugs = new Map([["ws-dueno", "dueno"]]);

  it("el invitado sale como 'Invitado', sin correo ni ids de negocios", () => {
    const [c] = armarCursosEnMercado({
      filas: [
        fila({
          beneficiaries: [
            { id: "x1", workspaceId: "ws-b", invitedEmail: null, shareBps: 6000, absorbsProcessorFee: false },
            { id: "x2", workspaceId: null, invitedEmail: "secreto@ejemplo.com", shareBps: 4000, absorbsProcessorFee: true },
          ],
        }),
      ],
      nombres,
      slugs,
      baseUrl: "https://x.test",
    });
    const json = JSON.stringify(c.beneficiarios);
    expect(c.beneficiarios.map((b) => b.nombre)).toEqual(["Docente SRL", "Invitado"]);
    expect(json).not.toContain("secreto@ejemplo.com");
    expect(json).not.toContain("ws-b");
    expect(c.beneficiarios.map((b) => b.bps)).toEqual([6000, 4000]);
  });

  it("sin beneficiarios, todo es del dueño; lista en centavos y link de muestra", () => {
    const [c] = armarCursosEnMercado({ filas: [fila()], nombres, slugs, baseUrl: "https://x.test" });
    expect(c.beneficiarios).toEqual([{ id: "dueno", nombre: "Dueño SA", bps: 10000, absorbeMp: true }]);
    expect(c.listaCentavos).toBe(10_500_000);
    expect(c.muestraUrl).toBe("https://x.test/w/dueno/cursos/retrato/muestra/l1");
    expect(c.miAcuerdo).toBeNull();
  });
});
