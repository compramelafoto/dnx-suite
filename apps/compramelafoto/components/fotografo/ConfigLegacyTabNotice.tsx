import Link from "next/link";
import Card from "@/components/ui/Card";

type LegacyTab = "mercadopago" | "upselling" | "referidos";

const NOTICES: Record<
  LegacyTab,
  { menu: string; item: string; menuHref: string }
> = {
  mercadopago: {
    menu: "Ventas",
    item: "Mercado Pago",
    menuHref: "/fotografo/configuracion?tab=mercadopago",
  },
  upselling: {
    menu: "Ventas",
    item: "Adicionales",
    menuHref: "/fotografo/configuracion?tab=upselling",
  },
  referidos: {
    menu: "Configuración",
    item: "Referidos & Marketing",
    menuHref: "/dashboard/referrals",
  },
};

export function isConfigLegacyTab(tab: string | null | undefined): tab is LegacyTab {
  return tab === "mercadopago" || tab === "upselling" || tab === "referidos";
}

export default function ConfigLegacyTabNotice({ tab }: { tab: LegacyTab }) {
  const { menu, item, menuHref } = NOTICES[tab];
  return (
    <Card className="border-[#c27b3d]/30 bg-[#fff8f3] p-4">
      <p className="text-sm text-[#1a1a1a] m-0">
        Esta sección ahora está en el menú lateral{" "}
        <strong>{menu}</strong> → <strong>{item}</strong>. La dirección que usaste sigue funcionando; también
        podés abrirla desde{" "}
        <Link href={menuHref} className="text-[#c27b3d] font-medium hover:underline">
          {menu} → {item}
        </Link>
        .
      </p>
    </Card>
  );
}
