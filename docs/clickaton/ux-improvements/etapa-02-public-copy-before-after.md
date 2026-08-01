# Etapa 02 — Copy público: antes / después

Ejemplos representativos de la humanización de textos.

---

## Mi cuenta — listado

| | |
|---|---|
| **Pantalla** | `/mi-cuenta` |
| **Antes** | Badge `CONFIRMED` · `Pago: APPROVED` · «Soporte TEST» |
| **Después** | Badge «Inscripción confirmada» · «Pago: Pago recibido» · ayuda de contacto |
| **Motivo** | El participante no debe leer enums ni jerga de staging |

---

## Mi inscripción — gate sin credencial

| | |
|---|---|
| **Pantalla** | `/mi-cuenta/inscripciones/[id]` |
| **Antes** | «La inscripción debe estar confirmada por el backend… Estado: PENDING_PAYMENT · Pago: PENDING» |
| **Después** | «Pago pendiente» + explicación + «Ir al resumen y pago» |
| **Motivo** | Evitar “backend” y estados crudos; indicar próximo paso |

---

## Resumen / checkout

| | |
|---|---|
| **Pantalla** | `…/inscripcion/resumen/[registrationId]` |
| **Antes** | «Estado: PENDING PAYMENT · Cobro: PENDING» · «vía DNX Payments» · «webhook/reconciliación» |
| **Después** | Tarjeta de estado humano · «pago seguro… Mercado Pago» · aviso de no pagar dos veces |
| **Motivo** | Checkout comprensible; sin infraestructura interna |

---

## Botón de pago

| | |
|---|---|
| **Componente** | `CheckoutPayButton` |
| **Antes** | «Continuar al pago» / «Pagar (TEST)» |
| **Después** | «Pagar con Mercado Pago» / «Pagar (entorno de prueba)» / «Confirmar inscripción gratuita» |
| **Motivo** | Acción concreta según escenario |

---

## Card Brick (banner)

| | |
|---|---|
| **Componente** | `CardPaymentBrickCheckout` |
| **Antes** | «Card Payment Brick + Orders Split 1:N… webhook/reconciliación» |
| **Después** | «Entorno de prueba… no realices un segundo pago mientras verificamos la operación.» |
| **Motivo** | P0 de jerga técnica en superficie pública |

---

## Postpago pendiente / error

| | |
|---|---|
| **Pantalla** | `PaymentReturnView` (no confirmado) |
| **Antes** | «Retorno de checkout» + estados con `_` · código de error crudo |
| **Después** | «Estamos verificando el pago» / «El pago no pudo completarse» + CTAs diferenciados |
| **Motivo** | Evitar doble cobro; mensajes orientados a la acción |

---

## Postpago confirmado

| | |
|---|---|
| **Pantalla** | `PaymentReturnView` (confirmado) |
| **Antes** | `¡TU INSCRIPCIÓN ESTÁ CONFIRMADA!` · `Estado CONFIRMED` · `CREAR / ACTIVAR MI CUENTA DNX` · flag `VENUE ADDRESS…` |
| **Después** | «Tu inscripción está confirmada» · label ES · «Creá tu cuenta para ver el QR» · sin flag técnico |
| **Motivo** | Tono cercano; sin marcas internas ni flags de configuración |

---

## Consentimiento (LEGAL_REVIEW)

| | |
|---|---|
| **Pantalla** | Wizard · paso participante |
| **Antes** | Checkbox corto «Acepto las bases…» (persiste múltiples consentimientos en silencio) |
| **Después** | Bloque «Consentimientos y autorizaciones» con lista de conceptos + mismos flags persistidos |
| **Motivo** | Mejorar comprensión **sin** cambiar alcance legal |

---

## Placa de bienvenida

| | |
|---|---|
| **Componente** | `WelcomeCardShareCard` |
| **Antes** | `Estado: GENERATED` / `FAILED` / `PENDIENTE` |
| **Después** | «Lista para compartir» / «No pudimos generar la placa» / «Generando tu placa» |
| **Motivo** | Estados públicos en español |
