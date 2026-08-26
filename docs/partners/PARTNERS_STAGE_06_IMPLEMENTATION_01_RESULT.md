# DNX Partners — ETAPA 06 / IMPLEMENTACIÓN 01 — Resultado

**Fecha:** 2026-08-07  
**Estado:** `DONE`  
**Alcance:** auditoría, cierre de gaps y redeploy productivo del Click Tracking / Outbound Attribution de Partners (FotoRank + Clickatón).

---

## 1. Estado general

El sistema canónico de click tracking **ya existía** (Etapa 05 Imp 01) con modelos Prisma, `@repo/partners`, `/r/[trackingKey]`, UTMs, kill switch, métricas y rendering público.

Esta implementación:

1. Audizó el repo (sin reconstruir).
2. Cerró gaps menores (aliases de métricas, admin Tráfico ES, bug `INACTIVE`→`PAUSED`, tests ampliados).
3. Confirmó migraciones **up to date** en FR y CK.
4. Creó backups Neon frescos.
5. Redeployó producción FR + CK.
6. Smoke PASS.

**No staging.**

---

## 2. Resultado auditoría previa

| Componente | Clasificación |
|---|---|
| `DnxPartnerOutboundLink` | EXISTS_COMPLETE |
| `DnxPartnerClickEvent` | EXISTS_COMPLETE |
| `PartnerClick` (nombre) | MISSING → equivalente `ClickEventRecord` |
| `PartnerTraffic` (nombre) | MISSING → equivalente `PartnerTrafficSummary` |
| `trackingKey` / `/r/` | EXISTS_COMPLETE |
| `destinationUrl` | EXISTS_COMPLETE |
| `buildPartnerAttributedUrl` | EXISTS_COMPLETE |
| `getPartnerTrafficSummary` | EXISTS_COMPLETE |
| `countPartnerClicks` | EXISTÍA como `countClickEvents` / `countParticipationClicks` → **alias agregado** |
| Admin tráfico | EXISTS_PARTIAL → pulido a sección **Tráfico** |
| Migración `20260807140000_dnx_partner_click_tracking` | EXISTS_COMPLETE (aplicada) |

---

## 3–5. Componentes existentes / creados / reutilizados

**Ya existían:** modelos Prisma, tracking domain/API, routes `/r`, public loaders, kill switch, onboarding→destinationUrl, tests base.

**Creados/cerrados en Imp 01 Etapa 06:**

- Aliases API: `countPartnerClicks`, `countClicksByApplication`, `countClicksByContext`, `countClicksByPlacement`
- `OUTBOUND_LINK_STATUS_LABELS`
- Sección admin **Tráfico** (totales + 7d/30d + por plataforma + por participación)
- Tests ampliados (UTM FR, soft-fail, bots, archived/expired, privacy helpers)

**Reutilizados:** `ensureParticipationOutboundLink`, `resolveOutboundRedirect`, enums canónicos, flags `DNX_PARTNER_CLICK_TRACKING_ENABLED`.

---

## 6–25. Capacidad canónica (confirmada)

| # | Ítem | Estado |
|---|---|---|
| 6 | `DnxPartnerOutboundLink` | Operativo |
| 7 | `DnxPartnerClickEvent` | Operativo |
| 8 | Destination URL | Participación → asset → website |
| 9 | Tracking key | `{slug}-{suffix}` no secuencial |
| 10 | Endpoint `/r` | FR + CK |
| 11 | Redirect | **302** |
| 12 | Open redirect | Destino solo desde DB; query ignorada |
| 13 | Soft-fail | Persist fail → igual redirect |
| 14 | UTMs | CK `clickaton` / FR `fotorank`, medium `partner` |
| 15 | Applications | Enums canónicos |
| 16 | Context | CK `EDITION` / FR `CONTEST` |
| 17 | Placements | Enum completo; auto `LOGO` |
| 18 | Assets | `assetId` opcional |
| 19 | Privacidad | Sin PII / fingerprint / cookies |
| 20 | IP | Solo seed efímero rate-limit |
| 21 | Referrer | Hostname sanitizado |
| 22 | Device | MOBILE/TABLET/DESKTOP/OTHER |
| 23 | Bots | Heurística UA; no cuentan |
| 24 | Rate limit | In-memory; skip evento, sí redirect |
| 25 | Kill switch | `DNX_PARTNER_CLICK_TRACKING_ENABLED` |

---

## 26–29. Métricas / admin / onboarding

- `getPartnerTrafficSummary` + aliases de conteo.
- Admin CK: Sponsors → Partner → **Tráfico**.
- Onboarding: `destinationUrl` se aplica al aprobar (sin reconstruir).

---

## 30–32. Integraciones

- **FotoRank:** `ContestPartnersSection` + `/r/` + public-groups.
- **Santa Fe en Foco:** slug público `santa-fe-en-foco` (smoke 200).
- **Clickatón:** `MarathonSponsors` + edition-partners-public.

---

## 33–38. Quality gates

| Gate | Resultado |
|---|---|
| Tests `@repo/partners` | **97/97 PASS** |
| Typecheck (en build Vercel FR/CK) | PASS |
| Builds FR / CK | PASS |
| Migración | Sin cambios nuevos; `migrate status` **up to date** en ambas DBs |

---

## 39–45. Backup / deploy / smoke

### Backup FotoRank

| Campo | Valor |
|---|---|
| Project | `compramelafoto` / `divine-hall-10689679` |
| Parent | `development` (`br-old-rain-adwthzng`, host `ep-dawn-dew…`, db `neondb`) |
| Backup | `backup-fotorank-partner-clicktracking-prod-20260807` |
| Branch ID | `br-dry-sunset-admi7u8w` |

### Deploy FotoRank

| Campo | Valor |
|---|---|
| Deployment | `dpl_DXkT1TQBRjeukD1YNAYcXQip5bsg` |
| SHA local (workspace) | `3737054f` |
| Estado | READY |
| Alias | `https://fotorank.dnxsuite.com` |
| Rollback | `dpl_6wh62QpjXE6XqbdjcMABuGvaWjDx` |

### Smoke FotoRank

- `/` 200 · SFEF 200 · `/r/unknown` 404 · inscripción gate 200

### Backup Clickatón

| Campo | Valor |
|---|---|
| Project | `clickaton-production` / `bitter-math-56019731` |
| Parent | `production` (`br-billowing-paper-aw1nrj9t`, host `ep-silent-haze…`, db `clickaton_production`) |
| Backup | `backup-clickaton-partner-clicktracking-prod-20260807` |
| Branch ID | `br-soft-truth-aw7slc9o` |

### Deploy Clickatón

| Campo | Valor |
|---|---|
| Deployment | `dpl_BjX7H8UPbaf4m8ZKRxxJi3BQyGr1` |
| Estado | READY |
| Alias | `https://maratonfotografica.com` |
| Rollback | `dpl_6AUkZJk9wjg4FC9jUGAxWB7KBTa8` |

### Smoke Clickatón

- `/` 200 · maratones 200 · tienda 200 · `/r/unknown` 404 · onboarding token inválido 200

---

## 46–47. Prueba controlada / clicks

**No ejecutada sobre partner real:** 0 `destinationUrl` y 0 outbound links activos en FR y CK prod.

```text
FR: links=0 clicks=0 withDest=0
CK: links=0 clicks=0 withDest=0
```

Validación técnica vía tests de dominio (incluye soft-fail, UTMs FR/CK, bots, expired/archived).

Al configurar destino autorizado + tracking en admin, el primer click medirá N→N+1.

---

## 48–50. Estabilidad / rollback / riesgos

- Producción estable tras smoke.
- Rollback app: promover deployment previo.
- Rollback DB: branch Neon de backup (migración aditiva; restore normalmente innecesario).
- Riesgos: rate-limit in-memory multi-instancia; bots heurísticos; 0 destinations → 0 medición comercial; deploy desde workspace con WIP ajeno (build/smoke PASS, monitorear).

---

## 51. FUTURE — Partner Analytics

Impresiones, CTR, asset/campaña/período, PDF/Excel, email mensual, banners, unique visitors. **No implementado.**

---

## 52. Archivos modificados (delta Etapa 06 Imp 01)

- `packages/partners/src/tracking-api.ts`
- `packages/partners/src/labels.ts`
- `packages/partners/src/index.ts`
- `packages/partners/src/partners-tracking.test.ts`
- `apps/clickaton/app/admin/(panel)/sponsors/[partnerId]/page.tsx`
- `docs/partners/PARTNERS_STAGE_06_IMPLEMENTATION_01_RESULT.md`

---

## 53. % MVP Sponsors

Infra + apps + cierre admin/métricas: **~98%**.  
Falta activación operativa de destinations autorizadas + primer informe real al partner.

---

## 54. Próximo paso recomendado

1. Configurar `destinationUrl` autorizado en 1–2 partners reales (SFEF / edición CK).
2. Un click controlado y verificar contador + UTM.
3. Etapa futura: Partner Analytics (impresiones/CTR/informe comercial).
