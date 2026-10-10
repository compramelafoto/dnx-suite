import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { toArDay } from "@repo/muestras";
import { AdministrarEnlace, GenerarEnlace } from "@/components/expositores/enlace-expositores";
import { enlace, nota } from "@/components/expositores/estilos";
import { enlaceDeExpositores } from "@/lib/expositores/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Expositores" };

type Props = { params: Promise<{ id: string }> };

export default async function ExpositoresDeMuestra({ params }: Props) {
  const { id } = await params;
  const usuario = await requireUsuario(`/panel/muestras/${id}/expositores`);
  // Sin `exhibitors` (rol de textos, ajenos): no existe.
  const r = await enlaceDeExpositores(id, usuario);
  if (!r) notFound();
  const { muestra: a, enlace: e } = r;

  return (
    <main className="max-w-3xl space-y-8">
      <Link href={`/panel/muestras/${a.id}`} className={`text-sm ${enlace}`}>Volver a la muestra</Link>
      <header className="space-y-3">
        <p className={nota}>{a.title}</p>
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Expositores</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">
          Mandá un enlace a las personas que elegiste para exponer: se suman con su cuenta de Google, completan su perfil y cargan sus
          obras. Vos aprobás cada obra antes de que entre a la muestra.
        </p>
      </header>
      {e && r.url ? (
        <AdministrarEnlace
          activityId={a.id}
          url={r.url}
          estado={r.estado}
          expositores={r.expositores}
          datos={{
            status: e.status,
            closesDay: e.closesAt ? toArDay(e.closesAt) : "",
            maxWorksPerExhibitor: e.maxWorksPerExhibitor,
            maxExhibitors: e.maxExhibitors,
            instructions: e.instructions ?? "",
          }}
        />
      ) : a.isCancelled ? (
        <p className="text-lg text-[var(--mf-alerta)]">La muestra está cancelada.</p>
      ) : r.cerrada ? (
        <p className="text-lg">La muestra ya cerró: no recibe expositores.</p>
      ) : (
        <GenerarEnlace activityId={a.id} pideVisibilidad={!r.tieneAjuste} />
      )}
    </main>
  );
}
