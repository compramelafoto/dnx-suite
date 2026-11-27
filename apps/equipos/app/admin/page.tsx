import { isSuperAdmin } from "@repo/auth-guards";
import { notFound } from "next/navigation";
import { Fragment } from "react";
import { portalStats, type PortalStats } from "@/lib/admin/estadisticas";
import { getPortalUser } from "@/lib/guards";
import { Pagina } from "@/app/_ui";

export const dynamic = "force-dynamic";

const GRUPOS: Array<{ titulo: string; filas: Array<[keyof PortalStats, string]> }> = [
  {
    titulo: "Personas",
    filas: [
      ["identidadesAprobadas", "Identidades aprobadas"],
      ["telefonosVerificados", "Teléfonos verificados"],
      ["cuentasBloqueadas", "Cuentas bloqueadas"],
    ],
  },
  {
    titulo: "Publicaciones",
    filas: [
      ["publicadas", "Publicadas"],
      ["enRevision", "En revisión"],
      ["pausadas", "Pausadas"],
      ["vendidas", "Vendidas"],
    ],
  },
  {
    titulo: "Movimiento",
    filas: [
      ["ventasConfirmadas", "Ventas confirmadas"],
      ["contactos30d", "Contactos de los últimos 30 días"],
      ["favoritos", "Favoritos guardados"],
      ["alertasActivas", "Alertas activas"],
      ["pedidosActivos", "Pedidos «Busco» activos"],
    ],
  },
];

const SECCIONES = [
  { href: "/admin/verificaciones", titulo: "Verificaciones", detalle: "Identidades en revisión manual." },
  {
    href: "/admin/publicaciones",
    titulo: "Publicaciones",
    detalle: "Publicaciones en revisión, reportes de publicaciones y consultas de serie.",
  },
  {
    href: "/admin/usuarios",
    titulo: "Usuarios",
    detalle: "Reportes entre personas y bloqueo de cuentas.",
  },
] as const;

export default async function AdminPage() {
  const user = await getPortalUser();
  if (!user || !(await isSuperAdmin(user))) notFound();

  const stats = await portalStats();

  return (
    <Pagina titulo="Administración" ancho="ancha">
      <div className="pila">
        <ul className="lista-texto">
          {SECCIONES.map((s) => (
            <li key={s.href}>
              <a href={s.href}>{s.titulo}</a> — {s.detalle}
            </li>
          ))}
        </ul>

        {GRUPOS.map((g) => (
          <section key={g.titulo} className="superficie pila" aria-label={g.titulo}>
            <h2 className="ficha-subtitulo">{g.titulo}</h2>
            <dl className="documento-datos">
              {g.filas.map(([clave, texto]) => (
                <Fragment key={clave}>
                  <dt>{texto}</dt>
                  <dd className="cifra">{stats[clave].toLocaleString("es-AR")}</dd>
                </Fragment>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </Pagina>
  );
}
