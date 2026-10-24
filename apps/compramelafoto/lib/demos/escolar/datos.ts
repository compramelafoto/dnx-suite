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
    nombre: "Estudio Demo Escolar",
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
  album: {
    titulo: "Escuela Demo Los Aromos · Fotos 2026",
    slug: "demo-escolar-los-aromos",
    comisionColegioPorcentaje: 10,
  },
  /** Plantilla de sistema que se copia al fotógrafo demo y se liga al pack con librito. */
  plantillaSistemaBase: "sys_librito_primaria_fin_de_ano_confeti",
  packs: [
    {
      clave: "librito",
      nombre: "Librito de fin de año + todas las digitales",
      descripcion: "Librito impreso de 30×20 cm con las fotos que elijas y todas tus fotos digitales.",
      precioPesos: 38000,
      precioListaPesos: 45000,
      fotosElegibles: 12,
      conLibrito: true,
    },
    {
      clave: "digitales",
      nombre: "Todas las fotos digitales",
      descripcion: "Todas las fotos en las que aparece tu hijo o hija, en alta calidad.",
      precioPesos: 18000,
      precioListaPesos: 22000,
      fotosElegibles: 0,
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
