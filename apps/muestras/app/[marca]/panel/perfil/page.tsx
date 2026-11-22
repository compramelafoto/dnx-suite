import Link from "next/link";
import type { Metadata } from "next";
import { countsForPublicProfile, PHOTOGRAPHY } from "@repo/muestras";
import { FormularioPerfil } from "@/components/perfil/formulario-perfil";
import { ObrasVinculadas } from "@/components/perfil/obras-vinculadas";
import { Portfolio } from "@/components/perfil/portfolio";
import { rutaDePerfil } from "@/lib/perfiles/casa";
import { buscarPerfilPropio, obrasVinculadas } from "@/lib/perfiles/consultas";
import { portfolioPropio } from "@/lib/portfolio/consultas";
import { marcaDeParams } from "@/lib/ruta-marca";
import { esUrlWeb } from "@/lib/url";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ marca: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const marca = await marcaDeParams(params);
  return { title: `Mi perfil de ${marca.palabraAutor.singular}` };
}

export default async function MiPerfil({ params }: Props) {
  const marca = await marcaDeParams(params);
  const usuario = await requireUsuario("/panel/perfil");
  const perfil = await buscarPerfilPropio(usuario.id);
  const [obras, fotos] = perfil ? await Promise.all([obrasVinculadas(perfil.id), portfolioPropio(usuario)]) : [[], null];
  // Mismo criterio que el perfil público: sólo cuentan las muestras publicadas.
  const publicado = obras.some((o) => countsForPublicProfile(o.activity));
  return (
    <main className="max-w-3xl space-y-12">
      <header className="space-y-3">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">{`Mi perfil de ${marca.palabraAutor.singular}`}</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">{`Tu página pública: tus datos y las obras tuyas que se expusieron en ${marca.nombre}.`}</p>
        {perfil && publicado ? (
          <Link href={rutaDePerfil(marca, perfil.slug)} className="inline-block underline underline-offset-[6px]">Ver mi perfil público</Link>
        ) : perfil ? (
          <p className="text-[15px] text-[var(--mf-muted)]">Tu perfil se publica cuando tengas una obra en una muestra publicada.</p>
        ) : null}
      </header>
      <FormularioPerfil
        esNuevo={!perfil}
        prefijoUrl={`${marca.dominio}${marca.rutaAutores}/`}
        inicial={{
          displayName: perfil?.displayName ?? usuario.name ?? "",
          slug: perfil?.slug ?? "",
          bio: perfil?.bio ?? "",
          city: perfil?.city ?? "",
          province: perfil?.province ?? "",
          website: perfil?.website ?? "",
          instagram: perfil?.instagram ? `@${perfil.instagram}` : "",
          avatarUrl: perfil?.avatarUrl ?? null,
          disciplines: perfil?.disciplines.length ? perfil.disciplines : [PHOTOGRAPHY],
        }}
      />
      {perfil ? (
        <Portfolio fotos={(fotos ?? []).filter((f) => esUrlWeb(f.imageUrl))} />
      ) : (
        <section id="portfolio" className="space-y-2 border-t border-[var(--mf-line)] pt-6">
          <h2 className="text-lg">Portfolio</h2>
          <p className="text-[15px] text-[var(--mf-muted)]">Creá tu perfil para armar tu portfolio.</p>
        </section>
      )}
      {perfil ? (
        <ObrasVinculadas
          obras={obras.filter((o) => esUrlWeb(o.imageUrl)).map((o) => ({
            id: o.id, title: o.title, imageUrl: o.imageUrl, muestra: o.activity.title,
            muestraSlug: o.activity.slug, publicada: o.activity.reviewStatus === "APPROVED",
          }))}
        />
      ) : null}
    </main>
  );
}
