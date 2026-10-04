import type { Metadata } from "next";
import { PaginaLegal } from "../components/pagina-legal";
import { SECCIONES_TERMINOS } from "@/lib/legal/contenido";

export const metadata: Metadata = {
  title: "Términos y condiciones | SubiLaFoto",
  description:
    "Las reglas del servicio: qué se puede subir, cómo se revisa, cuánto dura un evento y qué cuesta.",
};

export default function Terminos() {
  return (
    <PaginaLegal
      titulo="Términos y condiciones"
      entrada="Las reglas del servicio, para el invitado que sube una foto y para el profesional que lo vende."
      secciones={SECCIONES_TERMINOS}
      otroHref="/privacidad"
      otroTexto="Política de privacidad"
    />
  );
}
