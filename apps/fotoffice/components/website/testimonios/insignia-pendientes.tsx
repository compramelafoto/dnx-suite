/** Número de testimonios que esperan moderación (no se dibuja con 0). */
export function InsigniaPendientes({ cantidad }: { cantidad: number }) {
  if (cantidad <= 0) return null;
  const texto = cantidad > 99 ? "99+" : String(cantidad);
  return (
    <span
      className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[var(--fo-accent)] px-1.5 text-[0.65rem] font-semibold leading-5 text-white tabular-nums"
      aria-label={`${cantidad} ${cantidad === 1 ? "pendiente" : "pendientes"} de revisar`}
    >
      {texto}
    </span>
  );
}
