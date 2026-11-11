import type { Metadata } from "next";
import { cargarFormularioDeAlta } from "@/lib/alta-cliente/repositorio";
import { FormularioAlta } from "./formulario-alta";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Alta en FOTOFFICE",
  // Un enlace privado no se indexa: es una credencial, no una página.
  robots: { index: false, follow: false },
  referrer: "strict-origin",
};

/**
 * El formulario de alta de un cliente nuevo, sin cuenta: el token del enlace es la credencial.
 * Un enlace inexistente y uno roto muestran el mismo mensaje.
 */
export default async function AltaClientePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const formulario = await cargarFormularioDeAlta(token).catch((error) => {
    console.error("[fotoffice][alta] no se pudo leer el enlace", {
      detalle: error instanceof Error ? error.message : String(error),
    });
    return null;
  });

  if (!formulario) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center bg-[var(--fo-bg)] px-5 py-12 text-[var(--fo-text)]">
        <div className="fo-card space-y-2 p-6 text-center">
          <p className="text-base font-semibold">Este enlace no está disponible</p>
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">Revisá que esté completo o pedí uno nuevo.</p>
        </div>
      </main>
    );
  }

  const { cuestionario, destinatario } = formulario;
  const nombre = destinatario.split(" ")[0];

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-[var(--fo-muted)]">FOTOFFICE · {cuestionario.titulo}</p>
          <h1 className="text-2xl font-semibold tracking-tight">¡Hola, {nombre}!</h1>
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">{cuestionario.bienvenida}</p>
        </header>
        <FormularioAlta
          token={token}
          cuestionario={cuestionario}
          inicial={formulario.respuestas}
          enviadoAntes={formulario.estado === "ENVIADO"}
        />
      </main>
    </div>
  );
}
