# DNX Partners — ETAPA 05 / IMPLEMENTACIÓN 02 — Resultado

**Fecha:** 2026-08-07  
**Estado:** `DONE`  
**Alcance:** carga inicial partners Clickatón (confirmados + prospectos) + upload real de logos + gate `publicVisibility`.

---

## 1. Estado general

DONE en producción Clickatón (`maratonfotografica.com`) y gate de visibilidad también en FotoRank.

- 29 `DnxPartner` cargados (20 ACTIVE confirmados + 9 PROSPECT).
- 20 participaciones `CONFIRMED` en edición `clickaton-argentina-2026`, todas `publicVisibility=HIDDEN`.
- 22 contributions (sin montos inventados; `requiresPayment=false`).
- Logos: UI **Subir logo** (archivo → R2 → `DnxPartnerAsset`); `logoUrl` fuera del flujo normal.
- Publicación manual separada de aprobación de logo.
- Idempotencia verificada (segunda corrida: 29 `YA_EXISTE`).

---

## 2. Edición Clickatón

| Campo | Valor |
|-------|-------|
| id | `cms78cthj0000xpc4841bihf4` |
| slug | `clickaton-argentina-2026` |
| name | Clickatón - Dia del Fotógrafo 2026 - 1era Edición |
| isPublished | true |
| registrationEnabled | true |

Única edición publicada — sin ambigüedad.

---

## 3–10. Carga

| Métrica | Valor |
|---------|-------|
| Confirmados recibidos | 20 |
| Confirmados creados | 20 (partners ACTIVE + participaciones HIDDEN) |
| Confirmados ya existentes | 0 (DB vacía al inicio Imp02) |
| Ambiguos | 0 |
| Prospectos recibidos | 9 |
| Prospectos creados | 9 (`PROSPECT`, sin participación) |
| Prospectos existentes | 0 |
| Duplicados evitados | 0 (sin matches previos); re-run = 29 YA_EXISTE |

Dry-run: `CREAR: 29`. Apply (tras regenerate Prisma): partners + participaciones + contributions.

---

## 11–12. Enriquecimiento / descartado

Cargado solo lo verificado en el brief (Instagram/web/email/teléfono/dirección El Baúl, Fontanarrosa, Congreso Nómade, Terra, FDF, AFONA, Tecnoflash dirección).

Descartado / pendiente humano:

- Tecnoflash: dos teléfonos públicos → en notas, `phone` vacío.
- SCOOPX vs `scoxdatarecovery` → nota identity PENDING.
- Claroscuro / Arenhas / Cine Monumental / PhotoStraps aporte → flags de revisión.
- Copy Express rol SPONSOR\|COLLABORATOR → `roleDecisionPending`.

---

## 13. Responsables internos

En `notes` como texto: `Responsable interno Clickatón: Rodri|Dani|Tammy` (no como contactos del partner).

---

## 14–16. Contributions / pago

- Creadas: 22 (definidas + pendientes explícitas).
- Pendientes: Vicario, Fotolag, PhotoStraps (sin aporte), FECA catering, Fontanarrosa premiaciones, etc.
- Participaciones con pago: **0**.

---

## 17–18. Visibilidad

- Confirmados: `CONFIRMED` + `publicVisibility=HIDDEN` → **no** aparecen en landing.
- Prospectos: sin participación → **no** públicos.
- Gate canónico: `publicVisibility` (`HIDDEN`\|`PUBLIC`) + filtro listado público.

---

## 19–23. Logos / publicación

- Upload archivo PNG/JPG/WEBP (SVG bloqueado).
- Storage: R2 existente (`clickaton/partners/.../brand/...`) + proxy `/api/media/...`.
- `logoUrl` legacy retenido; quitado de alta/edición normal.
- Aprobar logo ≠ publicar. Botón **Publicar en landing** / **Ocultar**.

---

## 24–31. Calidad / ops

| Check | Resultado |
|-------|-----------|
| Tests `@repo/partners` | 85/85 PASS (incluye visibility) |
| Typecheck CK (artefacto) | PASS |
| Prisma migrate | `20260807180000_dnx_partner_public_visibility` FR+CK |
| Dry-run | CREAR 29 |
| Apply | 20 participaciones + 22 contrib; re-run YA_EXISTE 29 |
| Backup FR | `br-misty-tree-ada8azep` |
| Backup CK | `br-red-silence-awpn7nqp` |
| Deploy CK | `dpl_9W8T365baPwC1MZNJM8qzMttG6L1` |
| Deploy FR | `dpl_33fBDugEgSXogLKSKvFNEnooGWDo` |
| Smoke | home/maratón CK 200 · SFEF 200 |

---

## 32–35. Listas finales / revisión humana

**CONFIRMADOS (HIDDEN):** Venite con Tiempo, Sliders, Choco & Arte, Multi Shop, Copy Express*, Beba Lopergolo, Reggi Vinoteca, Claroscuro*, Cine Monumental*, Fraganshop, Vicario*, Fotolag*, El Baúl del Fotógrafo, PhotoStraps*, Arenhas Bar*, Spa CaroBig, FECA*, Mucha Escuela, Centro Cultural Roberto Fontanarrosa*, Andrés Preumayr*.

**PROSPECTOS:** Enchulame la Cámara, Tecnoflash*, Recupero Datos, SCOOPX*, Congreso Nómade, Terra, Bienal Argentina de Fotografía Documental, FDF Argentina, AFONA.

\* requieren revisión humana (identidad, teléfonos, rol o aporte).

---

## 36. Próximo paso

1. Operador sube y aprueba logos en `/admin/sponsors/[id]`.
2. Publicar manualmente cada participación lista.
3. Resolver flags humanos (Copy Express rol, Tecnoflash teléfonos, SCOOPX naming, Claroscuro).

---

## Archivos clave

- Migración `packages/db/prisma/migrations/20260807180000_dnx_partner_public_visibility`
- Catalog + seed: `packages/db/scripts/data/clickaton-partners-imp02-catalog.ts`, `seed-clickaton-partners-imp02.mts`
- `@repo/partners` visibility helpers + `publishParticipation`
- Clickatón: `PartnerLogoUpload`, `/api/admin/partners/[partnerId]/logo`, public filter + media keys
