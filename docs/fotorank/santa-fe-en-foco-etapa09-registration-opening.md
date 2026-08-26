# Santa Fe en Foco — ETAPA 09 — Apertura controlada de inscripciones (producción)

**Fecha:** 2026-08-04  
**Resultado actual:** **GO — LIVE (apertura limitada)**  
**Evidencia:** `docs/fotorank/santa-fe-en-foco-etapa09-golive-result.md`  
**Production:** `dpl_6AnSXBHBJXGQ1dPZ3i9tNZSkaZzV`

## Autorización institucional (CAMINO B)

| Campo | Valor |
|-------|--------|
| Responsable | Mario Alberto Laus |
| Cargo | Presidente de la Sociedad de Fotógrafos Profesionales de Rosario |
| Timestamp registro | 2026-08-04 (recepción operador ~15:59 ART) |
| Versión textos | `sfef-provisional-institutional-v1` |
| Alcance | Inscripción FREE + landing + auth + panel + admin |
| Upload | **OFF** (`PENDING_OPERATOR_CONFIRMATION`) |
| Documento | `santa-fe-en-foco-institutional-authorization-etapa09.md` |

**Advertencia:** no equivale a aprobación jurídica formal (CAMINO A). Riesgo de publicación provisoria asumido por la organización.

## Preparado (aún no go-live)

- Texto provisorio sin marcadores `BORRADOR` / `NO PUBLICAR`: `apps/fotorank/app/lib/fotorank/rules-lifecycle/santa-fe-provisional-institutional-v1.ts`
- Seed productivo acotado: `packages/db/prisma/scripts/seed-santa-fe-en-foco-production.ts` (requiere `SFEF_INSTITUTIONAL_AUTH=1` + `SFEF_ALLOW_PRODUCTION_SEED=1`)
- UI: aviso “carga todavía no habilitada” cuando la ventana de upload está cerrada
- Production intacta: `dpl_525VUHaEaz9ANgbFBQnMe9oryZyg`
- Staging intacto: `dpl_2vxiteyEEmwSRSBVwdXXgx6DZBmp`

## Pendiente de confirmación operativa del operador

Antes de backup / migrate / seed / deploy / alias:

1. Abrir solo inscripción FREE con upload OFF — **default sí**
2. Fallback email (pantalla + admin) si Resend no envía — **default sí (GO WITH CONDITIONS)**
3. Autorizar ejecución Production (backup → migrate → seed → candidate → promote) — **requiere “procedé” explícito**

## URLs canónicas (cuando se habilite)

- Landing: `https://fotorank.dnxsuite.com/concursos/santa-fe-en-foco`
- Inscripción: `https://fotorank.dnxsuite.com/concursos/santa-fe-en-foco/inscripcion`
- Login: `https://fotorank.dnxsuite.com/login?next=/concursos/santa-fe-en-foco/inscripcion`

**URL final difundible:** aún no (falta go-live confirmado).

## Rollback

`registrationEnabled=false` + revert deployment. No borrar inscripciones.

---

CAMINO B registrado. Esperando confirmación de ejecución productiva.
