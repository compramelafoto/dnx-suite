# DNX Partners — ETAPA 05 / IMPLEMENTACIÓN 01 — Resultado

**Fecha:** 2026-08-07  
**Estado:** `DONE`  
**Alcance:** click tracking / outbound attribution multiplataforma (FotoRank + Clickatón producción).

---

## 1. Estado general

Capa canónica de **outbound click tracking** en `@repo/partners`, persistencia Prisma aditiva, redirect `/r/[trackingKey]` en FotoRank y Clickatón, admin de destino/tráfico, métricas básicas, privacy-first.

- Migración aplicada en FR y CK producción.
- Deploys production **READY**.
- Smoke PASS (landing, inscripción/login gate, tienda CK, `/r/*` 404 seguro).
- Sin partners ficticios creados.
- Sin clicks comerciales medidos todavía (0 outbound links: no hay `destinationUrl` / website configurado para tracking).
- Kill switch: `DNX_PARTNER_CLICK_TRACKING_ENABLED` (default ON salvo `false`).

---

## 2. Modelo outbound links

`DnxPartnerOutboundLink` — enlace trackeable reutilizable por participación/placement.

Campos clave: `trackingKey`, `partnerId`, `participationId`, `application`, `contextType`, `contextId`, `assetId`, `placement`, `destinationUrl`, UTMs, `status`, vigencia, soft archive.

---

## 3. Modelo click events

`DnxPartnerClickEvent` — evento de click outbound.

Campos: ids de atribución, `occurredAt` (UTC), `referrerHost`, `deviceClass`, `browserFamily`, `countryCode` opcional, `metadata` mínimo.

**No** IP completa, no PII, no fingerprint, no cookies cross-site.

---

## 4. Destination URL

- Partner global: `websiteUrl`
- Participación: `destinationUrl` + `clickTrackingEnabled` (default `true`)
- Resolución: participación → asset/CTA → website → sin enlace

---

## 5. Tracking key

`buildTrackingKey(partnerSlug)` → `{slug}-{suffix}` no secuencial, único, estable una vez creado.

---

## 6. Endpoint redirect

- FotoRank: `https://fotorank.dnxsuite.com/r/[trackingKey]`
- Clickatón: `https://maratonfotografica.com/r/[trackingKey]`
- Misma lógica `@repo/partners.resolveOutboundRedirect`

---

## 7. Redirect status

`302` (destino puede cambiar; no 301).

---

## 8. Seguridad open redirect

Destino solo desde link configurado en DB. Query `?destination=` ignorado. Validación HTTPS + rechazo `javascript:` / `data:` / protocolos peligrosos.

---

## 9. UTMs

`buildPartnerAttributedUrl` — agrega UTMs si ausentes:

| App | source | medium | campaign |
|-----|--------|--------|----------|
| Clickatón | `clickaton` | `partner` | edition slug |
| FotoRank / SFEF | `fotorank` | `partner` | `santa-fe-en-foco-2026` (slug SFEF) / contest slug |

---

## 10–13. Aplicación / contexto / placement / asset

Enums canónicos DNX Partners. Placement incluye `BANNER` (previsto, no usado). `assetId` opcional.

---

## 14–17. Privacidad / IP / UA / referrer

Privacy-first. IP solo seed efímero de rate-limit (no persistida). UA → `deviceClass` (+ `browserFamily` liviano). Referrer → host sanitizado.

---

## 18–20. Bots / rate limit / kill switch

- Bots/crawlers/preview: no cuentan.
- Rate-limit in-memory: skip evento, **sí** redirect.
- `DNX_PARTNER_CLICK_TRACKING_ENABLED=false`: redirect sin registrar.

Fallo al persistir evento: log seguro + redirect si destino válido.

---

## 21–22. Métricas + admin tráfico

Servicios: `getPartnerTrafficSummary`, counts por partner/participación/app/contexto/placement, ventanas 7d/30d/total.

Admin:

- Clickatón partner: sección **Enlaces y tráfico**
- FotoRank concurso sponsors: columna Clicks + bloque en edición

---

## 23–25. Integraciones

- FotoRank públicos: `ContestPartnersSection` usa `/r/...` si tracking activo.
- Santa Fe en Foco: mismo path + campaign `santa-fe-en-foco-2026`.
- Clickatón: `MarathonSponsors` + `edition-partners-public`.

---

## 26–28. Tests

| Suite | Resultado |
|-------|-----------|
| `@repo/partners` (81) | PASS (incluye tracking) |
| Typecheck FotoRank | PASS |
| Typecheck Clickatón (artefacto deploy) | PASS |
| Build FR / CK | PASS |

Tests de dominio cubren create link, key, URL safety, open redirect, UTMs, tracking OFF, fallo de registro vs redirect. No se inventaron partners productivos para e2e de click real.

---

## 29–32. Typecheck / lint / builds / migración

Migración: `packages/db/prisma/migrations/20260807140000_dnx_partner_click_tracking`

Aplicada:

- FR `ep-dawn-dew` / `neondb` — up to date
- CK `ep-silent-haze` / `clickaton_production` — up to date

---

## 33–35. Backup / deploy / smoke FotoRank

| Campo | Valor |
|-------|-------|
| Backup | `backup-fotorank-partners-click-tracking-20260807` (`br-dry-morning-adb3nn3u`) ready |
| Deploy | `dpl_3Q3ZJky8PVtvQD26i3DMj7m6gVd4` READY |
| Alias | `https://fotorank.dnxsuite.com` |
| Rollback | `dpl_AH7hgbpDLxt7TFubibEBeiGbiwoT` |
| Smoke | SFEF 200 · inscripción→login 200 · `/r/unknown` 404 |

---

## 36–38. Backup / deploy / smoke Clickatón

| Campo | Valor |
|-------|-------|
| Backup | `backup-clickaton-partners-click-tracking-20260807` (`br-patient-salad-awe8x1ia`) ready |
| Deploy | `dpl_9E5wxfXUDEVTVkybqRP7KetzH8x2` READY |
| Alias | `https://maratonfotografica.com` |
| Rollback | `dpl_Bye7V7vKRpwbvj8zcikzkQUAgJ6t` |
| Smoke | home/maratones/tienda 200 · `/r/unknown` 404 |

---

## 39–40. Prueba controlada / clicks medidos

**No ejecutada en producción** sobre partner real: 0 `destinationUrl` y 0 outbound links activos.  
Validación técnica vía tests de dominio. Al configurar destino + tracking en admin, el primer click creará evento + redirect con UTM.

Estado actual DB:

- FR: 2 partners / 2 participaciones · 0 outbound · 0 clicks
- CK: 0 outbound · 0 clicks (catálogo según entorno)

---

## 41–42. Producción estable / rollback

Producción estable. Rollback app: redeploy deployment previo. Rollback DB: branch Neon de backup (aditiva; normalmente no requiere restore).

---

## 43. Riesgos

- Sin destination configurado → logos sin link trackeable (correcto).
- Rate-limit in-memory no compartido entre instancias Vercel.
- Detección de bots por UA heurística (limitada).
- Disco local/CI ajustado al armar worktrees de deploy.

---

## 44. FUTURE

Impresiones, CTR, banners, PDF/Excel, email mensual, dashboards avanzados, unique visitors, retención automática, InfoSpot/CLF wiring.

---

## 45. Archivos principales

- `packages/db/prisma/schema.prisma` + migración `20260807140000_dnx_partner_click_tracking`
- `packages/db/src/partners-prisma-repository.ts`
- `packages/partners/src/tracking.ts`, `tracking-api.ts`, `partners-tracking.test.ts`, `service.ts`, `types.ts`, `index.ts`
- `apps/fotorank/app/r/[trackingKey]/route.ts` + public/admin partners
- `apps/clickaton/app/r/[trackingKey]/route.ts` + public/admin partners
- `turbo.json` (`DNX_PARTNER_CLICK_TRACKING_ENABLED`)

---

## 46. % Sponsors MVP tras esta implementación

MVP prioritario agosto (roles/landing/admin) ya cerrado (~95%).  
Con click tracking productivo listo (infra + apps): **~98%** del MVP Sponsors medible; falta activación operativa de destinations autorizadas y primer informe real.

---

## 47. Próximo paso recomendado

1. Configurar `destinationUrl` autorizado en partners reales (SFEF / ediciones CK).
2. Un click controlado + verificar evento + UTM.
3. Etapa 05 Imp 02 (cuando corresponda): impressions/banners **o** informe partner agregado (sin PDF aún).
