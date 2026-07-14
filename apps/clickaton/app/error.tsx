"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[clickaton]", error.digest || error.message);
  }, [error]);

  return (
    <div className="ck-container flex min-h-[50vh] flex-col items-center justify-center py-20 text-center">
      <p className="ck-eyebrow">Error</p>
      <h1 className="mt-3 text-[clamp(2rem,6vw,3.25rem)]">No pudimos cargar esta página</h1>
      <p className="mt-4 max-w-md text-ck-text-secondary">
        Probá de nuevo. Si el problema continúa, volvé más tarde.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="ck-btn ck-btn-primary">
          Reintentar
        </button>
        <Link href="/" className="ck-btn ck-btn-secondary">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
