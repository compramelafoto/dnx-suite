import { notFound } from "next/navigation";
import { requireSalesStaff } from "@/lib/sales/access";
import { datosParaImprimir } from "@/lib/impresion/preparaciones";
import { medidaImpresaMm } from "@/lib/impresion/medidas";
import { HojaParaImprimir } from "./hoja-para-imprimir";

export const dynamic = "force-dynamic";

/** La hoja sola, al tamaño exacto en mm y sin márgenes. El cuadro de impresión se abre solo. */
export default async function HojaPage({ params }: { params: Promise<{ hojaId: string }> }) {
  const { workspace } = await requireSalesStaff();
  const { hojaId } = await params;
  const d = await datosParaImprimir(workspace.id, hojaId);
  if (!d) notFound();
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `@page { size: ${d.anchoMm}mm ${d.altoMm}mm; margin: 0; } html, body { margin: 0; padding: 0; background: #fff; } @media print { .no-imprimir { display: none !important; } }`,
        }}
      />
      <HojaParaImprimir
        hojaId={hojaId}
        src={`/api/impresion/hoja/${hojaId}`}
        anchoMm={medidaImpresaMm(d.anchoMm, d.escalaXMil)}
        altoMm={medidaImpresaMm(d.altoMm, d.escalaYMil)}
        paginaAnchoMm={d.anchoMm}
        paginaAltoMm={d.altoMm}
        copias={d.copias}
        titulo={`${d.salida} · ${d.tamano} · ${d.copias} ${d.copias === 1 ? "hoja" : "hojas"}`}
      />
    </>
  );
}
