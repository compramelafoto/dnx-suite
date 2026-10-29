/** Tipos de la carpeta de un trabajo que comparten el servidor y las pantallas. Módulo PURO. */
import type { Audiencia } from "./reglas";

export type ArchivoVista = { id: string; nombre: string; tipo: string; bytes: number; createdAt: string };

export type VistaCarpeta = {
  audiencia: Audiencia;
  estudio: string;
  trabajo: string;
  cliente: string;
  vence: string | null;
  /** El número de pedido que cargó el laboratorio (sólo en su enlace). */
  numeroLaboratorio: string | null;
  archivos: (ArchivoVista & { descargar: string; ver: string | null })[];
};
