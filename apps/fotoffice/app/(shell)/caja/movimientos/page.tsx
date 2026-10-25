import { PageHeader } from "@/components/page-header";
import { Listado } from "@/components/listado/listado";
import { requireCashViewer } from "@/lib/cash/access";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { listadoMovimientos } from "@/lib/cash/listado-movimientos";
import { listAccounts, listCategories } from "@/lib/cash/repository";
import { listClients } from "@/lib/clients/repository";
import { contextoListadoDePagina } from "@/lib/listado/acceso";
import { MovementForm } from "../movement-form";
import { canHandleProjectMoney, listMoneyProjects } from "@/lib/governance/money-server";

export const dynamic = "force-dynamic";

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Ver el libro pide VIEW en Caja; cargar y anular, MANAGE (`canOperate`).
  const { workspace, canOperate, user } = await requireCashViewer();
  const proyectosConPlata =
    canOperate && (await canHandleProjectMoney(user.id, workspace.id)) ? await listMoneyProjects(workspace.id) : [];
  const sp = await searchParams;
  const error = typeof sp.error === "string" ? sp.error : null;
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const ctx = await contextoListadoDePagina(user, workspace, CASH_MODULE_KEY);
  // Sin MANAGE no se ofrece anular por fila (la acción igual rebota en el servidor).
  const definicion = canOperate
    ? listadoMovimientos
    : { ...listadoMovimientos, columnas: listadoMovimientos.columnas.filter((c) => c.clave !== "acciones") };

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
      {canOperate ? (
        <MovementForm accounts={cuentas} categories={categorias} clients={clientes} returnTo="/caja/movimientos" projects={proyectosConPlata} />
      ) : null}

      <Listado def={definicion} ctx={ctx} ruta="/caja/movimientos" searchParams={sp} />
    </div>
  );
}
