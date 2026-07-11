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
    console.error("[infospot]", error.digest || error.message);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-xl flex-col items-center justify-center px-6 py-16 text-center">
      <p className="is-eyebrow">Error</p>
      <h1 className="is-h1 mt-3 text-3xl">No pudimos cargar esta página</h1>
      <p className="is-body mt-4">
        Probá de nuevo. Si el problema continúa, volvé más tarde.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="is-btn is-btn-solid">
          Reintentar
        </button>
        <Link href="/" className="is-btn is-btn-secondary">
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
