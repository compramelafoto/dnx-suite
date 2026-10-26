import Link from "next/link";
import { requireBlogEditor } from "@/lib/blog/access";
import { ESTADOS_TESTIMONIO, ETIQUETA_ESTADO_TESTIMONIO, esEstadoTestimonio, esTablaFaltante, type EstadoTestimonio } from "@/lib/testimonios/dominio";
import { fotoPublicaDelAutor } from "@/lib/testimonios/publico";
import { contarPorEstado, listarTestimonios } from "@/lib/testimonios/repositorio";
import { RUTA_PANEL_TESTIMONIOS } from "@/lib/testimonios/rutas";
import { AgregarTestimonio } from "@/components/website/testimonios/agregar-testimonio";
import { ListaTestimonios, type TestimonioDeLista } from "@/components/website/testimonios/lista-testimonios";
import { AvisoTablasTestimonios, TestimoniosShell } from "@/components/website/testimonios/testimonios-shell";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ estado?: string }> };

const VACIO: Record<EstadoTestimonio, string> = {
  PENDIENTE: "No hay testimonios esperando revisión. Los que lleguen por el formulario del sitio o por un pedido personal aparecen acá.",
  PUBLICADO: "Todavía no publicaste ningún testimonio. Revisá los pendientes o agregá uno a mano.",
  RECHAZADO: "No rechazaste ningún testimonio.",
};

async function cargar(workspaceId: string, estado: EstadoTestimonio) {
  try {
    const [filas, cuenta] = await Promise.all([listarTestimonios(workspaceId, { estado }), contarPorEstado(workspaceId)]);
    return { filas, cuenta, faltanTablas: false };
  } catch (err) {
    if (esTablaFaltante(err)) return { filas: [], cuenta: { PENDIENTE: 0, PUBLICADO: 0, RECHAZADO: 0 }, faltanTablas: true };
    throw err;
  }
}

/**
 * Sitio web → Testimonios: pendientes primero; publicar, rechazar, editar la frase destacada y el
 * detalle, destacar, ordenar arrastrando (en Publicados), borrar y agregar a mano.
 */
export default async function TestimoniosPage({ searchParams }: Props) {
  const { workspace } = await requireBlogEditor();
  const params = await searchParams;
  // Un estado inventado en la dirección vuelve a Pendientes en vez de dar una lista vacía sin explicación.
  const estado: EstadoTestimonio = esEstadoTestimonio(params.estado) ? params.estado : "PENDIENTE";
  const { filas, cuenta, faltanTablas } = await cargar(workspace.id, estado);

  if (faltanTablas) {
    return (
      <TestimoniosShell pendientes={0}>
        <AvisoTablasTestimonios />
      </TestimoniosShell>
    );
  }

  const testimonios: TestimonioDeLista[] = filas.map((t) => ({
    id: t.id,
    texto: t.texto,
    extracto: t.extracto,
    autorNombre: t.autorNombre,
    autorDetalle: t.autorDetalle,
    // Sólo se muestra una foto de nuestro almacenamiento (la misma regla que el sitio).
    autorFotoUrl: fotoPublicaDelAutor({ autorFotoUrl: t.autorFotoUrl, autorFotoKey: null }),
    autorEnlace: t.autorEnlace,
    autorEmail: t.autorEmail,
    calificacion: t.calificacion,
    estado: t.estado as EstadoTestimonio,
    consentimiento: t.consentimiento,
    consentimientoTexto: t.consentimientoTexto,
    origen: t.origen,
    destacado: t.destacado,
    creado: t.createdAt.toISOString(),
  }));

  return (
    <TestimoniosShell pendientes={cuenta.PENDIENTE}>
      <div className="space-y-4">
        <AgregarTestimonio />

        <nav className="flex flex-wrap gap-2" aria-label="Estado de los testimonios">
          {ESTADOS_TESTIMONIO.map((e) => {
            const activo = e === estado;
            return (
              <Link
                key={e}
                href={e === "PENDIENTE" ? RUTA_PANEL_TESTIMONIOS : `${RUTA_PANEL_TESTIMONIOS}?estado=${e}`}
                aria-current={activo ? "page" : undefined}
                className={`fo-btn text-sm ${activo ? "fo-btn-primary" : "fo-btn-secondary"}`}
              >
                {ETIQUETA_ESTADO_TESTIMONIO[e]}
                <span className="tabular-nums opacity-80">{cuenta[e]}</span>
              </Link>
            );
          })}
        </nav>

        {testimonios.length === 0 ? (
          <div className="fo-card py-12 text-center">
            <p className="mx-auto max-w-md text-sm leading-relaxed text-[var(--fo-muted)]">{VACIO[estado]}</p>
          </div>
        ) : (
          <ListaTestimonios key={estado} estado={estado} testimonios={testimonios} />
        )}
      </div>
    </TestimoniosShell>
  );
}
