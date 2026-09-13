import type { Metadata } from "next";
import { PaginaLegal } from "../components/pagina-legal";
import { SECCIONES_PRIVACIDAD } from "@/lib/legal/contenido";

export const metadata: Metadata = {
  title: "Política de privacidad | Subí la Foto",
  description:
    "Qué datos trata Subí la Foto, para qué los usa, con quién los comparte y cuánto los guarda.",
};

export default function Privacidad() {
  return (
    <PaginaLegal
      titulo="Política de privacidad"
      entrada="Qué datos tratamos, para qué los usamos y qué podés pedirnos. Escrito para leerse, no para aceptarse a ciegas."
      secciones={SECCIONES_PRIVACIDAD}
      otroHref="/terminos"
      otroTexto="Términos y condiciones"
    />
  );
}
