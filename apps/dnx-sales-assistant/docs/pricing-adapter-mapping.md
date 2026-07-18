# Adaptador puro → contrato ¿Cuánto Cobro?

## Alcance (Etapa 10)

- Traduce `PricingProfile` + `PricingServiceTemplate` + job de `preparePricingJob` → DTO compatible.
- **No** ejecuta `calculateCuantoCobro`.
- **No** calcula precios ni copia fórmulas.
- **No** importa `apps/compramelafoto`.

Función principal: `createCuantoCobroCompatibleInput`.

## Contratos

| DNX | Compatible (DTO asistente) | Motor real |
|-----|----------------------------|------------|
| `PricingProfile` | `CuantoCobroCompatibleProfile` | `CuantoCobroProfileInput` |
| `PricingJobInput` | `CuantoCobroCompatibleQuote` | `CuantoCobroQuoteInput` |

## Matriz servicio → jobType

| PhotographyServiceType | jobType | Nota |
|------------------------|---------|------|
| WEDDING | `boda` | Exacto |
| FIFTEENTH_BIRTHDAY | `evento` | Colapso genérico |
| BIRTHDAY | `evento` | Colapso genérico |
| CORPORATE_EVENT | `evento` | Colapso genérico |
| SOCIAL_EVENT | `evento` | Colapso genérico |
| SPORTS_EVENT | `evento` | Colapso genérico |
| PORTRAIT_SESSION | `retrato` | Exacto |
| FAMILY_SESSION | `retrato` | Colapso genérico |
| PRODUCT_PHOTOGRAPHY | `producto` | Exacto |
| SCHOOL_PHOTOGRAPHY | `escolar` | Exacto |
| OTHER | `otro` | Exacto |
| UNKNOWN | — | `UNSUPPORTED` |

Valores alineados con `CC_CONSULTA_JOB_TYPE_OPTIONS` de CLF.

## Perfil

| Campo DNX | Destino | Transformación |
|-----------|---------|----------------|
| currency | currency | string |
| income.livesOnlyFromPhotography | livesOnlyFromPhotography | igual |
| income.externalMonthlyIncome | externalMonthlyIncome | number → string |
| personalExpenses (enabled) | personalExpenseGroups | 1 grupo/línea, amount string |
| businessExpenses category rent | businessRent | suma → string |
| businessExpenses software | businessSoftware | suma → string |
| businessExpenses marketing + otros | businessMarketing | suma → string |
| businessExpenses employees | employeesCount + employeeMonthlyCost | |
| availability.weeklyHours | weeklyHours | number → string |
| timeDistribution % | timeDistribution | number → string (sin redistribuir) |
| reserves.equipmentRenewalMonthly | equipmentRenewalMonthly | string |
| reserves.emergencyFundMonthly | emergencyFundMonthly | string |
| reserves.savings + vacation | savingsGoalsMonthly | suma (motor unifica) |
| equipment CAMERA | primaryCamera* + inventory.renewal.camera | sin wear |
| equipment LENS/FLASH/… | inventory.renewal.* | OTHER omitido + warning |
| commercialPositioningId | commercialPositioningId | igual |

## Trabajo / quote

| Origen | Destino |
|--------|---------|
| jobType mapeado | client.jobType |
| eventDate | client.jobDate (metadata) |
| city | client.jobLocation (metadata) |
| generalClientHours | client.hours.* (strings) |
| coverageHours / editingHours | concepto OWN_SERVICE primario |
| plannedConcepts | concepts[] |
| — | client.name = `"Cliente por confirmar"` |
| — | chosenPrice = `""` |
| — | paymentOptions mínimas vacías |

Fecha/ciudad **no** generan viáticos ni recargos (`ADAPTER_METADATA_NOT_PRICED`).

## Conceptos

| DNX type | itemType motor |
|----------|----------------|
| OWN_SERVICE | own-service |
| PRODUCT | physical-product |
| OUTSOURCED | outsourced |
| EXPENSE | expense |

Costos/márgenes/cantidad se **transportan** como strings; no se aplican.

## Versiones

- `profileVersion`, `templateVersion`, `formulaVersion` ≠ `unconfigured`
- `profile.formulaVersion` debe igualar `template.formulaVersion`
- READY informa las tres

## Verificación de compatibilidad

- Test espejo (package): `packages/cuanto-cobro-core/src/__fixtures__/adapter-shape-contract.test.ts`
- Smoke CLF vía wrapper: `apps/compramelafoto/lib/cuantocobro/__fixtures__/adapter-shape-contract.test.ts`
- Puente tipado asistente (sin ejecutar motor): `src/pricing/cuanto-cobro-engine/contract-compatibility.ts`

JSON / DTO compatible → tipos públicos del package → (en tests del core) `calculateCuantoCobro` → `complete`.

## Package (Etapa 11) + engine (Etapa 12)

`CuantoCobroCompatibleProfile` / `Quote` se transforman a `CuantoCobroProfileInput` / `CuantoCobroQuoteInput` de `@repo/cuanto-cobro-core` por identidad tipada.

El engine mapea el resultado del core así:

- `status: "complete"` → `PricingCalculationResult` `READY`
- precio comercial DNX = `recommendedBusinessPrice` (no `recommendedPrice`)
- `status: "incomplete"` → `INCOMPLETE`
- invariancias rotas / excepciones → `FAILED`
- `approvalStatus: NOT_REVIEWED`

El pipeline HTTP **no** importa el core ni el engine.

## Limitaciones

- Colapso de varios servicios a `evento`/`retrato`
- Vacaciones DNX sumadas a `savingsGoalsMonthly`
- Otros gastos de negocio → `businessMarketing`
- Equipo OTHER omitido
- Una sola cámara en el slot primary

## Próxima etapa

Política de exposición de montos y eventual puente conversacional opcional — sin enviar precios hasta aprobación comercial explícita.
