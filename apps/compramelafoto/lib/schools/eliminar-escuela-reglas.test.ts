import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { motivoParaNoEliminarEscuela } from "./eliminar-escuela-reglas";

describe("eliminar escuela — reglas", () => {
  it("una escuela vacía se puede eliminar", () => {
    assert.equal(motivoParaNoEliminarEscuela({ albumes: 0, pedidos: 0, comisiones: 0 }), null);
  });

  it("con álbumes solamente, pide desvincularlos", () => {
    const m = motivoParaNoEliminarEscuela({ albumes: 1, pedidos: 0, comisiones: 0 });
    assert.match(m!, /1 álbum vinculado\./);
    assert.match(m!, /Desvinculá los álbumes/);
  });

  it("con pedidos, protege el historial de ventas", () => {
    const m = motivoParaNoEliminarEscuela({ albumes: 2, pedidos: 5, comisiones: 0 });
    assert.match(m!, /2 álbumes vinculados y 5 pedidos de preventa\./);
    assert.match(m!, /historial de ventas/);
    assert.doesNotMatch(m!, /Desvinculá/);
  });

  it("con comisiones, no se puede", () => {
    const m = motivoParaNoEliminarEscuela({ albumes: 0, pedidos: 1, comisiones: 3 });
    assert.match(m!, /1 pedido de preventa y 3 comisiones de organizadores\./);
  });

  it("lista los tres motivos con comas", () => {
    const m = motivoParaNoEliminarEscuela({ albumes: 1, pedidos: 1, comisiones: 1 });
    assert.match(m!, /1 álbum vinculado, 1 pedido de preventa y 1 comisión de organizador\./);
  });
});
