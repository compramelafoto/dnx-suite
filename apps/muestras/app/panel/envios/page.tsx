import Link from "next/link";
import { CALL_PHASE_PUBLIC_TEXT, acceptsSubmissions, callPhase, formatArDay } from "@repo/muestras";
import { listarMisEnvios } from "@/lib/envios/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mis envíos" };

export default async function MisEnvios() {
  const usuario = await requireUsuario("/panel/envios");
  const envios = await listarMisEnvios(usuario.id);
  const ahora = new Date();
  return (
    <main className="max-w-3xl space-y-10">
      <header className="space-y-3">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Mis envíos</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">Las obras que mandaste a convocatorias y cómo sigue cada una.</p>
      </header>
      {envios.length === 0 ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">Todavía no enviaste obras. <Link href="/convocatorias" className="underline underline-offset-[6px]">Ver convocatorias abiertas</Link></p>
      ) : (
        <ul className="border-t border-[var(--mf-line)]">
          {envios.map((e) => {
            const fase = callPhase(e.call, ahora);
            const terminado = e.call.status === "DONE";
            return (
              <li key={e.id} className="space-y-4 border-b border-[var(--mf-line)] py-6">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <Link href={`/convocatorias/${e.call.slug}`} className="mf-titulo text-xl underline-offset-[5px] hover:underline">{e.call.title}</Link>
                  <span className="text-sm">{e.status === "WITHDRAWN" ? "Retiraste el envío" : CALL_PHASE_PUBLIC_TEXT[fase]}</span>
                </div>
                {e.status === "ACTIVE" ? (
                  <ul className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    {e.works.map((w) => (
                      <li key={w.id} className="space-y-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={w.imageUrl} alt="" className="aspect-square w-full bg-[var(--mf-surface)] object-contain" />
                        <p className="text-[15px]">{w.title}</p>
                        {terminado ? <p className="text-sm text-[var(--mf-muted)]">{w.decision === "SELECTED" ? "Seleccionada" : "No quedó en la selección"}</p> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {acceptsSubmissions(fase) ? (
                  <p className="text-[15px]">
                    <Link href={`/convocatorias/${e.call.slug}/enviar`} className="underline underline-offset-[6px]">{e.status === "ACTIVE" ? "Cambiar o retirar" : "Volver a enviar"}</Link>
                    <span className="text-[var(--mf-muted)]"> hasta el {formatArDay(e.call.closesAt)}</span>
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
