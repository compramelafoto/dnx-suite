import { Suspense } from "react";
import SuccessClient from "./SuccessClient";

export default function PagoSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-[#6b7280]">Cargando...</p>
        </div>
      }
    >
      <SuccessClient />
    </Suspense>
  );
}
