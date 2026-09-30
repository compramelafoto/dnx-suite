import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { CiudadesARevisar } from "@/components/admin/people/CiudadesARevisar";
import { PersonasTabla } from "@/components/admin/people/PersonasTabla";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { cn } from "@/lib/cn";
import { cargarPersonas } from "@/lib/people/cargar-personas";

export const dynamic = "force-dynamic";

/**
 * Toda la comunidad en una tabla: una fila por persona, con su historial.
 *
 * Complementa a Inscripciones, que es una fila por inscripción y sirve para
 * operar una edición; ésta sirve para conocer a la gente y armar acciones.
 */
export default async function PersonasPage({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string }>;
}) {
  await requireClickatonAdmin();
  const { vista } = await searchParams;
  const { personas, ediciones, localidadesDisponibles, pendientesDeUbicar, enRevision } =
    await cargarPersonas();

  const participantes = personas.filter((p) => p.ediciones > 0);
  const repitieron = participantes.filter((p) => p.ediciones >= 2).length;
  const conCumple = participantes.filter((p) => p.diasParaCumple != null);
  const proximos = [...conCumple]
    .sort((a, b) => (a.diasParaCumple ?? 0) - (b.diasParaCumple ?? 0))
    .slice(0, 5);
  const ciudades = new Set(
    participantes.map((p) => p.localidad?.ciudad ?? p.ciudad).filter(Boolean),
  ).size;
  const aRevisar = enRevision.length + (pendientesDeUbicar > 0 ? 1 : 0);

  const pestanas = [
    { clave: "personas", etiqueta: "Personas", href: adminRoutes.people },
    {
      clave: "ciudades",
      etiqueta: aRevisar > 0 ? `Ciudades a revisar (${enRevision.length + pendientesDeUbicar})` : "Ciudades",
      href: `${adminRoutes.people}?vista=ciudades`,
    },
  ];
  const activa = vista === "ciudades" ? "ciudades" : "personas";

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Personas"
        description="Todas las personas que se inscribieron alguna vez, con su historial, sus fotos y sus notas."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { valor: participantes.length, etiqueta: "participaron al menos una vez" },
          { valor: repitieron, etiqueta: "vinieron 2 o más veces" },
          { valor: ciudades, etiqueta: "ciudades distintas" },
          { valor: conCumple.length, etiqueta: "con fecha de nacimiento" },
        ].map((d) => (
          <Card key={d.etiqueta} className="p-4">
            <p className="text-3xl font-semibold text-ck-text">{d.valor}</p>
            <p className="text-sm text-ck-text-secondary">{d.etiqueta}</p>
          </Card>
        ))}
      </div>

      {proximos.length > 0 ? (
        <Card className="space-y-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ck-text-muted">
            Próximos cumpleaños
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {proximos.map((p) => (
              <li key={p.clave}>
                <Link href={`${adminRoutes.people}/${p.registrationId}`} className="font-medium hover:text-ck-yellow">
                  {p.nombre}
                </Link>{" "}
                <span className="text-ck-text-muted">
                  {p.diasParaCumple === 0 ? "¡hoy!" : `en ${p.diasParaCumple} días`}
                  {p.edad != null ? ` · cumple ${p.edad + (p.diasParaCumple === 0 ? 0 : 1)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <nav aria-label="Vistas" className="flex gap-2 border-b border-ck-border">
        {pestanas.map((t) => (
          <Link
            key={t.clave}
            href={t.href}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm",
              activa === t.clave
                ? "border-ck-yellow font-semibold text-ck-text"
                : "border-transparent text-ck-text-secondary hover:text-ck-text",
            )}
          >
            {t.etiqueta}
          </Link>
        ))}
      </nav>

      {activa === "ciudades" ? (
        localidadesDisponibles ? (
          <CiudadesARevisar enRevision={enRevision} pendientesDeUbicar={pendientesDeUbicar} />
        ) : (
          <Card variant="outlined" className="p-6">
            <p className="text-sm text-ck-text-secondary">
              Falta crear la tabla de localidades en la base (migración
              20260925180000_clickaton_localities). Hasta entonces la tabla de personas funciona,
              pero sin mapa.
            </p>
          </Card>
        )
      ) : (
        <PersonasTabla personas={personas} ediciones={ediciones} />
      )}
    </div>
  );
}
