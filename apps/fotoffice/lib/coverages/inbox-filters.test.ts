import { describe, expect, it } from "vitest";
import { INBOX_FILTERS, isInboxFilter, whereForFilter } from "./inbox-filters";

const ahora = new Date("2026-09-14T12:00:00Z");

/**
 * Los filtros de la bandeja.
 *
 * Son criterios puros y no `where` escritos dentro de la pantalla: la bandeja, el contador de
 * cada pestaña y cualquier informe futuro tienen que coincidir. Cuando cada uno arma su propia
 * consulta, el número de la pestaña deja de corresponderse con la lista, y nadie se entera
 * hasta que alguien cuenta a mano.
 */
describe("whereForFilter", () => {
  it("«nuevas» son las recibidas", () => {
    expect(whereForFilter("nuevas", ahora)).toEqual({ status: "RECIBIDA" });
  });

  it("«incompletas» son las que esperan información", () => {
    expect(whereForFilter("incompletas", ahora)).toEqual({ status: "REQUIERE_INFO" });
  });

  it("«próximas» son las aprobadas que todavía no pasaron", () => {
    const w = whereForFilter("proximas", ahora);
    expect(w.status).toBe("APROBADA");
    expect(w.startsAt).toEqual({ gte: ahora });
  });

  it("«urgentes» son las que ocurren dentro de la semana y siguen vivas", () => {
    const w = whereForFilter("urgentes", ahora);
    expect(w.startsAt?.gte).toEqual(ahora);
    expect(w.startsAt?.lte).toEqual(new Date("2026-09-21T12:00:00Z"));
    expect(w.status).toEqual({ in: ["RECIBIDA", "EN_EVALUACION", "REQUIERE_INFO", "APROBADA"] });
  });

  it("«cerradas» junta cerradas y rechazadas, que es como se las mira", () => {
    expect(whereForFilter("cerradas", ahora)).toEqual({
      status: { in: ["CERRADA", "RECHAZADA"] },
    });
  });

  it("«canceladas» junta las dos formas de cancelar", () => {
    expect(whereForFilter("canceladas", ahora)).toEqual({
      status: { in: ["CANCELADA_SOLICITANTE", "CANCELADA_ORGANIZACION"] },
    });
  });

  it("un filtro desconocido no filtra nada en vez de romper", () => {
    // El filtro viene de la URL y lo puede escribir cualquiera.
    expect(whereForFilter("inventado", ahora)).toEqual({});
  });

  it("ningún filtro incluye el workspace: eso lo pone el repositorio", () => {
    // Si un filtro trajera su propio workspaceId, alguien podría olvidarse de ponerlo en el
    // repositorio y el aislamiento dependería de qué pestaña estás mirando.
    for (const f of INBOX_FILTERS) {
      expect(JSON.stringify(whereForFilter(f.key, ahora))).not.toContain("workspace");
    }
  });
});

describe("isInboxFilter", () => {
  it("reconoce los del catálogo", () => {
    expect(isInboxFilter("nuevas")).toBe(true);
  });
  it("descarta el resto", () => {
    expect(isInboxFilter("todo")).toBe(false);
    expect(isInboxFilter(null)).toBe(false);
  });
});
