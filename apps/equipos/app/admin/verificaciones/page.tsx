import { isSuperAdmin } from "@repo/auth-guards";
import { prisma } from "@repo/db";
import { getPortalUser } from "@/lib/guards";
import { Pagina } from "@/app/_ui";
import { DecisionForm } from "./DecisionForm";

export const dynamic = "force-dynamic";

export default async function VerificacionesEnRevisionPage() {
  const user = await getPortalUser();
  if (!user || !(await isSuperAdmin(user))) {
    return (
      <Pagina
        titulo="No autorizado"
        bajada="Esta pantalla es sólo para quienes administran el portal."
      >
        {null}
      </Pagina>
    );
  }

  // Sólo filas de verificación en revisión: la base se comparte con CLF y no se expone nada más.
  const filas = await prisma.identityVerification.findMany({
    where: { status: "IN_REVIEW" },
    orderBy: { updatedAt: "asc" },
    select: {
      id: true,
      providerRef: true,
      rejectionReason: true,
      updatedAt: true,
      user: { select: { email: true, name: true } },
    },
  });

  const clfUrl = process.env.CLF_URL?.replace(/\/+$/, "");
  const fecha = new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  });

  return (
    <Pagina titulo="Verificaciones en revisión" ancho="ancha">
      <div className="pila">
        <p>
          <a href="/admin/publicaciones">Ver publicaciones en revisión</a>
        </p>
        {clfUrl && (
          <p>
            <a href={`${clfUrl}/admin/equipos-robados`}>Ver denuncias de equipos robados</a>
          </p>
        )}
        {filas.length === 0 && (
          <p className="texto-secundario">No hay verificaciones pendientes.</p>
        )}
        {filas.map((f) => (
          <section key={f.id} className="superficie pila" aria-label={f.user.name ?? f.user.email}>
            <div className="paso-cabecera">
              <h2 className="ficha-subtitulo">{f.user.name ?? "(sin nombre)"}</h2>
              <span className="estado estado-revision">En revisión</span>
            </div>
            <dl className="documento-datos">
              <dt>Correo</dt>
              <dd>{f.user.email}</dd>
              <dt>En revisión desde</dt>
              <dd>{fecha.format(f.updatedAt)}</dd>
              <dt>Motivo del proveedor</dt>
              <dd>{f.rejectionReason ?? "sin detalle"}</dd>
              <dt>Sesión del proveedor</dt>
              <dd>{f.providerRef ?? "sin referencia"}</dd>
            </dl>
            <DecisionForm id={f.id} />
          </section>
        ))}
      </div>
    </Pagina>
  );
}
