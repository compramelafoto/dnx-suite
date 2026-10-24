/**
 * Identidad de las demos grabables (charlas y videos): quién administra las demos, qué usuarios
 * son de demo y qué correos nunca tienen que salir.
 *
 * Las demos viven en producción con datos falsos. Lo que separa una demo de lo real es:
 * - la etiqueta `DEMO_PRESENTACION` en `User.tags` de los usuarios de la demo;
 * - el dominio `.test` en sus correos (no existe en internet, así que nunca se entrega);
 * - `isTest` en sus álbumes y pedidos.
 */

export const DEMO_TAG = "DEMO_PRESENTACION";
export const DEMO_EMAIL_DOMAIN = "demo.compramelafoto.test";
/** Daniel (cuart.daniel@gmail.com): el único que prepara, reinicia y entra a las demos. */
export const DEMO_ADMIN_USER_ID = 1;

export function esUsuarioDemo(u: { tags?: string[] | null } | null | undefined): boolean {
  return Boolean(u?.tags?.includes(DEMO_TAG));
}

/** Cualquier dominio `.test` (reservado, RFC 2606): un correo así nunca se manda. */
export function esCorreoDePrueba(email: string): boolean {
  const at = email.trim().toLowerCase().lastIndexOf("@");
  if (at < 0) return false;
  const dominio = email.trim().toLowerCase().slice(at + 1).replace(/>$/, "");
  return dominio === "test" || dominio.endsWith(".test");
}

export function puedeAdministrarDemos(u: { id: number; role: string } | null | undefined): boolean {
  return Boolean(u && u.id === DEMO_ADMIN_USER_ID && String(u.role) === "ADMIN");
}

export function filtrarDestinatariosDePrueba(to: string | string[]): {
  enviar: string[];
  descartados: string[];
} {
  const lista = (Array.isArray(to) ? to : [to]).filter((d) => typeof d === "string" && d.trim());
  const enviar: string[] = [];
  const descartados: string[] = [];
  for (const d of lista) {
    (esCorreoDePrueba(d) ? descartados : enviar).push(d);
  }
  return { enviar, descartados };
}
