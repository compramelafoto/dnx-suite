import Link from "next/link";

/**
 * "Adquirir obra" (spec D33): lleva a la página de venta de la obra, dentro de la vista de sala.
 * Hoy esa página dice que la venta todavía no está disponible; la etapa de Ventas suma el precio y
 * la compra en el mismo lugar.
 */
export function BotonAdquirir({ slug, workId }: { slug: string; workId: string }) {
  return (
    <Link
      href={`/m/${encodeURIComponent(slug)}/sala/o/${encodeURIComponent(workId)}/adquirir`}
      className="inline-flex h-11 items-center justify-center rounded-[2px] border border-[var(--mf-ink)] bg-[var(--mf-ink)] px-5 text-[var(--mf-bg)]"
    >
      Adquirir obra
    </Link>
  );
}
