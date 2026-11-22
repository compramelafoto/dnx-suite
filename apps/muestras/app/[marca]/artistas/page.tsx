import type { Metadata } from "next";
import { metadatosDeAutores, PaginaAutores } from "@/components/perfil/pagina-autores";

export const revalidate = 300;

type Props = { params: Promise<{ marca: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return metadatosDeAutores(params, "/artistas");
}

export default function Artistas({ params }: Props) {
  return PaginaAutores({ params, ruta: "/artistas" });
}
