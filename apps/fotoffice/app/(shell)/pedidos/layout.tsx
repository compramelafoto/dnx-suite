import { requirePedidos } from "@/lib/pedidos/pagina";

/** Guarda de toda la sección: módulo `orders` encendido y "Ver". Cada pantalla la vuelve a pedir. */
export default async function PedidosLayout({ children }: { children: React.ReactNode }) {
  await requirePedidos("ver");
  return <>{children}</>;
}
