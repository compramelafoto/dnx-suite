# Recorrido de aceptación

*Los 31 pasos del capítulo 28. Estado al 2026-09-15.*

El lanzamiento no se aprueba hasta demostrar el recorrido entero. Esta es la lista con lo
que ya está demostrado y con **quién** tiene que demostrar el resto.

| | Estado | Qué falta |
|---|---|---|
| ✅ | Verificado en producción con datos reales | — |
| 🔧 | El código está y pasa sus tests, pero nunca se corrió de punta a punta | Una corrida |
| 👤 | Necesita una persona, un teléfono o plata de verdad | El titular |
| ⛔ | Bloqueado por configuración que falta | Variables en Vercel |

---

## La venta y el alta

| # | Paso | | Nota |
|---|---|---|---|
| 1 | El fotógrafo crea su cuenta | 🔧 | El login con Google funciona; falta hacerlo con una cuenta nueva |
| 2 | Configura su enlace permanente de venta | 🔧 | `/v/[slug]` existe |
| 3 | Un cliente registra su email y paga | ⛔ | Faltan las credenciales de Mercado Pago |
| 4 | El sistema crea el evento pagado | 🔧 | El webhook lo crea y es idempotente, con test |
| 5 | La configuración empieza recién después del pago | 🔧 | |

## La preparación del evento

| # | Paso | | Nota |
|---|---|---|---|
| 6 | Selecciona una plantilla | ✅ | Las seis, con test de contraste |
| 7 | Portada, activación y las 12 horas calculadas | ✅ | La vista previa del cierre se ve antes de confirmar |
| 8 | Prueba en modo DEMO sin arrancar la ventana real | 🔧 | |
| 9 | Genera el QR definitivo | ✅ | |
| 10 | Antes del horario, el QR no habilita cargas | ✅ | La ventana se verifica del lado del servidor |

## La noche

| # | Paso | | Nota |
|---|---|---|---|
| 11 | En el horario exacto el evento se activa | ✅ | |
| 12 | Un invitado escanea desde un celular real | 👤 | **Falta el teléfono de verdad** |
| 13 | Acepta condiciones y carga varias fotos | ✅ | El consentimiento se verifica en el servidor, no sólo en la pantalla |
| 14 | La carga sobrevive a una conexión imperfecta | ✅ | 100 fotos, 0 fallas, y la deduplicación reconoció una colisión real |
| 15 | La IA analiza cada fotografía | ✅ | 100 de 100, 308 ms de media |
| 16 | Las seguras se aprueban solas | ✅ | |
| 17 | Las dudosas se retienen y las de alto riesgo se bloquean | 🔧 | El motor está probado; **falta la parte 2** con fotos reales de eventos |
| 18 | Si la IA falla, nada se publica | 🔧 | **Falta la parte 3**: romper la credencial en producción |
| 19 | Sólo las aprobadas llegan a galería y pantalla | ✅ | |
| 20 | El operador pausa, avanza y oculta | 🔧 | |
| 21 | Se recupera un falso positivo con auditoría | 🔧 | |
| 22 | A las 12 horas se cierran las cargas | ✅ | |

## Después

| # | Paso | | Nota |
|---|---|---|---|
| 23 | Con la descarga comprada, recibe el enlace al otro día | ⛔ | Faltan las variables de Resend |
| 24 | Sin comprarla, recibe la secuencia sin duplicados | ⛔ | Ídem. El calendario y la unicidad están probados |
| 25 | Después del pago tardío, el paquete se genera y se entrega | ⛔ | |
| 26 | Al vencer el plazo se bloquea la venta y se borra | 🔧 | El candado está probado; el borrado real nunca corrió |

## Proveedores

| # | Paso | | Nota |
|---|---|---|---|
| 27 | El fotógrafo manda el enlace de proveedores | ✅ | |
| 28 | Un proveedor completa su ficha | ✅ | Probado en producción |
| 29 | **Se vincula sin duplicar una existente** | ✅ | Dos envíos, otro nombre, mismo CUIT: una sola empresa |
| 30 | Las acciones sensibles quedan auditadas | 🔧 | La moderación y el borrado escriben auditoría; falta revisar el resto |
| 31 | Los errores se explican y se puede recuperar | 🔧 | Auditado por pantalla; falta recorrerlo con alguien mirando |

---

## Lo que bloquea, en orden

1. **Las variables de Mercado Pago y de Resend.** Bloquean 5 pasos (3, 23, 24, 25 y buena
   parte del 26). Es lo primero.
2. **Un teléfono de verdad.** El paso 12 no se puede simular: el escaneo del QR, la cámara
   de iOS, el selector de fotos de Android.
3. **Fotos reales de eventos.** Las partes 2 y 3 de la prueba de moderación (capítulo 06)
   miden los falsos positivos, que es lo único que decide si el perfil SOCIAL sirve.

## Lo que ya no bloquea

Al 15 de septiembre estaban dados de baja tres riesgos que sí bloqueaban:

- **La regla anti-bypass** estaba escrita y no aplicada. Ahora el original no sale de
  ningún lado que no sea el ZIP pagado, verificado con 100 fotos.
- **`/api/diagnostico` estaba abierta** y publicaba el host de la base y el nombre del
  bucket, además de escribir en R2 en cada visita.
- **El resumen de carga mentía** cuando una foto fallaba: decía cuántas subieron y se
  callaba las caídas.
