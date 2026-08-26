# Santa Fe en Foco — Carga de premios (resultado operativo)

**Estado:** DONE  
**Fecha:** 2026-08-11  
**Rama local del script:** `feat/fotorank-sfef-public-page-visual`  
**SHA al momento de la corrida:** `c6410b9c991f163c427aaeb45e5fccd43406ede2`

## Qué se hizo

Carga idempotente de **12 premios monetarios** en `FotorankContest.rulesData.premiosRecompensas` del concurso productivo Santa Fe en Foco.

- No se crearon categorías nuevas.
- No se asignaron ganadores.
- No se habilitaron resultados / jurado / fases cerradas.
- No se modificaron bases, fechas, partners ni otros concursos.

## Guards

- Slug `santa-fe-en-foco` → ID `cmsf1je750005xpzcrizp52rd` (match OK).
- Host Neon `ep-dawn-dew`.
- Flags: `SFEF_ALLOW_PRODUCTION_PRIZES=1`, `SFEF_INSTITUTIONAL_AUTH=1`, `--confirm-fotorank-production-prizes`.

## Script

```bash
SFEF_ALLOW_PRODUCTION_PRIZES=1 \
SFEF_INSTITUTIONAL_AUTH=1 \
SFEF_PRIZES_DRY_RUN=1 \
pnpm --filter @repo/db exec tsx prisma/scripts/ops-sfef-configure-prizes-production.ts

# Apply:
SFEF_ALLOW_PRODUCTION_PRIZES=1 \
SFEF_INSTITUTIONAL_AUTH=1 \
pnpm --filter @repo/db exec tsx prisma/scripts/ops-sfef-configure-prizes-production.ts \
  --confirm-fotorank-production-prizes
```

Lógica pura + tests: `prisma/scripts/lib/sfef-configure-prizes.ts` · `pnpm --filter @repo/db test:sfef-configure-prizes`

## Backup / rollback

Snapshot lógico previo (rulesData completo del concurso):

- `/tmp/fotorank-prod-backups/sfef-prizes-backup-2026-08-11T05-44-53-008Z.json`
- `.data/fotorank-prod-backups/sfef-prizes-backup-2026-08-11T05-44-53-008Z.json`

Rollback: restaurar `rulesData` del JSON al concurso `cmsf1je750005xpzcrizp52rd`.

## Totales verificados en DB

| Categoría | Premios | Suma |
|-----------|---------|------|
| Fotógrafo Profesional | 3 | 1.200.000 |
| Fotógrafo Amateur | 3 | 1.200.000 |
| Reportero Gráfico | 3 | 1.200.000 |
| Fotografía Aérea | 3 | 1.200.000 |
| **Total** | **12** | **4.800.000 ARS** |

Importes canónicos: `500000` / `400000` / `300000`, moneda `ARS`, `deliveryStatus: PENDING`, sin `winnerLabel`.

## Lectura pública

URL verificada: https://fotorank.dnxsuite.com/concursos/santa-fe-en-foco `#premios`  
Deployment observado en HTML: `dpl_5xr1Dqzey2BjhMWaUWvZnK1GWRz2`  
IDs de premio del módulo visibles (`sfef-2026-…`). No se requirió redeploy: cambio solo de datos.

## Notas

- Denominación pública de categorías **sin cambios** (se reutilizaron «Fotógrafo Profesional / Amateur», etc.).
- Re-corrida idempotente: `keep=12`, sin duplicados.
