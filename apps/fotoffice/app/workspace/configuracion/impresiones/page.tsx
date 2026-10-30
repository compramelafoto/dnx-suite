import Link from "next/link";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { leerAjustes } from "@/lib/impresiones/configuracion-servidor";
import { CIRCUITO_POR_OMISION } from "@/lib/impresiones/constantes";
import { pedidosPagadosSinEnviar } from "@/lib/impresiones/trabajo-servidor";
import { guardarAjustesAction } from "./actions";
import { FormularioTamanos } from "./formulario-tamanos";
import { PedidosSinEnviar } from "./pedidos-sin-enviar";

const pesos = (c: number) => (c / 100).toLocaleString("es-AR", { style: "currency", currency: "ARS" });
const fechaAr = (d: Date | null) =>
  d ? d.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

export const dynamic = "force-dynamic";

/** Pedidos de impresión: papeles, tamaños, costos y precios, y a qué circuito van los trabajos. */
export default async function ImpresionesPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const { workspace, role } = await requireActiveWorkspaceRole();
  const params = await searchParams;
  if (!puede(role, "configurar")) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader title="Impresiones" />
        <p className="text-sm text-[var(--fo-muted)]">Sólo el dueño o un administrador pueden cambiar las impresiones.</p>
      </div>
    );
  }
  const [ajustes, proveedores, circuitos, sinEnviar] = await Promise.all([
    leerAjustes(workspace.id),
    prisma.fotofficeProveedor.findMany({ where: { workspaceId: workspace.id, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.fotofficeCircuit.findMany({ where: { workspaceId: workspace.id, kind: "TRABAJO", isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    pedidosPagadosSinEnviar(workspace.id),
  ]);
  const circuitoActual = ajustes.circuitId ?? circuitos.find((c) => c.name === CIRCUITO_POR_OMISION)?.id ?? "";

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Impresiones" description="Los tamaños, costos y precios de las copias que tus clientes piden desde su carpeta." />
      {params.error ? <p className="fo-card p-4 text-sm text-[var(--fo-danger)]">{params.error}</p> : null}
      {params.ok ? <p className="fo-card p-4 text-sm text-[var(--fo-success)]">Guardado.</p> : null}
      {!ajustes.encendido ? (
        <p className="fo-card p-4 text-sm">
          El módulo de impresiones está apagado: tus clientes todavía no pueden pedir copias. Podés dejar los tamaños listos y{" "}
          <Link href="/workspace/configuracion/modulos" className="underline">
            encenderlo en Configuración → Módulos
          </Link>
          .
        </p>
      ) : null}

      {sinEnviar.length > 0 ? (
        <PedidosSinEnviar
          filas={sinEnviar.map((p) => ({ pedidoId: p.pedidoId, numero: p.numero, cliente: p.cliente, pagadoEl: fechaAr(p.pagadoEl), total: pesos(p.totalCents), deMostrador: p.deMostrador, lastError: p.lastError }))}
        />
      ) : null}

      <form action={guardarAjustesAction} className="fo-card grid gap-3 p-5">
        <h2 className="text-base font-semibold">Ajustes</h2>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="paperGlossy" defaultChecked={ajustes.papeles.includes("BRILLO")} /> Papel brillo
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="paperMatte" defaultChecked={ajustes.papeles.includes("MATE")} /> Papel mate
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="testMode" defaultChecked={ajustes.testMode} /> Modo prueba (los correos al laboratorio te llegan a vos)
        </label>
        <label className="grid gap-1 text-sm">
          Seña de los pedidos por WhatsApp (%)
          <input name="depositPct" type="number" min={1} max={100} step={1} defaultValue={ajustes.depositPct} className="fo-input w-32" />
          <span className="text-xs text-[var(--fo-muted)]">El bot le manda al cliente dos links: la seña y el total. Con la seña paga, el pedido sale al laboratorio.</span>
        </label>
        <label className="grid gap-1 text-sm">
          Circuito de los trabajos
          <select name="circuitId" defaultValue={circuitoActual} className="fo-input">
            <option value="">Por omisión ({CIRCUITO_POR_OMISION})</option>
            {circuitos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="grid gap-3 border-t border-[var(--fo-border)] pt-3">
          <legend className="pt-3 text-sm font-semibold">Envío a domicilio</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="shippingEnabled" defaultChecked={ajustes.envio.encendido} /> Ofrecer envío a domicilio
          </label>
          {!ajustes.envio.estudioUbicado ? (
            <p className="text-sm text-[var(--fo-warning)]">
              Para ofrecer envíos, cargá la ubicación de tu estudio en{" "}
              <Link href="/workspace/configuracion/precios" className="underline">
                Configuración → Precios
              </Link>
              : desde ahí se mide la distancia.
            </p>
          ) : null}
          <p className="text-xs text-[var(--fo-muted)]">
            El costo es un monto fijo más un precio por kilómetro, medido en línea recta desde tu estudio × 1,3 (sólo ida). Más lejos que la
            distancia máxima, el cliente sólo puede retirar.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1 text-sm">
              Monto fijo ($)
              <input name="shippingBaseArs" defaultValue={ajustes.envio.baseArs} inputMode="decimal" placeholder="0" className="fo-input" />
            </label>
            <label className="grid gap-1 text-sm">
              Precio por km ($)
              <input name="shippingPerKmArs" defaultValue={ajustes.envio.porKmArs} inputMode="decimal" placeholder="0" className="fo-input" />
            </label>
            <label className="grid gap-1 text-sm">
              Distancia máxima (km)
              <input name="shippingMaxKm" defaultValue={ajustes.envio.maxKm} inputMode="numeric" placeholder="Sin tope" className="fo-input" />
            </label>
          </div>
        </fieldset>
        <div>
          <button type="submit" className="fo-btn fo-btn-primary text-sm">
            Guardar ajustes
          </button>
        </div>
      </form>

      <FormularioTamanos
        inicial={ajustes.tamanos.map((t) => ({ id: t.id, widthCm: t.widthCm, heightCm: t.heightCm, proveedorId: t.proveedorId, costArs: t.costArs, priceArs: t.priceArs, active: t.active }))}
        proveedores={proveedores}
      />
    </div>
  );
}
