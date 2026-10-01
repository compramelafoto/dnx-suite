/**
 * Los datos del comprador, revisados antes de crear nada.
 *
 * Se valida acá y no en el navegador: el formulario puede saltearse. Y se valida **antes**
 * de crear la orden, para no dejar órdenes pendientes de nadie cada vez que alguien se
 * equivoca al escribir su correo.
 */

export type DatosDelComprador = {
  nombre: string;
  email: string;
  telefono: string | null;
};

export type Revision =
  | { ok: true; datos: DatosDelComprador }
  | { ok: false; error: string };

/**
 * Formato de correo, no existencia.
 *
 * Verificar que exista es imposible sin mandarle algo, y rechazar direcciones raras pero
 * válidas es peor que aceptar una equivocada: el comprador se queda sin poder pagar.
 */
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function revisarComprador(entrada: {
  nombre?: unknown;
  email?: unknown;
  telefono?: unknown;
}): Revision {
  const nombre = typeof entrada.nombre === "string" ? entrada.nombre.trim() : "";
  const email = typeof entrada.email === "string" ? entrada.email.trim().toLowerCase() : "";
  const telefonoCrudo = typeof entrada.telefono === "string" ? entrada.telefono.trim() : "";

  if (nombre.length < 2) {
    return { ok: false, error: "Escribí tu nombre para que sepamos de quién es el evento." };
  }
  if (nombre.length > 120) {
    return { ok: false, error: "Ese nombre es demasiado largo." };
  }
  if (!CORREO.test(email) || email.length > 200) {
    return { ok: false, error: "Revisá el correo: ahí te mandamos el acceso al evento." };
  }

  return {
    ok: true,
    datos: { nombre, email, telefono: telefonoCrudo ? telefonoCrudo.slice(0, 40) : null },
  };
}
