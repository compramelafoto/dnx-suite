import { slugify } from "@/lib/slug";

/**
 * La dirección pública de un portfolio: `/w/{institución}/socios/juan-perez`.
 *
 * Se calcula UNA sola vez, al crear el portfolio, y no vuelve a cambiar aunque la persona
 * cambie de apellido: una dirección publicada que deja de funcionar es un enlace roto en el
 * sitio de otro.
 *
 * No se usa el número de socio. Expone el padrón y no le dice nada a quien llega.
 */
export function derivePortfolioSlug(params: {
  firstName: string;
  lastName: string;
  taken: ReadonlySet<string>;
}): string {
  // "socio" como red de contención: un nombre escrito sólo con símbolos no deja ninguna letra
  // usable, y un portfolio sin dirección no se puede abrir.
  const base = slugify(`${params.firstName} ${params.lastName}`) || "socio";
  if (!params.taken.has(base)) return base;

  // Arranca en 2: el primero no lleva sufijo, así que el segundo homónimo es el 2.
  let n = 2;
  while (params.taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
