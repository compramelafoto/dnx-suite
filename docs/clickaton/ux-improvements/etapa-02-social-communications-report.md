# Etapa 02 Imp. 08 — Placas, redes sociales y comunicaciones

**Estado:** DONE (con riesgos legales documentados)  
**Fecha:** 2026-08-01  
**Alcance:** presentación UX de placas, credenciales/QR, cola social y correos.  
**No modificado:** plantillas, render, R2, Resend, webhooks, Meta/Instagram APIs, publisher worker, flags, jobs, programación real, estados persistidos, permisos, APIs.

---

## Rutas intervenidas

| Ruta | Cambio |
|---|---|
| `/admin/social` | Título, LIVE banner, filtros ES, cards, confirms, técnico |
| `/admin/inscripciones/[registrationId]` | Placa generate/regenerate, Instagram, reenvío con confirm |
| `/admin/ediciones/[editionId]/acreditacion` | KPIs y ventana humanizados |
| `/admin/ediciones/[editionId]/acreditacion/escanear` | “Escanear credencial” |
| `/admin/integraciones/diagnostico` | Estados de correo humanizados |
| `/mi-cuenta/inscripciones/[id]` | Copy QR/credencial |
| Nav admin | “Publicaciones en redes” |

---

## Componentes modificados / creados

**Modificados:** `social/page.tsx`, detalle inscripción, acreditación + scanner, diagnóstico, `WelcomeCardShareCard`, `CredentialPrintActions`, `admin-status-presentation` (email/publicación), `navigation.ts`.

**Creados:**
- `lib/social-communications/ui/social-communications-status-presentation.ts`
- test + docs (`etapa-02-social-before-after.md`, `social-communications-status-map.md`, `social-sensitive-actions.md`)

---

## Estados traducidos

Ver `social-communications-status-map.md`. Cobertura: placa admin, publicación social (incl. PENDING_APPROVAL/APPROVED/REJECTED/CANCELLED/NOT_SCHEDULED), email SENT≠DELIVERED, motivos de acreditación, modo LIVE.

---

## Placas / generar vs regenerar

- Primera vez: **Generar placa**
- Existente: **Volver a generar** + **Volver a intentar la generación**
- Confirms con consecuencias; no se afirma publicación automática

## Credenciales / QR

- “Código QR de acreditación”, “Escanear credencial”, “Imprimir credencial”
- Explicación de uso en sede; sin contenido interno del QR como dato principal

## Redes / LIVE

- Banner operativo según `DNX_SOCIAL_PUBLISHER_LIVE === "true"`
- Sin “Publicar ahora” cuando LIVE está off
- Historia para WELCOME_CARD; texto de publicación visible; IDs en técnico

## Correos

- Enviado vs entregado diferenciados
- Rebotes humanizados; detalle crudo en técnico
- Reenviar con aviso de duplicación

## Responsive

Cards de una columna; preview Story `aspect-[9/16]`; botones `min-h-11`; filtros apilados; técnico colapsado.

## Pruebas

| Comando | Resultado |
|---|---|
| `test:social-communications-ux` | PASS (13) |
| `selfcheck:welcome-card` | PASS |
| `selfcheck:social-publisher` | PASS |
| `selfcheck:email-idempotency` | PASS |
| `selfcheck:accreditation` / `qr-token` | PASS |
| ESLint archivos modificados | PASS |
| `tsc --noEmit` | Sin errores en alcance Imp. 08; avisos previos en `resend-webhook/readiness.test.ts` |
| `npm run build` | PASS |
| E2E | No ejecutados (sin entorno E2E dedicado) |

## Riesgos / `LEGAL_REVIEW`

Ver `social-sensitive-actions.md`. Consentimiento imagen/Instagram/etiquetado/publicación colaborativa no reescrito.
