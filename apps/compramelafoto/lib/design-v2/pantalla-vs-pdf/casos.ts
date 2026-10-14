/**
 * Diseños de prueba para comparar la pantalla con el PDF.
 *
 * Cada caso ejercita algo que ya se rompió o que es fácil de romper: textos girados (la carpeta de
 * San Patricio salió con los textos fuera de la hoja), tipografías (el PDF las cambiaba por DM
 * Sans), alineaciones y saltos de línea, el listado del curso, formas e imágenes. Los bloques
 * están en el formato que guarda el editor, el mismo que dibuja el lienzo.
 */
import type { TemplateV2Block, TemplateV2Canvas } from "@repo/template-editor-core";

export type CasoDeComparacion = {
  id: string;
  titulo: string;
  canvas: TemplateV2Canvas;
  paginas: number;
  blocks: TemplateV2Block[];
  /** Valores de las variables (el listado del curso, por ejemplo). */
  valores?: Record<string, string>;
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
