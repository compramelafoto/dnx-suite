# Auditoría de consistencia — Jurado / admisión / voto público (15B)

**Fecha:** 2026-08-10  
**Objetivo:** evitar contradicciones entre Bases borrador, master rules, manuales, FAQs, blog y checklists.

---

## 1. Decisiones canónicas (deben repetirse igual)

| Tema | Valor canónico |
|------|----------------|
| Frase | El jurado selecciona. El público decide. |
| Mínimo competitivo | 8 / 10 (`minimumCompletedPrompts`) |
| 7 o menos | NO ELEGIBLE de **toda** la competencia |
| Criterios | 3 (Interpretación, Creatividad, Composición) |
| Escala | Enteros 1–10, pesos iguales |
| Evaluaciones/foto | 3 (configurable) |
| Finalistas/consigna | 3 → 30 total |
| Voto público | Me Gusta, unidad CONSIGNA, default 24 h |
| Desempate público | Sin score de jurado; `PUBLIC_TIEBREAK` |
| EXIF ausente | YELLOW / review; no auto-rechazo |
| Carga recomendada | 500 fotos/jurado; no bloqueante |
| Premios | No definidos en esta etapa |

---

## 2. Matriz de documentos

| Documento | Alineado |
|-----------|----------|
| `jury-and-public-voting-master-rules.md` | Fuente |
| `CLICKATON_BASES_DRAFT_v3_jury_public_vote.md` | Sí (DRAFT + LEGAL) |
| `technical-admission-policy.md` | Sí |
| `jury-regulations.md` | Sí |
| `jury-user-manual.md` | Sí |
| `jury-quick-guide.md` | Sí |
| `jury-faq.md` | Sí |
| `jury-organizer-manual.md` | Sí |
| `competition-participant-faq.md` | Sí |
| `jury-capacity-calculator-spec.md` | Sí (genérico FR) |
| `pre-jury-readiness-checklist.md` | Sí |
| `pre-public-vote-checklist.md` | Sí |
| `blog-como-se-eligen-ganadores.md` | Sí |
| `jury-and-public-vote-communications.md` | Sí |

---

## 3. Documentos previos a no usar como verdad de producto

| Documento | Divergencia | Acción |
|-----------|-------------|--------|
| `CLICKATON_JURY_SCORING.md` (Etapa 14) | Enfoque implementación; rúbrica histórica puede hablar de modelos previos | Banner de supersesión de producto → master 15B |
| `CLICKATON_2026_RULES_PLATFORM_ALIGNMENT.md` | Menciona 4 criterios y 72 h likes en matriz histórica | No reescribir histórico; producto nuevo = 3 criterios / 24 h default |
| Bases v2 `legal-funnel.ts` | Menciona mínimo 8; **no** detalla voto público/finalistas 15B | Esperar LEGAL + v3; no tocar runtime en 15B |

---

## 4. Términos auditados

| Correcto | Incorrecto en este dominio |
|----------|----------------------------|
| FINALISTA | “ganador” antes del público |
| EVALUACIÓN | “voto” del jurado |
| VOTACIÓN PÚBLICA | “jurado popular” ambiguo |
| ME GUSTA | “likes del jurado” |
| ADMISIBLE / NO ADMISIBLE | mezclar con elegibilidad de persona |
| ELEGIBLE / NO ELEGIBLE | mezclar con admisión de obra |

**Resultado auditoría 15B:** sin contradicciones internas en el paquete nuevo.  
Pendiente humano: LEGAL REVIEW de Bases v3 y publicación de copy.
