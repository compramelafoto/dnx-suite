import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { MiniaturaDeEnvio } from "@/components/admin/admission/MiniaturaDeEnvio";
import { DescargarTodas } from "@/components/admin/people/DescargarTodas";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { prisma } from "@/lib/admin/db";
import { nombreDelPremio } from "@/lib/edition-results/armar-resultados";
import { cargarResultadosDeEdicion } from "@/lib/edition-results/cargar-resultados";

export const dynamic = "force-dynamic";

/** Las entregas que llegaron a guardarse: las demás no tienen archivo. */
const CON_ARCHIVO = [
  "UPLOADED",
  "PROCESSING",
  "READY_FOR_REVIEW",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "REJECTED",
] as const;

const ESTADO_DE_FOTO: Record<string, string> = {
  CONFIRMED: "Entregada",
  REJECTED: "Rechazada",
  PENDING_CONFIRMATION: "Sin confirmar",
  READY_FOR_REVIEW: "En revisión",
  UPLOADED: "Subida",
  PROCESSING: "Procesando",
};

/**
 * La carpeta de una persona: todas sus fotos de todas las ediciones, para
 * mirarlas, bajarlas y —si lo autorizó— publicarlas en redes.
 *
 * La URL lleva cualquiera de sus inscripciones; la persona es su email.
 */
export default async function FichaDePersonaPage({
  params,
}: {
  params: Promise<{ registrationId: string }>;
}) {
  await requireClickatonAdmin();
  const { registrationId } = await params;

  const ancla = await prisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    select: { email: true },
  });
  if (!ancla) notFound();

  const inscripciones = await prisma.clickatonRegistration.findMany({
    where: { email: { equals: ancla.email.trim(), mode: "insensitive" } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      editionId: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      instagramHandle: true,
      city: true,
      province: true,
      visibleCode: true,
      status: true,
      socialPublicationConsent: true,
      imageUsageConsent: true,
      edition: { select: { name: true } },
      photoSubmissions: {
        where: { status: { in: [...CON_ARCHIVO] } },
        orderBy: { prompt: { sequence: "asc" } },
        select: {
          id: true,
          status: true,
          prompt: { select: { sequence: true, title: true, titleSnapshot: true } },
        },
      },
    },
  });
  const ultima = inscripciones[0]!;

  // Notas y puestos de cada foto, con el mismo cálculo que Resultados.
  const ediciones = [...new Set(inscripciones.map((i) => i.editionId))];
  const resultados = await Promise.all(ediciones.map((id) => cargarResultadosDeEdicion(id)));
  const notaPorEnvio = new Map(
    resultados.flatMap((r) =>
      r
        ? r.filas
            .filter((f) => f.autor?.submissionId)
            .map((f) => [f.autor!.submissionId!, { fila: f, final: r.modo === "FINAL" }] as const)
        : [],
    ),
  );

  const todas = inscripciones.flatMap((i) => i.photoSubmissions.map((s) => s.id));
  const instagram = ultima.instagramHandle?.replace(/^@/, "") ?? null;
  const nombre = `${ultima.firstName} ${ultima.lastName}`.trim();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={nombre}
        description={[ultima.email, ultima.phone, [ultima.city, ultima.province].filter(Boolean).join(", ")]
          .filter(Boolean)
          .join(" · ")}
        breadcrumbs={[{ label: "Personas", href: adminRoutes.people }, { label: nombre }]}
        actions={<DescargarTodas submissionIds={todas} />}
      />

      <Card className="flex flex-wrap items-center gap-3 p-4">
        {instagram ? (
          <a
            href={`https://instagram.com/${instagram}`}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-ck-yellow hover:underline"
          >
            @{instagram}
          </a>
        ) : (
          <span className="text-sm text-ck-text-muted">Sin Instagram</span>
        )}
        {ultima.socialPublicationConsent ? (
          <Badge variant="success">Autorizó publicar sus fotos en redes</Badge>
        ) : (
          <Badge variant="danger">No autorizó publicar en redes</Badge>
        )}
        <span className="text-sm text-ck-text-secondary">
          {todas.length} {todas.length === 1 ? "foto" : "fotos"} en {inscripciones.length}{" "}
          {inscripciones.length === 1 ? "inscripción" : "inscripciones"}
        </span>
      </Card>

      {inscripciones.map((i) => (
        <section key={i.id} id={i.id} className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-lg font-semibold text-ck-text">{i.edition.name}</h2>
            <span className="text-sm text-ck-text-muted">
              {i.visibleCode ? `N.º ${i.visibleCode} · ` : ""}
              {i.status.toLowerCase()}
            </span>
            <Link
              href={`${adminRoutes.registrations}/${i.id}`}
              className="text-sm text-ck-text-secondary hover:text-ck-yellow"
            >
              Ver inscripción
            </Link>
          </div>

          {i.photoSubmissions.length === 0 ? (
            <p className="rounded-[var(--ck-radius-card)] border border-dashed border-ck-border px-4 py-6 text-center text-sm text-ck-text-muted">
              No subió fotos en esta edición.
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {i.photoSubmissions.map((s) => {
                const titulo = s.prompt.title ?? s.prompt.titleSnapshot;
                const resultado = notaPorEnvio.get(s.id);
                const premio = nombreDelPremio(resultado?.fila.premio ?? null);
                return (
                  <li
                    key={s.id}
                    className="space-y-2 rounded-[var(--ck-radius-card)] border border-ck-border bg-ck-surface p-3"
                  >
                    <MiniaturaDeEnvio
                      submissionId={s.id}
                      alt={`${nombre}, consigna ${s.prompt.sequence}`}
                      className="aspect-[4/3] w-full object-cover"
                      abreEnPestana
                    />
                    <p className="text-sm font-medium text-ck-text">
                      Consigna {s.prompt.sequence}
                      {titulo ? ` · ${titulo}` : ""}
                    </p>
                    <p className="text-xs text-ck-text-muted">
                      {ESTADO_DE_FOTO[s.status] ?? s.status}
                      {resultado?.fila.nota != null
                        ? ` · nota ${resultado.fila.nota.toLocaleString("es-AR", { maximumFractionDigits: 2 })}`
                        : ""}
                      {resultado?.fila.puesto != null
                        ? ` · puesto ${resultado.fila.puesto}${resultado.final ? "" : " (parcial)"}`
                        : ""}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {premio ? <Badge variant="brand">{premio}</Badge> : null}
                      <a
                        href={`/api/admin/submissions/${s.id}/download`}
                        className="ml-auto rounded-[var(--ck-radius-sm)] border border-ck-border px-3 py-1.5 text-xs text-ck-text-secondary hover:border-ck-yellow/60 hover:text-ck-text"
                      >
                        Descargar original
                      </a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
