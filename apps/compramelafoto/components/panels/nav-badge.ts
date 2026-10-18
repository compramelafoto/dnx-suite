/** Cartel junto a un ítem del menú. "NEW" va llamativo para que se note la novedad; el resto, azul discreto. */
export function navBadgeClass(badge: string): string {
  if (badge.trim().toUpperCase() === "NEW") {
    return "shrink-0 rounded-full bg-gradient-to-r from-[#ff3d6e] to-[#ff8a00] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-[0_0_0_2px_rgba(255,61,110,0.25)] motion-safe:animate-pulse";
  }
  return "shrink-0 rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white";
}
