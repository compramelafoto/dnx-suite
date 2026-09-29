import { PageHeader } from "@/components/page-header";
import { Listado } from "@/components/listado/listado";
import { requireCashStaff } from "@/lib/cash/access";
import { listadoMovimientos } from "@/lib/cash/listado-movimientos";
import { listAccounts, listCategories } from "@/lib/cash/repository";
import { listClients } from "@/lib/clients/repository";
import { etiquetaDeUsuario } from "@/lib/listado/acceso";
import type { ContextoListado } from "@/lib/listado/tipos";
import { MovementForm } from "../movement-form";

export const dynamic = "force-dynamic";

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { user, workspace, role } = await requireCashStaff();
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const ctx: ContextoListado = {
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    userId: user.id,
    userLabel: etiquetaDeUsuario(user),
    role,
  };

  // Sólo para el formulario de alta (lo mismo que ofrece `/caja`). El filtro por cliente de la
  // lista ya no usa esta lista: es un buscador.
  const [cuentas, categorias, clientes] = await Promise.all([
    listAccounts(workspace.id),
    listCategories(workspace.id),
    listClients(workspace.id),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader title="Movimientos" description="El libro completo, con lo que entró y salió de todas las cuentas." />

      {error ? (
        <p className="fo-card p-4 text-sm text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Listo.</p> : null}

      {/*
        Mismo formulario que el panorama de `/caja` —no hay dos maneras de cargar un
        movimiento en este módulo—, repetido acá para no obligar a saltar de pantalla cuando
        ya estás mirando el libro filtrado: `returnTo` es lo único que cambia entre los dos.
      */}
      <MovementForm accounts={cuentas} categories={categorias} clients={clientes} returnTo="/caja/movimientos" />

      <Listado def={listadoMovimientos} ctx={ctx} ruta="/caja/movimientos" searchParams={sp} />
    </div>
  );
}
