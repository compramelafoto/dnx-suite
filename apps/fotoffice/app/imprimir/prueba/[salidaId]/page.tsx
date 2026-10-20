import { notFound } from "next/navigation";
import { requireSalesAdmin } from "@/lib/sales/access";
import { listarSalidas } from "@/lib/impresion/configuracion";
import { COLORES_PRUEBA, GRISES, colorDeGris, marcasDeRegla, origenCentrado } from "@/lib/impresion/hoja-prueba";
import { PruebaCliente } from "./prueba-cliente";

export const dynamic = "force-dynamic";

/**
 * Hoja de prueba: reglas de 100 mm, marco de seguridad, grises y colores. Se imprime SIN
 * corrección de escala: lo que se mide en el papel es justamente el error de la impresora.
 */
export default async function PruebaPage({
  params,
  searchParams,
}: {
  params: Promise<{ salidaId: string }>;
  searchParams: Promise<{ tamano?: string }>;
}) {
  const { workspace } = await requireSalesAdmin();
  const { salidaId } = await params;
  const { tamano: tamanoId } = await searchParams;
  if (!tamanoId) notFound();
  const salidas = await listarSalidas(workspace.id);
  const salida = salidas.find((s) => s.id === salidaId);
  const tamano = salida?.tamanos.find((t) => t.id === tamanoId);
  if (!salida || !tamano) notFound();

  const ancho = tamano.anchoMm;
  const alto = tamano.altoMm;
  const marcas = marcasDeRegla();
  const x0 = origenCentrado(ancho);
  const y0 = origenCentrado(alto);
  // Las reglas no entran en tamaños menores a 100 mm: se muestran igual, recortadas por la hoja.
  const yRegla = 12;
  const xRegla = 12;
  const yParches = alto - 24;

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `@page { size: ${ancho}mm ${alto}mm; margin: 0; } html, body { margin: 0; padding: 0; background: #fff; } @media print { .no-imprimir { display: none !important; } }`,
        }}
      />
      <PruebaCliente salidaId={salida.id} tamanoId={tamano.id} />
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={`${ancho}mm`}
        height={`${alto}mm`}
        viewBox={`0 0 ${ancho} ${alto}`}
        style={{ display: "block" }}
        fontFamily="Arial, sans-serif"
      >
        <rect x={0} y={0} width={ancho} height={alto} fill="#fff" />
        <rect x={3} y={3} width={ancho - 6} height={alto - 6} fill="none" stroke="#000" strokeWidth={0.2} />

        {/* Regla horizontal, centrada arriba */}
        <g transform={`translate(${x0} ${yRegla})`} stroke="#000">
          <line x1={0} y1={0} x2={100} y2={0} strokeWidth={0.3} />
          {marcas.map((m) => (
            <line key={m.pos} x1={m.pos} y1={0} x2={m.pos} y2={m.largo} strokeWidth={0.1} />
          ))}
          {marcas.filter((m) => m.numero !== null).map((m) => (
            <text key={m.pos} x={m.pos} y={7.5} fontSize={2.2} textAnchor="middle" fill="#000" stroke="none">{m.numero}</text>
          ))}
        </g>

        {/* Regla vertical, centrada a la izquierda */}
        <g transform={`translate(${xRegla} ${y0})`} stroke="#000">
          <line x1={0} y1={0} x2={0} y2={100} strokeWidth={0.3} />
          {marcas.map((m) => (
            <line key={m.pos} x1={0} y1={m.pos} x2={m.largo} y2={m.pos} strokeWidth={0.1} />
          ))}
          {marcas.filter((m) => m.numero !== null).map((m) => (
            <text key={m.pos} x={7} y={m.pos + 0.8} fontSize={2.2} textAnchor="start" fill="#000" stroke="none">{m.numero}</text>
          ))}
        </g>

        {/* Grises de 0 a 100 % */}
        <g>
          {GRISES.map((g, i) => (
            <g key={g}>
              <rect x={6 + i * 9} y={yParches} width={8} height={8} fill={colorDeGris(g)} stroke="#000" strokeWidth={0.05} />
              <text x={10 + i * 9} y={yParches - 1} fontSize={2} textAnchor="middle" fill="#000">{g}</text>
            </g>
          ))}
        </g>
        {/* Colores */}
        <g>
          {COLORES_PRUEBA.map((c, i) => (
            <rect key={c.nombre} x={6 + i * 9} y={yParches + 9} width={8} height={8} fill={c.css} stroke="#000" strokeWidth={0.05}>
              <title>{c.nombre}</title>
            </rect>
          ))}
        </g>

        <text x={ancho / 2} y={alto - 5} fontSize={2.4} textAnchor="middle" fill="#000">
          Medí las líneas de 100 mm y cargá lo que midan en Ventas → Impresión
        </text>
        <text x={ancho / 2} y={alto - 8} fontSize={2} textAnchor="middle" fill="#555">
          {salida.nombre} · {tamano.nombre}
        </text>
      </svg>
    </>
  );
}
