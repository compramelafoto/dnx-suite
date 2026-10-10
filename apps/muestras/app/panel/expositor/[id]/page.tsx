import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { dateRangeText, formatArDayLong } from "@repo/muestras";
import { ObrasExpositor } from "@/components/expositores/obras-expositor";
import { enlace, nota } from "@/components/expositores/estilos";
import { miParticipacion } from "@/lib/expositores/consultas";
import { esUrlWeb } from "@/lib/url";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mis obras" };

type Props = { params: Promise<{ id: string }> };

const ENLACE: Record<string, string> = {
  OPEN: "El enlace está abierto: podés cargar y enviar obras.",
  CLOSED: "El enlace está cerrado: no se reciben obras nuevas. Si te pidieron cambios, podés corregir y reenviar.",
  EXPIRED: "Pasó la fecha límite: no se reciben obras nuevas. Si te pidieron cambios, podés corregir y reenviar.",
  UNAVAILABLE: "La muestra ya no recibe obras.",
};

export default async function MisObrasEnLaMuestra({ params }: Props) {
  const { id } = await params;
  const usuario = await requireUsuario(`/panel/expositor/${id}`);
  // Siempre por la cuenta: la participación de otra persona no existe.
  const e = await miParticipacion(id, usuario);
  if (!e) notFound();
  const a = e.activity;
  const link = a.exhibitorLink;
  const tope = link?.maxWorksPerExhibitor ?? null;
  const cuentan = e.works.filter((w) => w.status !== "REMOVED").length;
  const puedeAgregar = e.status === "ACTIVE" && e.estadoEnlace === "OPEN" && (tope == null || cuentan < tope);

  return (
    <main className="max-w-3xl space-y-10">
      <Link href="/panel/expositor" className={`text-sm ${enlace}`}>Donde expongo</Link>
      <header className="space-y-3">
        <p className={nota}>Exponés en</p>
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">{a.title}</h1>
        <p className="text-[15px]">{dateRangeText(a.startsAt, a.endsAt)} · Organiza: {a.organizersText}</p>
        {e.status !== "ACTIVE" ? (
          <p className="text-lg text-[var(--mf-alerta)]">Quien organiza te sacó de esta muestra.</p>
        ) : (
          <>
            <p className="text-[15px]">{ENLACE[e.estadoEnlace]}</p>
            {link?.closesAt && e.estadoEnlace === "OPEN" ? <p className={nota}>Fecha límite: {formatArDayLong(link.closesAt)}.</p> : null}
          </>
        )}
        {link?.instructions ? <p className="whitespace-pre-line border-l-2 border-[var(--mf-line)] pl-3 text-[15px]">{link.instructions}</p> : null}
      </header>

      {e.status === "ACTIVE" && !e.profile?.bio?.trim() ? (
        <p className="text-[15px] text-[var(--mf-alerta)]">
          Antes de enviar, completá tu biografía en <Link href="/panel/perfil" className={enlace}>Mi perfil de fotógrafo</Link>: es lo que el público lee de vos.
        </p>
      ) : null}

      <ObrasExpositor
        exhibitorId={e.id}
        activo={e.status === "ACTIVE"}
        tope={tope}
        cuentan={cuentan}
        puedeAgregar={puedeAgregar}
        obras={e.works.map((w) => ({ ...w, imageUrl: esUrlWeb(w.imageUrl) ? w.imageUrl : null }))}
      />

      <section className="space-y-2 border-t border-[var(--mf-line)] pt-6">
        <h2 className="text-lg">Tu portfolio</h2>
        <p className="text-[15px]">Sumá fotos que no se exponen para que el público te conozca.</p>
        <p><Link href="/panel/perfil#portfolio" className={enlace}>Ir a tu portfolio</Link></p>
      </section>
    </main>
  );
}
