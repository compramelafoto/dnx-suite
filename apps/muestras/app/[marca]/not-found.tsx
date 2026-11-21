import Link from "next/link";

/**
 * 404 dentro del sitio de cada marca. Hace falta porque el layout raíz vive en `[marca]`: sin
 * este archivo, un `notFound()` sube hasta el 404 global de Next, que se dibuja sin el layout
 * (sin `lang="es"`, encabezado, pie ni fuente).
 */
export default function NoEncontrada() {
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
