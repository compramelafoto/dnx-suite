import { Suspense } from "react";
import CuantoCobroPageClient from "@/components/cuantocobro/CuantoCobroPageClient";

export default function CuantoCobroPage() {
  return (
    <Suspense fallback={<p className="container-custom py-12 text-center text-[var(--cc-color-muted)]">Cargando…</p>}>
      <CuantoCobroPageClient />
    </Suspense>
  );
}
