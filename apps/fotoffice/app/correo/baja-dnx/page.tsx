import type { Metadata } from "next";
import { leerBajaVendedor } from "@/lib/agentes/vendedor/baja";
import { darmeDeBajaAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Dejar de recibir correos", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<{ t?: string; listo?: string; error?: string }> };

/**
 * Página del enlace de baja de los correos de Daniel (agente Vendedor).
 *
 * Abrirla NO da de baja: muchos antivirus abren los enlaces de los correos para revisarlos. La
 * persona confirma con un botón.
 */
export default async function BajaVendedorPage({ searchParams }: Props) {
  const sp = await searchParams;
  const baja = leerBajaVendedor(sp.t);

  if (!baja) {
    return (
      <Marco>
        <h1 className="text-xl font-semibold text-[var(--fo-text)]">El enlace no es válido</h1>
        <p className="mt-2 text-sm text-[var(--fo-muted)]">
          Puede que esté incompleto. Abrí de nuevo el enlace desde el correo que recibiste, o respondé ese correo
          con la palabra «baja».
        </p>
      </Marco>
    );
  }

  return (
    <Marco>
      <h1 className="text-xl font-semibold text-[var(--fo-text)]">Correos de Daniel Cuart</h1>
      <p className="mt-2 text-sm text-[var(--fo-muted)]">
        Casilla: <strong className="text-[var(--fo-text)]">{baja.email}</strong>
      </p>
      {sp.listo ? (
        <p className="fo-alert-success mt-4 text-sm">Listo: no te voy a escribir más.</p>
      ) : (
        <form action={darmeDeBajaAction} className="mt-6">
          <input type="hidden" name="t" value={sp.t ?? ""} />
          <button type="submit" className="fo-btn fo-btn-primary">
            Darme de baja
          </button>
        </form>
      )}
    </Marco>
  );
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[var(--fo-bg)] px-4 py-12">
      <div className="fo-card w-full max-w-md p-6">{children}</div>
    </main>
  );
}
