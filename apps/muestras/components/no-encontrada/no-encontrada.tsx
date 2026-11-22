import Link from "next/link";

/** El cuerpo del 404: lo comparten `app/not-found.tsx` y `app/[marca]/not-found.tsx`. */
export function CuerpoNoEncontrada() {
  return (
    <main className="mx-auto max-w-2xl space-y-4 p-4 leading-relaxed sm:p-8">
      <h1 className="mf-titulo text-[2.45rem]">No encontramos esta página</h1>
      <p>Puede que el enlace esté mal escrito o que la página ya no esté publicada.</p>
      <p>
        <Link href="/" className="underline">Volver al inicio</Link>
      </p>
    </main>
  );
}
