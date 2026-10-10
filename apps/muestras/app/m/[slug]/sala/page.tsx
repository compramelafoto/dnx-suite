import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatArClock } from "@repo/muestras";
import { AvisoDeSala } from "@/components/sala/aviso-de-sala";
import { frenarPorIp, ipDeLaPeticion } from "@/lib/limite";
import { MUCHAS_CONSULTAS, MUCHA_GENTE_EN_LA_RED, frenarEnSala } from "@/lib/sala/freno";
import { escaneadoEnSala, paseDeSala } from "@/lib/sala/consultas";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Lo que escaneaste", robots: { index: false, follow: false }, referrer: "no-referrer" };

type Props = { params: Promise<{ slug: string }> };

/** Lo escaneado con el pase de sala y hasta qué hora vale. Sin pase: a la muestra. */
export default async function LoQueEscaneaste({ params }: Props) {
  const { slug } = await params;
  const publica = `/m/${encodeURIComponent(slug)}`;
  const ip = ipDeLaPeticion(await headers());
  if (!frenarPorIp("vistaSalaRed", ip).allowed) return <AvisoDeSala texto={MUCHA_GENTE_EN_LA_RED} volver={publica} />;
  const p = await paseDeSala(slug);
  if (p && !frenarEnSala("vistaSala", p, ip)) return <AvisoDeSala texto={MUCHAS_CONSULTAS} volver={publica} />;
  const e = p ? await escaneadoEnSala(p) : null;
  if (!e) redirect(publica);
  return (
    <main className="mf-marco space-y-8 py-8 sm:py-12">
      <header className="space-y-2">
        <p className="text-sm text-[var(--mf-muted)]">En la sala · {e.muestra.title}</p>
        <h1 className="mf-titulo text-[clamp(2rem,5vw,3rem)]">Lo que escaneaste</h1>
        {e.vence ? (
          <p className="text-[15px]">Tu acceso de sala vale hasta las {formatArClock(new Date(e.vence))}.</p>
        ) : (
          <p className="text-[15px]">Estás viendo como en la sala porque sos del equipo de la muestra.</p>
        )}
      </header>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {e.obras.map((o) => (
          <li key={o.id}>
            <Link href={`/m/${encodeURIComponent(e.muestra.slug)}/sala/o/${encodeURIComponent(o.id)}`} className="block space-y-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={o.imagen} alt="" loading="lazy" className="aspect-square w-full bg-[var(--mf-surface)] object-cover" />
              <span className="block text-[15px]">{o.title}</span>
              <span className="block text-sm text-[var(--mf-muted)]">{o.authorName}</span>
            </Link>
          </li>
        ))}
      </ul>
      <p><Link href={`/m/${encodeURIComponent(e.muestra.slug)}`} className="underline underline-offset-[6px]">Ver toda la muestra</Link></p>
    </main>
  );
}
