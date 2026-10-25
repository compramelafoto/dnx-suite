import Link from "next/link";
import { formatArDay, guestbookSignature } from "@repo/muestras";

type Entrada = { id: string; name: string | null; city: string | null; comment: string; createdAt: Date };

/** El libro de visitas en la página de la muestra: los últimos comentarios y la invitación a dejar uno. */
export function UltimosComentarios({ slug, entradas, abierto }: { slug: string; entradas: Entrada[]; abierto: boolean }) {
  if (entradas.length === 0 && !abierto) return null;
  const href = `/m/${slug}/libro`;
  return (
    <section aria-labelledby="t-libro" className="space-y-4 border-t border-[var(--mf-line)] pt-6">
      <h2 id="t-libro" className="mf-titulo text-[1.6rem]">Libro de visitas</h2>
      {entradas.length === 0 ? (
        <p className="text-[17px]">
          ¿Visitaste la muestra? <Link href={href} className="underline underline-offset-[6px]">Dejá tu comentario en el libro de visitas</Link>.
        </p>
      ) : (
        <>
          {/* data-nosnippet: los buscadores no muestran comentarios del público en sus resultados. */}
          <ul data-nosnippet className="max-w-[68ch] border-t border-[var(--mf-line)]">
            {entradas.slice(0, 6).map((e) => (
              <li key={e.id} className="space-y-1 border-b border-[var(--mf-line)] py-4">
                <p className="whitespace-pre-line leading-relaxed">{e.comment}</p>
                <p className="text-sm text-[var(--mf-muted)]">{guestbookSignature(e)} · {formatArDay(e.createdAt)}</p>
              </li>
            ))}
          </ul>
          <p>
            <Link href={href} className="underline underline-offset-[6px]">{abierto ? "Dejá tu comentario" : "Ver el libro de visitas"}</Link>
          </p>
        </>
      )}
    </section>
  );
}
