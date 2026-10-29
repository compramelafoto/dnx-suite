/**
 * Datos fijos de la demo escolar. Todo inventado: escuela, alumnos, familias y correos `.test`.
 * Los nombres coinciden con `docs/compramelafoto/demo-escolar/PROMPTS-FOTOS.md`, para que las
 * fotos generadas con IA se puedan subir por nombre de archivo.
 */

import { DEMO_EMAIL_DOMAIN } from "@/lib/demos/identidad";

export type CursoDemo = {
  /** Prefijo de los archivos de fotos (`S5-01.jpg`, `6A-GRUPO.jpg`). */
  codigo: "S5" | "6A";
  nombre: string;
  division: string;
  alumnos: Array<{ nombre: string; apellido: string }>;
};

const alumnos = (lista: string[]) =>
  lista.map((completo) => {
    const partes = completo.split(" ");
    const apellido = partes.pop() as string;
    return { nombre: partes.join(" "), apellido };
  });

export const DEMO_ESCOLAR = {
  fotografo: {
    email: `fotografo@${DEMO_EMAIL_DOMAIN}`,
    nombre: "DNX Estudio",
    handler: "estudiodemo",
    telefono: "+54 9 341 000-0000",
    ciudad: "Rosario",
    provincia: "Santa Fe",
  },
  colegioUsuario: {
    email: `colegio@${DEMO_EMAIL_DOMAIN}`,
    nombre: "Dirección · Escuela Demo Los Aromos",
  },
  escuela: {
    nombre: "Escuela Demo Los Aromos",
    slug: "escuela-demo-los-aromos",
    ciudad: "Rosario",
    provincia: "Santa Fe",
    direccion: "Av. de los Aromos 1234",
    email: `direccion@${DEMO_EMAIL_DOMAIN}`,
    telefono: "+54 9 341 000-0001",
  },
  /**
   * Logos (en R2): el colegio es inventado; el estudio es DNX Estudio. Los archivos están en
   * docs/compramelafoto/demo-escolar/logos/ y se
   * suben con `scripts/demos/escolar/subir-logos.ts`.
   */
  logos: {
    colegio: "demos/escolar/logo-colegio.png",
    estudio: "demos/escolar/logo-dnx-estudio.png",
  },
  album: {
    titulo: "Escuela Demo Los Aromos · Fotos 2026",
    slug: "demo-escolar-los-aromos",
    comisionColegioPorcentaje: 10,
  },
  /** Fotos del librito: la plantilla de mosaico tiene tres huecos (grupal, con la maestra, individual). */
  fotosDelLibrito: 3,
  /** Plantilla de sistema que se copia al fotógrafo demo y se liga al pack con librito. */
  plantillaSistemaBase: "sys_librito_mosaico_primaria_fin_de_ano",
  packs: [
    {
      clave: "librito",
      nombre: "Librito de fin de año + 5 fotos digitales",
      descripcion: "Librito impreso de 30×20 cm con la foto individual, la del grado y la de la maestra, y el mosaico de todo el curso. Más 5 fotos digitales a elección.",
      precioPesos: 38000,
      precioListaPesos: 45000,
      digitales: 5,
      conLibrito: true,
    },
    {
      clave: "digitales",
      nombre: "10 fotos digitales",
      descripcion: "Elegís 10 fotos de tu hijo o hija y las descargás en alta calidad.",
      precioPesos: 18000,
      precioListaPesos: 22000,
      digitales: 10,
      conLibrito: false,
    },
  ],
  cursos: [
    {
      codigo: "S5",
      nombre: "Sala de 5",
      division: "Naranja",
      alumnos: alumnos([
        "Abril Benítez", "Bautista Romero", "Catalina Sosa", "Dante Acosta", "Emma Herrera",
        "Felipe Medina", "Guadalupe Ríos", "Ignacio Torres", "Isabella Díaz", "Joaquín Castro",
        "Lola Vega", "Mateo Suárez", "Mía Fernández", "Nicolás Giménez", "Olivia Molina",
        "Santino Rojas", "Sofía Ortiz", "Thiago Luna", "Valentina Ruiz", "Benjamín Paz",
      ]),
    },
    {
      codigo: "6A",
      nombre: "6º grado",
      division: "A",
      alumnos: alumnos([
        "Agustina Álvarez", "Bruno Gómez", "Camila Pereyra", "Diego Navarro", "Elena Cabrera",
        "Franco Aguirre", "Julieta Morales", "Lautaro Ramos", "Martina Quiroga", "Lucas Domínguez",
        "Renata Villalba", "Tomás Ledesma", "Victoria Ibáñez", "Facundo Godoy", "Zoe Figueroa",
        "Juan Cruz Ojeda", "Paloma Correa", "Gael Sánchez", "Milagros Peralta", "Santiago Maldonado",
      ]),
    },
  ] satisfies CursoDemo[],
  /** El profesor de 6º A es Daniel: su foto real es la que encuentra la selfie. */
  profesor: { nombre: "Daniel", apellido: "Cuart", archivo: "6A-PROFE.jpg", rutaPublica: "public/demos/escolar/profe.jpg" },
} as const;

/** Nombre de archivo de la foto individual de un alumno: `6A-07.jpg`. */
export function archivoDeAlumno(codigo: string, indice: number): string {
  return `${codigo}-${String(indice + 1).padStart(2, "0")}.jpg`;
}
