# ContestRulesConfiguration — Schema (P0-09A)

Tipo TypeScript: `apps/fotorank/app/lib/fotorank/rules-config/types.ts`  
Persistencia: `FotorankContestConfigurationVersion.configurationJson` + columnas tipadas.

`schemaVersion`: número entero (actual: `1`).

---

## Enums

| Nombre | Valores |
|--------|---------|
| `RequirementLevel` | REQUIRED, RECOMMENDED, INFORMATIVE, NOT_REQUIRED |
| `MissingInfoAction` | ALLOW, WARN, REQUIRES_REVIEW, BLOCK, REJECT |
| `EditingRuleState` | ALLOWED, LIMITED, PROHIBITED, REQUIRES_DECLARATION |
| `AiRuleState` | ALLOWED, PROHIBITED, REQUIRES_DECLARATION, REQUIRES_REVIEW |
| `DeviceType` | MOBILE, CAMERA, DRONE, OPEN, OTHER |
| `PricingMode` | FREE, PAID, INVITATION_ONLY |
| `OptionalLimit` | `number \| null` — `null` = no definido / no aplicable |
| `ValidationStatus` | VALID, VALID_WITH_WARNINGS, INVALID, PENDING_HUMAN_CONFIRMATION |
| `TextCompareStatus` | MATCH, CONFLICT, NOT_MENTIONED, UNVERIFIABLE |

---

## A. `identity`

| Campo | Tipo | Notas |
|-------|------|-------|
| officialName | string | |
| slug | string | |
| description | string \| null | |
| organizers | `{ name, role? }[]` | |
| participatingInstitutions | string[] | |
| territoryScope | string \| null | |
| country | string | |
| province | string \| null | |
| siteUrl | string \| null | |
| contactEmail | string \| null | |
| language | string | p.ej. `es-AR` |
| timezone | string | IANA |
| platformName | string | FotoRank |

## B. `schedule`

Fechas en ISO UTC. Cierres usan **límite exclusivo** (`*ClosesAtExclusive` / `captureWindowEndsExclusiveAt`).

| Campo | Tipo |
|-------|------|
| registrationOpensAt | string |
| registrationClosesAtExclusive | string |
| submissionOpensAt | string |
| submissionClosesAtExclusive | string |
| replaceClosesAtExclusive | string \| null |
| judgingStartsAt / judgingEndsAt | string \| null |
| resultsAt / awardsAt | string \| null |
| captureWindowStartsAt | string \| null |
| captureWindowEndsExclusiveAt | string \| null |
| timezone | string |
| publicScheduleNote | string \| null |

## C. `participation`

| Campo | Tipo |
|-------|------|
| pricingMode | PricingMode |
| priceAmountMinor | number |
| currency | string |
| platformFeeBps | number |
| minAge | number \| null |
| minorsAllowed | boolean \| null |
| adultAuthorizationRequired | boolean \| null |
| adultAuthorizationPendingHumanConfirmation | boolean |
| residencyRequired | boolean |
| residencyScope | string \| null |
| individualOnly | boolean |
| maxRegistrationsPerPerson | number |
| maxCategoriesPerRegistration | number |
| maxEntriesPerRegistration | number |
| allowReplaceUntilClose | boolean |
| allowWithdrawal | boolean |

## D. `categories[]`

| Campo | Tipo |
|-------|------|
| name, slug | string |
| description | string \| null |
| deviceType | DeviceType |
| particularRequirements | string \| null |
| maxEntries | number |
| active | boolean |
| sortOrder | number |
| membershipRestriction | string \| null | p.ej. ARGRA |
| technicalPolicyNote | string \| null |

## E. `file`

| Campo | Tipo | Notas |
|-------|------|-------|
| supportedMimeTypes | string[] | Pipeline real |
| supportedExtensions | string[] | |
| maxFileSizeBytes | OptionalLimit | Reglamentario |
| minWidth / minHeight / maxWidth / maxHeight | OptionalLimit | |
| minMegapixels | OptionalLimit | |
| aspectRatioMode | FREE \| RESTRICTED | |
| orientationFree | boolean | |
| colorAllowed / blackAndWhiteAllowed | boolean | |
| originalFileRequired | boolean | |
| rawEventuallyRequested | boolean | |
| internalSafetyMaxFileSizeBytes | number | No es regla del concurso |
| note | string \| null | |

## F. `metadata`

Por dato (`exifGeneral`, `captureDate`, `gps`, `deviceModel`, `lens`, `altitude`, `editingSoftware`):

| Campo | Tipo |
|-------|------|
| level | RequirementLevel |
| missingAction | MissingInfoAction |

## G. `editing`

Claves (todas `EditingRuleState`): exposure, contrast, highlights, shadows, whiteBalance, color, saturation, crop, rotation, sharpening, noiseReduction, opticalCorrections, radialMasks, linearMasks, subjectMasks, skyMasks, hdr, panoramas, elementRemoval, elementAddition, skyReplacement, photomontage, multipleComposition, signatures, frames, watermarks (+ notes opcionales).

## H. `ai`

Claves (todas `AiRuleState`): fullyGeneratedImage, generativeFill, generativeRemoval, generativeExpand, generativeAddition, generativeReplacement, aiNoiseReduction, aiSharpening, smartMasks, autoSelection, autoDevelop, assistedColorCorrection.

## I. `rights`

Titularidad, licencia obligatoria, aplica a todas las obras, exclusiva, gratuita/remunerada, duración meses, territorio, finalidades (institucional/cultural/educativo/promocional/comercial/publicación/exhibición/reproducción/redes/catálogo/productos), atribución, sublicencia, archivo patrimonial permanente, `legalReviewFlags[]`.

## J. `jury`

minJudges, maxJudges (nullable si pendiente), perCategory, decisionFinal, desertedPrizesAllowed, conflictOfInterestEnabled, anonymizedEvaluation, generalCriteria, futureScoringNote, futureTieBreakNote, quantityPendingHumanConfirmation.

## K. `prizes[]`

categorySlug (o null = todas), place, amountMinor, currency, inKindDescription, mention, certificate, deliveryRequirements, estimatedDate.

## L. `disqualifications`

Severidades y motivos configurables (autoría, categoría, fecha, territorio, archivo, edición, IA, fotomontaje, identidad, firma, marca de agua, duplicado, falsedad, ilegal, terceros, incumplimiento).

## Theme

`theme.summary`, `geographicScope`, `temporalScopeNote`, `subjectNotes[]`.

---

## Persistencia Prisma

- `FotorankContestConfigurationVersion` — versiones + hash + columnas críticas  
- `FotorankContestRulesTemplate` — plantillas  
- `FotorankContestRulesVersion.configurationVersionId`  
- `FotorankContestRegistration.configurationVersionId`

## DTO generación bases

`ContestRulesGenerationInput` — JSON serializable sin secretos, IDs internos ni storage keys (`generation-input.ts`).
