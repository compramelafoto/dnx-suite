import { describe, expect, it } from "vitest";
import { parseAndValidateMemberImport } from "./parse";

const CATEGORY_ID = "cat_socio_activo";
const categoriesByName = new Map([["socio activo", CATEGORY_ID], ["estudiante", "cat_estudiante"]]);

function baseParams(overrides: Partial<Parameters<typeof parseAndValidateMemberImport>[0]> = {}) {
  return {
    rawCsv: "",
    categoriesByName,
    existingMemberNumbers: new Set<string>(),
    existingDocuments: new Set<string>(),
    ...overrides,
  };
}

const HEADER =
  "memberNumber,firstName,lastName,documentType,documentNumber,email,phone,birthDate,address,city,province,postalCode,joinedAt,status,category,notes";

describe("parseAndValidateMemberImport — CSV válido", () => {
  it("una fila completa y correcta queda VALID", () => {
    const csv = `${HEADER}\n124,Juan,Pérez,DNI,30111222,juan@example.com,+54 341 555-1111,1990-05-01,Calle Falsa 123,Rosario,Santa Fe,2000,2024-01-15,ACTIVE,Socio activo,Sin observaciones`;
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].status).toBe("VALID");
    expect(result.rows[0].resolved?.categoryId).toBe(CATEGORY_ID);
    expect(result.validCount).toBe(1);
    expect(result.errorCount).toBe(0);
  });

  it("campos opcionales vacíos generan advertencia, no error", () => {
    const csv = `${HEADER}\n124,Juan,Pérez,,,,,,,,,,2024-01-15,ACTIVE,Socio activo,`;
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].status).toBe("WARNING");
    expect(result.rows[0].errors).toHaveLength(0);
    expect(result.rows[0].warnings.length).toBeGreaterThan(0);
  });
});

describe("comillas, comas dentro de campos, tildes/ñ (UTF-8)", () => {
  it("una coma dentro de notes (entre comillas) no rompe el parseo de columnas", () => {
    const csv = `${HEADER}\n124,María,Núñez,,,,,,,,,,2024-01-15,ACTIVE,Socio activo,"Vive en Rosario, cerca del río"`;
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].firstName).toBe("María");
    expect(result.rows[0].lastName).toBe("Núñez");
    expect(result.rows[0].resolved?.notes).toBe("Vive en Rosario, cerca del río");
  });

  it("tildes y ñ se preservan intactas", () => {
    const csv = `${HEADER}\n1,José,Peña,,,,,,,,,,2024-01-15,ACTIVE,Socio activo,`;
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].firstName).toBe("José");
    expect(result.rows[0].lastName).toBe("Peña");
  });
});

describe("memberNumber — se conserva exacto, nunca se renumera", () => {
  it("ceros a la izquierda se preservan como string", () => {
    const csv = `${HEADER}\n001,Ana,Gómez,,,,,,,,,,2024-01-15,ACTIVE,Socio activo,`;
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].memberNumber).toBe("001");
    expect(result.rows[0].resolved?.memberNumber).toBe("001");
  });
});

describe("fechas — formato estricto AAAA-MM-DD, nunca se adivina", () => {
  it("fecha de ingreso mal formada: ERROR, no se adivina ni se cae a 'hoy'", () => {
    const csv = `${HEADER}\n1,Ana,Gómez,,,,,,,,,,15/01/2024,ACTIVE,Socio activo,`;
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].status).toBe("ERROR");
    expect(result.rows[0].errors.some((e) => e.includes("Fecha de ingreso"))).toBe(true);
    expect(result.rows[0].resolved).toBeUndefined();
  });

  it("fecha de nacimiento mal formada (cuando está presente): ERROR", () => {
    const csv = `${HEADER}\n1,Ana,Gómez,,,,,1990,,,,,2024-01-15,ACTIVE,Socio activo,`;
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].errors.some((e) => e.includes("nacimiento"))).toBe(true);
  });
});

describe("categoría", () => {
  it("categoría inexistente: ERROR explícito, nunca se crea sola", () => {
    const csv = `${HEADER}\n1,Ana,Gómez,,,,,,,,,,2024-01-15,ACTIVE,Categoría Inventada,`;
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].status).toBe("ERROR");
    expect(result.rows[0].errors.some((e) => e.includes("no existe"))).toBe(true);
  });

  it("categoría vacía: ERROR (es obligatoria)", () => {
    const csv = `${HEADER}\n1,Ana,Gómez,,,,,,,,,,2024-01-15,ACTIVE,,`;
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].status).toBe("ERROR");
  });
});

describe("status — solo ACTIVE/SUSPENDED/INACTIVE", () => {
  it("status inválido: ERROR con mensaje en castellano (no un error de zod)", () => {
    const csv = `${HEADER}\n1,Ana,Gómez,,,,,,,,,,2024-01-15,VENCIDO,Socio activo,`;
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].status).toBe("ERROR");
    expect(result.rows[0].errors.join(" ")).not.toMatch(/enum/i);
  });

  it("acepta minúsculas y equivalentes en castellano (ChatGPT puede variar el casing)", () => {
    const csv = `${HEADER}\n1,Ana,Gómez,,,,,,,,,,2024-01-15,activo,Socio activo,`;
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].resolved?.status).toBe("ACTIVE");
  });
});

describe("duplicados dentro del archivo", () => {
  it("dos filas con el mismo memberNumber: ambas ERROR", () => {
    const csv = `${HEADER}\n124,Juan,Pérez,,,,,,,,,,2024-01-15,ACTIVE,Socio activo,\n124,Otro,Socio,,,,,,,,,,2024-01-15,ACTIVE,Socio activo,`;
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].status).toBe("ERROR");
    expect(result.rows[1].status).toBe("ERROR");
    expect(result.rows[0].errors.some((e) => e.includes("duplicado"))).toBe(true);
  });

  it("documento duplicado dentro del archivo: ERROR en ambas filas", () => {
    const csv = `${HEADER}\n1,Juan,Pérez,DNI,30111222,,,,,,,,2024-01-15,ACTIVE,Socio activo,\n2,Otro,Socio,DNI,30111222,,,,,,,,2024-01-15,ACTIVE,Socio activo,`;
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].errors.some((e) => e.includes("documento"))).toBe(true);
    expect(result.rows[1].errors.some((e) => e.includes("documento"))).toBe(true);
  });
});

describe("duplicados contra la base existente", () => {
  it("memberNumber ya existente en el workspace: ERROR", () => {
    const csv = `${HEADER}\n124,Juan,Pérez,,,,,,,,,,2024-01-15,ACTIVE,Socio activo,`;
    const result = parseAndValidateMemberImport(
      baseParams({ rawCsv: csv, existingMemberNumbers: new Set(["124"]) }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].status).toBe("ERROR");
    expect(result.rows[0].errors.some((e) => e.includes("Ya existe un socio con ese número"))).toBe(true);
  });

  it("documento ya existente en el workspace: ERROR", () => {
    const csv = `${HEADER}\n1,Juan,Pérez,DNI,30111222,,,,,,,,2024-01-15,ACTIVE,Socio activo,`;
    const result = parseAndValidateMemberImport(
      baseParams({ rawCsv: csv, existingDocuments: new Set(["dni::30111222"]) }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].errors.some((e) => e.includes("Ya existe un socio con ese documento"))).toBe(true);
  });
});

describe("encabezados y límites", () => {
  it("faltan columnas obligatorias: error de archivo completo, no fila por fila", () => {
    const csv = "memberNumber,firstName\n1,Juan";
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(false);
  });

  it("archivo vacío (solo encabezado): error explícito", () => {
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: HEADER }));
    expect(result.ok).toBe(false);
  });

  it("más filas que el máximo permitido: rechazado antes de procesar", () => {
    const rows = Array.from(
      { length: 501 },
      (_, i) => `${i},A,B,,,,,,,,,,2024-01-15,ACTIVE,Socio activo,`,
    ).join("\n");
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: `${HEADER}\n${rows}` }));
    expect(result.ok).toBe(false);
  });
});
