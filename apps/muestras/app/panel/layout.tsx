import type { Metadata } from "next";
import { groupedPanelSections } from "@repo/muestras";
import { BarraLateral } from "@/components/panel/barra-lateral";
import { getUsuario } from "@/lib/usuario";

export const metadata: Metadata = { robots: { index: false } };

/**
 * El panel queda debajo del encabezado público (el layout raíz lo pinta). Sin sesión no se
 * dibuja la barra: cada página llama `requireUsuario` con su propia ruta, así el ingreso vuelve
 * exactamente a donde la persona quería ir. El layout no es un control de acceso.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const usuario = await getUsuario();
  if (!usuario) return <>{children}</>;
  const grupos = groupedPanelSections({ isSuperAdmin: usuario.esSuperAdmin });
  return (
    <div className="mf-marco grid gap-x-12 pb-20 lg:grid-cols-[13rem_minmax(0,1fr)]">
      <BarraLateral grupos={grupos} nombre={usuario.name ?? usuario.email} />
      <div className="min-w-0 pt-6 lg:pt-10">{children}</div>
    </div>
  );
}
