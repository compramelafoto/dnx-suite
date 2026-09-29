/**
 * Lo que viaja del servidor a los componentes de la ficha. Sólo datos simples (fechas como
 * texto ISO) y nunca la clave de un adjunto en el almacenamiento.
 */

/** La ficha que se está mirando: la misma forma que reciben las acciones de `app/actions/ficha`. */
export type PersonaFicha = { tipo: "CLIENTE" | "SOCIO"; id: string };

export type CategoriaVista = { id: string; name: string };

export type NotaVista = {
  id: string;
  body: string;
  categoryId: string | null;
  categoria: string;
  autor: string | null;
  fecha: string;
  editada: boolean;
  pinned: boolean;
  /** Autor o quien puede configurar. El servidor lo vuelve a decidir en cada acción. */
  puedeModificar: boolean;
};

export type EtiquetaVista = { id: string; name: string; color: string };

export type AdjuntoVista = {
  id: string;
  nombre: string;
  tipo: string;
  tamano: number;
  estado: "LISTO" | "BORRADO";
  subidoPor: string;
  fecha: string;
  /** Sólo en los borrados: hasta cuándo se puede restaurar. */
  restaurableHasta: string | null;
};

export type RelacionVista = {
  id: string;
  otra: { tipo: "CLIENTE" | "SOCIO"; id: string; nombre: string; href: string };
  /** Cómo se lee la otra persona desde esta ficha ("Madre o padre"). */
  etiqueta: string;
  nota: string | null;
};

/** Resultado de las acciones de la ficha. */
export type Resultado = { ok: true } | { ok: false; error: string };
