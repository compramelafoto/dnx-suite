import type { Metadata } from "next";
import { Encabezado } from "@/components/encabezado/encabezado";
import { Pie } from "@/components/pie/pie";
import { origenPublico } from "@/lib/marca";
import { marcaDeParams } from "@/lib/ruta-marca";

/** Las dos marcas se generan en la publicación; cualquier otro segmento es un 404. */
export function generateStaticParams() {
  return [{ marca: "fotografia" }, { marca: "arte" }];
}

export const dynamicParams = false;

export async function generateMetadata({ params }: LayoutProps<"/[marca]">): Promise<Metadata> {
  const marca = await marcaDeParams(params);
  return {
    metadataBase: new URL(origenPublico(marca)),
    title: { default: marca.nombre, template: `%s | ${marca.nombre}` },
    description: marca.descripcion,
    openGraph: {
      siteName: marca.nombre,
      description: marca.descripcion,
      locale: "es_AR",
      type: "website",
      images: [marca.imagenRedes],
    },
    icons: { icon: "/icon.png", apple: "/apple-icon.png" },
  };
}

/**
 * Layout de cada marca. El `<html>` y el `<body>` viven en `app/layout.tsx` (sin segmento
 * dinámico): así el 404 se dibuja dentro de este layout, con encabezado y pie, gracias a
 * `not-found.tsx` y al comodín `[...resto]`.
 */
export default async function LayoutDeMarca({ children, params }: LayoutProps<"/[marca]">) {
  const marca = await marcaDeParams(params);
  return (
    <>
      <Encabezado marca={marca} />
      <div className="flex-1">{children}</div>
      <Pie marca={marca} />
    </>
  );
}
