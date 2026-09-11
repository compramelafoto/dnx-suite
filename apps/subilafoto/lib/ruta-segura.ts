/**
 * Sólo deja pasar rutas internas de la aplicación.
 *
 * Sin esto, cualquiera puede armar un enlace
 * `subilafoto.com/login?next=https://sitio-falso.com` y, después de que la persona entre
 * con su cuenta real, mandarla a una copia del sitio que le pide la contraseña otra vez.
 * El ataque funciona justamente porque el primer paso es legítimo.
 *
 * Mismo criterio que `safeFotofficeNextPath` en Fotoffice.
 */
export function rutaInternaSegura(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;

  const valor = raw.trim();
  if (!valor.startsWith("/")) return undefined;
  // "//sitio.com" es un enlace absoluto sin esquema: el navegador lo lee como dominio.
  if (valor.startsWith("//")) return undefined;
  if (valor.includes("://")) return undefined;
  // Algunos navegadores convierten "\" en "/", así que "/\sitio.com" termina saliendo.
  if (valor.includes("\\")) return undefined;

  return valor.slice(0, 512);
}
