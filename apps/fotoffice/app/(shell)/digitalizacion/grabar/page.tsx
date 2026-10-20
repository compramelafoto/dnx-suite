import { PageHeader } from "@/components/page-header";
import { DigitalizarDvd } from "@/components/digitalizacion/dvd";
import { Estacion, type Continuacion } from "@/components/digitalizacion/estacion";
import { contextoDigitalizacion, requireDigitalizacion } from "@/lib/digitalizacion/contexto";
import { continuarGrabacion, leerAjustes, listarEquipos } from "@/lib/digitalizacion/servidor/grabaciones";

export const dynamic = "force-dynamic";

export default async function GrabarPage({ searchParams }: { searchParams: Promise<{ continuar?: string }> }) {
  const { workspace } = await requireDigitalizacion("MANAGE");
  const sp = await searchParams;
  const [ajustes, equipos] = await Promise.all([leerAjustes(workspace.id), listarEquipos(workspace.id)]);
  let continuar: Continuacion | null = null;
  if (typeof sp.continuar === "string") {
    const ctx = await contextoDigitalizacion("MANAGE");
    const r = ctx ? await continuarGrabacion(ctx, sp.continuar) : null;
    if (r?.ok) continuar = { grabacionId: sp.continuar, tramo: r.tramo, tipo: r.tipo, proyectoId: r.proyectoId, cassetteNumero: r.cassetteNumero, calidad: r.calidad, corregirProporcion: r.corregirProporcion };
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Grabar" description="Elegí la capturadora, revisá la vista previa y grabá. Podés seguir usando la computadora mientras graba." />
      <Estacion
        minutosSinSenal={ajustes.minutosSinSenal}
        equipos={equipos}
        continuar={continuar}
        dvd={<DigitalizarDvd continuar={continuar?.tipo === "DVD" ? continuar : null} />}
      />
    </div>
  );
}
