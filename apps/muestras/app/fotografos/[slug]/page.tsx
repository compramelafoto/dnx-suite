import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatArDay, profileWorksInActivity, workPath } from "@repo/muestras";
import { buscarPerfilPublico } from "@/lib/perfiles/consultas";
import { esUrlWeb } from "@/lib/url";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await buscarPerfilPublico((await params).slug);
  if (!r) return {};
  const { perfil } = r;
  const descripcion = perfil.bio?.slice(0, 160) || `Obras de ${perfil.displayName} en Muestras Fotográficas.`;
  return {
    title: perfil.displayName,
    description: descripcion,
    openGraph: { title: perfil.displayName, description: descripcion, type: "profile", images: esUrlWeb(perfil.avatarUrl) ? [perfil.avatarUrl] : [] },
  };
}

export default async function PerfilPublico({ params }: Props) {
  const r = await buscarPerfilPublico((await params).slug);
  if (!r) notFound();
  const { perfil, muestras } = r;
  const ahora = new Date();
  const lugar = [perfil.city, perfil.province].filter(Boolean).join(", ");

  return (
    <main className="mf-marco space-y-16 py-10 sm:py-16">
      <header className="grid gap-8 md:grid-cols-12">
        <div className="flex items-center gap-6 md:col-span-7">
          {esUrlWeb(perfil.avatarUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={perfil.avatarUrl} alt="" className="size-24 shrink-0 rounded-full object-cover sm:size-32" />
          ) : null}
          <div>
            <h1 className="mf-titulo text-[clamp(2.2rem,5vw,3.5rem)]">{perfil.displayName}</h1>
            {lugar ? <p className="mt-2 text-[var(--mf-muted)]">{lugar}</p> : null}
          </div>
        </div>
        <div className="space-y-4 md:col-span-5">
          {perfil.bio ? <p className="whitespace-pre-line leading-relaxed">{perfil.bio}</p> : null}
          <p className="flex flex-wrap gap-x-5 text-[15px]">
            {esUrlWeb(perfil.website) ? <a href={perfil.website} target="_blank" rel="noreferrer nofollow" className="underline underline-offset-[6px]">Sitio web</a> : null}
            {perfil.instagram ? <a href={`https://www.instagram.com/${encodeURIComponent(perfil.instagram)}/`} target="_blank" rel="noreferrer nofollow" className="underline underline-offset-[6px]">Instagram</a> : null}
          </p>
        </div>
      </header>

      <section aria-labelledby="t-expuso" className="space-y-10">
        <h2 id="t-expuso" className="text-sm text-[var(--mf-muted)]">Expuso en</h2>
        {muestras.map((m) => {
          const { visible, hiddenCount } = profileWorksInActivity(m, m.works, perfil.id, ahora);
          const fotos = visible.filter((w) => esUrlWeb(w.imageUrl));
          return (
            <article key={m.id} className="border-t border-[var(--mf-line)] pt-6">
              <h3 className="mf-titulo text-[clamp(1.4rem,2.4vw,1.9rem)]">
                <Link href={`/m/${m.slug}`} className="underline-offset-[5px] hover:underline">{m.title}</Link>
              </h3>
              <p className="mt-1 text-[15px] text-[var(--mf-muted)]">
                {formatArDay(m.startsAt)} al {formatArDay(m.endsAt)}{m.venueName ? `. ${m.venueName}` : ""}{m.city ? `, ${m.city}` : ""}
              </p>
              {fotos.length ? (
                <ul className="mt-5 grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
                  {fotos.map((w) => (
                    <li key={w.id}>
                      <Link href={workPath(m.slug, w.id)} className="group block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={w.imageUrl} alt={w.title} loading="lazy" className="aspect-[4/5] w-full bg-[var(--mf-surface)] object-cover transition-opacity duration-300 group-hover:opacity-85" />
                        <span className="mt-2 block text-sm font-medium">{w.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              {hiddenCount > 0 ? (
                <p className="mt-4 text-[15px] text-[var(--mf-muted)]">
                  {fotos.length ? (hiddenCount === 1 ? "Y 1 obra más" : `Y ${hiddenCount} obras más`) : (hiddenCount === 1 ? "1 obra" : `${hiddenCount} obras`)} para ver en la sala.
                </p>
              ) : null}
            </article>
          );
        })}
      </section>
    </main>
  );
}
