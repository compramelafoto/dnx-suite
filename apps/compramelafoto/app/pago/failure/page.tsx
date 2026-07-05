import { Suspense } from "react";
import FailureClient from "./FailureClient";

export default function PagoFailurePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-[#6b7280]">Cargando...</p>
        </div>
      }
    >
      <FailureClient />
    </Suspense>
  );
}
