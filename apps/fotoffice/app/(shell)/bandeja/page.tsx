import { PageHeader } from "@/components/page-header";
import { FiltrosYBusqueda } from "@/components/bandeja/filtros-y-busqueda";
import { ListaDeChats } from "@/components/bandeja/lista-de-chats";
import { RefrescoPeriodico } from "@/components/bandeja/refresco-periodico";
import { FILTROS_BANDEJA, listarChats, type FiltroBandeja } from "@/lib/bandeja/lecturas";
import { requireBandeja } from "@/lib/bandeja/pagina";

export const dynamic = "force-dynamic";

const valor = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Lista de chats de WhatsApp: filtros por enlace, búsqueda y refresco automático cada 10 segundos. */
export default async function BandejaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ctx } = await requireBandeja();
  const params = await searchParams;
  const filtroPedido = valor(params.filtro);
  const filtro: FiltroBandeja = (FILTROS_BANDEJA as readonly string[]).includes(filtroPedido) ? (filtroPedido as FiltroBandeja) : "todos";
  const q = valor(params.q).trim().slice(0, 80);
  const ahora = new Date();
  const chats = (await listarChats(ctx, { filtro, q, ahora })) ?? [];
  return (
    <div className="space-y-6">
      <PageHeader title="Bandeja de WhatsApp" description="Los chats de la línea de WhatsApp: quién los atiende y qué falta responder." />
      <FiltrosYBusqueda filtro={filtro} q={q} />
      <ListaDeChats chats={chats} ahora={ahora} />
      <RefrescoPeriodico segundos={10} />
    </div>
  );
}
