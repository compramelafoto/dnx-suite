# Clasificación de tablas — Cutover Clickatón Staging (10B.6)

Fuente: `packages/db/prisma/schema.prisma` + health origen.

---

## A. Identidad central (NO copiar hashes/sesiones como fuente)

Usar solo la DB destino compartida:

| Tabla / concepto | Acción |
| ---------------- | ------ |
| `User` | Reconciliar vía mapa → `ClickatonLegacyUserMap` |
| `User.password` / googleId | Migrar seguro o CREATE_CANONICAL |
| `UserSession` | **No importar** — revocar; nuevo login |
| `PasswordResetToken` | No importar tokens vivos |
| `EmailVerificationToken` | No importar tokens vivos |
| `DnxUserProfile` | Crear/actualizar en destino si aplica |
| `DnxFinancialIdentity` / `DnxPaymentAccount` | No duplicar; grants Clickatón sobre User canónico |
| `InfoSpotUserRole` | No tocar desde cutover Clickatón |
| `FotorankJudgeAccount` | Fuera de alcance (paralelo) |

Nueva en destino:

| Tabla | Uso |
| ----- | --- |
| `ClickatonLegacyUserMap` | sourceUserId → canonicalUserId |
| `UserIdentityAlias` | fusiones permanentes |

---

## B. Dominio Clickatón (preservar / importar)

| Modelo | Notas |
| ------ | ----- |
| `ClickatonEdition` | **6** en origen vivo — crítico |
| `ClickatonRegistrationPricePhase` / `ClickatonPricePhaseItem` | fases/precios |
| `ClickatonVenue` | sedes |
| `ClickatonEditionSequence` | numeración |
| `ClickatonTicketType` / `ClickatonTicketTypeItem` | tickets |
| `ClickatonProduct` / `ClickatonProductMedia` / `ClickatonProductVariant` | store |
| `ClickatonInventoryMovement` / `ClickatonStockHold` | stock |
| `ClickatonRegistration` / `ClickatonRegistrationItem` | inscripciones |
| `ClickatonCapacityHold` | holds |
| `ClickatonParticipantCredential` / `ClickatonQrToken` | credenciales |
| `ClickatonCheckIn` / kit delivery* | acreditación |
| `ClickatonEditionTimeline` / events / prompts / audits | timeline |
| `ClickatonEditionUploadConfig` / photo submissions* | upload |
| `ClickatonEditionAdmissionConfig` / admission* | admisión técnica |
| `ClickatonEditionAccreditationConfig` / devices / audits / offline | acreditación |
| `ClickatonEditionCapabilityGrant` | **reescribir userId** |
| `ClickatonEditionFinanceAudit` | **reescribir actorUserId** |
| `ClickatonFotoRankSync` | config sync |
| `ClickatonIntegrationOutboxEvent` | outbox |
| `ClickatonRegistrationStatusHistory` / `ClickatonRegistrationAudit` | **actor FKs** |
| `ClickatonContactMessage` | contacto |
| Welcome cards / social publisher tables (si existen en schema) | importar si dominio |

---

## C. Transversales (revisión cuidadosa)

| Área | Acción |
| ---- | ------ |
| Payments / FI | No copiar tokens; verificar grants sobre User canónico |
| Notifications / outbox genérico | Solo si referencian ediciones Clickatón |
| Storage keys / media metadata | Reescribir owners a canonicalUserId |
| Audit logs | Preferir conservar con userId mapeado |

---

## D. Legacy / descartables

| Ítem | Evidencia |
| ---- | --------- |
| Sesiones `UserSession` origen | Descartar — política de re-login |
| Tokens reset/verify origen | Descartar |
| `_prisma_migrations` origen | **No copiar** — destino aplica migraciones propias |
| Seeds/técnicos sin email válido | `TECHNICAL_USER` / `INVALID` |

---

## Orden de import sugerido

1. migrate deploy destino  
2. mapa usuarios + altas canónicas  
3. ediciones  
4. fases / venues / sequence  
5. productos / variantes / media  
6. tickets / price phase items  
7. memberships / capability grants (FK rewrite)  
8. inscripciones / holds / credentials  
9. timeline / prompts / upload / admission / accreditation  
10. FotoRank sync / outbox / audits  
11. integridad + smoke  
