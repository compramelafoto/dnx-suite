import { hasModuleLevel } from "@/lib/permissions/module-access";
import { WEBSITE_MODULE_KEY } from "@/lib/website/constants";
import { FALTAN_TABLAS, cargarPortfoliosDelEstudio } from "@/lib/portfolio-estudio/repositorio";
import type { PortfolioTrabajo } from "@/lib/portfolio-estudio/reglas";
import { ListaPortfolios } from "./lista-portfolios";
import { AdministrarRubros } from "./administrar-rubros";
import type { TarjetaPortfolio, VistaRubro } from "./tipos";

function tarjeta(t: PortfolioTrabajo): TarjetaPortfolio {
  // Día calendario guardado como medianoche UTC: el año se lee en UTC.
  const anio = t.fecha ? String(t.fecha.getUTCFullYear()) : "";
  return {
    id: t.id,
    titulo: t.titulo,
    detalle: [t.lugar?.trim(), anio].filter(Boolean).join(" · "),
    portadaUrl: t.portadaUrl,
    url: t.url,
    motivo: t.motivo,
  };
}

/**
 * Portfolios → Del estudio (spec 2026-11-15): los trabajos del estudio por rubro y estilo, para que
 * la vendedora abra y copie el que corresponde a cada consulta. Quien edita el sitio ve además lo
 * que todavía no se puede compartir y lo que falta etiquetar.
 */
export async function PortfoliosDelEstudio({ userId, workspaceId, puedeAdministrar }: { userId: number; workspaceId: string; puedeAdministrar: boolean }) {
  const puedeEditarTrabajos = await hasModuleLevel(userId, workspaceId, WEBSITE_MODULE_KEY, "MANAGE");
  const datos = await cargarPortfoliosDelEstudio(workspaceId, { incluirNoCompartibles: puedeEditarTrabajos });

  if (datos === FALTAN_TABLAS) {
    return (
      <section className="fo-card">
        <p className="text-sm text-[var(--fo-muted)]">Esta sección todavía no está lista en esta cuenta.</p>
      </section>
    );
  }

  const rubros: VistaRubro[] = datos.grupos.map((g) => ({
    id: g.rubro.id,
    nombre: g.rubro.nombre,
    total: g.total,
    enlaces: g.rubro.enlaces,
    estilos: g.estilos.map((e) => ({ estilo: e.estilo, trabajos: e.trabajos.map(tarjeta) })),
  }));

  return (
    <div className="space-y-6">
      {puedeAdministrar ? <AdministrarRubros rubros={datos.rubros} /> : null}
      <ListaPortfolios rubros={rubros} sinEtiquetar={puedeEditarTrabajos ? datos.sinEtiquetar.map(tarjeta) : []} />
    </div>
  );
}
