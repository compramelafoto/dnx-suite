import PresupuestosListClient from "@/components/cuantocobro/presupuestos/PresupuestosListClient";
import CuantoCobroListSkeleton from "@/components/cuantocobro/CuantoCobroListSkeleton";
import { Suspense } from "react";

export default function CuantoCobroPresupuestosPage() {
  return (
    <Suspense
      fallback={
        <div className="container-custom py-8">
          <CuantoCobroListSkeleton rows={6} />
        </div>
      }
    >
      <PresupuestosListClient />
    </Suspense>
  );
}
