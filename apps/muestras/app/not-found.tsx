import { headers } from "next/headers";
import { Encabezado } from "@/components/encabezado/encabezado";
import { CuerpoNoEncontrada } from "@/components/no-encontrada/no-encontrada";
import { Pie } from "@/components/pie/pie";
import { marcaPorHost } from "@/lib/marca";

/**
 * 404 de las URLs que no corresponden a ninguna página (`/no-existe`). Next la arma en el
 * servidor dentro de `app/layout.tsx`: el HTML llega con `lang="es"`, encabezado, título y pie
 * aunque el navegador no corra JavaScript. Un comodín `[marca]/[...resto]` que llamara a
 * `notFound()` no sirve: el error salta durante el armado del HTML y Next manda el documento de
 * error vacío (`__next_error__`), y el 404 sólo aparece después, en el navegador.
 *
 * Acá no hay segmento `[marca]`: la marca sale del dominio del pedido.
 */
export default async function NoEncontrada() {
  const marca = marcaPorHost((await headers()).get("host"));
  return (
    <>
      <title>{`No encontramos esta página | ${marca.nombre}`}</title>
      <Encabezado marca={marca} />
      <div className="flex-1">
        <CuerpoNoEncontrada />
      </div>
      <Pie marca={marca} />
    </>
  );
}
