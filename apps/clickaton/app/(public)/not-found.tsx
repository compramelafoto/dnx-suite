import Link from "next/link";

export default function NotFound() {
  return (
    <div className="ck-container flex min-h-[50vh] flex-col items-center justify-center py-20 text-center">
      <p className="ck-eyebrow">Página no disponible</p>
      <h1 className="mt-3 text-[clamp(2rem,6vw,3.5rem)]">No encontramos esta página</h1>
      <p className="mt-4 max-w-md text-ck-text-secondary">
        Es posible que el enlace haya cambiado o que la sección ya no esté disponible.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="ck-btn ck-btn-primary min-h-11">
          Volver al inicio
        </Link>
        <Link href="/mi-cuenta" className="ck-btn ck-btn-secondary min-h-11">
          Ir a Mi cuenta
        </Link>
      </div>
    </div>
  );
}
