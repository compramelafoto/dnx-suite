import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function PhotographerLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-[#6b7280]">Cargando...</p>
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
