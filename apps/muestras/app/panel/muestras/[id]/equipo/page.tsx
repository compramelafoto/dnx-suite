import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ACTIVITY_ROLE_LABELS, TEAM_ROLES, TEAM_ROLE_DESCRIPTIONS } from "@repo/muestras";
import { EquipoMuestra } from "@/components/equipo/equipo-muestra";
import { enlace, nota } from "@/components/equipo/estilos";
import { equipoDeLaMuestra } from "@/lib/equipo/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Equipo de la muestra" };

type Props = { params: Promise<{ id: string }> };

export default async function EquipoDeLaMuestra({ params }: Props) {
  const { id } = await params;
  const usuario = await requireUsuario(`/panel/muestras/${id}/equipo`);
  const e = await equipoDeLaMuestra(id, usuario);
  if (!e) notFound();
  const soyIntegrante = e.rol === "CO_ORGANIZER" || e.rol === "TEXT_EDITOR";
  return (
    <main className="max-w-3xl space-y-8">
      <Link href={`/panel/muestras/${e.muestra.id}`} className={`text-sm ${enlace}`}>Volver a la muestra</Link>
      <header className="space-y-3">
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">Equipo de «{e.muestra.title}»</h1>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">
          {e.puedeGestionar
            ? "Invitá a quienes preparan la muestra con vos. Cada persona entra con su propia cuenta de Google."
            : `Tu rol en esta muestra: ${e.rol ? ACTIVITY_ROLE_LABELS[e.rol] : "revisión"}.`}
        </p>
      </header>
      <section className="space-y-2">
        <h2 className="text-sm text-[var(--mf-muted)]">Qué puede hacer cada rol</h2>
        <dl className="border-t border-[var(--mf-line)]">
          <div className="border-b border-[var(--mf-line)] py-3">
            <dt className="font-medium">{ACTIVITY_ROLE_LABELS.OWNER}</dt>
            <dd className={nota}>Quien propuso la muestra. Puede todo: además maneja el equipo, la convocatoria y puede cancelar la muestra.</dd>
          </div>
          {TEAM_ROLES.map((r) => (
            <div key={r} className="border-b border-[var(--mf-line)] py-3">
              <dt className="font-medium">{ACTIVITY_ROLE_LABELS[r]}</dt>
              <dd className={nota}>{TEAM_ROLE_DESCRIPTIONS[r]}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg">Integrantes</h2>
        <p className="border-b border-t border-[var(--mf-line)] py-3">
          {e.duenio.nombre ?? "Quien propuso la muestra"} <span className={nota}>· {ACTIVITY_ROLE_LABELS.OWNER}{e.rol === "OWNER" ? " (vos)" : ""}</span>
        </p>
        <EquipoMuestra activityId={e.muestra.id} integrantes={e.integrantes} puedeGestionar={e.puedeGestionar} soyIntegrante={soyIntegrante} />
      </section>
    </main>
  );
}
