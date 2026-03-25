import { Suspense } from "react";
import ConfirmacionClient from "./ConfirmacionClient";

export default function PublicConfirmacionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <p className="text-[#6b7280]">Cargando...</p>
        </div>
      }
    >
      <ConfirmacionClient />
    </Suspense>
  );
}
