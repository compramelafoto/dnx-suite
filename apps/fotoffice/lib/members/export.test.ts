import { describe, expect, it } from "vitest";
import {
  buildExportFilename,
  buildMembersCsv,
  escapeFormulaInjection,
  hasActiveFilters,
  parseExportFilters,
  toCsvCell,
  toCsvDate,
  type ExportableMember,
} from "./export";
import { MEMBER_IMPORT_COLUMNS } from "./import/columns";

function member(overrides: Partial<ExportableMember> = {}): ExportableMember {
  return {
    memberNumber: "124",
    firstName: "Juan",
    lastName: "Pérez",
    documentType: "DNI",
    documentNumber: "30111222",
    email: "juan@example.com",
    phone: "+54 341 555-1111",
    birthDate: new Date("1990-05-01T00:00:00Z"),
    address: "Calle Falsa 123",
    city: "Rosario",
    province: "Santa Fe",
    postalCode: "2000",
    joinedAt: new Date("2024-01-15T00:00:00Z"),
    status: "ACTIVE",
    notes: "Sin observaciones",
    category: { name: "Socio activo" },
    ...overrides,
  };
}

describe("compatibilidad con el importador", () => {
  it("el encabezado es EXACTAMENTE el que espera el importador", () => {
    const csv = buildMembersCsv([]);
    expect(csv.split("\r\n")[0]).toBe(MEMBER_IMPORT_COLUMNS.map((c) => c.key).join(","));
  });

  it("exporta una fila por socio, más el encabezado", () => {
    const csv = buildMembersCsv([member(), member({ memberNumber: "125" })]);
    expect(csv.split("\r\n")).toHaveLength(3);
  });

  it("la categoría se exporta por NOMBRE, no por id técnico", () => {
    const csv = buildMembersCsv([member({ category: { name: "Estudiante" } })]);
    expect(csv).toContain("Estudiante");
  });

  it("las fechas salen en AAAA-MM-DD, el formato que exige el importador", () => {
    const csv = buildMembersCsv([member()]);
    expect(csv).toContain("2024-01-15");
    expect(csv).toContain("1990-05-01");
  });

  it("un socio sin categoría deja la celda vacía, no 'null'", () => {
    const csv = buildMembersCsv([member({ category: null })]);
    expect(csv).not.toContain("null");
  });

  it("campos nulos quedan vacíos, nunca con el texto 'null' o 'undefined'", () => {
    const csv = buildMembersCsv([
      member({ email: null, phone: null, notes: null, birthDate: null, address: null }),
    ]);
    expect(csv).not.toMatch(/null|undefined/);
  });

  it("el documento se exporta normalizado, para que reimportar no reintroduzca formatos mezclados", () => {
    const csv = buildMembersCsv([member({ documentType: "dni", documentNumber: "30.111.222" })]);
    expect(csv).toContain("DNI,30111222");
  });
});

describe("seguridad: inyección de fórmulas (CSV injection)", () => {
  it("una celda que empieza con = se neutraliza", () => {
    expect(escapeFormulaInjection("=1+1")).toBe("'=1+1");
  });

  it("también + , - y @", () => {
    expect(escapeFormulaInjection("+1")).toBe("'+1");
    expect(escapeFormulaInjection("-1")).toBe("'-1");
    expect(escapeFormulaInjection("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("tabulación y retorno de carro al inicio también se neutralizan", () => {
    expect(escapeFormulaInjection("\tcmd")).toBe("'\tcmd");
    expect(escapeFormulaInjection("\rcmd")).toBe("'\rcmd");
  });

  it("un texto normal NO se altera", () => {
    expect(escapeFormulaInjection("Juan Pérez")).toBe("Juan Pérez");
    expect(escapeFormulaInjection("Calle 1-2")).toBe("Calle 1-2");
  });

  it("un apellido malicioso no llega crudo al CSV", () => {
    const csv = buildMembersCsv([member({ lastName: "=HYPERLINK(\"http://malo\",\"click\")" })]);
    expect(csv).toContain("'=HYPERLINK");
  });

  it("una nota con fórmula tampoco", () => {
    const csv = buildMembersCsv([member({ notes: "@SUM(1+1)" })]);
    expect(csv).toContain("'@SUM");
  });

  it("el dato no se pierde: sigue siendo legible, solo deja de ejecutarse", () => {
    const csv = buildMembersCsv([member({ notes: "=2+2" })]);
    expect(csv).toContain("2+2");
  });
});

describe("escapado CSV (RFC 4180)", () => {
  it("una coma fuerza comillas", () => {
    expect(toCsvCell("Rosario, Santa Fe")).toBe('"Rosario, Santa Fe"');
  });

  it("las comillas se doblan", () => {
    expect(toCsvCell('dice "hola"')).toBe('"dice ""hola"""');
  });

  it("un salto de línea fuerza comillas", () => {
    expect(toCsvCell("linea1\nlinea2")).toBe('"linea1\nlinea2"');
  });

  it("null y undefined quedan vacíos", () => {
    expect(toCsvCell(null)).toBe("");
    expect(toCsvCell(undefined)).toBe("");
  });

  it("una nota con comas y comillas no rompe el número de columnas", () => {
    const csv = buildMembersCsv([member({ notes: 'Vive en Rosario, dice "hola"' })]);
    const lines = csv.split("\r\n");
    expect(lines).toHaveLength(2);
  });

  it("toCsvDate devuelve vacío ante fecha inválida o nula", () => {
    expect(toCsvDate(null)).toBe("");
    expect(toCsvDate(new Date("no-es-fecha"))).toBe("");
  });
});

describe("nombre de archivo seguro", () => {
  it("usa el nombre del workspace en forma de slug", () => {
    const f = buildExportFilename("Sociedad de Fotógrafos", "todos", new Date("2026-08-21T10:00:00Z"));
    expect(f).toBe("padron-sociedad-de-fotografos-todos-2026-08-21.csv");
  });

  it("distingue exportación filtrada de completa", () => {
    expect(buildExportFilename("SFPR", "filtrados", new Date("2026-08-21T10:00:00Z"))).toContain("filtrados");
  });

  it("NO permite inyectar cabeceras ni comillas desde el nombre del workspace", () => {
    const f = buildExportFilename('mal"; drop\r\nX-Evil: 1', "todos");
    expect(f).not.toMatch(/["\r\n;]/);
  });

  it("no permite recorrido de rutas", () => {
    const f = buildExportFilename("../../etc/passwd", "todos");
    expect(f).not.toContain("..");
    expect(f).not.toContain("/");
  });

  it("un nombre sin caracteres utilizables cae a un valor por defecto", () => {
    expect(buildExportFilename("!!!", "todos")).toContain("workspace");
  });
});

describe("filtros: el servidor rearma la consulta, no confía en el navegador", () => {
  it("lee búsqueda, estado y categoría de la URL", () => {
    const f = parseExportFilters(new URLSearchParams("q=perez&status=ACTIVE&categoryId=cat_1"));
    expect(f).toEqual({ search: "perez", status: "ACTIVE", categoryId: "cat_1" });
  });

  it("un estado inválido se DESCARTA, no ensancha ni rompe la consulta", () => {
    expect(parseExportFilters(new URLSearchParams("status=SUPERUSER")).status).toBeUndefined();
  });

  it("parámetros vacíos no generan filtros fantasma", () => {
    expect(parseExportFilters(new URLSearchParams("q=&status=&categoryId="))).toEqual({
      search: undefined,
      status: undefined,
      categoryId: undefined,
    });
  });

  it("IGNORA una lista de ids mandada por el navegador: no es un filtro válido", () => {
    const f = parseExportFilters(new URLSearchParams("ids=a,b,c&workspaceId=otro-workspace"));
    expect(f).toEqual({ search: undefined, status: undefined, categoryId: undefined });
    expect(JSON.stringify(f)).not.toContain("otro-workspace");
  });

  it("sin filtros, hasActiveFilters es false (exportación completa)", () => {
    expect(hasActiveFilters(parseExportFilters(new URLSearchParams()))).toBe(false);
  });

  it("con cualquier filtro real, hasActiveFilters es true", () => {
    expect(hasActiveFilters({ search: "perez" })).toBe(true);
    expect(hasActiveFilters({ status: "ACTIVE" })).toBe(true);
    expect(hasActiveFilters({ categoryId: "cat_1" })).toBe(true);
  });
});
