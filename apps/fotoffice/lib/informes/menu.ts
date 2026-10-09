/**
 * Entradas del menú "Informes" (etapa 6). Módulo PURO: lo importa el menú, que es del navegador y no
 * puede traer la política de acceso. La regla de visibilidad es la del nivel del módulo `reports`
 * (dueño y administradores lo tienen en Gestionar cuando el módulo está encendido); "Ajustes" es de
 * quien puede configurar (dueño o administrador), igual que la pantalla.
 */
export type ItemMenuInformes = {
  href: string;
  label: string;
  description: string;
  activeMatch: "exact" | "under";
};

export function itemsMenuInformes(opciones: { veInformes: boolean; puedeConfigurar: boolean }): ItemMenuInformes[] {
  if (!opciones.veInformes) return [];
  return [
    { href: "/informes", label: "Tablero", description: "Lo que hay por cobrar y por pagar, el saldo de Caja y el monotributo de un vistazo.", activeMatch: "exact" },
    { href: "/informes/resultados", label: "Resultados", description: "Ingresos, costos y gastos por rubro y por mes: lo cobrado y pagado, o lo vendido y comprometido.", activeMatch: "under" },
    { href: "/informes/ventas", label: "Ventas", description: "Lo vendido por producto, cliente, vendedor, categoría u origen, mes a mes.", activeMatch: "under" },
    { href: "/informes/embudo", label: "Embudo", description: "Cuántas consultas entraron, cuántas se ganaron o se perdieron y cuánto se vendió, por categoría u origen.", activeMatch: "under" },
    { href: "/informes/flujo", label: "Flujo de caja", description: "Cuánto dinero va a haber en Caja según lo que se cobra y se paga.", activeMatch: "under" },
    { href: "/informes/monotributo", label: "Monotributo", description: "Control de lo cobrado en 12 meses contra el tope de la categoría.", activeMatch: "under" },
    ...(opciones.puedeConfigurar
      ? [{ href: "/informes/ajustes", label: "Ajustes", description: "Saldo mínimo de Caja, tope y categoría del monotributo.", activeMatch: "under" as const }]
      : []),
  ];
}
