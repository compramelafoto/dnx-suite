import type { Metadata } from "next";
import { metadatosDePerfil, PaginaPerfil } from "@/components/perfil/pagina-perfil";

export const revalidate = 300;

type Props = { params: Promise<{ marca: string; slug: string }> };

export function generateMetadata({ params }: Props): Promise<Metadata> {
  return metadatosDePerfil(params, "/fotografos");
}

export default function PerfilPublico({ params }: Props) {
  return PaginaPerfil({ params, ruta: "/fotografos" });
}
