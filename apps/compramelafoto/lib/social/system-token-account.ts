/**
 * Elegir la cuenta de Instagram a partir de lo que devuelve Meta para un token de usuario
 * del sistema (`GET /me/accounts?fields=name,instagram_business_account{id,username}`).
 *
 * Puro, para testear sin red. La conexión real está en `connect-account.ts`.
 */

export type PaginaConInstagram = {
  id?: string;
  name?: string;
  instagram_business_account?: { id?: string; username?: string } | null;
};

export type CuentaInstagram = { igUserId: string; username: string | null; pageName: string | null };

/**
 * Devuelve la cuenta de Instagram a usar. Si hay varias, prefiere la de `preferida`
 * (sin @, sin importar mayúsculas); si no está, la primera. `null` si ninguna página
 * del token tiene una cuenta de Instagram vinculada.
 */
export function elegirCuentaInstagram(paginas: PaginaConInstagram[], preferida = "compramelafoto"): CuentaInstagram | null {
  const cuentas = paginas
    .filter((p) => p.instagram_business_account?.id)
    .map((p) => ({
      igUserId: p.instagram_business_account!.id!,
      username: p.instagram_business_account!.username ?? null,
      pageName: p.name ?? null,
    }));
  if (cuentas.length === 0) return null;
  return cuentas.find((c) => c.username?.toLowerCase() === preferida.toLowerCase()) ?? cuentas[0]!;
}

/** Marca en `DnxSocialAccount.scopes` de las cuentas conectadas con token del sistema. */
export const SYSTEM_USER_SCOPE = "SYSTEM_USER_TOKEN";
