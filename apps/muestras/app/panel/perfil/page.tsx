import Link from "next/link";
import { FormularioPerfil } from "@/components/perfil/formulario-perfil";
import { ObrasVinculadas } from "@/components/perfil/obras-vinculadas";
import { buscarPerfilPropio, obrasVinculadas } from "@/lib/perfiles/consultas";
import { esUrlWeb } from "@/lib/url";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mi perfil de fotógrafo" };

export default async function MiPerfil() {
  const usuario = await requireUsuario("/panel/perfil");
  const perfil = await buscarPerfilPropio(usuario.id);
  const obras = perfil ? await obrasVinculadas(perfil.id) : [];
  const publicado = obras.some((o) => o.activity.reviewStatus === "APPROVED");
  return (
    <main className="max-w-3xl space-y-12">
      <header className="space-y-3">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Mi perfil de fotógrafo</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">Tu página pública: tus datos y las obras tuyas que se expusieron en Muestras Fotográficas.</p>
        {perfil && publicado ? (
          <Link href={`/fotografos/${perfil.slug}`} className="inline-block underline underline-offset-[6px]">Ver mi perfil público</Link>
        ) : perfil ? (
          <p className="text-[15px] text-[var(--mf-muted)]">Tu perfil se publica cuando tengas una obra en una muestra publicada.</p>
        ) : null}
      </header>
      <FormularioPerfil
        esNuevo={!perfil}
        inicial={{
          displayName: perfil?.displayName ?? usuario.name ?? "",
          slug: perfil?.slug ?? "",
          bio: perfil?.bio ?? "",
          city: perfil?.city ?? "",
          province: perfil?.province ?? "",
          website: perfil?.website ?? "",
          instagram: perfil?.instagram ? `@${perfil.instagram}` : "",
          avatarUrl: perfil?.avatarUrl ?? null,
        }}
      />
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
