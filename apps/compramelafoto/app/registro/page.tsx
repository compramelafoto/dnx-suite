import { Suspense } from "react";
import RegisterClient from "./RegisterClient";

export default function RegistroPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f7f5f2]">
          <p className="text-[#6b7280]">Cargando...</p>
        </div>
      }
    >
      <RegisterClient />
    </Suspense>
  );
}
