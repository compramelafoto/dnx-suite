import { Suspense } from "react";
import LaboratoriosClient from "./LaboratoriosClient";

export default function AdminLaboratoriosPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-[#6b7280]">Cargando...</p>
        </div>
      }
    >
      <LaboratoriosClient />
    </Suspense>
  );
}
