import { PageHeader } from "@/components/page-header";
import { DigitalizarDvd } from "@/components/digitalizacion/dvd";
import { Estacion, type Continuacion, type Preseleccion } from "@/components/digitalizacion/estacion";
import { requireDigitalizacion } from "@/lib/digitalizacion/contexto";
import { leerAjustes, leerGrabacionParaContinuar, listarEquipos } from "@/lib/digitalizacion/servidor/grabaciones";
import { trabajoParaGrabar } from "@/lib/digitalizacion/servidor/trabajo";

export const dynamic = "force-dynamic";

export default async function GrabarPage({ searchParams }: { searchParams: Promise<{ continuar?: string; proyecto?: string }> }) {
  const { workspace } = await requireDigitalizacion("MANAGE");
  const sp = await searchParams;
  const [ajustes, equipos] = await Promise.all([leerAjustes(workspace.id), listarEquipos(workspace.id)]);
  let continuar: Continuacion | null = null;
  // Sólo leer: el tramo nuevo lo pide la estación al tocar Grabar. Así recargar, volver atrás
  // o abrir otra pestaña no suma tramos vacíos.
  if (typeof sp.continuar === "string") {
    const g = await leerGrabacionParaContinuar(workspace.id, sp.continuar);
    if (g) {
      const tipo = g.tipo === "DVD" ? "DVD" : "VHS";
      continuar = {
        grabacionId: g.id, tramo: tipo === "DVD" ? 1 : g.tramos, tipo, proyectoId: g.proyectoId,
        cassetteNumero: g.cassetteNumero, calidad: g.calidad, corregirProporcion: g.corregirProporcion,
        dvdArchivos: tipo === "DVD" && Array.isArray(g.dvdArchivos) ? (g.dvdArchivos as { nombre: string; bytes: number }[]) : null,
      };
    }
  }
  // «● Grabar cassette» desde el trabajo, el pedido o el Cobrador: el trabajo llega elegido. Se
  // valida acá que sea del negocio (si no, la estación arranca como siempre, con un aviso); el
  // servidor lo vuelve a validar al crear la grabación.
  let preseleccion: Preseleccion | null = null;
  let avisoTrabajo: string | null = null;
  if (!continuar && typeof sp.proyecto === "string") {
    const t = await trabajoParaGrabar(workspace.id, sp.proyecto);
    if (t) preseleccion = { id: t.id, numero: t.numero, nombre: t.nombre, pedidoNumero: t.pedidoNumero, siguienteCassette: t.siguienteCassette };
    else avisoTrabajo = "No encontramos ese trabajo: elegilo de la lista.";
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Grabar" description="Elegí la capturadora, revisá la vista previa y grabá. Podés seguir usando la computadora mientras graba." />
      {avisoTrabajo ? <p className="fo-alert-warning p-3 text-sm">{avisoTrabajo}</p> : null}
      <Estacion
        minutosSinSenal={ajustes.minutosSinSenal}
        equipos={equipos}
        continuar={continuar}
        preseleccion={preseleccion}
        dvd={<DigitalizarDvd continuar={continuar?.tipo === "DVD" ? continuar : null} preseleccion={preseleccion} />}
      />
    </div>
  );
}
