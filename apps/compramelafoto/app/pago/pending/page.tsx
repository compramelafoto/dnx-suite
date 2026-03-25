import { Suspense } from "react";
import PendingClient from "./PendingClient";

export default function PagoPendingPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-[#6b7280]">Cargando...</p>
        </div>
      }
    >
      <PendingClient />
    </Suspense>
  );
}
