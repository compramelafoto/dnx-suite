import type { Metadata } from "next";
import { requireLevel } from "@/lib/guards";
import { Pagina } from "@/app/_ui";
import { MARCA } from "@/app/_ui/marca";
import { FormularioSerie } from "./FormularioSerie";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: `Consultar número de serie — ${MARCA}` };

export default async function ConsultarSeriePage() {
  await requireLevel("identidad", "/consultar-serie");
  return (
    <Pagina
      titulo="Consultar número de serie"
      bajada="Antes de comprar un equipo usado, fijate si su número de serie figura con una denuncia activa."
    >
      <FormularioSerie />
    </Pagina>
  );
}
