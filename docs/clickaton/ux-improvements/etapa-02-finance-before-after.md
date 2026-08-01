# Antes / después — Finanzas y Mercado Pago (Etapa 02 Imp. 03)

---

## Collector

**Antes:** “Reconectar la cuenta collector…”, “Cuenta collector owner”.  
**Después:** “Cuenta que recibirá los pagos”, “Cuenta receptora”.

---

## OAuth

**Antes:** “Estado OAuth: ACTIVE”, “Inicia el consentimiento OAuth LIVE”.  
**Después:** “Estado de la conexión: Cuenta conectada”, “Serás redirigido a Mercado Pago…”.

---

## PKCE

**Antes:** “PKCE en authorize: ON/OFF” + nombres de env en UI.  
**Después:** Solo en Información técnica como “Protección de autorización (PKCE)”.

---

## Webhook

**Antes:** “Webhook: listo / no listo”, “Webhook unhealthy”.  
**Después:** “Actualizaciones automáticas de pagos” / “Clickatón no está recibiendo correctamente las actualizaciones…”.

---

## Split

**Antes:** “Modalidad… collector OAuth… No hay split multi-receptor…”.  
**Después:** “Distribución de los pagos” + “Tammy recibirá el 100 %…” cuando aplica.

---

## Ledger

**Antes:** “Ledger completo: pendiente” en readiness principal.  
**Después:** Solo en Información técnica (“Registro contable interno”).

---

## Reconciliación

**Antes:** “Reconciliación de pagos” / “Órdenes pendientes de reconcile”.  
**Después:** “Verificación de pagos” + estados “Sin diferencias” / “Pendiente de verificación”.

---

## Cuenta conectada / desconectada

**Antes:** enums `ACTIVE` / `NOT_CONNECTED` / `REVOKED`.  
**Después:** “Cuenta conectada” / “Sin conectar” / “Cuenta desconectada” + próximo paso.

---

## Distribución

**Antes:** “Versión ACTIVE”, “Activar”, “Recipient”, “Elegí cuenta ACTIVE”.  
**Después:** “Distribución publicada”, “Publicar distribución”, “Cuenta receptora”, “Guardar configuración”.

---

## Totales

No había panel de totales cobrados en finanzas de edición. Se priorizó estado + distribución + checklist. Totales de cobro siguen en flujos de inscripción / diagnóstico de verificación.

---

## Errores

**Antes:** posible `invalid_grant` / códigos crudos.  
**Después:** “La conexión con Mercado Pago necesita actualizarse…”; referencia técnica secundaria si existe.

---

## Alertas

**Antes:** lista cruda del gate con `bps=` / `ACTIVE`.  
**Después:** blockers humanizados + “Próximo paso”.

---

## Información técnica

**Antes:** mezclada en el primer viewport (IDs, env, PKCE).  
**Después:** `AdminTechnicalInfo` cerrado por defecto.

---

## Vista móvil

**Antes:** tabla de allocations con overflow; botones en fila.  
**Después:** cards de distribución; CTAs full-width; checklist apilada.
