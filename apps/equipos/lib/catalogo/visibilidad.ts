import { CUENTA_SIN_BLOQUEO } from "@/lib/usuarios/bloqueo";

/**
 * Filtros de Prisma sobre `User` que comparten el catálogo, los favoritos y «Busco». Viven en un
 * módulo aparte (sin dependencias del catálogo) para no armar ciclos de imports: se usan como
 * constantes al cargar los módulos.
 */

/** Identidad aprobada HOY: si se la revocan, deja de contar. */
export const VENDEDOR_VERIFICADO = { identityVerification: { is: { status: "APPROVED" } } } as const;

/**
 * Lo que el catálogo muestra: vendedor con la identidad aprobada HOY y sin la cuenta bloqueada
 * (si lo bloquean, sus publicaciones no salen, y vuelven solas si se levanta el bloqueo).
 */
export const VENDEDOR_VISIBLE = { ...VENDEDOR_VERIFICADO, ...CUENTA_SIN_BLOQUEO } as const;
