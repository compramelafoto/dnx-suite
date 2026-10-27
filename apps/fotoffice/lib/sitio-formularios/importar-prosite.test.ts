import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  agruparPorFormulario,
  claveDeFormularioProsite,
  claveDeImportacion,
  combinarArchivos,
  formularioDeNombreDeArchivo,
  decodificarTexto,
  detectarFormato,
  filasConSheetJs,
  filasDeArchivoDeTexto,
  interpretarTabla,
  parsearFechaArgentina,
} from "./importar-prosite";

const fixture = (n: string) => new Uint8Array(readFileSync(join(__dirname, "__fixtures__", n)));

describe("parsearFechaArgentina", () => {
  it("toma día/mes primero y la hora como argentina (UTC−3)", () => {
    expect(parsearFechaArgentina("27/10/2026 14:05")?.toISOString()).toBe("2026-10-27T17:05:00.000Z");
    expect(parsearFechaArgentina("27-10-2026")?.toISOString()).toBe("2026-10-27T03:00:00.000Z");
    expect(parsearFechaArgentina("27/10/26 14:05:30")?.toISOString()).toBe("2026-10-27T17:05:30.000Z");
    expect(parsearFechaArgentina("2026-10-27 08:00:00")?.toISOString()).toBe("2026-10-27T11:00:00.000Z");
    expect(parsearFechaArgentina("27/10/2026 às 14:05")?.toISOString()).toBe("2026-10-27T17:05:00.000Z");
  });

  it("respeta la zona si viene escrita", () => {
    expect(parsearFechaArgentina("2026-10-27T17:05:00Z")?.toISOString()).toBe("2026-10-27T17:05:00.000Z");
    expect(parsearFechaArgentina("2026-10-27T14:05:00-03:00")?.toISOString()).toBe("2026-10-27T17:05:00.000Z");
  });

  it("entiende el número de serie de Excel", () => {
    // 46322 = 27/10/2026; ,5 = 12:00.
    expect(parsearFechaArgentina(46322.5)?.toISOString()).toBe("2026-10-27T15:00:00.000Z");
  });

  it("rechaza fechas inexistentes o ilegibles", () => {
    expect(parsearFechaArgentina("31/02/2025 10:00")).toBeNull();
    expect(parsearFechaArgentina("ayer")).toBeNull();
    expect(parsearFechaArgentina("")).toBeNull();
    expect(parsearFechaArgentina(12)).toBeNull();
  });
});

describe("detectarFormato y decodificación", () => {
  it("reconoce cada formato por el contenido", () => {
    expect(detectarFormato(fixture("inbox-prosite.csv"))).toBe("csv");
    expect(detectarFormato(fixture("inbox-prosite-html.xls"))).toBe("html");
    expect(detectarFormato(fixture("inbox-prosite-xml.xls"))).toBe("xml-excel");
    expect(detectarFormato(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0]))).toBe("xlsx");
    expect(detectarFormato(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0]))).toBe("xls-binario");
  });

  it("lee Windows-1252 cuando no es UTF-8", () => {
    expect(decodificarTexto(new Uint8Array([0x54, 0x65, 0x6c, 0xe9, 0x66, 0x6f, 0x6e, 0x6f]))).toBe("Teléfono");
    expect(decodificarTexto(new TextEncoder().encode("﻿Teléfono"))).toBe("Teléfono");
  });
});

describe("interpretarTabla con el CSV de ejemplo", () => {
  const { formato, filas } = filasDeArchivoDeTexto(fixture("inbox-prosite.csv"));
  const r = interpretarTabla(filas);

  it("detecta las columnas y deja afuera el estado del inbox", () => {
    expect(formato).toBe("csv");
    expect(r.columnas).toEqual({
      fecha: "Fecha",
      formulario: "Formulario",
      campos: ["Nombre", "Correo", "Teléfono", "Instagram", "Mensaje"],
      ignoradas: ["Status"],
    });
  });

  it("arma los pares en orden, sin vacíos, y saca el contacto", () => {
    const ana = r.envios[0];
    expect(ana.formulario).toBe("Contacto");
    expect(ana.fecha?.toISOString()).toBe("2026-10-27T17:05:00.000Z");
    expect(ana.pares).toEqual([
      { etiqueta: "Nombre", valor: "Ana Pérez" },
      { etiqueta: "Correo", valor: "ANA@Ejemplo.com" },
      { etiqueta: "Teléfono", valor: "341 555-1234" },
      { etiqueta: "Instagram", valor: "@anaperez" },
      { etiqueta: "Mensaje", valor: "Hola, quiero info\nsobre bodas" },
    ]);
    expect(ana.contacto).toEqual({ nombre: "Ana Pérez", email: "ana@ejemplo.com", telefono: "341 555-1234" });
  });

  it("cuenta las filas repetidas una vez y explica las descartadas", () => {
    expect(r.repetidas).toBe(1);
    expect(r.descartadas).toEqual([
      { fila: 5, motivo: "Fecha ilegible: «31/02/2025 10:00»" },
      { fila: 8, motivo: "Fila sin datos (sólo la fecha)." },
    ]);
    expect(r.envios.map((e) => e.formulario)).toEqual(["Contacto", "CursoLightroom", "contacto", "Inbox de Prosite"]);
  });

  it("agrupa por formulario sin importar mayúsculas", () => {
    const grupos = agruparPorFormulario(r.envios);
    expect(grupos.map((g) => [g.clave, g.nombre, g.envios.length])).toEqual([
      ["prosite:contacto", "Contacto", 2],
      ["prosite:cursolightroom", "CursoLightroom", 1],
      ["prosite:inbox-de-prosite", "Inbox de Prosite", 1],
    ]);
    const contacto = grupos[0];
    expect(contacto.desde?.toISOString()).toBe("2025-03-02T14:00:00.000Z");
    expect(contacto.hasta?.toISOString()).toBe("2026-10-27T17:05:00.000Z");
  });

  it("usa el formulario por omisión que se le pase", () => {
    expect(interpretarTabla(filas, "Contacto web").envios.at(-1)?.formulario).toBe("Contacto web");
  });
});

describe("interpretarTabla con «XLS» que son HTML o XML", () => {
  it("HTML de Prosite en portugués: encabezados, entidades y saltos de línea", () => {
    const { filas } = filasDeArchivoDeTexto(fixture("inbox-prosite-html.xls"));
    const r = interpretarTabla(filas);
    expect(r.columnas.fecha).toBe("Data");
    expect(r.columnas.formulario).toBe("Formulário");
    expect(r.envios).toHaveLength(2);
    expect(r.envios[0].pares).toEqual([
      { etiqueta: "Nome", valor: "María & Cía" },
      { etiqueta: "E-mail", valor: "maria@ejemplo.com" },
      { etiqueta: "Telefone", valor: "+54 9 341 555-0000" },
      { etiqueta: "Mensagem", valor: "Primera línea\nsegunda" },
    ]);
    expect(r.envios[0].contacto.email).toBe("maria@ejemplo.com");
    expect(r.envios[0].contacto.telefono).toBe("+54 9 341 555-0000");
    expect(r.envios[1].contacto).toEqual({ nombre: "Pedro", email: null, telefono: "3415550001" });
  });

  it("XML de Excel 2003 con celdas salteadas (ss:Index)", () => {
    const { formato, filas } = filasDeArchivoDeTexto(fixture("inbox-prosite-xml.xls"));
    expect(formato).toBe("xml-excel");
    const r = interpretarTabla(filas);
    expect(r.envios.map((e) => e.pares)).toEqual([
      [
        { etiqueta: "Nombre", valor: "Sofía" },
        { etiqueta: "Correo", valor: "sofi@ejemplo.com" },
      ],
      [{ etiqueta: "Correo", valor: "solo@ejemplo.com" }],
    ]);
  });

  it("sin columna de fecha no importa nada y lo dice", () => {
    const r = interpretarTabla([
      ["Nombre", "Correo"],
      ["Ana", "ana@ejemplo.com"],
    ]);
    expect(r.envios).toEqual([]);
    expect(r.descartadas[0].motivo).toMatch(/no tiene una columna «Fecha»/);
  });

  it("filas de SheetJS (números de serie y teléfonos numéricos)", () => {
    const falso = {
      read: () => ({ SheetNames: ["Hoja1"], Sheets: { Hoja1: {} } }),
      utils: {
        sheet_to_json: () => [
          ["Fecha", "Formulario", "Nombre", "Celular"],
          [46322.5, "Celular", "Ana", 3415551234],
        ],
      },
    };
    const r = interpretarTabla(filasConSheetJs(falso, new Uint8Array()));
    expect(r.envios[0].fecha?.toISOString()).toBe("2026-10-27T15:00:00.000Z");
    expect(r.envios[0].contacto).toEqual({ nombre: "Ana", email: null, telefono: "3415551234" });
  });
});

describe("huellas", () => {
  it("la huella del envío es estable y cambia con cualquier dato", () => {
    const f = new Date("2026-10-27T17:05:00Z");
    const pares = [{ etiqueta: "Nombre", valor: "Ana" }];
    const a = claveDeImportacion(f, "Contacto", pares);
    expect(a).toHaveLength(40);
    expect(claveDeImportacion(f, " contacto ", pares)).toBe(a);
    expect(claveDeImportacion(f, "CONTACTO", [{ etiqueta: " nombre ", valor: "Ana" }])).toBe(a);
    expect(claveDeImportacion(f, "Contacto", [{ etiqueta: "Nombre", valor: "Ana B" }])).not.toBe(a);
    expect(claveDeImportacion(new Date("2026-10-27T17:06:00Z"), "Contacto", pares)).not.toBe(a);
  });

  it("la clave del formulario no tiene tildes ni espacios", () => {
    expect(claveDeFormularioProsite("Contacto de proveedores")).toBe("prosite:contacto-de-proveedores");
    expect(claveDeFormularioProsite("Fórmula  XV!")).toBe("prosite:formula-xv");
    expect(claveDeFormularioProsite("¿?")).toBe("prosite:sin-nombre");
  });
});

describe("exportación real de Prosite: un CSV por formulario en una carpeta", () => {
  const carpeta = join(__dirname, "__fixtures__", "prosite-carpeta");
  const entradas = readdirSync(carpeta)
    .sort()
    .map((archivo) => ({ archivo: join(carpeta, archivo), filas: filasDeArchivoDeTexto(new Uint8Array(readFileSync(join(carpeta, archivo)))).filas }));

  it("saca el formulario y la cantidad del nombre del archivo (con espacios, &, + y °)", () => {
    expect(formularioDeNombreDeArchivo("/x/001__Contacto de proveedores & más__3.csv")).toEqual({ nombre: "Contacto de proveedores & más", cantidad: 3 });
    expect(formularioDeNombreDeArchivo("002__Curso Lightroom + Photoshop 2°__1.csv")).toEqual({ nombre: "Curso Lightroom + Photoshop 2°", cantidad: 1 });
    expect(formularioDeNombreDeArchivo("010__XV__Landing__25.csv")).toEqual({ nombre: "XV__Landing", cantidad: 25 });
    expect(formularioDeNombreDeArchivo("inbox.csv")).toBeNull();
    expect(formularioDeNombreDeArchivo("001__Contacto.csv")).toBeNull();
  });

  it("«Enviado em» es la fecha, en UTC tal cual, y deduce el contacto de las etiquetas", () => {
    const r = combinarArchivos(entradas);
    const [ana, luis] = r.envios;
    expect(r.porArchivo[0].resultado.columnas).toEqual({ fecha: "Enviado em", formulario: null, campos: ["E-mail", "Instagram", "Nombre"], ignoradas: [] });
    expect(ana).toMatchObject({ formulario: "Contacto de proveedores & más", contacto: { nombre: "Ana Pérez", email: "ana@ejemplo.com", telefono: null } });
    expect(ana.fecha?.toISOString()).toBe("2025-04-26T17:41:32.944Z");
    expect(luis.fecha?.toISOString()).toBe("2025-04-27T03:00:00.000Z");
    const beto = r.envios.find((e) => e.formulario.startsWith("Curso"));
    expect(beto?.contacto).toEqual({ nombre: "Beto", email: null, telefono: "+54 9 341 555-0000" });
    // Sin columna de formulario: «Página» queda como un campo más.
    expect(beto?.pares.map((p) => p.etiqueta)).toEqual(["Nombre", "Celular", "Mensaje", "Página"]);
  });

  it("no duplica el mismo envío repetido en un archivo ni en otro archivo con las columnas en otro orden", () => {
    const r = combinarArchivos(entradas);
    expect(r.envios).toHaveLength(3);
    expect(r.repetidas).toBe(2);
    expect(r.porArchivo.map((a) => [a.formulario, a.esperados, a.nuevos])).toEqual([
      ["Contacto de proveedores & más", 3, 2],
      ["Curso Lightroom + Photoshop 2°", 1, 1],
      ["Contacto de proveedores & más", 1, 0],
    ]);
    expect(agruparPorFormulario(r.envios).map((g) => [g.clave, g.envios.length])).toEqual([
      ["prosite:contacto-de-proveedores-mas", 2],
      ["prosite:curso-lightroom-photoshop-2", 1],
    ]);
  });
});

describe("casos reales de la exportación de Prosite", () => {
  it("«2019-07-26 01:16:06 UTC» es UTC", () => {
    expect(parsearFechaArgentina("2019-07-26 01:16:06 UTC")?.toISOString()).toBe("2019-07-26T01:16:06.000Z");
    expect(parsearFechaArgentina("2019-02-30 01:16:06 UTC")).toBeNull();
  });

  it("realinea las filas que no traen la columna sin nombre del encabezado (RAMIREZ FESTEJA)", () => {
    const r = interpretarTabla(
      filasDeCsvDePrueba(
        "Correo,Instagram,Imstagram,Imstagra,,Nombre,Enviado em\nnay@ejemplo.com,,,,Nayla,2023-06-29T17:22:18.754Z\nnay@ejemplo.com,,,,Nayla castro ,2023-05-25T11:32:50.784Z\n",
      ),
      "RAMIREZ FESTEJA",
      { columnaFormulario: false },
    );
    expect(r.descartadas).toEqual([]);
    expect(r.columnas.campos).toEqual(["Correo", "Instagram", "Imstagram", "Imstagra", "Campo sin nombre", "Nombre"]);
    expect(r.envios[0].fecha?.toISOString()).toBe("2023-06-29T17:22:18.754Z");
    expect(r.envios[0].pares).toEqual([
      { etiqueta: "Correo", valor: "nay@ejemplo.com" },
      { etiqueta: "Nombre", valor: "Nayla" },
    ]);
    expect(r.envios[1].contacto).toEqual({ nombre: "Nayla castro", email: "nay@ejemplo.com", telefono: null });
  });

  it("una fila con la fecha vacía se importa «sin fecha», con huella estable; una fecha ilegible se descarta", () => {
    const csv = "Nombre,Correo,Enviado em\nAna,ana@ejemplo.com,\nBeto,beto@ejemplo.com,ayer\n,,\n";
    const a = interpretarTabla(filasDeCsvDePrueba(csv), "X", { columnaFormulario: false });
    const b = interpretarTabla(filasDeCsvDePrueba(csv), "X", { columnaFormulario: false });
    expect(a.envios).toHaveLength(1);
    expect(a.envios[0].fecha).toBeNull();
    expect(a.envios[0].clave).toBe(b.envios[0].clave);
    expect(a.descartadas).toEqual([{ fila: 3, motivo: "Fecha ilegible: «ayer»" }]);
    const [g] = agruparPorFormulario(a.envios);
    expect([g.desde, g.hasta, g.sinFecha]).toEqual([null, null, 1]);
  });
});

function filasDeCsvDePrueba(texto: string) {
  return filasDeArchivoDeTexto(new TextEncoder().encode(texto)).filas;
}
