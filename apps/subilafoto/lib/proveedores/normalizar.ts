/**
 * Cómo se comparan dos fichas de proveedor.
 *
 * Todo el módulo existe por un motivo: "Salón Luna S.R.L." y "salon luna" son la misma
 * empresa, y la base de proveedores no sirve para nada si tiene tres veces al mismo salón.
 *
 * Puro y probado aparte, porque acá el error es silencioso: una normalización de más
 * fusiona dos empresas distintas, una de menos deja el duplicado que se quería evitar.
 */

/** Formas societarias que no distinguen una empresa de otra. */
const FORMAS_SOCIETARIAS = new Set(["sa", "srl", "sas", "sh", "scs", "sca", "saic", "sac"]);

const sinAcentos = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Los once dígitos del CUIT, o `null` si no los tiene. */
export function cuitNormalizado(valor: string | null | undefined): string | null {
  const digitos = (valor ?? "").replace(/\D/g, "");
  return digitos.length === 11 ? digitos : null;
}

/** El correo en minúscula, o `null` si no parece un correo. */
export function correoNormalizado(valor: string | null | undefined): string | null {
  const limpio = (valor ?? "").trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio) ? limpio : null;
}

/** El usuario de Instagram, venga como `@nombre`, como dirección o pelado. */
export function usuarioDeInstagram(valor: string | null | undefined): string | null {
  let texto = (valor ?? "").trim().toLowerCase();
  if (!texto) return null;

  texto = texto.replace(/^https?:\/\//, "").replace(/^www\./, "");
  if (texto.startsWith("instagram.com/")) texto = texto.slice("instagram.com/".length);

  // Se corta en lo primero que deje de ser el usuario: la barra final o los parámetros.
  const usuario = texto.replace(/^@/, "").split(/[/?#]/)[0]?.trim() ?? "";
  return usuario.length > 0 ? usuario : null;
}

/** El dominio del sitio, sin `www` ni ruta. */
export function dominioDeSitio(valor: string | null | undefined): string | null {
  let texto = (valor ?? "").trim().toLowerCase();
  if (!texto) return null;

  texto = texto.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const dominio = texto.split(/[/?#]/)[0]?.trim() ?? "";
  // Sin punto no es un dominio: es alguien que escribió cualquier cosa en el campo.
  return dominio.includes(".") ? dominio : null;
}

/**
 * El nombre comparable: sin acentos, sin puntuación, sin forma societaria.
 *
 * La forma societaria se saca palabra por palabra y sólo si la palabra entera es una de
 * ellas. Buscarla como texto suelto convertiría "Sabores" en "bores".
 */
export function nombreNormalizado(valor: string | null | undefined): string | null {
  const palabras = sinAcentos((valor ?? "").toLowerCase())
    // Primero se pegan las siglas: "s.r.l." tiene que llegar a la comparación como "srl".
    // Si el punto se cambiara por espacio antes, quedarían tres palabras de una letra.
    // Sólo se saca el punto que sigue a una letra sola, para no pegar "Casa.Luna".
    .replace(/\b([a-z])\./g, "$1")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((p) => p.length > 0 && !FORMAS_SOCIETARIAS.has(p));

  return palabras.length > 0 ? palabras.join(" ") : null;
}
