# Clickatón Argentina 2026 — Checklist maestro pre-lanzamiento

**Etapa:** **10G.0 — Launch scope: venta de inscripciones**  
**Fecha:** 2026-07-31  
**Edición:** Clickatón Argentina 2026 (`clickaton-argentina-2026`)  
**Dominio:** `https://maratonfotografica.com`  
**Inscripciones:** `registrationEnabled=false`  
**LIVE payments flag:** `DNX_CLICKATON_MP_LIVE_PAYMENTS_ENABLED` = **OFF**  
**Social LIVE:** `DNX_SOCIAL_PUBLISHER_LIVE` = **OFF**  
**Legal:** `LEGAL REVIEW REQUIRED`  
**Sales gate doc:** `docs/clickaton/CLICKATON_REGISTRATION_SALES_LAUNCH.md`  
**Alignment (parcial OK):** `docs/clickaton/CLICKATON_2026_RULES_PLATFORM_ALIGNMENT.md`  
**Runbook:** `docs/clickaton/CLICKATON_FINAL_LIVE_E2E_RUNBOOK.md`

---

## Veredicto (10G.0)

```text
CLICKATON REGISTRATION SALES BLOCKED
```

Rules alignment global puede seguir PARTIAL. Post-evento (CLF/royalties) **no** bloquea venta.

| Capacidad | Estado |
|-----------|--------|
| Ficha pública sales (Rosario / horarios / remera) | PASS deploy 10G |
| MP LIVE config preflight | PASS · execution OFF |
| Post-pago funnel (evidencia previa) | PASS |
| LEGAL SALES | **BLOCKED** |
| Edition DRAFT → REGISTRATION_OPEN | **BLOCKED** (ops) |
| LIVE + registrationEnabled | OFF a propósito |
| CONTROLLED LIVE E2E | PENDING auth |

No GO de ventas. No cobro LIVE. No apertura de inscripciones.

---

## Resumen reglas críticas

| Área | Estado |
|------|--------|
| Schedule 17:00–21:00 + TZ BA + reject @21:00 | PASS (dominio/seed) |
| 10 consignas + 8/10 elegibilidad | PARTIAL |
| Remera first-100 / 30/08 | PASS |
| Royalty 20% / colectivo 0% | PASS (dominio) |
| Returning / Annual pass / transfer | PARTIAL |
| CLF sync finalistas + panel retiro | MISSING |
| Social carousel + likes 72h | PARTIAL (LIVE OFF) |
| Menores / licencias / términos | PARTIAL + LEGAL REVIEW |

---

## Frases de control

```text
LEGAL APPROVED FOR REGISTRATION
```

Solo después: activar LIVE flag + E2E controlado según runbook.

---

**Fin checklist (10F.0)**
