import Link from "next/link";
import { requireAuth } from "../lib/auth";

/**
 * Área de participante: solo exige sesión User.
 * No requiere AppAccess FOTORANK ni pertenencia a ContestOrganization
 * (a diferencia del panel organizador).
 */
export default async function ParticipantLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();

  return (
    <div className="min-h-screen bg-fr-bg text-fr-primary">
      <header className="border-b border-[#1a1a1a] bg-fr-bg/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-4 py-4 md:px-6">
          <Link href="/" className="font-semibold tracking-tight text-fr-primary hover:text-gold">
            FotoRank
          </Link>
          <div className="flex items-center gap-4 text-sm text-fr-muted">
            <span className="hidden sm:inline">{user.email}</span>
            <Link href="/participaciones" className="text-gold hover:text-gold-hover">
              Mis participaciones
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-8 py-12 md:px-10 lg:px-12">{children}</main>
    </div>
  );
}
