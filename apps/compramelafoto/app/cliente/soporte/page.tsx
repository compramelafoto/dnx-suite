import { Suspense } from "react";
import SoporteClient from "./SoporteClient";

export default function ClienteSoportePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-[#6b7280]">Cargando...</p>
        </div>
      }
    >
      <SoporteClient />
    </Suspense>
  );
}
