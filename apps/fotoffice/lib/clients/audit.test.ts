import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CAMPOS_AUDITADOS_CLIENTE, ETIQUETAS_CAMPO_CLIENTE } from "./audit";

describe("campos auditados del cliente", () => {
  it("no incluye las observaciones: viven en notas", () => {
    expect(CAMPOS_AUDITADOS_CLIENTE).not.toContain("notes");
  });
  it("incluye los datos de contacto y fiscales", () => {
    for (const c of ["firstName", "lastName", "email", "phone", "docNumber", "ivaCondition", "status"]) {
      expect(CAMPOS_AUDITADOS_CLIENTE).toContain(c);
    }
  });
  it("cada campo tiene su etiqueta en español", () => {
    for (const c of CAMPOS_AUDITADOS_CLIENTE) {
      expect(ETIQUETAS_CAMPO_CLIENTE[c], c).toBeTruthy();
    }
  });
});

describe("clientes/actions.ts", () => {
  const fuente = readFileSync(join(__dirname, "..", "..", "app/(shell)/clientes/actions.ts"), "utf8");

  /** Texto de cada callback de `$transaction(async (tx) => { ... })`, por conteo de llaves. */
  function transacciones(src: string): string[] {
    const out: string[] = [];
    let desde = 0;
    for (;;) {
      const i = src.indexOf("$transaction(", desde);
      if (i < 0) break;
      const abre = src.indexOf("{", i);
      let nivel = 0;
      let j = abre;
      for (; j < src.length; j++) {
        if (src[j] === "{") nivel++;
        else if (src[j] === "}" && --nivel === 0) break;
      }
      out.push(src.slice(abre, j + 1));
      desde = j;
    }
    return out;
  }

  function todasDentro(nombre: string) {
    const total = fuente.split(nombre).length - 1;
    const dentro = transacciones(fuente).reduce((n, t) => n + (t.split(nombre).length - 1), 0);
    expect(total).toBeGreaterThan(0);
    expect(dentro).toBe(total);
  }

  it("el historial se escribe dentro de la transacción", () => todasDentro("clientAudit.create"));
  it("la mudanza de piezas ocurre dentro de la transacción", () => todasDentro("mudarPiezasDelSocioAlCliente("));
  it("los redirects quedan fuera de las transacciones", () => {
    for (const t of transacciones(fuente)) expect(t).not.toContain("redirect(");
  });
});
