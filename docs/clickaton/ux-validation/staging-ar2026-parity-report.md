# Paridad comercial staging AR2026 — Imp. 07

**Fecha:** 2026-08-03 (actualizado Imp. 08)  
**Estado:** `DONE` en staging vía fixture + alias SEO/footer (`dpl_3mvpY1bQ8jiq9dLqhDbaLbt659GR`). SEO **productivo** sigue pendiente. Brick no ejercido.

## Causa de “Inscripción no disponible” (slug productivo)

En staging, `clickaton-argentina-2026` permanece con kill switch cerrado por diseño del seed operativo:

| Requisito | Producción | Staging AR2026 | Necesario para abrir |
| --------- | ---------- | -------------- | -------------------- |
| Edición existe | sí | sí | sí |
| `isPublished` | true | true (landing) | sí |
| `registrationEnabled` | true | **false** | **sí** |
| `status` operable | REGISTRATION_OPEN | DRAFT / seguro | sí (no DRAFT) |
| Ventana fechas | abierta | null/ok | open |
| Ticket vendible | sí | GENERAL existe | salesStatus open |
| Fases precio | 25k/30k/35k | seed | highest>current |
| Remera en fase | sí | seed | opcional UX |
| FAQ | código | código | fuente compartida |

**Causa exacta:** `registrationEnabled=false` (+ a menudo `status=DRAFT`) → `EDITION_NOT_AVAILABLE` / H1 “Inscripción no disponible”.  
No se abrió el slug productivo; se creó fixture separado.

## Fixture

| Campo | Valor |
| ----- | ----- |
| Nombre | Clickatón AR2026 — TEST UX |
| Slug | `ar2026-commercial-ux-test` |
| Seed | `pnpm --filter clickaton seed:ar2026-commercial-ux` (`CLICKATON_SEED_AR2026_COMMERCIAL_UX=1`) |
| Guard | `assertStagingDatabaseUrl` → solo `ep-round-fog…` |
| Idempotencia | upsert por slug; fases recreadas en el fixture |
| Datos productivos copiados | **ninguno** |

## Oferta comercial del fixture

| Ítem | Valor |
| ---- | ----- |
| Fase vigente | Fase TEST — Ahora · `$25.000` |
| Fase referencia (highest) | Fase TEST — Referencia · `$35.000` |
| Condición tachado | highest > current |
| Remera | incluida en fase actual + intermedia |
| Talles | 9 (XS–5XL) |
| FAQ | 9 ítems (`registrationExperienceFaq` en código) |
| Pack | ensureMarathonPackTicket |
| Cupo | 100 (TEST) |

## Selfcheck

`pnpm --filter clickaton readiness:ar2026-commercial-ux` → **`READY_FOR_PUBLIC_FUNNEL_SMOKE`**

## Funnel (smoke alias staging)

URL: `https://clickaton-staging.vercel.app/maratones/ar2026-commercial-ux-test/inscripcion`

| Check | Resultado |
| ----- | --------- |
| H1 | Inscripción — Clickatón AR2026 — TEST UX |
| Ahora | `$ 25.000` |
| Antes | `$ 35.000` |
| Remera | visible |
| FAQ | visible |
| Reservar → datos | sí |
| Brick | no abierto |
| Overflow 320–430/desktop | no |
| Footer “sin inscripciones” en alias | aún presente (SEO/footer Imp07 no desplegados al alias) |

## Diferencias con producción

| Dimensión | Clasificación |
| --------- | ------------- |
| Slug distinto (`…-test`) | Diferente intencional |
| Copy “TEST UX / no es venta real” | Diferente intencional |
| DB / participantes / pagos | Diferente intencional |
| Precio/tachado/remera/FAQ comportamiento | Equivalente |
| Abrir AR2026 real en staging | No hecho (riesgo) |

## Bloqueos

* Brick / MP TEST: sigue bloqueado (Imp. 05/06).  
* Deploy prod SEO: no realizado (política Imp. 07).  
* Worktree dirty partners WIP: rompe build si se despliega desde el worktree completo → deploy vía worktree limpio `3dfbfa7`+Imp07.
