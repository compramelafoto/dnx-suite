import Link from "next/link";
import { notFound } from "next/navigation";
import { CALL_STATUS_LABELS, CALL_PHASE_PUBLIC_TEXT, callPhase, formatArDay, isCallStatus, toArDay } from "@repo/muestras";
import { AccionesConvocatoria } from "@/components/convocatorias/acciones-convocatoria";
import { EquipoCuratorial } from "@/components/convocatorias/equipo-curatorial";
import { FormularioConvocatoria } from "@/components/convocatorias/formulario-convocatoria";
import { buscarConvocatoriaDelOrganizador } from "@/lib/convocatorias/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Convocatoria" };

type Props = { params: Promise<{ id: string }> };

export default async function EditarConvocatoria({ params }: Props) {
  const { id } = await params;
  const usuario = await requireUsuario(`/panel/convocatorias/${id}`);
  const c = await buscarConvocatoriaDelOrganizador(id, usuario);
  if (!c) notFound();
  const fase = callPhase(c, new Date());
  const estado = isCallStatus(c.status) ? CALL_STATUS_LABELS[c.status] : c.status;

  return (
    <main className="max-w-3xl space-y-12">
      <header className="space-y-3">
        <p className="text-sm text-[var(--mf-muted)]">
          Convocatoria de <Link href={`/panel/muestras/${c.activity.id}`} className="underline underline-offset-4">{c.activity.title}</Link>
        </p>
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">{c.title}</h1>
        <p className="text-[15px]">
          {estado}{fase !== "DRAFT" && fase !== c.status ? `. ${CALL_PHASE_PUBLIC_TEXT[fase]}` : ""}. Del {formatArDay(c.opensAt)} al {formatArDay(c.closesAt)}.
        </p>
        {fase !== "DRAFT" ? <Link href={`/convocatorias/${c.slug}`} className="inline-block underline underline-offset-[6px]">Ver la página pública</Link> : null}
      </header>

      <section aria-labelledby="t-recibido" className="space-y-3">
        <h2 id="t-recibido" className="text-sm text-[var(--mf-muted)]">Lo recibido</h2>
        <dl className="grid grid-cols-2 border-t border-[var(--mf-line)] sm:grid-cols-3">
          <div className="border-b border-[var(--mf-line)] py-4"><dt className="text-[13px] text-[var(--mf-muted)]">Envíos</dt><dd className="mf-titulo mt-1 text-3xl tabular-nums">{c._count.submissions}</dd></div>
          <div className="border-b border-[var(--mf-line)] py-4"><dt className="text-[13px] text-[var(--mf-muted)]">Obras</dt><dd className="mf-titulo mt-1 text-3xl tabular-nums">{c.obras}</dd></div>
          <div className="border-b border-[var(--mf-line)] py-4"><dt className="text-[13px] text-[var(--mf-muted)]">En la muestra hoy</dt><dd className="mf-titulo mt-1 text-3xl tabular-nums">{c.activity._count.works}</dd></div>
        </dl>
        <p className="text-sm text-[var(--mf-muted)]">Los nombres de quienes enviaron aparecen recién al cerrar la curaduría.</p>
        {c.status === "CURATING" || c.status === "DONE" ? (
          <Link href={`/panel/convocatorias/${c.id}/seleccion`} className="inline-block underline underline-offset-[6px]">
            {c.status === "CURATING" ? "Ver el ranking y elegir" : "Ver la selección"}
          </Link>
        ) : null}
      </section>

      <AccionesConvocatoria id={c.id} fase={fase} />

      <section aria-labelledby="t-equipo" className="space-y-3">
        <h2 id="t-equipo" className="text-sm text-[var(--mf-muted)]">Equipo curatorial</h2>
        <p className="text-[15px] text-[var(--mf-muted)]">Cada integrante recibe un enlace por mail y entra con su cuenta de Google. Ve todas las obras, sin nombres, y las puntúa de 1 a 5.</p>
        <EquipoCuratorial callId={c.id} curadores={c.curators} editable={c.status !== "DONE"} />
      </section>

      <section aria-labelledby="t-datos" className="space-y-3">
        <h2 id="t-datos" className="text-sm text-[var(--mf-muted)]">Bases y fechas</h2>
        <FormularioConvocatoria
          inicial={{
            id: c.id, status: c.status, title: c.title, basesText: c.basesText, requirementsText: c.requirementsText ?? "",
            rightsText: c.rightsText, opensDay: toArDay(c.opensAt), closesDay: toArDay(c.closesAt), maxWorksPerPerson: c.maxWorksPerPerson,
          }}
        />
        {c.status !== "DRAFT" && c.status !== "OPEN" ? <p className="text-[15px] text-[var(--mf-muted)]">La convocatoria cerró: sus bases ya no se pueden cambiar.</p> : null}
      </section>
    </main>
  );
}
