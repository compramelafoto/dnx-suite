import { describe, expect, it } from "vitest";
import { composeReference, parseAndValidatePaymentImport } from "./parse";

const WS = "ws-sfpr";
const PADRON = new Map([
  ["12", { id: "m-12", fullName: "Pérez, Ana" }],
  ["007", { id: "m-007", fullName: "Gómez, Luis" }],
]);

const ENCABEZADO = "memberNumber,paidAt,amountArs,method,period,reference";

function correr(csv: string, yaImportados: string[] = []) {
  return parseAndValidatePaymentImport({
    rawCsv: csv,
    workspaceId: WS,
    membersByNumber: PADRON,
    existingDedupKeys: new Set(yaImportados),
  });
}

function ok(csv: string, yaImportados: string[] = []) {
  const r = correr(csv, yaImportados);
  if (!r.ok) throw new Error(`esperaba que el archivo se leyera: ${r.error}`);
  return r;
}

describe("encabezado y tamaño", () => {
  it("rechaza un archivo sin las columnas obligatorias", () => {
    const r = correr("memberNumber,paidAt\n12,2024-03-10");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("amountArs");
  });

  it("rechaza un archivo sin filas de datos", () => {
    expect(correr(ENCABEZADO).ok).toBe(false);
  });
});

describe("el socio tiene que existir", () => {
  it("rechaza la fila cuyo número de socio no está en el padrón, y lo dice sin ambigüedad", () => {
    const r = ok(`${ENCABEZADO}\n999,2024-03-10,15000,EFECTIVO,,`);
    expect(r.rows[0]?.status).toBe("ERROR");
    expect(r.rows[0]?.errors[0]).toContain("no da de alta socios");
    expect(r.rows[0]?.resolved).toBeUndefined();
  });

  it("acepta la fila cuyo socio existe y la deja lista para escribir", () => {
    const r = ok(`${ENCABEZADO}\n12,2024-03-10,15000,EFECTIVO,,`);
    expect(r.rows[0]?.status).toBe("VALID");
    expect(r.rows[0]?.resolved?.memberId).toBe("m-12");
    expect(r.rows[0]?.resolved?.amountMinor).toBe(1500000);
  });

  it("respeta los ceros a la izquierda del número de socio", () => {
    expect(ok(`${ENCABEZADO}\n007,2024-03-10,15000,EFECTIVO,,`).rows[0]?.resolved?.memberId)
      .toBe("m-007");
    // `7` y `007` no son el mismo socio: no se normaliza el número por las dudas.
    expect(ok(`${ENCABEZADO}\n7,2024-03-10,15000,EFECTIVO,,`).rows[0]?.status).toBe("ERROR");
  });

  it("muestra el nombre del socio para que quien revisa reconozca la fila", () => {
    expect(ok(`${ENCABEZADO}\n12,2024-03-10,15000,EFECTIVO,,`).rows[0]?.memberName)
      .toBe("Pérez, Ana");
  });
});

describe("fechas, importes y medios", () => {
  it("rechaza una fecha mal formada", () => {
    const r = ok(`${ENCABEZADO}\n12,10/03/2024,15000,EFECTIVO,,`);
    expect(r.rows[0]?.errors[0]).toContain("AAAA-MM-DD");
  });

  it("rechaza un día que no existe en vez de correrlo al mes siguiente", () => {
    expect(ok(`${ENCABEZADO}\n12,2024-02-31,15000,EFECTIVO,,`).rows[0]?.status).toBe("ERROR");
  });

  it("rechaza un medio de pago que no reconoce", () => {
    const r = ok(`${ENCABEZADO}\n12,2024-03-10,15000,BITCOIN,,`);
    expect(r.rows[0]?.errors[0]).toContain("Medio de pago desconocido");
  });

  it("sin medio de pago avisa, pero no bloquea la fila", () => {
    const r = ok(`${ENCABEZADO}\n12,2024-03-10,15000,,,`);
    expect(r.rows[0]?.status).toBe("WARNING");
    expect(r.rows[0]?.resolved?.method).toBe("OTRO");
  });

  it("rechaza un período mal formado", () => {
    expect(ok(`${ENCABEZADO}\n12,2024-03-10,15000,EFECTIVO,marzo 2024,`).rows[0]?.status)
      .toBe("ERROR");
  });
});

describe("no duplicar", () => {
  it("un pago ya importado se avisa para omitirlo", () => {
    const primero = ok(`${ENCABEZADO}\n12,2024-03-10,15000,EFECTIVO,,`);
    const clave = primero.rows[0]?.resolved?.dedupKey ?? "";
    const segundo = ok(`${ENCABEZADO}\n12,2024-03-10,15000,EFECTIVO,,`, [clave]);
    expect(segundo.rows[0]?.status).toBe("WARNING");
    expect(segundo.rows[0]?.warnings[0]).toContain("ya se importó");
  });

  it("dos cobros iguales el mismo día se importan los dos, con aviso", () => {
    const r = ok(`${ENCABEZADO}\n12,2024-03-10,15000,EFECTIVO,,\n12,2024-03-10,15000,EFECTIVO,,`);
    const claves = r.rows.map((f) => f.resolved?.dedupKey);
    expect(claves[0]).not.toBe(claves[1]);
    expect(r.rows[1]?.warnings[0]).toContain("mismo importe");
  });

  it("la clave incluye la institución: el mismo pago en otro workspace no colisiona", () => {
    const aca = ok(`${ENCABEZADO}\n12,2024-03-10,15000,EFECTIVO,,`).rows[0]?.resolved?.dedupKey;
    const alla = parseAndValidatePaymentImport({
      rawCsv: `${ENCABEZADO}\n12,2024-03-10,15000,EFECTIVO,,`,
      workspaceId: "ws-otra",
      membersByNumber: PADRON,
      existingDedupKeys: new Set(),
    });
    if (!alla.ok) throw new Error("debería leerse");
    expect(aca).not.toBe(alla.rows[0]?.resolved?.dedupKey);
  });
});

describe("composeReference", () => {
  it("nombra el período en palabras del socio", () => {
    expect(composeReference("2024-03", "")).toBe("Cuota de marzo de 2024");
  });

  it("junta período y comprobante cuando están los dos", () => {
    expect(composeReference("2024-03", "recibo 1234")).toBe("Cuota de marzo de 2024 · recibo 1234");
  });

  it("sin ninguno de los dos no inventa un texto vacío", () => {
    expect(composeReference("", "")).toBeNull();
  });
});

describe("recuento", () => {
  it("cuenta válidas, con aviso y con error por separado", () => {
    const r = ok(
      `${ENCABEZADO}\n` +
        "12,2024-03-10,15000,EFECTIVO,,\n" +
        "12,2024-04-10,15000,,,\n" +
        "999,2024-05-10,15000,EFECTIVO,,\n",
    );
    expect(r.totalRows).toBe(3);
    expect(r.validCount).toBe(1);
    expect(r.warningCount).toBe(1);
    expect(r.errorCount).toBe(1);
  });
});
