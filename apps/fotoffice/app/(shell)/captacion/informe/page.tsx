import { redirect } from "next/navigation";
import { ArmazonCaptacion } from "@/components/captacion/armazon";
import { Informe } from "@/components/circuitos/informe";
import { circuitosDelInforme, informeCircuito } from "@/lib/circuitos/informe";
import { esAtajoPeriodo, esRangoValido, hoyEnBuenosAires, resolverPeriodo } from "@/lib/listado/periodos";
import { requireServiceLeadsStaff } from "@/lib/service-leads/access";
import { prepararCaptacion } from "@/lib/service-leads/preparar";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
const PERIODO_POR_DEFECTO = "este-mes";

function uno(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Informe por circuito de Captación. El período (atajo o rango "AAAA-MM-DD..AAAA-MM-DD") se
 * resuelve en hora de Buenos Aires; el circuito tiene que ser del workspace de la sesión (si no,
 * se muestra el predeterminado).
 */
export default async function CaptacionInformePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { workspace } = await requireServiceLeadsStaff();
  if (!workspace) redirect("/workspace");
  const sp = await searchParams;

  const periodoParam = uno(sp.periodo) ?? "";
  const periodo = esAtajoPeriodo(periodoParam) || esRangoValido(periodoParam) ? periodoParam : PERIODO_POR_DEFECTO;
  const circuitoParam = uno(sp.circuito);
  const pedido = circuitoParam && ID_VALIDO.test(circuitoParam) ? circuitoParam : null;

  // Primero se preparan los circuitos y se enganchan las consultas (la primera vez los crea).
  const { quedan } = await prepararCaptacion(workspace.id);
  const { circuitos, elegido } = await circuitosDelInforme(workspace.id, pedido);
  const rango = resolverPeriodo(periodo, hoyEnBuenosAires(new Date()))!;
  const datos = elegido ? await informeCircuito(workspace.id, elegido, rango.desde, rango.hasta) : null;

  return (
    <ArmazonCaptacion activa="informe" quedan={quedan}>
      <Informe circuitos={circuitos} circuito={elegido} periodo={periodo} datos={datos} />
    </ArmazonCaptacion>
  );
}
