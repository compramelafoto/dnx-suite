# Staging authenticated validation report

**Palabra clave:** `Clickatón UX`  
**URL:** `https://clickaton-staging.vercel.app`  
**Deployment:** `dpl_B5EDq4UE5FJ5R2yKS7NSj45zNLKr`  
**Estado:** `PARTIAL`  
**Actualizado:** Imp. 05 (2026-08-01)

## Fixtures

Solo `TEST UX` (`.local/clickaton-ux-staging/credentials.json`, gitignored). Sin usuarios reales.

## Participante

| Paso | Resultado |
|------|-----------|
| Login | PASS (sesión Mi cuenta) |
| Mi cuenta | H1 «Hola, TEST UX Participante Confirmado» |
| Detalle | H1 «Inscripción de TEST UX Confirmado» |
| Pago / confirmado | Copy de inscripción confirmada (sin QR si falta credential) |
| Empty fixture | sin link a detalle |
| Logout | disponible en shell admin; participante no revalidado aparte |

## Admin

| Paso | Resultado |
|------|-----------|
| Login | PASS → panel |
| Dashboard | H1 «Inicio del panel» |
| Inscripciones | 200 |
| cuenta-owner | 200 empty state |
| Finanzas partner | 200 (canónica) |
| Integraciones / Diagnóstico | 200 |
| Logout | control presente → `/` |

## Sin permisos

| Paso | Resultado |
|------|-----------|
| `/admin` / cuenta-owner | Acceso denegado · sin datos financieros |

## E2E

`auth-staging` + `public-ux-smoke` + `env-smoke` con fixtures: **30 PASS**.

## Revisiones

`LEGAL_REVIEW` · `FINANCE_REVIEW` · `COMMERCIAL_REVIEW`
