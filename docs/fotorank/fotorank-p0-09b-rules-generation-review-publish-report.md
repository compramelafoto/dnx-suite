# FotoRank P0-09B — Generación, revisión y publicación de Bases

**Fecha:** 2026-07-28  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Alcance:** ciclo de vida de `FotorankContestRulesVersion`, prompt ChatGPT, importación segura, comparación ampliada, revisión humana, revisión jurídica, publicación sincronizada, aceptación + menores.  
**No incluido:** OpenAI productivo, PDF, puntajes/ranking/voto, commit/push/deploy, apertura automática del concurso.

---

## 1. Arquitectura

Fuente de verdad: `FotorankContestConfigurationVersion` (PUBLISHED).  
Bases: representación textual asociada (`configurationVersionId` + `configurationHashSnapshot`).

```
Config PUBLISHED → prompt / import → GENERATED
  → UNDER_REVIEW → APPROVED → PUBLISHED
                 ↘ CHANGES_REQUESTED → DRAFT/edición
```

La IA **nunca** publica. `aiMayPublish` siempre `false`.

## 2. Generadores

| Implementación | Rol |
|----------------|-----|
| `ManualPromptRulesGenerator` | Default; genera prompt copiable |
| `OpenAiContestRulesGenerator` | Stub preparado; requiere `FOTORANK_RULES_AI_PROVIDER=openai` + key + model; sin cliente oficial en monorepo |

`resolveRulesTextGenerator()` elige provider por env.

## 3. Prompt

`buildChatGptRulesPrompt` incluye identidad, cronograma, categorías, menores, archivo, metadata, edición, IA, derechos, premios, jurado, descalificaciones, JSON `ContestRulesGenerationInput`, hash, e instrucciones de salida JSON estructurado (`documentTitle`, `rulesDocument`, `declaredConfigurationHash`, etc.).

## 4. Importación

- Documento Markdown/texto/HTML sanitizado  
- Respuesta JSON estructurada (`parseExternalRulesAiResponse`)  
Validaciones: vacío, tamaño, placeholders, scripts/iframes, asociación a config publicada.

## 5. Normalización

`normalizeContestRulesDocument`: LF, trim, sanitize HTML, SHA-256. Guarda original + normalizado + hash.

## 6. Comparación

`rules-lifecycle/compare.ts` amplía P0-09A con severidades `INFO|WARNING|BLOCKING` y estados `MATCH|CONFLICT|MISSING|EXTRA_RULE|UNVERIFIABLE`.  
Detecta límites de archivo inventados, EXIF/GPS obligatorios indebidos, ARGRA/dron, licencia, jurado, etc.

## 7. Revisión humana

Panel `/dashboard/concursos/[id]/bases`: tres columnas (configuración / documento / validación).  
Acciones auditadas: enviar revisión, solicitar cambios, aprobar, marcar legal, publicar.  
Política opcional de doble control (`requireDistinctApprover`).

## 8. Publicación

`publishContestRulesVersion`:

1. status `APPROVED`  
2. config publicada + hash coincidente  
3. cero conflictos bloqueantes  
4. sin placeholders  
5. secciones mínimas  
6. legal: `PENDING` bloquea producción; staging puede `allowLegalPendingForLocal`  
7. archiva PUBLISHED anterior  
8. no abre el concurso  

## 9. Menores

Edad mínima 16; 16–17 requieren `FotorankMinorAuthorization` (nombre, vínculo, declaración versionada).  
UI inscripción: checkboxes separados (bases / licencia / promo) + bloque menores.

## 10. Licencia

Santa Fe: `legalReviewStatus=PENDING` al importar/seed; advertencia explícita en admin.  
No se altera la decisión comercial confirmada; solo se registra revisión.

## 11. Santa Fe en Foco

- Config: autorización de menores **CONFIRMADA**; jurado máx. 5 **CONFIRMADO**  
- Borrador: `buildSantaFeEnFoco2026RulesDraftMarkdown()` + acción «Crear borrador Santa Fe en Foco»  
- Validación config: `VALID_WITH_WARNINGS` (flags legales / sin límite de peso reglamentario)

## 12. Tests

| Script | Resultado |
|--------|-----------|
| `test:rules-lifecycle:selfcheck` | PASS |
| `test:rules-lifecycle:integration` | PASS (`fotorank_staging_2026`) |
| `test:rules-config:selfcheck` | PASS (`VALID_WITH_WARNINGS`) |

Migración: `20260728210000_fotorank_p0_09b_rules_generation_review_publish` (solo DB local tras `db:assert-safe`).

## 13. Riesgos

1. Publicación productiva bloqueada por revisión jurídica PENDING.  
2. Comparación determinística es heurística (falsos positivos/negativos).  
3. OpenAI no cableado; flujo depende de importación manual.  
4. Legacy `publishExistingRulesDraft` aún publica DRAFT vía API antigua — el flujo P0-09B usa `publishApprovedAction`.

## 14. Próximo paso

**P0-09C / ops:** revisión jurídica formal → marcar REVIEWED → publicar bases en staging; R2/email; E2E inscripción con menores; opcional PDF; retirar publish legacy sin APPROVED.

---

**Confirmación:** no hubo commit, push ni deploy a producción.
