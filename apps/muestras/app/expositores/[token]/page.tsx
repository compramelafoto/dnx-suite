import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatArDayLong, dateRangeText } from "@repo/muestras";
import { AltaExpositor } from "@/components/expositores/alta-expositor";
import { botonLleno, enlace as claseEnlace, nota } from "@/components/expositores/estilos";
import { enlacePorToken, miFilaEnMuestra } from "@/lib/expositores/consultas";
import { frenarPorIp, ipDeLaPeticion } from "@/lib/limite";
import { buscarPerfilPropio } from "@/lib/perfiles/consultas";
import { esUrlWeb } from "@/lib/url";
import { getUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
// El token va en la dirección: que no se indexe ni viaje como referencia a otro sitio.
export const metadata: Metadata = { title: "Sumate a exponer", robots: { index: false, follow: false }, referrer: "no-referrer" };

type Props = { params: Promise<{ token: string }> };

export default async function SumarseComoExpositor({ params }: Props) {
  const { token } = await params;
  // Quien prueba tokens recibe, pasado el tope, el mismo 404 que un token inexistente.
  if (!frenarPorIp("paginaExpositores", ipDeLaPeticion(await headers())).allowed) notFound();
  const r = await enlacePorToken(token);
  if (!r || r.estado === "UNAVAILABLE") notFound();
  const { muestra: a, enlace: e } = r;
  const usuario = await getUsuario();
  const fila = usuario ? await miFilaEnMuestra(a.id, usuario.id) : null;
  const lugar = a.isVirtualOnly ? "Muestra virtual" : [a.venueName, a.city, a.province].filter(Boolean).join(", ");

  return (
    <main className="mx-auto max-w-3xl space-y-8 p-4 sm:p-8">
      {esUrlWeb(a.coverImageUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.coverImageUrl} alt="" className="aspect-[16/9] w-full rounded-[2px] object-cover" />
      ) : null}
      <header className="space-y-3">
        <p className={nota}>Te invitan a exponer en</p>
        <h1 className="mf-titulo text-[clamp(2.2rem,5vw,3.4rem)] leading-tight">{a.title}</h1>
        <p className="text-lg">Organiza: {a.organizersText}</p>
        <p className="text-[15px]">{dateRangeText(a.startsAt, a.endsAt)}{lugar ? ` · ${lugar}` : ""}</p>
      </header>

      {r.estado !== "OPEN" ? (
        <p className="text-lg">
          Este enlace ya no recibe expositores. Si ya te sumaste, entrá a{" "}
          <Link href="/panel/expositor" className={claseEnlace}>&quot;Dónde expongo&quot;</Link> en tu panel.
        </p>
      ) : (
        <>
          {e.instructions ? (
            <section className="space-y-2 border-t border-[var(--mf-line)] pt-6">
              <h2 className="text-lg">Lo que pide quien organiza</h2>
              <p className="whitespace-pre-line text-[15px]">{e.instructions}</p>
            </section>
          ) : null}
          <section className="space-y-1 text-[15px]">
            {e.maxWorksPerExhibitor != null ? (
              <p>Podés cargar hasta {e.maxWorksPerExhibitor} {e.maxWorksPerExhibitor === 1 ? "obra" : "obras"}.</p>
            ) : null}
            {e.closesAt ? <p>Tenés tiempo hasta el {formatArDayLong(e.closesAt)}.</p> : null}
            <p className={nota}>Por cada obra vas a cargar la foto que se cuelga en la sala y sus datos. Quien organiza aprueba cada una.</p>
          </section>

          {!usuario ? (
            <p>
              <Link href={`/login?next=${encodeURIComponent(`/expositores/${token}`)}`} className={botonLleno}>
                Ingresá con Google para sumarte
              </Link>
            </p>
          ) : fila?.status === "ACTIVE" ? (
            <section className="space-y-3 border-t border-[var(--mf-line)] pt-6">
              <h2 className="text-lg">Ya estás en esta muestra</h2>
              <p><Link href={`/panel/expositor/${fila.id}`} className={botonLleno}>Ir a mis obras</Link></p>
            </section>
          ) : fila ? (
            <p className="text-lg">Quien organiza te sacó de esta muestra. Escribile si fue un error.</p>
          ) : (
            <AltaExpositor nombreSugerido={usuario.name ?? ""} perfil={await perfilParaAlta(usuario.id)} />
          )}
        </>
      )}
    </main>
  );
}

/** Lo justo del perfil propio para el formulario: si existe y si le falta la biografía. */
async function perfilParaAlta(userId: number) {
  const p = await buscarPerfilPropio(userId);
  return p ? { displayName: p.displayName, tieneBio: !!p.bio?.trim() } : null;
}
