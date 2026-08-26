# Santa Fe en Foco — Decisiones humanas (actualizado P0-09B)

**Regla:** no inventar valores.  
**RC:** `FOTORANK-SFEF-2026-RC1`  
**Última actualización:** 2026-07-28 (P0-09B)

Fuente estructurada: `buildSantaFeEnFoco2026Configuration()` + Wizard `/configuracion`.  
Bases: representación textual asociada a configuración publicada.

---

## Fechas y timezone

| Decisión | Estado | Valor | Fuente | Bloquea |
|----------|--------|-------|--------|---------|
| Timezone | CONFIRMED | `America/Argentina/Cordoba` | P0-09A/B | No |
| Apertura inscripción/carga | CONFIRMED | 2026-08-01 00:00 ART | P0-09A/B | No |
| Cierre | CONFIRMED | Exclusivo 2026-10-01 00:00 ART (30 sep inclusive) | P0-09A/B | No |
| Ventana captura | CONFIRMED | ago–sep 2026 inclusive | P0-09A/B | No |
| Reemplazo | CONFIRMED | Hasta cierre carga | P0-09A/B | No |

## Participación

| Decisión | Estado | Valor | Fuente | Bloquea |
|----------|--------|-------|--------|---------|
| FREE | CONFIRMED | precio 0, fee 0 BPS | P0-09A/B | No |
| 1 inscripción / 1 categoría / 1 foto | CONFIRMED | | P0-09A/B | No |
| Edad mínima | CONFIRMED | 16 años | P0-09B | No |
| Menores 16–17 | CONFIRMED | Autorización padre/madre/tutor obligatoria antes de confirmar | P0-09B | No |
| Residencia del participante | CONFIRMED BY ORGANIZER (ETAPA 05) | **No requerida** — participación abierta | ETAPA 05 | No |
| Territorio de la fotografía | CONFIRMED BY ORGANIZER (ETAPA 05) | Provincia de Santa Fe (declaración + revisión) | ETAPA 05 | No |

## Categorías / archivo / metadata / edición / IA

| Decisión | Estado | Valor | Bloquea |
|----------|--------|-------|---------|
| 4 categorías + ARGRA + dron | CONFIRMED | | No |
| Sin límites reglamentarios peso/dims | CONFIRMED | solo safety interno | No |
| Metadata RECOMMENDED; sin EXIF ≠ rechazo | CONFIRMED | | No |
| Revelado + máscaras OK; fotomontaje prohibido | CONFIRMED | | No |
| IA generativa prohibida; asistida OK | CONFIRMED | | No |

## Derechos / licencia

| Decisión | Estado | Valor | Bloquea |
|----------|--------|-------|---------|
| Licencia comercial 12 meses, exclusiva, gratuita, todas las obras | CONFIRMED (técnico) | | Parcial |
| Archivo patrimonial permanente (seleccionadas) | CONFIRMED (técnico) | separado | Parcial |
| Revisión jurídica | PENDING | `legalReviewStatus=PENDING` en borradores SF | **Sí** para publicación productiva |

## Premios y jurado

| Decisión | Estado | Valor | Bloquea |
|----------|--------|-------|---------|
| Premios 500/400/300k ARS + menciones | CONFIRMED | | No |
| Máximo 5 jurados (efectivos configurables) | CONFIRMED | | No |
| Anónimo + COI + fallo definitivo | CONFIRMED | | No |

## Bases oficiales (texto)

| Decisión | Estado | Valor | Bloquea |
|----------|--------|-------|---------|
| Borrador P0-09B alineado a config | CONFIRMED (borrador) | seed/acción admin | No (como borrador) |
| Texto legal definitivo publicado | PENDING HUMAN / LEGAL | requiere APPROVED + legal REVIEWED | **Sí** apertura |

## Infra / ops

| Decisión | Estado | Bloquea |
|----------|--------|---------|
| R2 staging real | DONE (ETAPA 04C/04D) | No (staging) |
| Email staging | BLOCKED | **Sí** GO estricto |

### Bloqueadores apertura

1. Revisión jurídica de licencia → `REVIEWED`  
2. Publicación de bases APPROVED  
3. R2 + email staging  
4. E2E browser  
