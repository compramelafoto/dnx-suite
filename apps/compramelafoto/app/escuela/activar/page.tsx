import { Suspense } from "react";
import ActivateSchoolOrganizerClient from "./ActivateSchoolOrganizerClient";

export default function ActivarEscuelaPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-xl px-4 py-10">Cargando...</main>}>
      <ActivateSchoolOrganizerClient />
    </Suspense>
  );
}
