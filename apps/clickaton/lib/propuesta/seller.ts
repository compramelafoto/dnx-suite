import type { SellerScope } from "@repo/partners";

/**
 * Quién vende desde esta pantalla.
 *
 * Clickatón es el equipo de DNX vendiendo la red completa, así que ofrece el
 * inventario de dueño `PLATFORM`. Cuando la herramienta la usen organizadores o
 * workspaces, esto sale de la sesión en vez de estar fijo acá.
 */
export const PROPOSAL_SELLER: SellerScope = { owner: "PLATFORM" };
