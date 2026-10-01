import { describe, expect, test } from "vitest";
import { CADENCIAS, estadoDeUnCron, semaforoGeneral } from "./estado";

const AHORA = new Date("2026-10-10T23:30:00Z");
const haceMinutos = (n: number) => new Date(AHORA.getTime() - n * 60_000);

describe("cuándo un cron está atrasado", () => {
  test("recién corrido está bien", () => {
    const r = estadoDeUnCron({ nombre: "moderacion", ultimaCorrida: haceMinutos(2), ahora: AHORA });
    expect(r.estado).toBe("bien");
  });

  test("un poco tarde todavía no alarma", () => {
    // La moderación corre cada 5. A los 8 puede ser que Vercel lo demoró.
    const r = estadoDeUnCron({ nombre: "moderacion", ultimaCorrida: haceMinutos(8), ahora: AHORA });
    expect(r.estado).toBe("bien");
  });

  test("al triple de su cadencia está atrasado", () => {
    const r = estadoDeUnCron({ nombre: "moderacion", ultimaCorrida: haceMinutos(16), ahora: AHORA });
    expect(r.estado).toBe("atrasado");
  });

  test("al sextuple está caído", () => {
    const r = estadoDeUnCron({ nombre: "moderacion", ultimaCorrida: haceMinutos(35), ahora: AHORA });
    expect(r.estado).toBe("caido");
  });

  test("cada cron tiene su propia paciencia", () => {
    // El de purga corre una vez por día: 35 minutos no es nada para él.
    const r = estadoDeUnCron({ nombre: "purga", ultimaCorrida: haceMinutos(35), ahora: AHORA });
    expect(r.estado).toBe("bien");
  });

  test("uno que nunca corrió está caído, no bien", () => {
    // Es el caso peligroso: sin fila, "no hay noticias" parece "todo bien".
    const r = estadoDeUnCron({ nombre: "moderacion", ultimaCorrida: null, ahora: AHORA });
    expect(r.estado).toBe("caido");
    expect(r.detalle).toBe("Nunca corrió");
  });

  test("uno que corrió pero falló no está bien aunque sea reciente", () => {
    const r = estadoDeUnCron({
      nombre: "moderacion",
      ultimaCorrida: haceMinutos(1),
      ultimoError: "AccessDeniedException",
      ahora: AHORA,
    });
    expect(r.estado).toBe("atrasado");
    expect(r.detalle).toContain("AccessDeniedException");
  });

  test("un nombre que no está en la tabla se trata con la cadencia más lenta", () => {
    const r = estadoDeUnCron({ nombre: "inventado", ultimaCorrida: haceMinutos(35), ahora: AHORA });
    expect(r.estado).toBe("bien");
  });

  test("las cadencias son las cinco de vercel.json", () => {
    expect(Object.keys(CADENCIAS).sort()).toEqual(
      ["avisos", "cierre", "moderacion", "paquetes", "purga"].sort(),
    );
  });
});

describe("el semáforo de arriba de todo", () => {
  const bien = { estado: "bien" as const, detalle: "" };
  const atrasado = { estado: "atrasado" as const, detalle: "" };
  const caido = { estado: "caido" as const, detalle: "" };

  test("todo bien es verde", () => {
    expect(semaforoGeneral([bien, bien])).toBe("bien");
  });

  test("uno atrasado tiñe todo", () => {
    expect(semaforoGeneral([bien, atrasado])).toBe("atrasado");
  });

  test("uno caído manda sobre los atrasados", () => {
    expect(semaforoGeneral([bien, atrasado, caido])).toBe("caido");
  });

  test("sin nada que mirar no se dice que está bien", () => {
    // Un panel vacío que dice "todo bien" es peor que uno que dice que no sabe.
    expect(semaforoGeneral([])).toBe("caido");
  });
});
