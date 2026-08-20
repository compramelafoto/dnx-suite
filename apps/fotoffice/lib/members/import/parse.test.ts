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

describe("emails duplicados — dentro del archivo", () => {
  const row = (n: number, email: string, doc = "") =>
    `${n},Socio${n},Apellido${n},${doc ? "DNI" : ""},${doc},${email},,,,,,,2024-01-15,ACTIVE,Socio activo,`;

  it("dos filas con exactamente el mismo email: ambas quedan en ERROR", () => {
    const csv = `${HEADER}\n${row(1, "socio@ejemplo.com")}\n${row(2, "socio@ejemplo.com")}`;
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].status).toBe("ERROR");
    expect(result.rows[1].status).toBe("ERROR");
    expect(result.rows[0].errors.some((e) => e.includes("repetido en el archivo"))).toBe(true);
    expect(result.rows[1].errors.some((e) => e.includes("repetido en el archivo"))).toBe(true);
    expect(result.errorCount).toBe(2);
  });

  it("mismo email variando mayúsculas: se detecta igual", () => {
    const csv = `${HEADER}\n${row(1, "SOCIO@EJEMPLO.COM")}\n${row(2, "socio@ejemplo.com")}`;
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].status).toBe("ERROR");
    expect(result.rows[1].status).toBe("ERROR");
  });

  it("mismo email con espacios laterales: se detecta igual", () => {
    const csv = `${HEADER}\n${row(1, " socio@ejemplo.com ")}\n${row(2, "socio@ejemplo.com")}`;
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].status).toBe("ERROR");
    expect(result.rows[1].status).toBe("ERROR");
  });

  it("tres filas con el mismo email: las TRES quedan marcadas, no solo las repetidas", () => {
    const csv = `${HEADER}\n${row(1, "compartido@ejemplo.com")}\n${row(2, "compartido@ejemplo.com")}\n${row(3, "compartido@ejemplo.com")}`;
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.map((r) => r.status)).toEqual(["ERROR", "ERROR", "ERROR"]);
    expect(result.errorCount).toBe(3);
  });

  it("el mensaje nombra las OTRAS filas del conflicto, para poder corregir el CSV", () => {
    const csv = `${HEADER}\n${row(1, "compartido@ejemplo.com")}\n${row(2, "compartido@ejemplo.com")}\n${row(3, "compartido@ejemplo.com")}`;
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const msg = result.rows[0].errors.find((e) => e.includes("repetido en el archivo"))!;
    expect(msg).toContain("2, 3");
    expect(msg).not.toContain(" 1,");
  });

  it("emails distintos: ninguna fila se marca por email", () => {
    const csv = `${HEADER}\n${row(1, "uno@ejemplo.com")}\n${row(2, "dos@ejemplo.com")}`;
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows.every((r) => !r.errors.some((e) => e.toLowerCase().includes("email")))).toBe(true);
    expect(result.errorCount).toBe(0);
  });

  it("filas SIN email no se consideran duplicadas entre sí", () => {
    const csv = `${HEADER}\n${row(1, "")}\n${row(2, "")}\n${row(3, "")}`;
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.errorCount).toBe(0);
    expect(result.rows.every((r) => r.status === "WARNING")).toBe(true);
  });

  it("una fila con email y otras sin email: no hay conflicto", () => {
    const csv = `${HEADER}\n${row(1, "unico@ejemplo.com")}\n${row(2, "")}`;
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.errorCount).toBe(0);
  });
});

describe("emails duplicados — contra la base del workspace", () => {
  const row = (n: number, email: string) =>
    `${n},Socio${n},Apellido${n},,,${email},,,,,,,2024-01-15,ACTIVE,Socio activo,`;

  it("email que ya existe en ESTE workspace: fila en ERROR", () => {
    const csv = `${HEADER}\n${row(1, "existente@ejemplo.com")}`;
    const result = parseAndValidateMemberImport(
      baseParams({ rawCsv: csv, existingEmails: new Set(["existente@ejemplo.com"]) }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].status).toBe("ERROR");
    expect(result.rows[0].errors.some((e) => e.includes("ya está registrado"))).toBe(true);
  });

  it("el mensaje NO revela ningún dato personal del socio existente", () => {
    const csv = `${HEADER}\n${row(1, "existente@ejemplo.com")}`;
    const result = parseAndValidateMemberImport(
      baseParams({ rawCsv: csv, existingEmails: new Set(["existente@ejemplo.com"]) }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const msg = result.rows[0].errors.find((e) => e.includes("ya está registrado"))!;
    // Solo dice que está tomado; ni nombre, ni número de socio, ni documento del otro socio.
    expect(msg).not.toMatch(/socio n|dni|apellido/i);
  });

  it("comparación normalizada: MAYÚSCULAS del CSV matchean el email guardado", () => {
    const csv = `${HEADER}\n${row(1, "EXISTENTE@EJEMPLO.COM")}`;
    const result = parseAndValidateMemberImport(
      baseParams({ rawCsv: csv, existingEmails: new Set(["existente@ejemplo.com"]) }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].status).toBe("ERROR");
  });

  it("aislamiento: un email de OTRO workspace no bloquea (el set solo trae los de este)", () => {
    const csv = `${HEADER}\n${row(1, "otro-workspace@ejemplo.com")}`;
    // El set representa SOLO los emails del workspace actual; el de otro workspace no está.
    const result = parseAndValidateMemberImport(
      baseParams({ rawCsv: csv, existingEmails: new Set(["alguien-de-este-workspace@ejemplo.com"]) }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].errors.some((e) => e.includes("ya está registrado"))).toBe(false);
    expect(result.errorCount).toBe(0);
  });

  it("sin existingEmails (llamador que no lo pasa): no rompe, solo no valida contra base", () => {
    const csv = `${HEADER}\n${row(1, "cualquiera@ejemplo.com")}`;
    const result = parseAndValidateMemberImport(baseParams({ rawCsv: csv }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.errorCount).toBe(0);
  });

  it("conflicto de email conviviendo con conflicto de número de socio: se reportan ambos", () => {
    const csv = `${HEADER}\n${row(1, "existente@ejemplo.com")}`;
    const result = parseAndValidateMemberImport(
      baseParams({
        rawCsv: csv,
        existingEmails: new Set(["existente@ejemplo.com"]),
        existingMemberNumbers: new Set(["1"]),
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].errors.some((e) => e.includes("ya está registrado"))).toBe(true);
    expect(result.rows[0].errors.some((e) => e.includes("número"))).toBe(true);
  });

  it("una fila con email en conflicto NUNCA queda resolved: no llega al insert", () => {
    const csv = `${HEADER}\n${row(1, "existente@ejemplo.com")}\n${row(2, "libre@ejemplo.com")}`;
    const result = parseAndValidateMemberImport(
      baseParams({ rawCsv: csv, existingEmails: new Set(["existente@ejemplo.com"]) }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows[0].resolved).toBeUndefined();
    expect(result.rows[1].resolved).toBeDefined();
  });
});
