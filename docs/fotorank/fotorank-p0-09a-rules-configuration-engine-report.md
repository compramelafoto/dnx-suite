# FotoRank P0-09A — Motor estructurado de reglas (reporte)

**Fecha:** 2026-07-28  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Alcance:** dominio `ContestRulesConfiguration`, versionado, Wizard admin, Santa Fe en Foco 2026, validación, políticas derivadas, prompt ChatGPT (sin API), importación de bases, comparación determinística, plantilla provincial.  
**No incluido:** OpenAI, PDF definitivo, rúbricas, ranking, votación pública, commit/push/deploy.

---

## 1. Arquitectura

Fuente primaria: JSON tipado `ContestRulesConfiguration` (app) + columnas críticas denormalizadas en `FotorankContestConfigurationVersion`.

```
Wizard admin → saveDraft → validate → publishConfigurationVersion
                                         ↓
                    Contest + categories + uploadPolicyJson
                                         ↓
              adapters (registration / upload / metadata / editing / rights / jury)
                                         ↓
              ContestRulesGenerationInput → prompt ChatGPT (copiar)
              Bases draft (import) ←→ compareRulesTextWithConfiguration
```

Las bases textuales (`FotorankContestRulesVersion`) **no** son fuente de verdad: referencian `configurationVersionId`.

## 2. Fuente de verdad

| Capa | Rol |
|------|-----|
| Editable (DRAFT / READY_FOR_REVIEW) | Wizard; se sobrescribe el borrador vigente |
| Publicada (PUBLISHED) | Inmutable; hash SHA-256 del JSON normalizado |
| Bases publicadas | Deben asociarse a la misma versión de configuración |
| Inscripciones | Guardan `configurationVersionId` al confirmar |

## 3. Versionado

Modelo: `FotorankContestConfigurationVersion`  
Estados: `DRAFT` → `READY_FOR_REVIEW` → `PUBLISHED` → `ARCHIVED`  
Reglas: publicar archiva la PUBLISHED anterior; re-publicar la misma versión falla; modificar tras publicar crea nueva versión (nuevo `versionNumber`).

## 4. Wizard

Ruta: `/dashboard/concursos/[id]/configuracion`  
10 pasos: Identidad → Participación → Fechas → Categorías → Archivo/metadatos → Edición/IA → Derechos → Jurado/premios → Descalificaciones → Revisión.  
Campos condicionales (FREE oculta precio; menores → autorización; IA prohibida → detalle; licencia comercial → duración/exclusividad).  
Acciones: guardar borrador, preset Santa Fe, publicar formal, aplicar técnico (`allowPendingHuman`), copiar prompt, importar bases, comparar texto.

## 5. Validación

`validateContestRulesConfiguration` → `VALID` | `VALID_WITH_WARNINGS` | `INVALID` | `PENDING_HUMAN_CONFIRMATION`.  
Errores: fechas incoherentes, FREE con precio, EXIF REQUIRED + ALLOW, contradicciones IA, etc.  
Publicación formal bloquea `PENDING_HUMAN_CONFIRMATION` e `INVALID`.

## 6. Santa Fe en Foco 2026

Builder: `buildSantaFeEnFoco2026Configuration()`.

| Tema | Valor |
|------|--------|
| Organizadores | SFPR + Cámara de Senadores |
| Modalidad | FREE, precio 0, fee 0 BPS |
| Ventanas | 2026-08-01 00:00 ART → cierre exclusivo 2026-10-01 00:00 ART |
| Captura | Misma ventana (1 ago–30 sep inclusive) |
| Participación | 1 inscripción, 1 categoría, 1 foto, reemplazo hasta cierre, residencia Santa Fe, ≥16 |
| Menores 16–17 | `adultAuthorizationPendingHumanConfirmation: true` |
| Categorías | Profesional, Reportero Gráfico (ARGRA), Amateur, Fotografía Aérea — Dron |
| Archivo reglamentario | Sin peso/dimensiones/aspecto; MIME pipeline: jpeg/png/webp |
| Metadata | RECOMMENDED; ausencia → WARN/REQUIRES_REVIEW (no REJECT) |
| Edición | Revelado + máscaras de ajuste ALLOWED; fotomontaje PROHIBITED |
| IA | Generativa PROHIBITED; ruido/enfoque/máscaras asistidas ALLOWED |
| Licencia | Todas las obras; exclusiva 12 meses; uso patrimonial permanente separado (flag legal) |
| Premios | 500k / 400k / 300k ARS por categoría + menciones |

Seed técnico: `pnpm --filter @repo/db run db:seed:santa-fe-rules-config` (DB local, `allowPendingHuman`).

## 7–10. Edición, IA, metadata, derechos

Ver schema en [`fotorank-contest-rules-schema.md`](./fotorank-contest-rules-schema.md). Políticas derivadas en `app/lib/fotorank/rules-config/policies.ts`.

## 11. Sincronización texto ↔ config

`compareRulesTextWithConfiguration` (determinístico): fechas, gratuidad, GPS, EXIF, IA, fotomontaje, licencia, premios, categorías, etc. Estados: `MATCH` | `CONFLICT` | `NOT_MENTIONED` | `UNVERIFIABLE`.

## 12. Plantillas

`FotorankContestRulesTemplate` — plantilla sistema `concurso-fotografico-provincial` (sin nombre/fechas/premios/organizadores institucionales).

## 13. Tests

| Script | Resultado |
|--------|-----------|
| `test:rules-config:selfcheck` | PASS (hash, fechas, FREE, metadata, edición, IA, licencia, premios, compare, prompt, plantilla) |
| `test:rules-config:integration` | PASS en `fotorank_staging_2026` (draft→publish→inmutable→import→compare→template) |

Migración aplicada solo en DB local aislada tras `db:assert-safe`.

## 14. Riesgos

1. Publicación formal bloqueada hasta confirmar autorización de menores y cantidad de jurados.  
2. Posible tensión jurídica: licencia exclusiva todas las obras vs titularidad vs uso patrimonial permanente (`legalReviewFlags`).  
3. Seed histórico del concurso aún puede tener categorías Celular/Cámara; publicar config SF las upserta a las 4 oficiales.  
4. Comparación texto es heurística; etapa futura con IA.  
5. Disco/local staging: no confundir con Neon productiva.

## 15. Próximo paso recomendado

**P0-09B** — Generación asistida de Bases (prompt → revisión humana → publicación) y/o cableado completo de checklist/declaraciones de edición-IA desde políticas publicadas; resolver pendientes humanos (menores + jurado) y texto oficial de bases.

---

**Confirmación:** no hubo commit, push ni deploy a producción en esta etapa.
