# Clickatón — Inscripción sin registro previo (identidad post-pago)

**Fecha:** 2026-07-29  
**Etapa:** 10B.6.1  
**Estado:** Implementación guest identity en código (10C) — `userId` nullable en reserva; vínculo post-pago vía `resolveOrCreateUser`. Ver `CLICKATON_REGISTRATION_CHECKOUT_CURRENT_STATE.md`.

---

## Principio

Los participantes de Clickatón son **fotógrafos / participantes**, no “clientes” genéricos por el hecho de pagar.

El CTA público de una edición debe ser:

```text
INSCRIBIRME
```

No:

```text
CREAR CUENTA PARA INSCRIBIRME
```

El registro previo **no** es requisito comercial.

---

## Flujo objetivo

```text
Maratón → Inscribirme → completar inscripción → pagar
                ↓
              EMAIL
                ↓
         PAGO APROBADO
                ↓
        ¿EXISTE User DNX?
         ↙           ↘
       SÍ             NO
        ↓               ↓
    VINCULAR      CREAR/PREPARAR identidad
        ↓               ↓
        mismo User.id DNX
                ↓
     ACTIVAR / ACCEDER A CUENTA
     (establecer contraseña o vincular Google)
```

### Reglas

| Caso | Acción |
| ---- | ------ |
| Ya existe User DNX (email normalizado) | Vincular `ClickatonRegistration.userId` al canónico. No crear User. No cambiar contraseña. No cambiar roles de otras apps. |
| No existe User | Crear/preparar vía `@repo/auth` (`resolveOrCreateUser` / flujo de activación). **No** generar contraseña silenciosa ni temporal. Enviar activación; permitir set password o Google. |
| Ya logueado al inscribirse | Precargar datos seguros; pedir solo campos de inscripción. |
| Guest checkout | Permitir completar + pagar; resolver identidad **después** del pago aprobado (o al confirmar email según contrato). |

---

## Modelo preferido

```text
User  (identidad DNX central)
 └── ClickatonRegistration[]   (dominio inscripción / edición / pago / QR)
      └── ClickatonParticipantCredential / QR / check-in
```

Snapshots de participante viven en la Registration (nombre, Instagram, foto, ciudad, consentimientos).  
No existe ni debe crearse `ClickatonUser`.

`ClickatonParticipantCredential` = acreditación/QR de una inscripción, no una cuenta.

Rol de producto: membership/perfil Clickatón de **participante/fotógrafo**, no `CUSTOMER` como concepto de negocio (aunque el enum técnico de bootstrap pueda reutilizarse hasta normalizar ApplicationMembership).

---

## Relación con auth UX

- Login/crear cuenta siguen el sistema `@repo/auth` + futuro `@repo/auth-ui`.  
- La inscripción **no** obliga a pasar por crear cuenta primero.  
- Tras pago, el mensaje debe invitar a “activar / acceder a tu Cuenta DNX”, no a “volver a registrarte”.

---

## Fuera de alcance de esta nota

- Implementar el checkout guest end-to-end.  
- Abrir inscripciones o Mercado Pago LIVE.  
- Rollout `@repo/auth-ui`.

Prerrequisito: `DNX UNIVERSAL ACCOUNT READY IN STAGING`.
