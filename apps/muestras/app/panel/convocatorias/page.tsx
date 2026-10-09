import Link from "next/link";
import { CALL_STATUS_LABELS, formatArDay, isCallStatus } from "@repo/muestras";
import { CrearConvocatoria } from "@/components/convocatorias/crear-convocatoria";
import { listarConvocatoriasMias, muestrasSinConvocatoria } from "@/lib/convocatorias/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Convocatorias" };

export default async function Convocatorias() {
  const usuario = await requireUsuario("/panel/convocatorias");
  const [mias, sinConvocatoria] = await Promise.all([listarConvocatoriasMias(usuario), muestrasSinConvocatoria(usuario.id)]);
  return (
    <main className="max-w-3xl space-y-12">
      <header className="space-y-3">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Convocatorias</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">
          Convocá fotógrafos para tu muestra presencial: envían sus obras por acá y tu equipo curatorial elige cuáles se exponen, sin ver quién las hizo.
        </p>
      </header>

      <section aria-labelledby="t-mias" className="space-y-4">
        <h2 id="t-mias" className="text-sm text-[var(--mf-muted)]">{usuario.esSuperAdmin ? "Todas las convocatorias" : "Tus convocatorias"}</h2>
        {mias.length === 0 ? <p className="text-lg">Todavía no armaste ninguna.</p> : (
          <ul className="border-t border-[var(--mf-line)]">
            {mias.map((c) => (
              <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--mf-line)] py-4">
                <span>
                  <Link href={`/panel/convocatorias/${c.id}`} className="mf-titulo text-xl underline-offset-[5px] hover:underline">{c.title}</Link>
                  <span className="block text-[13px] text-[var(--mf-muted)]">
                    Para “{c.activity.title}”. Del {formatArDay(c.opensAt)} al {formatArDay(c.closesAt)}. {c._count.submissions} {c._count.submissions === 1 ? "envío" : "envíos"}, {c._count.curators} en el equipo curatorial.
                  </span>
                </span>
                <span className="text-sm">{isCallStatus(c.status) ? CALL_STATUS_LABELS[c.status] : c.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="t-nueva" className="space-y-4">
        <h2 id="t-nueva" className="text-sm text-[var(--mf-muted)]">Armar una convocatoria nueva</h2>
        {sinConvocatoria.length === 0 ? (
          <p className="text-[15px]">
            Cada convocatoria es de una muestra. <Link href="/panel/proponer" className="underline underline-offset-[6px]">Creá la muestra</Link> y volvé acá. Para abrir la convocatoria, la muestra tiene que estar publicada.
          </p>
        ) : (
          <ul className="border-t border-[var(--mf-line)]">
            {sinConvocatoria.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--mf-line)] py-3">
                <span>{m.title}</span>
                <CrearConvocatoria activityId={m.id} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
