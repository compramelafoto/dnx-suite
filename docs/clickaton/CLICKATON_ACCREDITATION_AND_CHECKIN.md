# Clickatón — Acreditación presencial, QR, check-in y kit (Etapa 12)

**Fecha:** 2026-07-28  
**Edición:** Clickatón Argentina 2026 — TZ `America/Argentina/Cordoba`  
**Alcance:** desk de acreditación + kit por ítem; sin jurado/ranking. **Operación LIVE deshabilitada por defecto** (`accreditationEnabled=false`).

Docs relacionadas: `CLICKATON_TIMELINE_AND_PARTICIPANT_EXPERIENCE.md` · `CLICKATON_PHOTO_UPLOAD_EXIF_GPS.md` · `CLICKATON_FOTORANK_SYNC.md` · `REGISTRATION_QR_CHECKIN_KIT_AUDIT_10D1.md`

---

## 1. Arquitectura actual

| Pieza | Ubicación | Rol |
|---|---|---|
| QR HMAC regenerable | `lib/registration/security/qr-token.ts` | Token opaco; solo hash en DB |
| Credencial / QR token | `ClickatonParticipantCredential` + `ClickatonQrToken` | Emisión / revocación |
| Check-in | `ClickatonCheckIn` (+ campos Etapa 12) | Llegada idempotente |
| Kit | `ClickatonRegistrationItem.fulfillmentStatus` | Entrega por ítem |
| Kit delivery (legacy) | `ClickatonKitDelivery` | Complementario; desk usa Item |
| Config | `ClickatonEditionAccreditationConfig` | Flags, identidad, geofence |
| Dispositivos | `ClickatonAccreditationDevice` | Token hash, revocación |
| Auditoría | `ClickatonAccreditationAudit` | Append-only |
| Offline queue | `ClickatonAccreditationOfflineEvent` | Sync diferida |
| Timeline | `ACCREDITATION_OPEN` / `ACCREDITATION_CLOSE` | Ventana |
| Grants | `ClickatonEditionCapabilityGrant` | Permisos por edición |
| Dominio | `apps/clickaton/lib/accreditation/` | Scan, check-in, kit, offline |
| Panel | `/admin/ediciones/[id]/acreditacion` | KPIs + dispositivos |
| Scanner | `.../acreditacion/escanear` | Cámara + manual + kit |
| Dashboard participante | `/mi-cuenta/inscripciones/[id]` | Estado acreditación |

**DNX Suite:** no hay paquete genérico de check-in/offline reutilizable; se reutiliza QR/credencial/check-in/kit/timeline de Clickatón + grants. No se duplicó un segundo sistema.

---

## 2. QR existente (seguro)

- Propósito: `clickaton:qr:v1`
- Plaintext: HMAC-SHA256 (base64url, 43 chars) sobre `registrationId:credentialId`
- Persistido: solo `tokenHash` (SHA-256 del plaintext) + prefijo corto
- **No** incluye nombre, email, documento, pago, talle, IDs incrementales
- Regenerable con el mismo secreto; revocable invalidando `ClickatonQrToken`
- Código corto de respaldo: búsqueda por número / prefijo con rate limit + aislamiento por edición
- Distinción de propósito: este token es **acreditación/credencial de participante**; no reutilizar para consignas/accesos sin política explícita

Amenazas mitigadas: enumeración trivial, PII en QR, URL predecible. Mitigaciones pendientes operativas: rate limit HTTP agresivo en prod, rotación de secreto documentada, detección de QR compartido (doble scan → BLUE).

---

## 3. Gaps previos → cierre Etapa 12

| Gap | Resolución |
|---|---|
| Check-in sin API/UI desk | APIs scan/check-in/offline/export + panel + scanner |
| Sin CLOSE timeline | Evento `ACCREDITATION_CLOSE` en seed/engine |
| Free/`NOT_REQUIRED` no elegible | `post-payment-eligibility` + `isPaidForAccreditation` |
| Sin dispositivos / offline | Modelos + cola + sync |
| Kit acoplado mentalmente al check-in | Entrega por ítem independiente |
| Stock 10k placeholder | Reporte operativo; `configuredPhysicalStock=null` |

---

## 4. Modelo

### Reutilizado
- `ClickatonCheckIn` (fuente de “acreditación activa”)
- `ClickatonRegistration` / `ClickatonQrToken` / `ClickatonParticipantCredential`
- `ClickatonRegistrationItem` (kit)
- Timeline events / capability grants

### Nuevo
- `ClickatonEditionAccreditationConfig`
- `ClickatonAccreditationDevice`
- `ClickatonAccreditationAudit`
- `ClickatonAccreditationOfflineEvent`
- Extensiones en `ClickatonCheckIn`: device, identity, exception, timeline snapshot, onlineMode, geo opcional, notes
- Fuentes check-in: `PARTICIPANT_NUMBER`, `DOCUMENT_SEARCH`, `OFFLINE_SYNC`

Migración: `packages/db/prisma/migrations/20260728121000_clickaton_accreditation/migration.sql`

---

## 5. Flujo propuesto (operación)

1. Operador abre scanner (permiso `canCheckInParticipants`)
2. Escanea QR / código corto / número → backend valida token + edición + pago + ventana
3. UI tono GREEN/YELLOW/RED/BLUE (+ texto/ícono)
4. Confirma check-in con `requestId` (idempotente)
5. Verifica identidad según `identityMode` (MVP: VISUAL → VERIFIED/MISMATCH/EXCEPTION)
6. Entrega ítems de kit uno a uno (no automático)
7. Eventos offline se encolan y sincronizan; backend decide

---

## 6. Ventana temporal

- Fuente: timeline Etapa 10 (`canCheckIn`)
- Antes de OPEN / después de CLOSE: bloqueo por defecto
- Excepción: `canGrantAccreditationException` + motivo auditado
- Snapshot de versión timeline en check-in
- Desplazamiento futuro: nuevas ops usan versión ACTIVE; check-ins previos permanecen

---

## 7. Permisos

| Capability | Uso |
|---|---|
| `canViewEditionAccreditation` | Panel / export |
| `canCheckInParticipants` | Scan + check-in |
| `canVerifyParticipantIdentity` | Identidad |
| `canDeliverEditionKit` | Entrega ítem |
| `canReverseAccreditation` | Reversión |
| `canGrantAccreditationException` | Fuera de ventana / pago pendiente auditado |
| `canManageAccreditationDevices` | Alta/revocación dispositivos |

Daniel: grants totales vía seed/actor. Tammy/Rodrigo: grants configurables en seed (no hardcode por email en actions). Voluntario: subset (scan/check-in/kit) sin finanzas.

---

## 8. Dispositivos

- Token mostrado una vez al registrar; DB solo `deviceTokenHash`
- Estados: ACTIVE / REVOKED / LOST / DISABLED
- Limitados a `editionId`; revocables; lastSeen/lastSync

---

## 9. Offline limitado

Cola `ClickatonAccreditationOfflineEvent`: acción, hash hint, hora cliente, idempotency key.  
Al sync: backend valida pago/token/ventana/duplicado. Reloj local no determina validez.  
Estados: PENDING / SYNCED / CONFLICT / REJECTED.  
Cache local de roster: **no implementada como fuente de verdad**; documentada como opcional futura (mínima, con expiración, sin PII financiera).

---

## 10. Identidad

Config por edición: `NOT_REQUIRED | VISUAL | DOCUMENT | CODE | CONTROL_QUESTION | MANUAL_REVIEW` (enum).  
MVP: registra tipo, resultado, actor, fecha, nota. **Sin imágenes de documento.**

---

## 11. Kit y remera

- Check-in ≠ entrega
- Estados ítem: PENDING / READY / DELIVERED / NOT_AVAILABLE / CANCELLED
- Scanner muestra talle y permite “Entregar” por ítem
- Reversión de entrega: acción auditada (permiso kit + reverse según política)

---

## 12. Stock operativo

Panel muestra reservadas/entregadas/pendientes **por talle**.  
`configuredPhysicalStock = null` hasta carga real. Placeholder 10.000 **no productivo**.

---

## 13. Geofence

Modos: OFF / OPTIONAL / REQUIRED_FOR_DEVICE / MANUAL_REVIEW.  
Seed: OFF, sin coordenadas inventadas. GPS del participante no es obligatorio.

---

## 14. Credencial preview

Plantilla `clickaton.credential.preview` en `@repo/media-composition` (separada de welcome story).  
Helper `lib/accreditation/credential-preview.ts`. **No** emisión productiva automática.

---

## 15. FotoRank

Check-in escribe auditoría `FOTORANK_CHECKIN_HINT` (soft). Fallo FR no bloquea. No altera pago ni duplica participantes ni abre entries fuera de timeline.

---

## 16. Excepciones

Pago pendiente, QR perdido, llegada tarde, identidad dudosa, etc. → permiso + motivo + auditoría.  
**No** marcar PAID desde acreditación.

---

## 17. Exportación

CSV admin: número, nombre, Instagram, pago, acreditación, hora, identidad, talle, entrega, FotoRank.  
Sin dependencia XLS nueva.

---

## 18. Seguridad

- QR opaco + hash-only
- Aislamiento por edición
- Grants (no email hardcode en actions)
- Tokens de dispositivo hasheados
- Auditoría append-only sin secretos
- Idempotencia `requestId`
- Doble scan → BLUE, no segunda acreditación
- Offline no es fuente de verdad

---

## 19. Seed

Idempotente Argentina 2026:

- `accreditationEnabled=false`
- `geofenceMode=OFF`
- Grants de acreditación a actor Daniel + Tammy/Rodrigo si existen
- Timeline con `ACCREDITATION_CLOSE`
- Sin horarios/coords/stock/operadores productivos inventados

---

## 20. Tests

```bash
pnpm --filter clickaton selfcheck:accreditation
pnpm --filter clickaton selfcheck:qr-token
pnpm --filter clickaton selfcheck:timeline
pnpm --filter clickaton selfcheck:photo-upload
pnpm --filter clickaton lint
pnpm --filter clickaton check-types
```

---

## 21. Operación del evento / contingencias

- Credenciales impresas + QR en celular + código corto
- Dispositivos de backup; revocar robados
- Cola offline si hay corte; reconciliar al recuperar
- Excepciones con supervisor
- No autoacreditación por kiosco en esta etapa

---

## 22. Pendientes (fuera de cierre Etapa 12)

- Stock físico real por variante
- Impresoras / credencial productiva aprobada
- Kiosco de autoacreditación
- Cache roster offline cifrada
- **Etapa 13 (hecha):** admisión técnica — `CLICKATON_TECHNICAL_ADMISSION.md`
- **Etapa 14 (hecha):** jurado / rúbricas / scoring anónimo — `CLICKATON_JURY_SCORING.md` (sin ranking LIVE)
- Ranking / resultados / premiación → Etapa 15+
