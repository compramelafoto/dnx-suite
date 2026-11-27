import { isSuperAdmin } from "@repo/auth-guards";
import { notFound } from "next/navigation";
import { getPortalUser } from "@/lib/guards";
import { getAccountForAdmin, listActiveBlocks } from "@/lib/usuarios/bloqueo";
import { listOpenUserReports } from "@/lib/usuarios/reportes";
import { Aviso, Boton, Campo, Pagina } from "@/app/_ui";
import { buscarCuenta } from "./actions";
import { BloquearCuenta, DesbloquearCuenta, ResolverReporte } from "./AccionesUsuario";

export const dynamic = "force-dynamic";

const fecha = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

const persona = (p: { name: string | null; email: string }) => `${p.name ?? "(sin nombre)"} · ${p.email}`;

export default async function UsuariosAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ usuario?: string; buscar?: string }>;
}) {
  const user = await getPortalUser();
  if (!user || !(await isSuperAdmin(user))) notFound();

  const sp = await searchParams;
  const usuarioId = Number(sp.usuario);
  const [reportes, bloqueos, cuenta] = await Promise.all([
    listOpenUserReports(),
    listActiveBlocks(),
    Number.isInteger(usuarioId) && usuarioId > 0 ? getAccountForAdmin(usuarioId) : Promise.resolve(null),
  ]);

  return (
    <Pagina titulo="Usuarios" ancho="ancha" volver={{ href: "/admin", texto: "Administración" }}>
      <div className="pila">
        <section className="superficie pila" aria-labelledby="buscar">
          <h2 id="buscar" className="ficha-subtitulo">
            Buscar una cuenta para bloquear
          </h2>
          <form action={buscarCuenta} className="formulario">
            <Campo etiqueta="Correo de la cuenta">
              <input className="control" type="email" name="email" required autoComplete="off" />
            </Campo>
            <div className="acciones">
              <Boton variante="secundario">Buscar</Boton>
            </div>
          </form>
          {sp.buscar === "sin-resultado" ? (
            <Aviso tipo="error">No hay ninguna cuenta con ese correo.</Aviso>
          ) : null}
          {sp.usuario && !cuenta ? <Aviso tipo="error">No encontramos esa cuenta.</Aviso> : null}
          {cuenta ? (
            <div className="pila" aria-label={`Cuenta ${cuenta.id}`}>
              <dl className="documento-datos">
                <dt>Cuenta</dt>
                <dd>
                  #{cuenta.id} · {persona(cuenta)}
                </dd>
                <dt>Estado</dt>
                <dd>{cuenta.blocked ? "Bloqueada" : "Activa"}</dd>
              </dl>
              {cuenta.blocked ? (
                <DesbloquearCuenta userId={cuenta.id} />
              ) : cuenta.id === user.id ? (
                <p className="texto-secundario">Es tu propia cuenta: no se puede bloquear.</p>
              ) : (
                <BloquearCuenta userId={cuenta.id} />
              )}
            </div>
          ) : null}
        </section>

        <h2 className="ficha-subtitulo">Reportes sin resolver</h2>
        {reportes.length === 0 && <p className="texto-secundario">No hay reportes pendientes.</p>}
        {reportes.map((r) => (
          <section key={r.id} className="superficie pila" aria-label={`Reporte ${r.id}`}>
            <dl className="documento-datos">
              <dt>Reportó</dt>
              <dd>{persona(r.reporter)}</dd>
              <dt>Reportada</dt>
              <dd>
                {persona(r.reported)}
                {r.reported.blocked ? " (bloqueada)" : ""}
              </dd>
              <dt>Motivo</dt>
              <dd className="texto-multilinea">{r.reason}</dd>
              <dt>Contexto</dt>
              <dd>{r.context ?? "sin contexto"}</dd>
              <dt>Fecha</dt>
              <dd>{fecha.format(r.createdAt)}</dd>
            </dl>
            {r.reported.blocked ? null : (
              <p>
                <a href={`/admin/usuarios?usuario=${r.reported.id}`}>Bloquear a la persona reportada</a>
              </p>
            )}
            <ResolverReporte userId={r.reported.id} reportId={r.id} />
          </section>
        ))}

        <h2 className="ficha-subtitulo">Cuentas bloqueadas</h2>
        {bloqueos.length === 0 && <p className="texto-secundario">No hay cuentas bloqueadas.</p>}
        {bloqueos.map((b) => (
          <section key={b.userId} className="superficie pila" aria-label={`Bloqueo de la cuenta ${b.userId}`}>
            <dl className="documento-datos">
              <dt>Cuenta</dt>
              <dd>
                #{b.userId} · {persona(b)}
              </dd>
              <dt>Motivo interno</dt>
              <dd className="texto-multilinea">{b.reason}</dd>
              <dt>Desde</dt>
              <dd>{fecha.format(b.createdAt)}</dd>
            </dl>
            <DesbloquearCuenta userId={b.userId} />
          </section>
        ))}
      </div>
    </Pagina>
  );
}
