import Link from "next/link";
import { prisma } from "@repo/db";
import { PageHeader } from "@/components/page-header";
import { requireActiveWorkspaceRole } from "@/lib/access/active-context";
import { puede } from "@/lib/access/policy";
import { leerAjustes } from "@/lib/impresiones/configuracion-servidor";
import { CIRCUITO_POR_OMISION } from "@/lib/impresiones/constantes";
import { guardarAjustesAction } from "./actions";
import { FormularioTamanos } from "./formulario-tamanos";

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
  const [ajustes, proveedores, circuitos] = await Promise.all([
    leerAjustes(workspace.id),
    prisma.fotofficeProveedor.findMany({ where: { workspaceId: workspace.id, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.fotofficeCircuit.findMany({ where: { workspaceId: workspace.id, kind: "TRABAJO", isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
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
