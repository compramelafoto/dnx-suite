# 09 — Revisión legal / humana (clasificación)

**Fecha:** 2026-07-29  
**Alcance:** identificar superficies — **no** redactar documentos legales.  
**ACCIÓN LEGAL REQUERIDA AHORA:** **NO** (esta etapa es solo auditoría técnica).

---

## Clasificación

| Superficie | Legacy | Monorepo | Clase | Motivo |
|------------|--------|----------|-------|--------|
| Términos generales `/terminos` | Sí | Sí (misma estructura) | LEGAL_OK / LEGAL_REVISAR contenido | Paridad estructural; texto cliente embebido genérico — revisar humano antes de cutover público |
| Contrato fotógrafos `lib/terms/photographerTerms*` | `2026-01-26` / v2 | `2026-07-21` / v3 **+ Info Spot** | **LEGAL_BLOQUEANTE** (divergencia) | Cutover con texto distinto a prod Legacy = riesgo contractual |
| Contrato laboratorio `labTerms.ts` | Sí | Sí SAME | LEGAL_OK | Sin divergencia detectada |
| Privacidad `/privacidad` + content | Sí | Sí SAME | LEGAL_REVISAR | Pack AAIP/bases/biometría — revisión humana periódica; no diverge mono↔legacy |
| Consentimiento biométrico / imagen | Páginas + content | SAME | LEGAL_REVISAR | Rekognition + retención — humano |
| Menores / escolar `/privacidad/escuelas` | Sí | Sí | LEGAL_REVISAR | Sin página `/menores` dedicada |
| Retención / ARCO solicitudes | Sí | Sí | LEGAL_OK operativa / LEGAL_REVISAR texto | Flujo presente |
| Condiciones de venta (checkout) | `checkout-terms` versionado | SAME | LEGAL_REVISAR | Apunta a `/terminos`+`/privacidad`; no página venta aparte |
| Devoluciones | Cláusulas embebidas “sin reembolsos” | SAME | LEGAL_REVISAR | Sin `/devoluciones` dedicada |
| Facturación | Sin página legal | SAME | LEGAL_REVISAR | Hueco en ambos |
| Contratos organizadores | Sin `organizadorTerms` dedicado | SAME | LEGAL_REVISAR | Gap producto legal (no divergencia) |
| Referidos `referralTerms.ts` | Sí | SAME | LEGAL_OK | |
| Datos enviados a Mercado Pago | Preference metadata + payer | SAME cobro | LEGAL_REVISAR | Informar en privacidad/términos qué viaja a MP |
| Conservación / eliminación fotos | Policies + crons cleanup | SAME | LEGAL_REVISAR | |
| Distribución fondos DNX Payments 1:N | N/A Legacy | Package futuro | LEGAL_REVISAR → futuro **LEGAL_BLOQUEANTE** pre-E12 | No bloquea cutover paridad; **sí** revisar antes de 1:N |

---

## ACCIÓN LEGAL AHORA

**NO**

Motivo: no se publica cutover ni se cambia texto contractual en esta etapa. Solo se documenta.

### Update ETAPA 02 (Panel Lab)

- `lib/terms/labTerms.ts` **no modificado** (IDENTICAL Legacy↔Mono, `v2`).
- Se migró solo el mecanismo técnico `POST /api/terms/accept` (sin cambiar texto).
- **LEGAL_REVISAR nuevo por Lab:** ninguno.

---

## ACCIÓN HUMANA (antes del cutover — no “ahora” de auditoría)

**SÍ** (programar antes de ETAPA 10), puntos:

1. **LEGAL_BLOQUEANTE:** decidir alineación términos fotógrafo (¿publicar Info Spot en Legacy primero o revertir mono a texto prod?).  
2. Revisar pack privacidad + biometría + escolares.  
3. Confirmar messaging de “sin reembolsos” / condiciones checkout.  
4. Validar OAuth redirects y dominio en consolas Google/MP (ops humano).  
5. Aprobar ventana cutover DNS + rollback.  
6. Diferir a post-E11 cualquier texto de distribución 1:N.

---

## APIs legales faltantes en Mono (técnico + compliance)

| API Legacy ausente en Mono | Impacto |
|----------------------------|---------|
| `/api/terms/accept` | Registro de aceptación |
| `/api/users/me/marketing-opt-in` | Marketing consent |
| `/api/users/me/revoke-face-consent` | Derechos imagen/biometría |

Clasificación técnica: P1 (ver `07`). Clasificación legal asociada: **LEGAL_REVISAR** hasta restaurar paridad de mecanismos.
