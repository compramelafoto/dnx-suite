import Link from "next/link";
import { requireAuth } from "../lib/auth";
import { tieneCuentaDeJurado } from "../lib/fotorank/access/judge-panel-access";
import {
  PANEL_DE_JURADO_ETIQUETA,
  PANEL_DE_JURADO_HREF,
} from "../lib/fotorank/access/judge-panel-entry";

/**
 * Área de participante: solo exige sesión User.
 * No requiere AppAccess FOTORANK ni pertenencia a ContestOrganization
 * (a diferencia del panel organizador).
 */
export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  const esJurado = await tieneCuentaDeJurado(user.email);

  return (
    <div className="min-h-screen bg-fr-bg text-fr-primary">
      <header className="border-b border-[#1a1a1a] bg-fr-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-4 py-4 md:px-6">
          <Link href="/" className="font-semibold tracking-tight text-fr-primary hover:text-gold">
            FotoRank
          </Link>
          <div className="flex flex-wrap items-center gap-4 text-sm text-fr-muted">
            <span className="hidden sm:inline">{user.email}</span>
            <Link href="/mi-actividad" className="hover:text-gold">
              Mi actividad
            </Link>
            <Link href="/participaciones" className="text-gold hover:text-gold-hover">
              Mis participaciones
            </Link>
            {esJurado ? (
              <Link href={PANEL_DE_JURADO_HREF} className="hover:text-gold">
                {PANEL_DE_JURADO_ETIQUETA}
              </Link>
            ) : null}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-8 py-12 md:px-10 lg:px-12">{children}</main>
    </div>
  );
}
