import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function ClientLoginPage() {
  return (
    <Suspense
      fallback={
        <section className="py-12 md:py-16 bg-white">
          <div className="container-custom">
            <div className="max-w-4xl mx-auto text-center">
              <p className="text-[#6b7280]">Cargando...</p>
            </div>
          </div>
        </section>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
