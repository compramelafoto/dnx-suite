import Link from "next/link";
import { listarFotografos } from "@/lib/perfiles/consultas";
import { esUrlWeb } from "@/lib/url";

export const revalidate = 300;
export const metadata = {
  title: "Fotógrafos que expusieron",
  description: "Autores con obras en muestras fotográficas de todo el país.",
};

export default async function Fotografos() {
  const perfiles = await listarFotografos();
  return (
    <main className="mf-marco py-10 sm:py-16">
      <h1 className="mf-titulo max-w-[16ch] text-[clamp(2.2rem,5vw,3.5rem)]">Fotógrafos que expusieron</h1>
      <p className="mt-4 max-w-[52ch] text-lg leading-snug text-[var(--mf-muted)]">Autores con obras en muestras de todo el país.</p>
      {perfiles.length === 0 ? (
        <p className="mt-10 border-t border-[var(--mf-line)] pt-8 text-lg">Todavía no hay perfiles publicados.</p>
      ) : (
        <ul className="mt-10 grid border-t border-[var(--mf-line)] sm:grid-cols-2 lg:grid-cols-3">
          {perfiles.map((p) => {
            const n = new Set(p.works.map((w) => w.activityId)).size;
            return (
              <li key={p.slug} className="border-b border-[var(--mf-line)]">
                <Link href={`/fotografos/${p.slug}`} className="group flex items-center gap-4 py-5 pr-4">
                  {esUrlWeb(p.avatarUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatarUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span aria-hidden className="size-14 shrink-0 rounded-full bg-[var(--mf-surface)]" />
                  )}
                  <span className="min-w-0">
                    <span className="mf-titulo block text-xl underline-offset-[5px] group-hover:underline">{p.displayName}</span>
                    <span className="text-[13px] text-[var(--mf-muted)]">{[p.city, n === 1 ? "1 muestra" : `${n} muestras`].filter(Boolean).join(". ")}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
