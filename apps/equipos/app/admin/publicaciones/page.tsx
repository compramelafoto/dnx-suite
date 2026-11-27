import { isSuperAdmin } from "@repo/auth-guards";
import { prisma } from "@repo/db";
import { notFound } from "next/navigation";
import { getPortalUser } from "@/lib/guards";
import { Pagina } from "@/app/_ui";
import { AccionesReporte } from "./AccionesReporte";
import { DecisionPublicacionForm } from "./DecisionPublicacionForm";

export const dynamic = "force-dynamic";

const ESTADOS: Record<string, string> = {
  DRAFT: "Borrador",
  IN_REVIEW: "En revisión",
  PUBLISHED: "Publicada",
  PAUSED: "Pausada",
  SOLD: "Vendida",
  CLOSED: "Cerrada",
};

const DIAS_30 = 30 * 24 * 3600 * 1000;

export default async function PublicacionesAdminPage() {
  const user = await getPortalUser();
  if (!user || !(await isSuperAdmin(user))) notFound();

  const desde = new Date(Date.now() - DIAS_30);
  const [publicadas, enRevisionCuenta, contactos, enRevision, reportes, consultas] = await Promise.all([
    prisma.gearListing.count({ where: { status: "PUBLISHED" } }),
    prisma.gearListing.count({ where: { status: "IN_REVIEW" } }),
    prisma.gearListingContact.count({ where: { createdAt: { gte: desde } } }),
    prisma.gearListing.findMany({
      where: { status: "IN_REVIEW" },
      orderBy: { updatedAt: "asc" },
      select: {
        id: true,
        make: true,
        model: true,
        reviewNote: true,
        updatedAt: true,
        seller: { select: { email: true, name: true } },
      },
    }),
    prisma.gearListingFlag.findMany({
      where: { resolvedAt: null },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        listingId: true,
        reason: true,
        createdAt: true,
        listing: { select: { make: true, model: true, status: true } },
        reporter: { select: { email: true, name: true } },
      },
    }),
    prisma.gearSerialLookup.findMany({
      where: { matchedReportId: { not: null }, createdAt: { gte: desde } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        serialNormalized: true,
        matchedReportId: true,
        createdAt: true,
        user: { select: { email: true, name: true } },
      },
    }),
  ]);

  const fecha = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  return (
    <Pagina titulo="Publicaciones" ancho="ancha">
      <div className="pila">
        <p>
          <a href="/admin/verificaciones">Ver verificaciones en revisión</a>
        </p>

        <section className="superficie pila" aria-label="Conteos">
          <dl className="documento-datos">
            <dt>Publicadas</dt>
            <dd>{publicadas}</dd>
            <dt>En revisión</dt>
            <dd>{enRevisionCuenta}</dd>
            <dt>Contactos de los últimos 30 días</dt>
            <dd>{contactos}</dd>
          </dl>
        </section>

        <h2 className="ficha-subtitulo">En revisión</h2>
        {enRevision.length === 0 && (
          <p className="texto-secundario">No hay publicaciones en revisión.</p>
        )}
        {enRevision.map((l) => (
          <section key={l.id} className="superficie pila" aria-label={`Publicación ${l.id}`}>
            <div className="paso-cabecera">
              <h3 className="ficha-subtitulo">
                #{l.id} · {l.make} {l.model}
              </h3>
              <span className="estado estado-revision">En revisión</span>
            </div>
            <dl className="documento-datos">
              <dt>Vendedor</dt>
              <dd>
                {l.seller.name ?? "(sin nombre)"} · {l.seller.email}
              </dd>
              <dt>Motivo interno</dt>
              <dd className="texto-multilinea">{l.reviewNote ?? "sin detalle"}</dd>
              <dt>En revisión desde</dt>
              <dd>{fecha.format(l.updatedAt)}</dd>
            </dl>
            <p>
              <a href={`/equipos/${l.id}`}>Ver la publicación</a>
            </p>
            <DecisionPublicacionForm id={l.id} />
          </section>
        ))}

        <h2 className="ficha-subtitulo">Reportes sin resolver</h2>
        {reportes.length === 0 && <p className="texto-secundario">No hay reportes pendientes.</p>}
        {reportes.map((f) => (
          <section key={f.id} className="superficie pila" aria-label={`Reporte ${f.id}`}>
            <dl className="documento-datos">
              <dt>Publicación</dt>
              <dd>
                <a href={`/equipos/${f.listingId}`}>
                  #{f.listingId} · {f.listing.make} {f.listing.model}
                </a>
              </dd>
              <dt>Reportó</dt>
              <dd>
                {f.reporter.name ?? "(sin nombre)"} · {f.reporter.email}
              </dd>
              <dt>Motivo</dt>
              <dd className="texto-multilinea">{f.reason}</dd>
              <dt>Estado de la publicación</dt>
              <dd>{ESTADOS[f.listing.status] ?? f.listing.status}</dd>
              <dt>Fecha</dt>
              <dd>{fecha.format(f.createdAt)}</dd>
            </dl>
            <AccionesReporte
              listingId={f.listingId}
              flagId={f.id}
              puedeRevisar={f.listing.status === "PUBLISHED" || f.listing.status === "PAUSED"}
            />
          </section>
        ))}

        <h2 className="ficha-subtitulo">Consultas de serie con coincidencia (30 días)</h2>
        {consultas.length === 0 && (
          <p className="texto-secundario">No hubo consultas con coincidencia.</p>
        )}
        {consultas.map((c) => (
          <section key={c.id} className="superficie pila" aria-label={`Consulta ${c.id}`}>
            <dl className="documento-datos">
              <dt>Usuario</dt>
              <dd>
                {c.user.name ?? "(sin nombre)"} · {c.user.email}
              </dd>
              <dt>Serie</dt>
              <dd>{c.serialNormalized}</dd>
              <dt>Denuncia</dt>
              <dd>#{c.matchedReportId}</dd>
              <dt>Fecha</dt>
              <dd>{fecha.format(c.createdAt)}</dd>
            </dl>
          </section>
        ))}
      </div>
    </Pagina>
  );
}
