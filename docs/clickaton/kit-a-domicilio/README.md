# Envío del kit de Clickatón a domicilio

Para quien vive **fuera de la ciudad de la edición** (Rosario). Paga un costo fijo de
envío ($10.000) además de la inscripción. No hay integración con ninguna empresa de
correo: el kit se despacha a mano.

## Cómo funciona

1. **Inscripción.** En el paso de datos aparece "Vivo fuera de Rosario: quiero recibir
   el kit en mi casa (+$10.000)". Al marcarlo se piden quién recibe, DNI, teléfono,
   calle, altura, piso, código postal, localidad, provincia y referencias.
   - Un domicilio en Rosario se rechaza (se compara con la ciudad y provincia de la edición).
   - El envío se suma **después** de cupones y referidos: ningún descuento lo toca.
   - No se combina con el canje de crédito del Pack (se coordina aparte).
2. **Fecha garantizada.** Hasta el 12/12 inclusive se promete que el kit llega antes de
   la maratón. Después se sigue vendiendo con envío, con un aviso de que puede no llegar
   a tiempo; la persona participa igual.
3. **Despacho.** En el panel: `Ediciones → <edición> → Kits a domicilio`. Se ve el
   domicilio de cada inscripción **pagada**, y se marca "despachado" con el correo y el
   número de seguimiento. Opcionalmente se le avisa por email.
4. **Acreditación.** Todos los instructivos llevan **el mismo QR**
   (`qr-recibi-mi-kit.png` / `.svg` en esta carpeta), que abre
   `https://maratonfotografica.com/recibi-mi-kit`. La persona inicia sesión con el email
   de la inscripción y toca "Recibí mi kit · acreditarme". Queda acreditada (puede entrar
   a la pantalla de la maratón), el envío pasa a "Recibido" y los artículos del kit quedan
   entregados.
   - No depende del interruptor de acreditación ni del horario del día del evento.
   - El QR no identifica a nadie: identifica la sesión. Por eso puede ser igual para todos.

## Configuración

En la misma pantalla del panel: encender/apagar, costo en pesos y fecha de llegada
garantizada. Sin configuración, la edición no ofrece envío.

## Base de datos

Migración `20261001120000_clickaton_kit_a_domicilio`: dos tablas nuevas
(`ClickatonEditionHomeDelivery`, `ClickatonRegistrationShipping`), un tipo nuevo y el
valor `KIT_SELF_CONFIRM` en `ClickatonCheckInSource`. Sólo agrega; es idempotente.

## Texto sugerido para el instructivo

> **¡Llegó tu kit de Clickatón!**
> Escaneá este QR, iniciá sesión con el email con el que te inscribiste y tocá
> "Recibí mi kit". Con eso quedás acreditado: no tenés que ir a ninguna sede.
> ¿No podés escanear? Entrá a maratonfotografica.com/recibi-mi-kit
