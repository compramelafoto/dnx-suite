# Clickatón 2026 — Alineación plataforma ↔ Bases

**Etapa:** 10F.0 → actualizado **10G.3 Schedule V2**  
**Fecha:** 2026-07-31  
**Edición:** `clickaton-argentina-2026`  
**Inscripciones:** cerradas (`registrationEnabled=false`)  
**LIVE payments:** OFF  
**Social LIVE:** OFF (`DNX_SOCIAL_PUBLISHER_LIVE=false`)  
**Legal:** Bases v1 aprobadas; **v2** (`CLICKATON_TERMS_2026_09_19_v2`) publicada con cronograma materialmente distinto — confirmación formal humana de v2 pendiente antes de abrir ventas.

### Schedule V2 (canónico)

| Ventana | Horario AR | Contrato |
|---------|------------|----------|
| Acreditación | 14:00–16:00 | timeline `ACCREDITATION_*` |
| Charla | 16:00–16:30 | timeline `CUSTOM` |
| Captura | **[16:00, 20:00)** | EXIF `DateTimeOriginal` — exclusive end |
| Upload | **[16:00, 22:00)** | reloj servidor — exclusive end |

Fuente: `apps/clickaton/config/editions/argentina-2026.ts` · selfcheck `selfcheck:rules-2026`.
**Veredicto técnico:** `CLICKATON RULES ALIGNMENT PARTIAL`

**Deploy Staging 10F.0:** `https://clickaton-staging.vercel.app` (`dpl_AkqTygb…`)  
**Migrate Staging:** pendiente aplicar `20260731180000_clickaton_10f0_rules_alignment` (DATABASE_URL Encrypted en pull CLI).  
**Production:** no deploy de schema en esta pasada hasta migrate Staging PASS.

### Reconciliación vs auditorías exploratorias (pre-10F.0)

Las auditorías de código leyeron el árbol **antes** del cierre de esta etapa. Hallazgos clave ya **superados en código** (no reabrir como blockers A/B/D/J/W del estado viejo):

| Hallazgo auditoría (pre) | Estado post-10F.0 |
|--------------------------|-------------------|
| TZ SoT Cordoba / start 09–20 / sin charla / 3 prompts | Config+seed: BA, 17–21, charla CUSTOM, 10 prompts, timeline con ISO |
| Upload close inclusivo / sin warning cámara | Exclusive end @21:00 + warning UI |
| Sin 8/10, edit rules, AI flag, royalty, business-days, entitlements | Dominio `lib/rules-2026/*` + selfcheck 47 |
| Sin modelos prize/social vote/ledger/REPROGRAMMED | Schema + migration SQL |
| Rúbrica FR ≠ 4 criterios Clickatón | `clickaton-2026-rubric.ts` (activar en concurso aún PARTIAL) |

**Siguen válidos como blockers** (coinciden ambas auditorías + matriz abajo): N/R/S (CLF sync/panel/cert), G likes Insights + carousel LIVE, wire checkout entitlements, wire competitiveStatus + `winnersPerScope=3`, migrate+seed Staging, LEGAL.

---

## Contrato canónico (código)

| Pieza | Ubicación |
|-------|-----------|
| Schedule + rules | `apps/clickaton/config/editions/argentina-2026.ts` |
| Dominio puro | `apps/clickaton/lib/rules-2026/*` |
| Upload exclusive close | `apps/clickaton/lib/photo-upload/windows.ts` |
| TZ default | `America/Argentina/Buenos_Aires` |
| Seed | `apps/clickaton/scripts/seed-argentina-2026-edition.ts` |
| Selfcheck | `pnpm --filter clickaton selfcheck:rules-2026` |
| Rúbrica jurado | `apps/fotorank/.../clickaton-2026-rubric.ts` |
| Schema | entitlements, prize bundles, social voting, royalty ledger |

---

## Matriz BASES → implementación → test → estado

| ID | Bases | Implementación | Test | Estado |
|----|-------|----------------|------|--------|
| A | 19/09, acred. 14–16, charla 16–16:30, captura [16–20), upload [16–22), TZ BA | config + seed/ops timeline + exclusive ends | selfcheck capture/upload/cross | **PASS** (10G.3) |
| B | 10 consignas, 1 foto, no dup, min 8/10 ELIGIBLE (solo capture-valid) | seed 10 prompts + `countCaptureValidPrompts` | selfcheck 8/10 + invalid capture | **PASS** dominio (wire persistencia admission aún PARTIAL) |
| C | EXIF captura [16–20), warning cámara V2, review | windows exclusive + warning UI + MANUAL_REVIEW | selfcheck EXIF boundaries | **PASS** (10G.3) |
| D | ALLOWED/FORBIDDEN + AI flag + RAW opcional | `edit-rules.ts` | selfcheck | **PARTIAL** (flag en confirm/admin pendiente UI) |
| E | Jurado anónimo 1–10 × 4 criterios | rubric Clickatón + jury FR existente | selfcheck criteria | **PARTIAL** (activar rúbrica en concurso FR) |
| F | TOP 3 / prompt FINALIST max 30 | `selectTopFinalistsByScore` | selfcheck | **PARTIAL** (wire result-service `winnersPerScope=3`) |
| G/AI | Carrusel + 72h likes API | `social-voting.ts` + `social-carousel-capacity.ts` | selfcheck 72h | **PARTIAL** (Insights API + publish pipeline PENDING; LIVE OFF) |
| H | Fraud admin override | modelo `ClickatonSocialVoteFraudFlag` | — | **PARTIAL** |
| I | Winner likes / tie MANUAL_REVIEW | `resolveWinnerByLikes` | selfcheck | **PARTIAL** |
| J | 10 prize bundles random | modelo + seed slots + assign | selfcheck | **PARTIAL** (contenido sponsors DRAFT) |
| K/L/M | Licencias promo/comercial 12m | `licenses.ts` + wizard checkboxes | selfcheck | **PARTIAL** + **LEGAL REVIEW** |
| N | Sync finalistas → CLF | — | — | **MISSING** |
| O | Royalty 20% excl. shipping | `royalty.ts` | selfcheck $100k→$20k | **PASS** (dominio) |
| P | COLLECTIVE_PRODUCT 0% | `royalty.ts` | selfcheck | **PASS** (dominio) |
| Q | Ledger + 15 business days | modelo + `business-days.ts` | selfcheck | **PARTIAL** |
| R | Panel retiro fotógrafo | modelo estados | — | **MISSING** (UI) |
| S | Certificado venta | — | — | **MISSING** |
| T | Cron licenseEnd unpublish | `shouldUnpublishForNewSales` | selfcheck | **PARTIAL** (cron PENDING) |
| U | Derechos imagen + IP/audit | wizard checkbox + schema fields | — | **PARTIAL** |
| V | Remera first-100 / 30/08 | existente | first-n selfcheck | **PASS** |
| W | Returning 7 días | `entitlements.ts` + modelo | selfcheck | **PARTIAL** (checkout wire PENDING) |
| X–AB | Pase anual ×4, consume prompts, transfer, merch no auto | dominio + modelo ANNUAL_PASS | selfcheck | **PARTIAL** |
| AC | Transfer inscripción 1× | dominio + statuses | selfcheck | **PARTIAL** |
| AD/AE | REPROGRAMMED / REFUND_REQUESTED | enum statuses | — | **PARTIAL** |
| AF | Menores + legal fields review | `minors.ts` | selfcheck | **PARTIAL** + **MINOR LEGAL FIELDS REVIEW REQUIRED** |
| AG | CLICKATON_TERMS_VERSION | constant + wizard | selfcheck | **PARTIAL** |
| AH | Admin config sin código | `rulesConfig` Json + admin parcial | — | **PARTIAL** |

---

## Blockers exactos (antes de FULLY ALIGNED)

1. **N/R/S** — Integración comercial CLF finalistas + panel retiro + certificado (UI/servicio).  
2. **G** — Instagram Insights likes oficiales + pipeline carrusel (capacidad sí; ejecución no).  
3. **W/X checkout** — Wire entitlements al precio de inscripción / producto Pase Anual.  
4. **B wire** — Persistir `competitiveStatus` al cerrar uploads / admission batch.  
5. **F wire** — `winnersPerScope=3` + `resultStatus=FINALIST` en FotoRank para Clickatón.  
6. **LEGAL** — menores, licencias, comercialización, colectivos, cancelación/devolución.  
7. **Migrate + seed Staging** — aplicar schema 10F.0 y re-seed edición.

---

## Controles no negociables (esta etapa)

- No abrir inscripciones.  
- No `DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED=true`.  
- No `DNX_SOCIAL_PUBLISHER_LIVE=true`.  
- No cobros LIVE / refunds / withdrawals reales.  
- No declarar aprobación legal profesional.

---

## Cómo revalidar

```bash
pnpm --filter clickaton selfcheck:rules-2026
pnpm --filter clickaton selfcheck:first-n-benefit
# Tras migrate:
CLICKATON_SEED_ARGENTINA_2026=1 pnpm --filter clickaton seed:argentina-2026
```

---

**Fin 10F.0 alignment doc**
