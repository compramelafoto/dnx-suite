import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSalesStaff } from "@/lib/sales/access";
import { datosParaImprimirPreparacion } from "@/lib/impresion/preparaciones";
import { medidaImpresaMm } from "@/lib/impresion/medidas";
import { HojasParaImprimir } from "./hojas-para-imprimir";

export const dynamic = "force-dynamic";

/**
 * Todas las hojas vigentes de una preparación de copias en un solo documento: cada hoja repetida
 * tantas veces como copias, en páginas consecutivas del mismo tamaño. `?solo=pendientes` imprime
 * sólo lo que todavía no salió entero (por ejemplo, después de editar una foto ya impresa).
 * Si alguna hoja quedó armada en otro papel (el producto cambió de hoja), se imprime en el papel del
 * producto y esas hojas se avisan como faltantes: hay que volver a armarlas.
 */
export default async function PreparacionParaImprimirPage({
  params,
  searchParams,
}: {
  params: Promise<{ preparacionId: string }>;
  searchParams: Promise<{ solo?: string }>;
}) {
  const { workspace } = await requireSalesStaff();
  const { preparacionId } = await params;
  const { solo } = await searchParams;
  const soloPendientes = solo === "pendientes";
  const d = await datosParaImprimirPreparacion(workspace.id, preparacionId, soloPendientes);
  if (!d) notFound();
  if (!d.papel || d.hojas.length === 0) {
    return (
      <div className="mx-auto max-w-xl space-y-3 p-6 text-sm">
        {d.faltan > 0 ? (
          <p>
            Faltan armar {d.faltan} {d.faltan === 1 ? "foto" : "fotos"}. Abrí la preparación en el Mostrador y tocá «Armar hojas».
          </p>
        ) : (
          <p>No queda nada por imprimir: todo salió.</p>
        )}
        {soloPendientes && d.papel ? (
          <Link className="underline" href={`/imprimir/preparacion/${preparacionId}`}>
            Imprimir todo otra vez
          </Link>
        ) : null}
      </div>
    );
  }
  const totalHojas = d.hojas.reduce((s, h) => s + h.copias, 0);
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `@page { size: ${d.papel.anchoMm}mm ${d.papel.altoMm}mm; margin: 0; } html, body { margin: 0; padding: 0; background: #fff; } .pagina { break-after: page; } .pagina:last-child { break-after: auto; } @media print { .no-imprimir { display: none !important; } }`,
        }}
      />
      <HojasParaImprimir
        preparacionId={preparacionId}
        hojas={d.hojas}
        faltan={d.faltan}
        anchoMm={medidaImpresaMm(d.papel.anchoMm, d.papel.escalaXMil)}
        altoMm={medidaImpresaMm(d.papel.altoMm, d.papel.escalaYMil)}
        paginaAnchoMm={d.papel.anchoMm}
        paginaAltoMm={d.papel.altoMm}
        titulo={`${d.papel.salida} · ${d.papel.tamano} · ${totalHojas} ${totalHojas === 1 ? "hoja" : "hojas"}${soloPendientes ? " (lo que falta)" : ""}`}
      />
    </>
  );
}
