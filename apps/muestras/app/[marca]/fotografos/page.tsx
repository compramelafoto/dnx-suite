import type { Metadata } from "next";
import { metadatosDeAutores, PaginaAutores } from "@/components/perfil/pagina-autores";

export const revalidate = 300;

type Props = { params: Promise<{ marca: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return metadatosDeAutores(params, "/fotografos");
}

export default function Fotografos({ params }: Props) {
  return PaginaAutores({ params, ruta: "/fotografos" });
}
