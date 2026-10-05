import Link from "next/link";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireCommunicationsManager } from "@/lib/placas/access";
import { getMailingSettings } from "@/lib/mailing/settings";
import { loadOccasions } from "@/lib/mailing/occasions-store";
import {
  argentinaToday,
  birthdaysToday,
  daysUntil,
  isValidMonthDay,
  nextOccurrence,
  type Ymd,
} from "@/lib/mailing/occasions";
import type { OccasionConfig } from "@/lib/mailing/occasions-catalog";
import { etiquetaEspecialidad } from "@/lib/membership/specialties";
import { createCustomOccasionAction, toggleOccasionAction } from "@/app/actions/mailing-occasions";

export const dynamic = "force-dynamic";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function esTablaAusente(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:table|relation|column).*does not exist|P2021|P2022/i.test(message);
}

function cuando(o: OccasionConfig, hoy: Ymd): { fecha: string; falta: string | null; orden: number } {
  if (!isValidMonthDay(o.month, o.day)) return { fecha: "Sin fecha", falta: null, orden: 10_000 };
  const prox = nextOccurrence(o.month as number, o.day as number, hoy);
  const dias = daysUntil(prox, hoy);
  return {
    fecha: `${o.day} de ${MESES[(o.month as number) - 1]}`,
    falta: dias === 0 ? "hoy" : dias === 1 ? "mañana" : `en ${dias} días`,
    orden: dias,
  };
}

function aQuien(o: OccasionConfig): string {
  if (o.specialties.length === 0) return "Todos los socios";
  return o.specialties.map(etiquetaEspecialidad).join(", ");
}

/**
 * Comunicación → Fechas y saludos. Spec: docs/superpowers/specs/2026-10-05-correo-a-socios-etapa-3-fechas-design.md
 */
export default async function FechasPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { workspace } = await requireCommunicationsManager();
  const params = await searchParams;
  const hoy = argentinaToday(new Date());

  let faltaMigracion = false;
  let fechas: OccasionConfig[] = [];
  try {
    fechas = await loadOccasions(workspace.id);
  } catch (error) {
    if (!esTablaAusente(error)) throw error;
    faltaMigracion = true;
  }
  const settings = await getMailingSettings(workspace.id);

  // Cumpleaños de los próximos 30 días, para que se vea que el saludo tiene a quién llegar.
  const conFecha = await prisma.member.findMany({
    where: { workspaceId: workspace.id, status: "ACTIVE", birthDate: { not: null }, email: { not: null } },
    select: { id: true, email: true, firstName: true, birthDate: true },
  });
  const socios = conFecha.map((m) => ({ ...m, date: m.birthDate as Date }));
  let proximosCumples = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.UTC(hoy.y, hoy.m - 1, hoy.d + i));
    proximosCumples += birthdaysToday(socios, { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }).length;
  }

  const personales = fechas.filter((o) => o.kind !== "EFEMERIDE");
  const delAnio = fechas
    .filter((o) => o.kind === "EFEMERIDE")
    .map((o) => ({ o, c: cuando(o, hoy) }))
    .sort((a, b) => a.c.orden - b.c.orden || a.o.title.localeCompare(b.o.title, "es-AR"));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Fechas y saludos"
        description="Los saludos que la institución les manda por correo a sus socios: cumpleaños, aniversario de ingreso, fiestas, fechas patrias y días del oficio. Salen solos a las 9 de la mañana del día; cada uno tiene su interruptor."
        actions={
          <form action={createCustomOccasionAction}>
            <button type="submit" className="fo-btn fo-btn-secondary text-sm">
              Agregar una fecha propia
            </button>
          </form>
        }
      />

      {params.error ? (
        <p className="fo-alert-error p-4 text-sm" role="alert">
          {params.error}
        </p>
      ) : null}
      {params.ok ? <p className="fo-alert-success p-4 text-sm">{params.ok}</p> : null}
      {faltaMigracion ? (
        <p className="fo-alert-warning p-4 text-sm">Falta preparar la base de datos para los saludos. Avisale al equipo técnico.</p>
      ) : null}
      {!settings.bulkEnabled ? (
        <p className="fo-alert-warning p-4 text-sm">
          Los envíos a socios están apagados: aunque enciendas un saludo, no sale hasta que los enciendas en{" "}
          <Link href="/comunicacion/correo" className="underline">
            Comunicación → Correo
          </Link>
          .
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Saludos personales</h2>
        <div className="space-y-2">
          {personales.map((o) => (
            <Fila
              key={o.key}
              o={o}
              linea1={o.kind === "BIRTHDAY" ? "El día del cumpleaños de cada socio" : "El día en que cada socio cumple años en la institución"}
              linea2={
                o.kind === "BIRTHDAY"
                  ? `${proximosCumples} cumpleaños en los próximos 30 días (de ${socios.length} socios con fecha de nacimiento y correo).`
                  : o.milestonesOnly
                    ? "Sólo en 1, 5, 10, 15… años."
                    : "Todos los años, desde el primero."
              }
            />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-[var(--fo-text)]">Fechas del año</h2>
        <div className="space-y-2">
          {delAnio.map(({ o, c }) => (
            <Fila
              key={o.key}
              o={o}
              linea1={c.falta ? `${c.fecha} · ${c.falta}` : c.fecha}
              linea2={`${aQuien(o)}${o.hint && !isValidMonthDay(o.month, o.day) ? " · Falta confirmar la fecha" : ""}`}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function Fila({ o, linea1, linea2 }: { o: OccasionConfig; linea1: string; linea2: string }) {
  return (
    <div className="fo-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/comunicacion/fechas/${encodeURIComponent(o.key)}`} className="font-medium text-[var(--fo-text)] hover:underline">
            {o.title}
          </Link>
          <span
            className={`rounded-full px-2 py-0.5 text-xs ${
              o.enabled ? "bg-[var(--fo-success-soft)] text-[var(--fo-success)]" : "bg-[var(--fo-surface-muted)] text-[var(--fo-muted)]"
            }`}
          >
            {o.enabled ? "Encendido" : "Apagado"}
          </span>
          {!o.builtIn ? <span className="text-xs text-[var(--fo-muted)]">Propia</span> : null}
        </div>
        <p className="mt-1 text-sm text-[var(--fo-text-secondary)]">{linea1}</p>
        <p className="text-xs text-[var(--fo-muted)]">{linea2}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Link href={`/comunicacion/fechas/${encodeURIComponent(o.key)}`} className="fo-btn fo-btn-ghost text-sm">
          Editar
        </Link>
        <form action={toggleOccasionAction}>
          <input type="hidden" name="key" value={o.key} />
          <input type="hidden" name="valor" value={o.enabled ? "0" : "1"} />
          <button type="submit" className={`fo-btn ${o.enabled ? "fo-btn-secondary" : "fo-btn-primary"} text-sm`}>
            {o.enabled ? "Apagar" : "Encender"}
          </button>
        </form>
      </div>
    </div>
  );
}
