export function runPricingReviewChecklist(): {
  exitCode: number;
  lines: string[];
} {
  const lines = [
    "DNX pricing-review:checklist",
    "",
    "- [ ] Laboratorio local con DNX_SALES_ASSISTANT_REVIEW_LAB=true",
    "- [ ] NODE_ENV !== production",
    "- [ ] Perfil económico .local o fixtures TEST_ONLY_SYNTHETIC_PROFILE",
    "- [ ] Sección «Revisión de presupuesto» en /review-lab",
    "- [ ] Importes ocultos hasta «Mostrar valores internos»",
    "- [ ] Explicación dani-pricing-explanation-v1 revisable",
    "- [ ] Revisión humana APROBADA / NECESITA AJUSTE / INCORRECTA",
    "- [ ] Export financiero separado en .local/pricing-review/",
    "- [ ] Sin precios en rutas públicas",
    "- [ ] Sin breakdown público",
    "- [ ] Sin duplicar fórmulas del core",
    "",
    "Verificar perfil: pnpm --filter dnx-sales-assistant pricing:checklist",
    "Validar escenarios: pnpm --filter dnx-sales-assistant pricing-review:validate",
    "",
    "El laboratorio no debe utilizarse como sustituto de una revisión profesional de la configuración económica del fotógrafo.",
  ];
  return { exitCode: 0, lines };
}
