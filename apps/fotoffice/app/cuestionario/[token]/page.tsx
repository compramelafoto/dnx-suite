import type { Metadata } from "next";
import { envioPorToken } from "@/lib/cuestionarios/cuestionarios-servidor";
import { valoresIniciales } from "@/lib/cuestionarios/tipos";
import { primerNombre } from "@/lib/cuestionarios/mensaje";
import { FormularioCuestionario } from "./formulario";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cuestionario",
  // Un enlace privado no se indexa: es una credencial, no una página.
  robots: { index: false, follow: false },
  referrer: "strict-origin",
};

/**
 * El cuestionario que el estudio le mandó a su cliente, sin cuenta: el token del enlace es la
 * credencial. Un enlace inexistente y uno roto muestran el mismo mensaje.
 */
export default async function CuestionarioPublicoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const envio = await envioPorToken(token).catch(() => null);

  if (!envio) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center bg-[var(--fo-bg)] px-5 py-12 text-[var(--fo-text)]">
        <div className="fo-card space-y-2 p-6 text-center">
          <p className="text-base font-semibold">Este enlace no está disponible</p>
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">Revisá que esté completo o pedile al estudio uno nuevo.</p>
        </div>
      </main>
    );
  }

  const nombre = primerNombre(envio.nombreCliente);

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:py-12">
        <header className="space-y-3">
          {envio.estudio.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- el logo es una URL de R2
            <img src={envio.estudio.logoUrl} alt={envio.estudio.nombre} className="h-14 w-auto max-w-[10rem] object-contain" />
          ) : null}
          {envio.estudio.nombre ? (
            <p className="text-xs uppercase tracking-wide text-[var(--fo-muted)]">{envio.estudio.nombre}</p>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight">{envio.cuestionario.nombre}</h1>
          {nombre ? <p className="text-base">¡Hola, {nombre}!</p> : null}
          {envio.cuestionario.intro ? (
            <p className="text-sm leading-relaxed text-[var(--fo-muted)]">{envio.cuestionario.intro}</p>
          ) : null}
        </header>
        <FormularioCuestionario
          token={token}
          definicion={envio.cuestionario.definicion}
          inicial={valoresIniciales(envio.respuestas)}
          yaRespondido={envio.estado === "RESPONDIDO"}
          nombreEstudio={envio.estudio.nombre}
        />
      </main>
    </div>
  );
}
