import Link from "next/link";

export default function NotFound() {
  return (
    <div className="ck-container flex min-h-[50vh] flex-col items-center justify-center py-20 text-center">
      <p className="ck-eyebrow">404</p>
      <h1 className="mt-3 text-[clamp(2rem,6vw,3.5rem)]">No encontramos esa página</h1>
      <p className="mt-4 max-w-md text-ck-text-secondary">
        El enlace puede haber cambiado o la sección todavía no existe.
      </p>
      <Link href="/" className="ck-btn ck-btn-primary mt-8">
        Volver al inicio
      </Link>
    </div>
  );
}
