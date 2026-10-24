/**
 * Diseños de prueba para comparar la pantalla con el PDF.
 *
 * Cada caso ejercita algo que ya se rompió o que es fácil de romper: textos girados (la carpeta de
 * San Patricio salió con los textos fuera de la hoja), tipografías (el PDF las cambiaba por DM
 * Sans), alineaciones y saltos de línea, el listado del curso, formas e imágenes. Los bloques
 * están en el formato que guarda el editor, el mismo que dibuja el lienzo.
 */
import type { TemplateV2Block, TemplateV2Canvas } from "@repo/template-editor-core";
import type { UMBRALES } from "./comparar";

export type CasoDeComparacion = {
  id: string;
  titulo: string;
  canvas: TemplateV2Canvas;
  paginas: number;
  blocks: TemplateV2Block[];
  /** Valores de las variables (el listado del curso, por ejemplo). */
  valores?: Record<string, string>;
  /**
   * Tolerancias propias del caso, sólo cuando hay una diferencia conocida que no es un error. Hay
   * que decir cuál en un comentario al lado.
   */
  umbrales?: Partial<typeof UMBRALES>;
};

let orden = 0;

function bloque(
  type: TemplateV2Block["type"],
  pageIndex: number,
  caja: { x: number; y: number; width: number; height: number; rotation?: number; opacity?: number },
  configJson: Record<string, unknown>,
): TemplateV2Block {
  orden += 1;
  return {
    id: `b${orden}`,
    type,
    pageIndex,
    name: null,
    layout: {
      x: caja.x,
      y: caja.y,
      width: caja.width,
      height: caja.height,
      rotation: caja.rotation ?? 0,
      zIndex: orden,
      opacity: caja.opacity ?? 1,
      locked: false,
      visible: true,
    },
    configJson,
  };
}

function texto(
  pageIndex: number,
  caja: { x: number; y: number; width: number; height: number; rotation?: number },
  content: string,
  estilo: Record<string, unknown> = {},
): TemplateV2Block {
  return bloque("TEXT", pageIndex, caja, {
    content,
    fontFamily: "DM Sans",
    fontSize: 40,
    color: "#1d3a6b",
    textAlign: "CENTER",
    fontWeight: 400,
    lineHeight: 1.2,
    ...estilo,
  });
}

function forma(
  pageIndex: number,
  caja: { x: number; y: number; width: number; height: number; rotation?: number; opacity?: number },
  estilo: Record<string, unknown>,
): TemplateV2Block {
  return bloque("SHAPE", pageIndex, caja, { variant: "rectangle", fill: "#f3d9e4", ...estilo });
}

function imagen(
  pageIndex: number,
  caja: { x: number; y: number; width: number; height: number; rotation?: number },
  src: string,
  estilo: Record<string, unknown> = {},
): TemplateV2Block {
  return bloque("IMAGE", pageIndex, caja, { src, ...estilo });
}

const CHICO: TemplateV2Canvas = { width: 1500, height: 1000, dpi: 150, background: "#ffffff" } as TemplateV2Canvas;

const ALUMNOS = [
  "Sofía Pérez", "Mateo Gómez", "Valentina Díaz", "Benjamín Álvarez", "Isabella Romero",
  "Thiago Pérez", "Emma Gómez", "Joaquín Díaz", "Martina Álvarez", "Lautaro Romero",
  "Catalina Pérez", "Felipe Gómez", "Olivia Díaz", "Santino Álvarez", "Mía Romero", "Bautista Pérez",
];

function listaDelCurso(): string {
  return JSON.stringify(
    ALUMNOS.map((n, i) => {
      const [f, l] = n.split(" ");
      return i === 3 ? { f, l, o: 1 } : { f, l };
    }),
  );
}

/** Dos cursos de la misma foto grupal (7.° A y 7.° B), cada uno con su título. */
function dosCursos(): string {
  const curso = (nombres: string[], dueña: number | null) =>
    nombres.map((n, i) => {
      const [f, l] = n.split(" ");
      return i === dueña ? { f, l, o: 1 } : { f, l };
    });
  return JSON.stringify({
    g: [
      { t: "7.° A", k: "padron|||7.°|A", s: curso(ALUMNOS.slice(0, 9), 3) },
      { t: "7.° B", k: "padron|||7.°|B", s: curso(ALUMNOS.slice(9), null) },
    ],
  });
}

/** Dos cursos del padrón tal como vienen («3» + «B»), con turno: el título sale «3.° B · Turno mañana». */
function dosCursosConTurno(): string {
  const curso = (nombres: string[], dueña: number | null) =>
    nombres.map((n, i) => {
      const [f, l] = n.split(" ");
      return i === dueña ? { f, l, o: 1 } : { f, l };
    });
  return JSON.stringify({
    g: [
      { t: "3 B", k: "padron|Primario|Mañana|3|B", h: "Mañana", s: curso(ALUMNOS.slice(0, 10), 2) },
      { t: "3 C", k: "padron|Primario|Tarde|3|C", h: "Tarde", s: curso(ALUMNOS.slice(6), null) },
    ],
  });
}

/** Un curso más largo y con número impar: las dos columnas quedan de distinto largo. */
const SEPTIMO_A = [
  "lucía acosta", "tomás benítez", "martina castro", "juan cruz díaz", "emilia fernández",
  "bruno giménez", "julieta gómez", "franco herrera", "agustina lópez", "ignacio martínez",
  "camila morales", "nicolás pérez", "abril quiroga", "facundo romero", "victoria sosa",
  "lorenzo torres", "zoe vega", "máximo zapata", "pilar aguirre", "gael bustos",
  "renata cabrera", "ciro domínguez", "alma espinoza",
];

function septimoA(): string {
  return JSON.stringify(
    SEPTIMO_A.map((n, i) => {
      const partes = n.split(" ");
      const l = partes.pop()!;
      return i === 6 ? { f: partes.join(" "), l, o: 1 } : { f: partes.join(" "), l };
    }),
  );
}

/**
 * El bloque «Listado del curso» de 7.º A, copiado tal cual de la plantilla de San Patricio
 * (TemplateV2 cmv36vjbc0000l8066hx8tjex): posición, tamaño, giro, columnas y tipografía.
 */
function listadoSanPatricio(pageIndex: number, verticalAlign?: string): TemplateV2Block {
  return bloque(
    "VARIABLE_TEXT",
    pageIndex,
    { x: -153.4737183511329, y: 590.8512944622227, width: 1969.923309783439, height: 1239.297411075555, rotation: 90.68413159032582 },
    {
      color: "#334155",
      fallback: "",
      fontSize: 67,
      classList: { sortBy: "lastName", columns: 2, nameOrder: "firstLast", givenNames: "all", highlightOwner: true },
      textAlign: "CENTER",
      underline: false,
      fontFamily: "Helvetica",
      fontItalic: false,
      fontWeight: 400,
      lineHeight: 1.3,
      variableKey: "course.studentList",
      letterSpacing: 0,
      textTransform: "capitalize",
      ...(verticalAlign ? { verticalAlign } : {}),
    },
  );
}

/** Los casos, con la imagen de prueba ya resuelta (se genera una sola vez). */
export function casosDeComparacion(imagenDePrueba: string): CasoDeComparacion[] {
  orden = 0;
  return [
    {
      id: "textos-girados",
      titulo: "Textos girados en varios ángulos",
      canvas: CHICO,
      paginas: 1,
      blocks: [
        texto(0, { x: 50, y: 60, width: 600, height: 70 }, "Sin giro"),
        texto(0, { x: 750, y: 60, width: 600, height: 70, rotation: 30 }, "Treinta grados"),
        texto(0, { x: 100, y: 450, width: 700, height: 70, rotation: 90 }, "5.º A - Colegio San Patricio"),
        texto(0, { x: 500, y: 450, width: 700, height: 70, rotation: -90 }, "Hacia arriba, menos noventa"),
        texto(0, { x: 850, y: 600, width: 560, height: 70, rotation: 180 }, "Cabeza abajo"),
        texto(0, { x: 850, y: 800, width: 560, height: 70, rotation: -7 }, "Un poco inclinado", { fontWeight: 700 }),
      ],
    },
    {
      id: "tipografias",
      titulo: "Tipografías del editor, normal y negrita",
      canvas: CHICO,
      paginas: 1,
      blocks: [
        "Helvetica", "Montserrat", "Lato", "Playfair Display", "Merriweather", "Oswald",
        "Great Vibes", "Pacifico", "Caveat", "Roboto", "Times New Roman", "Bebas Neue",
      ].map((familia, i) =>
        texto(
          0,
          { x: 40 + (i % 2) * 720, y: 30 + Math.floor(i / 2) * 160, width: 700, height: 80 },
          `${familia}: Benjamín 5.º A`,
          { fontFamily: familia, textAlign: "left", fontWeight: i % 3 === 0 ? 700 : 400, fontSize: 44 },
        ),
      ),
    },
    {
      id: "alineaciones",
      titulo: "Alineaciones, varias líneas y mayúsculas",
      canvas: CHICO,
      paginas: 1,
      blocks: [
        forma(0, { x: 40, y: 40, width: 440, height: 420 }, { fill: "#f4f1ec" }),
        texto(0, { x: 40, y: 40, width: 440, height: 420 }, "Texto alineado a la izquierda que ocupa varias líneas en su recuadro", { textAlign: "left" }),
        forma(0, { x: 530, y: 40, width: 440, height: 420 }, { fill: "#f4f1ec" }),
        texto(0, { x: 530, y: 40, width: 440, height: 420 }, "Texto centrado que también ocupa varias líneas en su recuadro"),
        forma(0, { x: 1020, y: 40, width: 440, height: 420 }, { fill: "#f4f1ec" }),
        texto(0, { x: 1020, y: 40, width: 440, height: 420 }, "Texto a la derecha con varias líneas en su recuadro", { textAlign: "right" }),
        texto(0, { x: 40, y: 560, width: 1420, height: 100 }, "mayúsculas desde minúsculas", { textTransform: "uppercase", fontSize: 60, fontWeight: 700 }),
        texto(0, { x: 40, y: 720, width: 1420, height: 220 }, "Primera línea\nSegunda línea con salto manual", { fontSize: 56, lineHeight: 1.4, fontItalic: true }),
      ],
    },
    {
      id: "listado-del-curso",
      titulo: "Listado del curso derecho y girado",
      canvas: CHICO,
      paginas: 2,
      valores: { "course.studentList": listaDelCurso() },
      blocks: [
        bloque("VARIABLE_TEXT", 0, { x: 100, y: 100, width: 1300, height: 800 }, {
          variableKey: "course.studentList", fontFamily: "Helvetica", fontSize: 44, color: "#1d3a6b", columns: 2, textAlign: "LEFT",
        }),
        bloque("VARIABLE_TEXT", 1, { x: 300, y: 150, width: 900, height: 700, rotation: 90 }, {
          variableKey: "course.studentList", fontFamily: "Helvetica", fontSize: 40, color: "#1d3a6b", columns: 2, textAlign: "LEFT",
        }),
      ],
    },
    {
      id: "formas-e-imagenes",
      titulo: "Formas, bordes, transparencia e imágenes",
      canvas: CHICO,
      paginas: 1,
      blocks: [
        forma(0, { x: 60, y: 60, width: 400, height: 260 }, { fill: "#c2185b" }),
        forma(0, { x: 540, y: 60, width: 400, height: 260 }, { fill: "#ffffff", stroke: "#1d3a6b", strokeWidth: 12 }),
        forma(0, { x: 1020, y: 60, width: 400, height: 260 }, { fill: "#2e7d32", radius: 60 }),
        forma(0, { x: 60, y: 400, width: 300, height: 300 }, { variant: "circle", fill: "#f9a825" }),
        forma(0, { x: 440, y: 420, width: 400, height: 220, rotation: 20 }, { fill: "#1565c0", opacity: 0.6 }),
        imagen(0, { x: 920, y: 380, width: 500, height: 330 }, imagenDePrueba),
        imagen(0, { x: 120, y: 760, width: 420, height: 200, rotation: -8 }, imagenDePrueba),
        imagen(0, { x: 700, y: 760, width: 220, height: 220 }, imagenDePrueba, { maskShape: "circle" }),
      ],
    },
    {
      /*
       * El logo de la escuela va con "contain": entra entero en su recuadro. El PDF ya lo hacía;
       * la pantalla lo recortaba como una foto. Es la imagen tal como la deja `render.ts` después
       * de resolver `branding.schoolLogoUrl` (fija, con el encaje del bloque).
       */
      id: "logo-contain",
      titulo: "Logo de la escuela entero en recuadros alto, ancho y cuadrado",
      canvas: CHICO,
      paginas: 1,
      blocks: [
        forma(0, { x: 60, y: 60, width: 300, height: 600 }, { fill: "#f4f1ec" }),
        imagen(0, { x: 60, y: 60, width: 300, height: 600 }, imagenDePrueba, { fit: "contain" }),
        forma(0, { x: 460, y: 60, width: 980, height: 260 }, { fill: "#f4f1ec" }),
        imagen(0, { x: 460, y: 60, width: 980, height: 260 }, imagenDePrueba, { fit: "contain" }),
        forma(0, { x: 460, y: 420, width: 500, height: 500 }, { fill: "#f4f1ec" }),
        imagen(0, { x: 460, y: 420, width: 500, height: 500 }, imagenDePrueba, { fit: "contain" }),
        imagen(0, { x: 1060, y: 420, width: 380, height: 500 }, imagenDePrueba, { fit: "cover" }),
      ],
    },
    {
      /*
       * Alineación vertical: arriba (lo de siempre), centro y abajo, con varias líneas e
       * interlineado amplio, y textos girados, que se alinean en el marco de su caja.
       */
      id: "alineacion-vertical",
      titulo: "Texto arriba, centrado y abajo en su caja, derecho y girado",
      canvas: CHICO,
      paginas: 1,
      blocks: [
        forma(0, { x: 40, y: 40, width: 400, height: 380 }, { fill: "#f4f1ec" }),
        texto(0, { x: 40, y: 40, width: 400, height: 380 }, "Arriba", { verticalAlign: "TOP" }),
        forma(0, { x: 480, y: 40, width: 400, height: 380 }, { fill: "#f4f1ec" }),
        texto(0, { x: 480, y: 40, width: 400, height: 380 }, "Centro con interlineado amplio", { verticalAlign: "MIDDLE", lineHeight: 1.6, textAlign: "LEFT" }),
        forma(0, { x: 920, y: 40, width: 400, height: 380 }, { fill: "#f4f1ec" }),
        texto(0, { x: 920, y: 40, width: 400, height: 380 }, "Abajo\ncon salto manual", { verticalAlign: "BOTTOM", textAlign: "RIGHT" }),
        forma(0, { x: 60, y: 610, width: 540, height: 200, rotation: 90 }, { fill: "#e6eef8" }),
        texto(0, { x: 60, y: 610, width: 540, height: 200, rotation: 90 }, "Girado 90° y centrado", { verticalAlign: "MIDDLE" }),
        forma(0, { x: 520, y: 610, width: 540, height: 200, rotation: -90 }, { fill: "#e6eef8" }),
        texto(0, { x: 520, y: 610, width: 540, height: 200, rotation: -90 }, "Menos noventa, abajo", { verticalAlign: "BOTTOM" }),
        forma(0, { x: 980, y: 640, width: 480, height: 220, rotation: 180 }, { fill: "#e6eef8" }),
        texto(0, { x: 980, y: 640, width: 480, height: 220, rotation: 180 }, "Cabeza abajo, abajo", { verticalAlign: "BOTTOM", fontWeight: 700 }),
      ],
    },
    {
      /*
       * El listado de 7.º A de San Patricio, girado 90,68°, centrado en el alto de su recuadro (lo
       * que pidió Daniel). En la segunda página, un listado derecho alineado abajo.
       */
      id: "listado-centrado-vertical",
      titulo: "Listado de 7.º A de San Patricio centrado en su recuadro girado",
      canvas: { width: 3602, height: 2421, dpi: 300, background: "#ffffff" } as TemplateV2Canvas,
      paginas: 2,
      valores: { "course.studentList": septimoA() },
      blocks: [
        forma(0, { x: -153.4737183511329, y: 590.8512944622227, width: 1969.923309783439, height: 1239.297411075555, rotation: 90.68413159032582 }, { fill: "#f4f1ec" }),
        listadoSanPatricio(0, "MIDDLE"),
        forma(1, { x: 200, y: 200, width: 3200, height: 2000 }, { fill: "#f4f1ec" }),
        bloque("VARIABLE_TEXT", 1, { x: 200, y: 200, width: 3200, height: 2000 }, {
          variableKey: "course.studentList", fontFamily: "Helvetica", fontSize: 67, lineHeight: 1.3, color: "#1d3a6b",
          classList: { columns: 3 }, textAlign: "LEFT", verticalAlign: "BOTTOM",
        }),
      ],
    },
    {
      /*
       * Un listado con dos cursos: cada uno con su título más grande, derecho y girado 90° (como
       * la carpeta de San Patricio), y un listado viejo de un curso que toma el título del curso.
       */
      id: "listado-dos-cursos",
      titulo: "Listado con dos cursos y sus títulos, derecho y girado",
      canvas: CHICO,
      paginas: 3,
      valores: { "course.studentList": dosCursos() },
      blocks: [
        bloque("VARIABLE_TEXT", 0, { x: 100, y: 100, width: 1300, height: 800 }, {
          variableKey: "course.studentList", fontFamily: "Helvetica", fontSize: 44, color: "#1d3a6b", columns: 2, textAlign: "LEFT",
          classList: { columns: 2, allowExtraCourses: true },
        }),
        bloque("VARIABLE_TEXT", 1, { x: 300, y: 150, width: 900, height: 700, rotation: 90 }, {
          variableKey: "course.studentList", fontFamily: "Helvetica", fontSize: 40, color: "#1d3a6b", textAlign: "CENTER",
          classList: { columns: 2, headingScale: 1.5 }, verticalAlign: "MIDDLE",
        }),
        bloque("VARIABLE_TEXT", 2, { x: 100, y: 100, width: 1300, height: 800 }, {
          variableKey: "course.studentList", fontFamily: "Helvetica", fontSize: 44, color: "#1d3a6b", textAlign: "LEFT",
          classList: { columns: 3, showHeading: false },
        }),
      ],
    },
    {
      /*
       * Dos cursos con turno y el colegio arriba: los nombres van en 4 columnas (aunque el bloque
       * diga 2), el colegio una sola vez arriba de todo y cada título con su turno. Derecho y
       * girado 90°.
       */
      id: "listado-colegio-y-turno",
      titulo: "Listado de dos cursos con el colegio arriba y el turno, en 4 columnas",
      canvas: CHICO,
      paginas: 2,
      valores: { "course.studentList": dosCursosConTurno(), "school.name": "Escuela Manuel Belgrano" },
      /*
       * El título de dos cursos («3.° B · Turno mañana y 3.° C · Turno tarde») es una línea larga en
       * negrita: el navegador y el PDF espacian las letras apenas distinto y al final de la línea
       * suman unos 8 px. Se ve igual (mismo texto, mismo lugar); por eso la peor zona tolera más.
       */
      umbrales: { maximoPeorZona: 0.45 },
      blocks: [
        bloque("VARIABLE_TEXT", 0, { x: 100, y: 100, width: 1300, height: 800 }, {
          variableKey: "course.studentList", fontFamily: "Helvetica", fontSize: 40, color: "#1d3a6b", textAlign: "LEFT",
          classList: { columns: 2, showSchoolName: true },
        }),
        bloque("VARIABLE_TEXT", 1, { x: 300, y: 100, width: 900, height: 800, rotation: 90 }, {
          variableKey: "course.studentList", fontFamily: "Helvetica", fontSize: 36, color: "#1d3a6b", textAlign: "CENTER",
          classList: { columns: 1, showSchoolName: true, headingScale: 1.2 }, verticalAlign: "MIDDLE",
        }),
      ],
    },
    {
      id: "san-patricio",
      titulo: "Copia de la carpeta de San Patricio (3602×2421 a 300 dpi)",
      canvas: { width: 3602, height: 2421, dpi: 300, background: "#ffffff" } as TemplateV2Canvas,
      paginas: 2,
      valores: { "course.studentList": listaDelCurso() },
      blocks: [
        texto(0, { x: 1500, y: 1150, width: 900, height: 120, rotation: 90.49 }, "5.º A", { fontFamily: "Helvetica", fontSize: 90 }),
        bloque("VARIABLE_TEXT", 0, { x: -153, y: 591, width: 1970, height: 1239, rotation: 90.68 }, {
          variableKey: "course.studentList", fontFamily: "Helvetica", fontSize: 67, color: "#1d3a6b", columns: 2, textAlign: "LEFT",
        }),
        texto(1, { x: 2300, y: 250, width: 1000, height: 150 }, "Benjamín", { fontFamily: "Great Vibes", fontSize: 110 }),
        imagen(1, { x: 2450, y: 500, width: 700, height: 900 }, imagenDePrueba),
        imagen(1, { x: 300, y: 500, width: 1400, height: 1000, rotation: -89.67 }, imagenDePrueba),
        texto(1, { x: 2418, y: 1165, width: 2082, height: 91, rotation: -89.65 }, "5.º A - Colegio San Patricio", { fontFamily: "Helvetica", fontSize: 70 }),
      ],
    },
  ];
}
