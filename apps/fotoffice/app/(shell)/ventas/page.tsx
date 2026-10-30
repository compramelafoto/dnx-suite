import { PageHeader } from "@/components/page-header";
import { leerCatalogoFotolibro } from "@/lib/fotolibro/catalogo-precios";
import { requireSalesStaff } from "@/lib/sales/access";
import { listProductCategories, listProducts } from "@/lib/sales/repository";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { listAccounts, listCategories } from "@/lib/cash/repository";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { leerAjustesCobro } from "@/lib/cobro-ajustes/ajustes";
import { prisma } from "@repo/db";
import { contextoDePedidos } from "@/lib/pedidos/contexto";
import { proyectosEncendidos } from "@/lib/proyectos/crear";
import { Pos } from "./pos";
import { hayCopiasDeLaboratorio } from "@/lib/impresion/laboratorio-servidor";
import { leerAgregarAlAbrir } from "@/lib/sales/agregar-al-abrir";
import { leerQrMostrador } from "@/lib/sales/qr-mp-servidor";
import { esDuenoOAdmin, leerReglas, miComision, productosConComision } from "@/lib/comisiones/servidor";

export const dynamic = "force-dynamic";

/**
 * La caja de kiosco. Se usa con gente esperando del otro lado del mostrador, así que acá se
 * arma todo lo que la pantalla necesita de una sola vez —catálogo, categorías, y clientes
 * sólo si ese módulo está prendido— y el resto es trabajo del cliente (`pos.tsx`): agregar y
 * cobrar no pueden depender de ida y vuelta al servidor por cada clic.
 */
export default async function VentasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspace, user, canEditCatalog } = await requireSalesStaff();
  // Lo que manda a cobrar otra pantalla (el diseñador de polaroids): `?agregar=SKU*cantidad,…`.
  const agregarAlAbrir = leerAgregarAlAbrir((await searchParams).agregar);

  const clientsEnabled = await isModuleEnabledForWorkspace(workspace.id, CLIENTS_MODULE_KEY);
  // Sólo para el cartel fijo de "esto no se va a depositar": `recordSale` vuelve a preguntar
  // esto mismo antes de escribir (nunca confía en lo que decidió la pantalla), así que acá no
  // es control de acceso — es avisarle al mostrador de antemano, no después del hecho.
  const cashEnabled = await isModuleEnabledForWorkspace(workspace.id, CASH_MODULE_KEY);

  // Egresos desde el mostrador: sólo para quien puede operar la caja (como Caja → Anotar).
  const puedeEgresos = cashEnabled && hasLevel(await getModuleLevel(user.id, workspace.id, CASH_MODULE_KEY), "MANAGE");

  // Foto carnet desde el ticket: buscar y dar de alta clientes, igual que en Ventas → Foto carnet.
  const nivelClientes = clientsEnabled ? await getModuleLevel(user.id, workspace.id, CLIENTS_MODULE_KEY) : "NONE";

  // Trabajos con proceso (copias a laboratorio, fotolibros, rollos, digitalizaciones): los productos
  // con un flujo en "Proyecto que genera". Sólo si se pueden crear pedidos y proyectos; si no, el
  // Mostrador vende todo como hasta ahora.
  const puedeCrearPedidos = (await contextoDePedidos("operar")) !== null;
  const pedidosHabilitados = puedeCrearPedidos && (await proyectosEncendidos(workspace.id));
  // «Seña» en un renglón sin proceso: alcanza con poder crear pedidos (el pedido necesita un
  // cliente, por eso Clientes). No pide Proyectos: con ese módulo apagado el pedido y la seña se
  // registran igual, sólo que sin trabajo ni tablero (lo dice la guía de diseño).
  const senaHabilitada = puedeCrearPedidos && clientsEnabled;
  const reglas = pedidosHabilitados
    ? await prisma.fotofficeProductoProyecto.findMany({
        where: { workspaceId: workspace.id },
        select: { productId: true, plazoDias: true, ultimoPlazoDias: true },
      })
    : [];
  // Plazo sugerido por producto: el último que se usó, si no el configurado; el mayor si hay varios.
  const procesos: Record<string, number | null> = {};
  for (const r of reglas) {
    const dias = r.ultimoPlazoDias ?? r.plazoDias;
    const previo = procesos[r.productId];
    procesos[r.productId] = previo === undefined ? dias : dias === null ? previo : Math.max(previo ?? 0, dias);
  }

  // Los clientes ya no viajan todos: el mostrador los busca por cualquier dato al tipear.
  const [productos, categorias, cuentas, categoriasEgreso, ajustesCobro, qr] = await Promise.all([
    listProducts(workspace.id, { onlyActive: true, onlyCounter: true }),
    listProductCategories(workspace.id),
    puedeEgresos ? listAccounts(workspace.id) : Promise.resolve([]),
    puedeEgresos ? listCategories(workspace.id, "EGRESO") : Promise.resolve([]),
    // Los mismos datos para transferir que muestra el enlace de pago de un pedido.
    leerAjustesCobro(workspace.id),
    leerQrMostrador(workspace.id),
  ]);

  // Comisión de venta: el cartel verde lo ven quien cobra comisión y el dueño; el acumulado, sólo quien cobra.
  const reglasActivas = (await leerReglas(workspace.id)).filter((r) => r.activa);
  const mia = reglasActivas.some((r) => r.userId === user.id) ? await miComision(workspace.id, user.id) : null;
  const comision =
    reglasActivas.length > 0 && (mia || (await esDuenoOAdmin(user.id, workspace.id)))
      ? { porcentaje: mia?.porcentaje ?? Math.max(...reglasActivas.map((r) => r.porcentaje)), productIds: await productosConComision(workspace.id), mia }
      : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Mostrador" description="Tocá los productos, elegí cómo paga y cobrá." />
      <Pos
        products={productos}
        categories={categorias}
        clientsEnabled={clientsEnabled}
        cashEnabled={cashEnabled}
        procesos={procesos}
        senaHabilitada={senaHabilitada}
        qrActivo={qr.activo}
        comision={comision}
        agregarAlAbrir={agregarAlAbrir}
        hayCopiasLab={await hayCopiasDeLaboratorio(workspace.id).catch(() => false)}
        fotolibro={await leerCatalogoFotolibro(workspace.id, { conCostos: canEditCatalog }).then((catalogo) => (catalogo ? { catalogo, verCostos: canEditCatalog } : null))}
        permisosCarnet={{ puedeBuscarClientes: hasLevel(nivelClientes, "VIEW"), puedeAltaCliente: hasLevel(nivelClientes, "MANAGE") }}
        egresos={
          puedeEgresos
            ? {
                cuentas: cuentas.map((c) => ({ id: c.id, nombre: c.name, efectivo: c.kind === "EFECTIVO" && !c.isVault, predeterminada: c.isDefault })),
                categorias: categoriasEgreso.map((c) => ({ id: c.id, nombre: c.name })),
              }
            : null
        }
        datosTransferencia={{
          alias: ajustesCobro.alias,
          cbuCvu: ajustesCobro.cbuCvu,
          titular: ajustesCobro.titular,
          cuit: ajustesCobro.cuit,
          banco: ajustesCobro.banco,
        }}
      />
    </div>
  );
}
