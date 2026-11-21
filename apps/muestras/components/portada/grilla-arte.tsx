import Link from "next/link";

export type MuestraDeGrilla = { slug: string; title: string; coverImageUrl: string | null; organizersText: string | null };

/** Portadas de hasta 8 muestras de arte, con su crédito. Sin muestras no se dibuja nada. */
export function GrillaArte({ muestras }: { muestras: MuestraDeGrilla[] }) {
  if (muestras.length === 0) return null;
  return (
    <section aria-label="Muestras de arte" className="mf-marco pt-16 sm:pt-20">
      <ul className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {muestras.slice(0, 8).map((m) => (
          <li key={m.slug} className="min-w-0">
            <Link href={`/m/${m.slug}`} className="group block">
              <div className="relative aspect-[4/5] overflow-hidden bg-[var(--mf-surface)]">
                {m.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.coverImageUrl} alt="" className="absolute inset-0 size-full object-cover" />
                ) : null}
              </div>
              <span className="mf-titulo mt-3 block text-lg underline-offset-[5px] group-hover:underline">{m.title}</span>
              {m.organizersText ? <span className="text-[13px] text-[var(--mf-muted)]">{m.organizersText}</span> : null}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
