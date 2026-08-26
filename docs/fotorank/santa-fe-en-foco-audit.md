# Santa Fe en Foco — Auditoría (actualizada ETAPA 05)

## Estado

- ETAPA 04D: DONE (aislamiento staging/prod + R2).
- ETAPA 05: configuración definitiva de elegibilidad (participación abierta, territorio, período, 4 categorías, ARGRA).

## Código relevante

| Pieza | Ubicación |
| ----- | --------- |
| Preset | `apps/fotorank/app/lib/fotorank/rules-config/santa-fe-en-foco-2026.ts` |
| Políticas | `apps/fotorank/app/lib/fotorank/eligibility/*` |
| Registro | `registration-service.ts` + `answersJson` |
| Carga | `entry-service.ts` + `EntryUploadPanel` |
| Seed categorías | `packages/db/prisma/scripts/seed-santa-fe-en-foco.ts` |
| Migración | `20260804010000_fotorank_registration_answers_json` |

## Eliminado como requisito activo

- Residencia en Provincia de Santa Fe (`residencyRequired: false`).
- Categorías legacy `celular` / `camara` / `santa-fe-en-foco` general → ARCHIVED en seed.

## Legal

Todos los drafts: `BORRADOR — LEGAL REVIEW REQUIRED — NO PUBLICAR`.
