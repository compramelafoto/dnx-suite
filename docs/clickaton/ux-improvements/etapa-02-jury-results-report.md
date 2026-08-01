# Etapa 02 — Imp. 06 — Jurado, evaluación y resultados

**Estado:** `PARTIAL`  
**Motivo:** Clickatón no hospeda panel de jurado, invitaciones, puntajes ni ranking operativo. Esos flujos viven en **FotoRank**. Esta implementación humaniza el hand-off, resultados públicos, integraciones y documentación de estados reales, sin modificar lógica de FotoRank ni puntajes.

---

## Rutas / superficies intervenidas

| Superficie | Cambio |
|---|---|
| `/admin/ediciones/[editionId]/admision` | `JuryHandoffCard`, conflicto de interés (info), freeze ≠ publicar |
| `/admin/ediciones/[editionId]` | Handoff + vínculo FR humanizado; IDs en técnico |
| `/admin/integraciones` | Copy jurado/resultados + owns Clarificados |
| Pública maratón — resultados | Estados preliminar/parcial vs publicados |
| Pública maratón — jurado | Separación técnica vs artística + anonimato |
| Cronograma (labels) | JUDGING_OPEN/CLOSE / RESULTS_RELEASE |

**No existen en Clickatón (gap documentado):**

- Panel del jurado (`/jurado/*`)
- Invitaciones / asignaciones operativas
- Ballot / puntajes / criterios UI
- Ranking admin / desempate / publicación real

---

## Componentes modificados

- `MarathonResultsPlaceholder.tsx`
- `MarathonJury.tsx`
- `admision/page.tsx`
- `ediciones/[editionId]/page.tsx`
- `integraciones/page.tsx`
- `config/admin/integrations.ts`
- `types/marathon.ts` (`resultsStatusLabels`)
- `lib/timeline/ui/timeline-status-presentation.ts`

## Componentes creados

- `components/admin/jury/JuryHandoffCard.tsx`
- `lib/jury-results/ui/jury-results-status-presentation.ts`
- `lib/jury-results/ui/jury-results-status-presentation.test.ts`

---

## Estados traducidos

Ver `jury-results-status-map.md` (invitación, asignación, evaluación, sesión, lote de resultados, entry, resultados públicos CK, hand-off).

## Anonimización visible

- Aviso en hand-off admin.
- Copy pública del jurado.
- Helpers `anonymousWorkLabel` / `anonymousWorkAltText`.
- Revisión en `jury-anonymity-review.md`.
- **No se modificó** `buildAnonymousJuryCode` ni listas forbidden.

## Criterios y escalas

Sin UI de criterios en Clickatón. Helper `presentScoreScaleHelp` neutral (sin inventar “1=débil / 10=excelente” como verdad reglamentaria).

## Guardar / completar / cerrar

Labels tipados en capa de presentación (`presentJuryActionLabel`). Aplicables cuando exista UI de evaluación (FotoRank). En Clickatón se diferencia explícitamente:

- Congelar para el jurado  
- Confirmar resultados  
- Publicar resultados  

## Conflictos de interés

Copy informativo en admisión + constantes `CONFLICT_OF_INTEREST_COPY` (`LEGAL_REVIEW`). Sin acción nueva.

## Progreso / ranking / publicación

Solo presentación y documentación. Sin recalcular ranking ni publicar.

## Estrategia responsive

Handoff y vínculo FR en una columna, botones `min-h-11`, técnico colapsable. Resultados públicos en grid 1→2 cols.

## Pruebas

| Comando | Resultado |
|---|---|
| `pnpm test:jury-results-ux` | OK (19/19) |
| `tsc --noEmit` | OK |
| eslint archivos tocados | OK |
| `selfcheck:technical-admission` | OK (32) |
| build | OK (tras reintento; hubo `ENOSPC` intermitente en caché webpack por disco casi lleno) |
| E2E | No ejecutados |
| Selfchecks jury/ranking FR | Fuera de package Clickatón (viven en FotoRank) |

### Fallas previas ajenas

1. Disco casi lleno (`ENOSPC`) al cachear webpack — no relacionado con el código de Imp. 06.  
2. Un intento de build falló con un falso positivo de tipos en home spotlight; reintento OK; `tsc --noEmit` OK.

## Riesgos pendientes

1. Panel jurado real ausente en Clickatón → experiencia completa depende de FotoRank.  
2. Definición/consecuencias de COI → `LEGAL_REVIEW`.  
3. Escala 1–10 sin definición formal aprobada en UI CK.  
4. Posible fuga de identidad solo si se abre UI de evaluación en FR con datos mal filtrados (fuera de este cambio).
