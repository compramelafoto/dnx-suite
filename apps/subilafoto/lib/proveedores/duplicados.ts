/**
 * Si el proveedor que se está cargando ya está en la base.
 *
 * El criterio del backlog es una frase: *un salón ya existente se vincula sin crear un
 * duplicado*. Una base de proveedores con el mismo salón tres veces no sirve para nada, y
 * limpiarla después cuesta mucho más que no ensuciarla.
 *
 * La decisión se parte en dos: buscar coincidencias (esto) y decidir qué hacer con ellas
 * (`elegirVinculo`). Puro las dos, porque el error es caro en los dos sentidos: fusionar
 * dos empresas distintas es peor que dejar un duplicado, y dejar duplicados es el problema
 * que se está resolviendo.
 */

import {
  correoNormalizado,
  cuitNormalizado,
  dominioDeSitio,
  nombreNormalizado,
  usuarioDeInstagram,
} from "./normalizar";

export type Ficha = {
  nombre: string;
  cuit?: string | null;
  email?: string | null;
  instagram?: string | null;
  sitioWeb?: string | null;
};

export type Existente = Ficha & { id: string };

/** Por qué se cree que son la misma empresa, de lo más fuerte a lo más débil. */
export type Motivo = "cuit" | "email" | "instagram" | "sitio" | "nombre";

export type Coincidencia = {
  id: string;
  motivo: Motivo;
  /** Si alcanza para vincular sin que lo mire una persona. */
  seguro: boolean;
};

/**
 * Los identificadores, del más fuerte al más débil.
 *
 * El CUIT identifica a la empresa ante la AFIP: no hay dos. El correo, el usuario de
 * Instagram y el dominio son de uno solo por definición. El nombre no: "Catering Norte"
 * puede haber dos en dos provincias distintas, así que es una sospecha y no una certeza.
 */
const CLAVES: { motivo: Motivo; seguro: boolean; leer: (f: Ficha) => string | null }[] = [
  { motivo: "cuit", seguro: true, leer: (f) => cuitNormalizado(f.cuit) },
  { motivo: "email", seguro: true, leer: (f) => correoNormalizado(f.email) },
  { motivo: "instagram", seguro: true, leer: (f) => usuarioDeInstagram(f.instagram) },
  { motivo: "sitio", seguro: true, leer: (f) => dominioDeSitio(f.sitioWeb) },
  { motivo: "nombre", seguro: false, leer: (f) => nombreNormalizado(f.nombre) },
];

/**
 * Qué empresas de la base podrían ser esta misma, ordenadas de más segura a menos.
 *
 * De cada empresa se devuelve **un solo motivo**, el más fuerte. Si coinciden el CUIT y el
 * nombre, lo que importa es el CUIT: el nombre no agrega nada y ensucia la explicación que
 * después lee una persona.
 */
export function buscarDuplicados(
  candidato: Ficha,
  existentes: readonly Existente[],
): Coincidencia[] {
  const coincidencias: Coincidencia[] = [];

  for (const existente of existentes) {
    for (const clave of CLAVES) {
      const mio = clave.leer(candidato);
      const suyo = clave.leer(existente);
      // Dos campos vacíos no son una coincidencia: sin esto, todas las fichas incompletas
      // de la base serían la misma empresa.
      if (!mio || !suyo || mio !== suyo) continue;
      coincidencias.push({ id: existente.id, motivo: clave.motivo, seguro: clave.seguro });
      break;
    }
  }

  const peso = (m: Motivo) => CLAVES.findIndex((c) => c.motivo === m);
  return coincidencias.sort((a, b) => peso(a.motivo) - peso(b.motivo));
}

export type Vinculo =
  | { accion: "crear"; posiblesDuplicados?: string[] }
  | { accion: "vincular"; partnerId: string; motivo: Motivo; posiblesDuplicados?: string[] };

/**
 * Qué hacer con las coincidencias encontradas.
 *
 * Con una segura se vincula sola: es el caso del salón que ya está en la base. Con sólo
 * sospechas se crea igual y se deja anotado a quién se parece — negarle el alta a alguien
 * porque su nombre se parece a otro es peor que un duplicado que un administrador fusiona
 * después.
 *
 * Si hay más de una segura, algo está mal en la base (dos fichas de la misma empresa). Se
 * vincula a la más fuerte y las otras quedan anotadas para que alguien las mire.
 */
export function elegirVinculo(coincidencias: readonly Coincidencia[]): Vinculo {
  const seguras = coincidencias.filter((c) => c.seguro);
  const resto = coincidencias.filter((c) => c !== seguras[0]).map((c) => c.id);

  if (seguras.length === 0) {
    return coincidencias.length === 0 ? { accion: "crear" } : { accion: "crear", posiblesDuplicados: resto };
  }

  const elegida = seguras[0]!;
  return resto.length > 0
    ? { accion: "vincular", partnerId: elegida.id, motivo: elegida.motivo, posiblesDuplicados: resto }
    : { accion: "vincular", partnerId: elegida.id, motivo: elegida.motivo };
}
