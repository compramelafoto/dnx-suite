/** Logo Mercado Pago (celeste #009EE3) — solo UI, sin tokens. */
export function MercadoPagoConnectedIcon({
  className = "h-4 w-4 shrink-0",
  title = "Mercado Pago conectado",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <span
      className="inline-flex items-center"
      title={title}
      aria-label={title}
    >
      <svg
        className={className}
        viewBox="0 0 24 24"
        aria-hidden
        fill="#009EE3"
        role="img"
      >
        <path d="M15.972 2.188h2.769v6.462h.01l4.154-6.462h2.923l-5.385 7.77 5.77 8.308h-3.077l-4.308-6.462-1.385 2.077v4.385h-2.77V2.188zm-5.77 0h2.77v13.846h-2.77V2.188zM2.595 2.188h2.77v13.846h-2.77V2.188z" />
      </svg>
    </span>
  );
}
